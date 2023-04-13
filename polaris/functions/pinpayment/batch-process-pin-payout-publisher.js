/*
 * @step# : 3
 * @Description: Post batching, this will execute as a cron to process the batch, it picks records from payout_batch for pin payments and publish the message to queue BatchProcessPinPayoutsQueue
 * Validates the merchant and batches, invokes third party service for payout
 * @Test: No input required, running the lambda ProcessPinPayoutPublisher will do the processing
 */

import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
export const processBatchService = async (event, context) => {
    let logMetadata = {
        location: 'PinPayout ~ pinPayoutService',
        awsRequestId: context.awsRequestId
    };

    logger.info(logMetadata, 'Event:', event);

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    const { sequelize, PayoutBatch } = db;

    const payoutBatches = await PayoutBatch.findAll({
        where: {
            status: 'PENDING',
            payout_provider: 'PIN_PAYMENT'
        },
        raw: true
    });

    sequelize.close && (await sequelize.close());

    logger.info(logMetadata, 'here the list of pending payouts', payoutBatches);

    let payoutInfo = new Array();

    payoutBatches.forEach((item) => {
        var payloadMid = {
            batch_id: item.batch_id,
            merchant_id: item.customer_id,
            total: item.total,
            status: item.status,
            token: item.pp_token,
            payout_provider : 'PIN_PAYMENT'
        };
        payoutInfo.push(payloadMid);
    });

    // then pass this to the qeuee

    let queueUrl = process.env.QUEUE_URL;
    let options = {};
    if (process.env.IS_OFFLINE) {
        options = {
            apiVersion: '2012-11-05',
            region: 'localhost',
            endpoint: 'http://0.0.0.0:9324',
            sslEnabled: false
        };
        queueUrl = process.env.LOCAL_QUEUE_URL;
    }

    logger.info(`queueUrl:${queueUrl}`);
    let sendMessagePromises = payoutInfo.map(async (v) => {
        const params = {
            MessageBody: JSON.stringify(v),
            QueueUrl: queueUrl
        };
        console.log('messages that are pushed to the sqs', params);
        const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
        return sqs.sendMessage(params).promise();
    });
    let promiseExecutionResponse = await Promise.all(sendMessagePromises);
    console.log('Executed successfully', promiseExecutionResponse);
    sequelize.close && (await sequelize.close());
    return response({ isSuccessful: true });
};
