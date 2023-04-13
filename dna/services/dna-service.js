const { logHelpers, cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
import AWS from 'aws-sdk';
const axios = require('axios');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const logger = logHelpers.logger;

const formUrlEncoded = (x) => Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '');

export const getAuthToken = async (scope) => {
    const response = await axios.post(
        `${process.env.DNA_AUTH_API_URL}/oauth2/token`,
        formUrlEncoded({
            client_id: process.env.DNA_CLIENT_ID,
            client_secret: process.env.DNA_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scope
        }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    return response.data;
};

// export const getTransactionsForMerchant = async (accessToken, from, to, merchantId) => {
//     const url = `${process.env.DNA_API_URL}/v1/partners/pos/transactions?from=${from}&to=${to}&size=5000&merchantId=${merchantId}`;
//     console.log(`Requesting Transactions as: ${url}`);
//     const response = await axios.get(url, {
//         headers: {
//             Authorization: `Bearer ${accessToken}`,
//             'Content-Type': 'application/json'
//         }
//     });
//     console.log(`dna~response~data:`,response);
//     return response.data;
// };

/**
 * @param {{
 *   payload: any,
 *   t2sPayload: any,
 *   card_payment_id: integer
 * }} opt
 */
export const notifyT2SSubscriber = async (payload, t2sPayload, card_payment_id, awsRequestId) => {
    let options = {};
    let logMetadata = {
        orderId: payload.order_id,
        location: 'DNAService ~ notifyT2SSubscriber',
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
};

export const sendDataQueue = async (notificationObject, requestPayload, masterToken, awsRequestId) => {
    let logMetadata = {
        orderId: requestPayload.order_id,
        location: 'DNAService ~ sendDataQueue',
        awsRequestId
    };

    //payload to send to dna master token handler
    try {
        const {
            id,
            cardExpiryDate,
            cardTokenId,
            cardPanStarred,
            cardSchemeId,
            cardSchemeName,
            cardIssuingCountry
        } = notificationObject;

        if (requestPayload.customer_id) {
            const masterTokenPayload = {
                type: 1,
                metaData: {
                    card_number: cardPanStarred,
                    expiry_month: cardExpiryDate.split('/')[0],
                    expiry_year: cardExpiryDate.split('/')[1],
                    cardSchemeId: cardSchemeId,
                    cardSchemeName: cardSchemeName,
                    cardIssuingCountry: cardIssuingCountry,
                    provider: 'DNA',
                    provider_token: cardTokenId,
                    is_billing_address: true,
                    last_4_digit: cardPanStarred.substr(cardPanStarred.length - 4),
                    customer_id: String(requestPayload.customer_id),
                    first_name: requestPayload.first_name,
                    last_name: requestPayload.last_name,
                    // postcode: payload.billing_post_code,
                    // address: payload.billing_address,
                    master_token: masterToken,
                    merchant_id: String(requestPayload.merchant_id),
                    transactionUnique: id
                }
            };

            let encrptedQueueData = cryptFunctions.encryptPayload(
                JSON.stringify(masterTokenPayload),
                process.env.MX_PAYLOAD_ENCRYPTION_KEY
            );

            await tokeniseCard(encrptedQueueData);
            return true;
        } else {
            logger.info(logMetadata, 'sendDataQueue Else', `Not creating master token, as no customer id provided!`);
            return null;
        }
    } catch (error) {
        logger.error(logMetadata, 'errorResponse SendData Queue', error);
        console.log('error', error);
        return error;
    }
};

/**
 * @param {{
 *   payload: any,
 * }}
 */

const tokeniseCard = async (payload) => {
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
};
