import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
const { logHelpers } = process.env.IS_OFFLINE ? require('../../layers/helper_lib/src') : require('datman-helpers');
let logger = logHelpers.logger;

export class MypayService {
    async sendSMS(payload) {
        let options = {};
        let logMetadata = {
            phoneNumber: payload.phone_number,
            location: 'MypayService ~ sendSMS'
        };
        let QueueUrl = process.env.SMS_QUEUE_URL;
        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            QueueUrl = process.env.LOCAL_QUEUE_URL;
        }

        const sqs = new AWS.SQS(options);
        const objectStringified = JSON.stringify({
            payload
        });

        logger.info(logMetadata, 'Queue Url', QueueUrl);
        logger.info(logMetadata, 'objectStringified', objectStringified);

        const params = {
            MessageGroupId: uuidv4(),
            MessageBody: objectStringified,
            QueueUrl: QueueUrl
        };

        const res = await sqs.sendMessage(params).promise(); //publisher
        logger.info(logMetadata, 'send message result', res);
    }

    async sendPushNotification(payload) {
        // publisher
        let options = {};
        let logMetadata = {
            payload: payload,
            location: 'MypayService ~ sendPushNotification'
        };
        let QueueUrl = process.env.PUSH_NOTIFICATION_QUEUE_URL;
        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            QueueUrl = process.env.LOCAL_PUSH_NOTIFICATION_QUEUE_URL;
        }

        const sqs = new AWS.SQS(options);
        const objectStringified = JSON.stringify({
            payload
        });

        logger.info(logMetadata, 'Queue Url', QueueUrl);
        logger.info(logMetadata, 'objectStringified', objectStringified);

        const params = {
            MessageGroupId: uuidv4(),
            MessageBody: objectStringified,
            QueueUrl: QueueUrl
        };

        const res = await sqs.sendMessage(params).promise();
        logger.info(logMetadata, 'send message result', res);
    }
}
