import AWS from 'aws-sdk';
const axios = require('axios');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../layers/models_lib/src') : require('datman-models');

var { cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../layers/helper_lib/src')
    : require('datman-helpers');
let logger = logHelpers.logger;

export class JupitorService {
    /**
     * @param {{
     *   payload: any,
     *   t2sPayload: any,
     *   card_payment_id: integer
     * }} opt
     */
    async notifyT2SSubscriber(payload, t2sPayload, card_payment_id, awsRequestId) {
        let options = {};
        let logMetadata = {
            orderId: payload.order_id,
            location: 'JupitorService ~ notifyT2SSubscriber',
            awsRequestId
        };

        let queueUrl = process.env.QUEUE_URL;

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            queueUrl = process.env.LOCAL_QUEUE_URL;
        }

        const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));

        const objectStringified = JSON.stringify({
            payload,
            t2sPayload,
            card_payment_id
        });

        logger.info(logMetadata, `queueUrl ${queueUrl}`);

        const params = {
            MessageBody: objectStringified,
            QueueUrl: queueUrl
        };

        await sqs.sendMessage(params).promise();
    }

    async notifyT2SSubscriberDirect(payload, t2sPayload, card_payment_id, awsRequestId) {
        let logMetadata = {
            orderId: payload.order_id,
            location: 'JupitorService ~ notifyT2SSubscriberDirect',
            awsRequestId
        };

        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        const { WebhookLog, sequelize } = db;

        const encryptedT2SPayload = cryptFunctions.encryptPayload(
            JSON.stringify(t2sPayload),
            process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY
        );
        logger.info(logMetadata, `card_payment_id ${card_payment_id}`);
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
            .catch(async function (error) {
                if (error) {
                    logger.error(logMetadata, 'error', error);
                    return { status: error.response && error.response.status };
                }
            });

        await WebhookLog.create({
            action: 'payment_success',
            card_payment_id: card_payment_id,
            webhook_url: payload.webhook_url,
            payload: JSON.stringify(t2sPayload),
            encrypted_payload: encryptedT2SPayload,
            http_response_code: webhookResLog.status
        });

        sequelize.close && (await sequelize.close());
    }
}
