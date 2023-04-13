import AWS from 'aws-sdk';
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { cronHelper, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export class InvoiceGeneratorService {
    async invoiceGenerator(event) {
        const promises = event.Records.map((message) => {
            return this.processInvoiceGenerator(message);
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

    async processInvoiceGenerator(event) {
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, Crons, Invoice, Payment } = db;

        let logMetadata = {
            location: 'MessagingService ~ invoiceGeneratorConsumer',
            awsRequestId: ''
        };

        try {
            let {
                customer_id,
                contract_rent,
                user_ip_address,
                specialRentData,
                cron_record_id,
                requestId,
                is_last,
                startTime
            } = JSON.parse(event.body);

            logMetadata.awsRequestId = requestId;

            specialRentData = JSON.parse(specialRentData);

            var cron_update_status = {};

            if (isNaN(contract_rent)) {
                var append_data = `${customer_id} - skipped as there is empty rent`;

                cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), append_data);

                await cronHelper.finish(cron_update_status, Crons, cron_record_id);

                logger.error(logMetadata, 'error', 'skipped as there is empty rent');

                sequelize.close && (await sequelize.close());
                return { event, success: true };
            }

            logger.info(logMetadata, 'specialRentData', specialRentData);

            var special_flag = '';
            await specialRentData.find(function (post) {
                if (post.customer_id == customer_id && post.rent_amount != '') {
                    contract_rent = post.rent_amount;
                    special_flag = ` (special # ${post.id})`;
                }
            });

            logger.info(logMetadata, 'Rent', contract_rent);

            await Invoice.create({
                customer_id: customer_id,
                date_sent: moment().tz(TIMEZONE).format('YYYY-MM-DD'),
                date_due: moment().tz(TIMEZONE).format('YYYY-MM-DD'),
                amount: contract_rent,
                week_id: moment().tz(TIMEZONE).format('W'),
                paid_status: '1',
                payment_method: 'online'
            });

            await Payment.create({
                customer_id: customer_id,
                ip: user_ip_address,
                firstname: 'merchant services',
                total: '-' + contract_rent,
                payed: '-' + contract_rent,
                withdraw_status: '1',
                payment_status: 'OK',
                week_no: moment().tz(TIMEZONE).format('W'),
                time: moment().tz(TIMEZONE).format('YYYY-MM-DD') + ' 00:00:00',
                year: moment().tz(TIMEZONE).format('Y'),
                month: moment().tz(TIMEZONE).format('M') - 1
            });

            var append_data_final = `${customer_id} - ${contract_rent} ${special_flag} <br>`;

            if (is_last) {
                append_data_final += `Time Execution: ${(Date.now() - startTime) / 1000} seconds`;
                cron_update_status['finished_at'] = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
                cron_update_status['status  '] = 'FINISHED';
            }

            cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), append_data_final);

            await cronHelper.finish(cron_update_status, Crons, cron_record_id);

            logger.info(logMetadata, 'customer id', customer_id);

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (e) {
            console.log(e);
            logger.error(logMetadata, '~ InvoiceGeneratorService ~ processInvoiceGenerator ~ ', e);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }
}
