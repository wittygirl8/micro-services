import AWS from 'aws-sdk';
//const axios = require('axios');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

// var { connectDB } = process.env.IS_OFFLINE ? require('../../layers/models_lib/src') : require('datman-models');

const { logHelpers } = process.env.IS_OFFLINE ? require('../../layers/helper_lib/src') : require('datman-helpers');
let logger = logHelpers.logger;

export class SwitchService {
    /**
     *  @param {Object} payload
     *  @param {Object} transactionDetails
     */

    async initiateRefundSale(payload, transactionDetails) {
        let logMetadata = {
            location: 'SwitchService ~ initiateRefundSale'
        };
        try {
            let options = {};

            let queueUrl = process.env.REFUND_SALE_SQS_QUEUE_URL;

            if (process.env.IS_OFFLINE) {
                options = {
                    apiVersion: '2012-11-05',
                    region: 'localhost',
                    endpoint: 'http://0.0.0.0:9324',
                    sslEnabled: false
                };
                queueUrl = process.env.LOCAL_REFUND_SALE_SQS_QUEUE_URL;
            }

            const sqs = new AWS.SQS(options);
            logger.info(logMetadata, 'Refund SQS queue url: ', queueUrl);
            const messageBody = JSON.stringify({
                payload,
                transactionDetails
            });

            const params = {
                MessageBody: messageBody,
                QueueUrl: queueUrl
            };
            await sqs.sendMessage(params).promise();
        } catch (error) {
            logger.error(logMetadata, 'Request Added in QUEUE Error: ', error);
        }
    }
}
