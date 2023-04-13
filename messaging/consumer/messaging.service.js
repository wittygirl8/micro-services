import AWS from 'aws-sdk';
const axios = require('axios');

var { cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');

let logger = logHelpers.logger;

export class MessagingService {
    async notifyT2s(event, context = {}) {
        let logMetadata = {
            location: 'MessagingService ~ AutoWithdrawalService ~ init',
            awsRequestId: context.awsRequestId
        };

        const promises = event.Records.map((message) => {
            return this.processT2SNotification(message, logMetadata);
        });

        const executions = await Promise.all(promises);
        await this.postProcessMessage(executions, logMetadata);
    }

    async postProcessMessage(executions, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ notifyT2s ~ postProcessMessage',
            awsRequestId
        };

        const hasAtLeastOneError = executions.some((result) => result.succes === false);

        logger.info(logMetadata, 'Executions result:', executions);
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

            const processSuccesItems = executions.filter((result) => result.succes === true);
            for (let successMsg of processSuccesItems) {
                const params = {
                    QueueUrl: process.env.QUEUE_URL,
                    ReceiptHandle: successMsg.receiptHandle
                };
                try {
                    await sqs.deleteMessage(params).promise();
                } catch (error) {
                    // Do nothing, need to make the code idempotent in such case
                }
            }

            // For errors, lambda instance will not be available till visisibility timeout expires
            const processErrorItemsMsgIds = executions
                .filter((result) => result.succes === false)
                .map((result) => result.message.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        }
    }

    async processT2SNotification(message, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ notifyT2s ~ processT2SNotification',
            awsRequestId
        };

        logger.info(logMetadata, 'Messaging :: Consumer: processT2SNotification: body - ', message.body);
        const { payload, t2sPayload, card_payment_id } = JSON.parse(message.body);

        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        const { sequelize, WebhookLog } = db;
        try {
            //prepare payload to send
            const encryptedT2SPayload = cryptFunctions.encryptPayload(
                JSON.stringify(t2sPayload),
                process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY
            );

            let webhookResLog = await axios
                .post(
                    payload.webhook_url,
                    {
                        data: encryptedT2SPayload
                    },
                    {
                        headers: {
                            token: process.env.T2S_API_TOKEN,
                            'cache-control': 'no-cache'
                        }
                    }
                )
                .catch(function (error) {
                    if (error) {
                        console.error('T2s API error:', message.messageId, error);
                        return { status: error.response && error.response.status };
                    }
                });

            logger.info(logMetadata, 'Returned webhookResLog status', webhookResLog && webhookResLog.status);

            await WebhookLog.create({
                action: 'payment_success',
                card_payment_id: card_payment_id,
                webhook_url: payload.webhook_url,
                payload: JSON.stringify(t2sPayload),
                encrypted_payload: encryptedT2SPayload,
                http_response_code: webhookResLog.status
            });

            sequelize.close && (await sequelize.close());

            if (webhookResLog.status !== 200) {
                return { message, succes: false };
            }
            return { message, succes: true };
        } catch (error) {
            logger.error(logMetadata, 'NotifyT2S error:', message.messageId, error);
            sequelize.close && (await sequelize.close());
            return { message, succes: false };
        }
    }
}
