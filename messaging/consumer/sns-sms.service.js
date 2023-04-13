// Import required AWS SDK clients and commands for Node.js
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
import AWS from 'aws-sdk';

var { logHelpers } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

let logger = logHelpers.logger;

export class SNSService {
    async sendSMS(event, context = {}) {
        let logMetadata = {
            location: 'MessagingService ~ sendSMS',
            awsRequestId: context.awsRequestId
        };
        const promises = event.Records.map((message) => {
            return this.processsSNSMessage(message, logMetadata);
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions, logMetadata);
        return result;
    }

    async postProcessMessage(executions, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ sendSMS ~ postProcessMessage',
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

    async processsSNSMessage(message, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ sendSMS ~ postProcessMessage',
            awsRequestId
        };
        logger.info(logMetadata, 'Messaging :: Consumer: processSendSMS: body - ', message.body);
        const body = JSON.parse(message.body);
        const payload = body.payload;
        logger.info(logMetadata, 'Payload: ', payload);
        try {
            const sns = new SNSClient();
            const params = {
                Message: payload.message_text /* required */,
                PhoneNumber: payload.phone_number, //PHONE_NUMBER, in the E.164 phone number structure
                MessageAttributes: {
                    'AWS.SNS.SMS.SenderID': {
                        DataType: 'String',
                        StringValue: payload.SenderId || 'Datman'
                    }
                }
            };

            logger.info(logMetadata, 'Params: ', params);
            const data = await sns.send(new PublishCommand(params));
            logger.info(logMetadata, 'Success, message published. MessageID is ' + data.MessageId);
            logger.info(logMetadata, 'Complete Response: ', data);
            return { message, success: true };
        } catch (error) {
            logger.error(logMetadata, 'Send SMS error:', message.messageId, error);
            return { message, success: false };
        }
    }
}
