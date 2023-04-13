import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { logHelpers, cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../layers/helper_lib/src')
    : require('datman-helpers');
let logger = logHelpers.logger;

export class CheckoutService {
    /**
     * @param {{
     *   payload: any,
     *   t2sPayload: any,
     *   card_payment_id: integer
     * }} opt
     */
    async notifyT2SSubscriber(payload, t2sPayload, card_payment_id, awsRequestId) {
        console.log('notifying subscriber: ', payload, t2sPayload, card_payment_id, awsRequestId);
        let options = {};
        let logMetadata = {
            orderId: payload.order_id,
            location: 'CheckoutService ~ notifyT2SSubscriber',
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
        //logger.info(logMetadata, `objectStringified ${objectStringified}`);

        const params = {
            MessageBody: objectStringified,
            QueueUrl: queueUrl
        };

        await sqs.sendMessage(params).promise();
    }

    async sendDataQueue(notificationData, requestPayload, masterToken, awsRequestId) {
        console.log('sendDataQueue req params: ', notificationData, requestPayload, masterToken, awsRequestId);
        let logMetadata = {
            orderId: requestPayload.order_id,
            location: 'CheckoutService ~ sendDataQueue',
            awsRequestId
        };

        //payload to send to dna master token handler
        try {
            let { source } = notificationData;

            if (requestPayload.customer_id) {
                const masterTokenPayload = {
                    type: 1,
                    metaData: {
                        // card_number: cardPanStarred,
                        expiry_month: source.expiry_month,
                        expiry_year: source.expiry_year.toString().substr(2),
                        cardSchemeId: '', // placeholder for now
                        cardSchemeName: source.scheme,
                        cardIssuingCountry: source.issuer_country,
                        provider: 'CHECKOUT-HF',
                        provider_token: source.id,
                        is_billing_address: 0,
                        last_4_digit: source.last_4,
                        customer_id: String(requestPayload.customer_id),
                        // postcode: payload.billing_post_code,
                        // address: payload.billing_address,
                        master_token: `mxtoken_${masterToken}`,
                        merchant_id: String(requestPayload.merchant_id),
                        transactionUnique: requestPayload.omt
                    }
                };

                console.log('masterTokenPayload', masterTokenPayload);
                let encrptedQueueData = cryptFunctions.encryptPayload(
                    JSON.stringify(masterTokenPayload),
                    process.env.MX_PAYLOAD_ENCRYPTION_KEY
                );

                await this.tokeniseCard(encrptedQueueData);
                return true;
            } else {
                logger.info(
                    logMetadata,
                    'sendDataQueue Else',
                    `Not creating master token, as no customer id provided!`
                );
                return null;
            }
        } catch (error) {
            logger.error(logMetadata, 'errorResponse SendData Queue', error);
            console.log('error', error);
            return error;
        }
    }

    /**
     * @param {{
     *   payload: any,
     * }}
     */

    async tokeniseCard(payload) {
        try {
            let options = {};

            let queueUrl = process.env.QUEUE_URL_MASTERTOKEN_V2;

            if (process.env.IS_OFFLINE) {
                options = {
                    apiVersion: '2012-11-05',
                    region: 'localhost',
                    endpoint: 'http://0.0.0.0:9324',
                    sslEnabled: false
                };
                queueUrl = process.env.LOCAL_QUEUE_URL_MASTERTOKEN_V2;
            }

            const sqs = new AWS.SQS(options);

            const objectStringified = JSON.stringify({
                payload
            });

            console.log('Queue Url SQS for Master token V2: ', queueUrl);
            const params = {
                MessageBody: objectStringified,
                QueueUrl: queueUrl
            };
            await sqs.sendMessage(params).promise();
        } catch (error) {
            console.log('Request Added in QUEUE Error: ' + error);
        }
    }
}
