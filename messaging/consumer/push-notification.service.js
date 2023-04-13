// Import required AWS SDK clients and commands for Node.js
import AWS from 'aws-sdk';
const axios = require('axios');

var { logHelpers } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

let logger = logHelpers.logger;

export class PushNotificationService {
    async sendPushNotification(event, context = {}) {
        let logMetadata = {
            location: 'PushNotificationMessagingService ~ sendPushNotification',
            awsRequestId: context.awsRequestId
        };

        console.log(`event data~${event}`);

        const promises = event.Records.map((message) => {
            console.log('map message ', message);
            return this.processsPushNotification(message, logMetadata);
        });

        console.log('promises ', promises);

        const executions = await Promise.all(promises);

        console.log({ executions });
        var result = await this.postProcessPushNotifications(executions, logMetadata);
        return result;
    }

    async postProcessPushNotifications(executions, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ sendPushNotifications ~ postProcessPushNotifications',
            awsRequestId
        };
        const hasAtLeastOneError = executions.some((result) => result.success === false);

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

            const processSuccesItems = executions.filter((result) => result.success === true);
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
                .filter((result) => result.success === false)
                .map((result) => result.message.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        } else {
            return { success: true };
        }
    }

    async processsPushNotification(message, { awsRequestId }) {
        let logMetadata = {
            location: 'PushNotificationMessagingService ~ sendPushNotification ~ processsPushNotification',
            awsRequestId
        };
        logger.info(logMetadata, 'Messaging :: Consumer: processSendPushNotification: body - ', message.body);
        const body = JSON.parse(message.body);
        console.log('body ', body);
        const payload = body.payload;
        console.log({ payload });

        try {
            const apiData = {
                method: 'POST',
                url: process.env.PUSH_NOTIFICATION_ENDPOINTS + `/send-push-notification`,
                headers: {
                    api_key: process.env.PUSH_NOTIFICATION_ENDPOINTS_API_KEY
                },
                data: payload
            };

            const resposne = await axios(apiData);

            console.log('Api Response : ', resposne);

            return { message, success: true };
        } catch (error) {
            console.log({ error });
            logger.error(logMetadata, 'Send PushNotification error:', message.messageId, error);
            return { message, success: false };
        }
    }
}
