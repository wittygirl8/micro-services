import AWS from 'aws-sdk';
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { cronHelper, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export class InternalTransferService {
    async internalTransfer(event) {
        const promises = event.Records.map((message) => {
            return this.processInternalTransfer(message);
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

    async processInternalTransfer(event) {
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, Crons, InternalTransferTransaction, InternalTransferAudit } = db;

        let logMetadata = {
            location: 'MessagingService ~ internalTransferCompleteConsumer'
        };

        try {
            let { ref, startTime, cron_record_id, is_last } = JSON.parse(event.body);

            logger.info(logMetadata, 'Ref', ref);
            logger.info(logMetadata, 'cronRecordID', cron_record_id);

            var internalTResult = await InternalTransferTransaction.update(
                {
                    status: 'COMPLETE'
                },
                {
                    where: {
                        ref: ref
                    }
                }
            );

            var internalAudiResult = await InternalTransferAudit.create({
                table_changed: 'TRANSACTION',
                attribute_changed: 'STATUS',
                attribute_new_value: 'COMPLETE',
                internal_transfer_ref: ref,
                initiated_by: '111'
            });

            logger.info(logMetadata, 'internaltransfer Transaction Result: ', internalTResult);
            logger.info(logMetadata, 'internalTransfer Audit Result: ', internalAudiResult);

            var cron_update_status = {};

            if (is_last) {
                cron_update_status['finished_at'] = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
                cron_update_status['status'] = 'FINISHED';
            }

            if (internalTResult && internalAudiResult) {
                var append_data = `${ref} is completed successfully!<br>`;
                if (is_last) {
                    append_data += ` Time Execution: ${(Date.now() - startTime) / 1000} seconds`;
                }
                cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), append_data);
            } else {
                var append_data_fail = `${ref} cron failed!<br>`;
                if (is_last) {
                    append_data_fail += ` Time Execution: ${(Date.now() - startTime) / 1000} seconds`;
                }
                cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), append_data_fail);
            }

            await cronHelper.finish(cron_update_status, Crons, cron_record_id);

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (e) {
            logger.error(logMetadata, '~ InternalTransferService ~ processInternalTransfer ~ ', e);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }
}
