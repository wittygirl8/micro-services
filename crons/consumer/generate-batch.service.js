import AWS from 'aws-sdk';
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { logHelpers, cronHelper } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export class GenerateBatchService {
    async generateBatch(event) {
        console.log(event);
        const promises = event.Records.map((message) => {
            return this.processGenerateBatch(message);
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async postProcessMessage(executions) {
        const hasAtLeastOneError = executions.some((result) => result.success === false);

        if (hasAtLeastOneError) {
            let options = {};

            if (process.env.IS_OFFLINE) {
                options = {
                    apiVersion: '2012-11-05',
                    region: 'localhost',
                    endpoint: 'http://0.0.0.0:9324',
                    sslEnabled: false
                };
            }
            const sqs = new AWS.SQS(options);

            const processSuccesItems = executions.filter((result) => result.success === true);

            for (let successMsg of processSuccesItems) {
                const params = {
                    QueueUrl: process.env.QUEUE_URL,
                    ReceiptHandle: successMsg.event.receiptHandle
                };

                try {
                    await sqs.deleteMessage(params).promise();
                } catch (error) {
                    // Do nothing, need to make the code idempotent in such case
                }
            }

            // For errors, lambda instance will not be available till visisibility timeout expires
            const processErrorItemsMsgIds = executions
                .filter((result) => result.success === false)
                .map((result) => result.event.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        } else {
            return { success: true };
        }
    }

    async processGenerateBatch(event) {
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, Payment, Batch, BatchItem, Crons } = db;

        let logMetadata = {
            location: 'MessagingService ~ generateBatchConsumer',
            awsRequestId: ''
        };

        try {
            let { requestId, withdrawRecord, cron_id, is_last, startTime } = JSON.parse(event.body);

            withdrawRecord = JSON.parse(withdrawRecord);

            logger.info(logMetadata, 'withdrawRecord', withdrawRecord);

            var cron_update_status = {};

            logMetadata.awsRequestId = requestId;

            var batchResult = await Batch.create({
                customer_id: withdrawRecord.customer_id,
                date_pending: withdrawRecord.time,
                week_no: moment().tz(TIMEZONE).format('W'),
                account_number: withdrawRecord.accountnumber,
                sort_code: withdrawRecord.sortcode,
                bank_name: withdrawRecord.bankname,
                account_holder: withdrawRecord.accountholder,
                date_sent: '',
                date_complete: ''
            });

            logger.info(logMetadata, 'batchResult', batchResult);

            var resultCardPaymentAll = await sequelize.query(
                `SELECT * FROM card_payment WHERE firstname='withdraw' AND delete_status='0' AND customer_id=${withdrawRecord.customer_id} AND withdraw_status = 1 AND payment_status != 'INBATCH' ORDER BY time ASC`
            );
            resultCardPaymentAll = resultCardPaymentAll ? resultCardPaymentAll[0] : [];
            logger.info(logMetadata, 'resultCardPaymentAll', resultCardPaymentAll);

            var totalAmount = 0;
            for (const cardPayment of resultCardPaymentAll) {
                logger.info(logMetadata, 'cardPayment', cardPayment);
                totalAmount = totalAmount + Number(cardPayment.total);

                await BatchItem.create({
                    batch_id: batchResult.batch_id,
                    card_payment_id: cardPayment.id,
                    customer_id: cardPayment.customer_id,
                    date_issued: cardPayment.time,
                    total: cardPayment.total,
                    not_received: 0
                });

                await Payment.update(
                    {
                        withdraw_status: 2,
                        payment_status: 'INBATCH'
                    },
                    { where: { id: cardPayment.id } }
                );
            }

            logger.info(logMetadata, 'totalAmount', totalAmount);

            await Batch.update(
                {
                    total: totalAmount.toFixed(2)
                },
                { where: { batch_id: batchResult.batch_id } }
            );

            var append_data_final = `${withdrawRecord.customer_id}<br>`;

            if (is_last) {
                cron_update_status['finished_at'] = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
                cron_update_status['status'] = 'FINISHED';
                append_data_final += ` Time Executed: ${(Date.now() - startTime) / 1000} seconds`;
            }
            cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), append_data_final);

            await cronHelper.finish(cron_update_status, Crons, cron_id);

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (e) {
            logger.error(logMetadata, '~ GenerateBatchService ~ processGenerateBatch ~ ', e);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }
}
