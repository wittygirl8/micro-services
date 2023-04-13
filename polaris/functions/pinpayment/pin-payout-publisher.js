/*
 * @step# : 1
 * @Description: This runs on cron and publishes the message to queue PinPayoutsQueue by picking eligible merchant with the required information for batching
 * @Test: No input required, running the lambda function PinPayoutPublisher will publish the message
 */

import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;
const { validateCronMonthly } = require('../helpers/validateCronMonthly');
const { validateCronWeek } = require('../helpers/validateCronWeek');
export const pinPayoutService = async (event, context) => {
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

    const { sequelize, Sequelize, SettlementConfig } = db;

    const mids = await SettlementConfig.findAll({
        where: {
            last_executed_at: {
                [Sequelize.Op.lt]: moment().tz(TIMEZONE).format('YYYY-MM-DD')
            },
            status: 1
        },
        attributes: [
            'id',
            'customer_id',
            'delay_payout',
            'payout_provider',
            'last_executed_at',
            'frequency',
            'frequency_value'
        ],
        raw: true
    });

    sequelize.close && (await sequelize.close());

    logger.info(logMetadata, 'here the list of mids', mids);

    let merchant_info = new Array();

    mids.forEach((item) => {
        var payloadMid = {
            merchant_id: item.customer_id,
            delay_payout: item.delay_payout,
            last_executed_at: item.last_executed_at,
            payout_provider: item.payout_provider
        };

        if (
            item.frequency == 'DAILY' ||
            (item.frequency == 'WEEKLY' && validateCronWeek(item.frequency_value, item.customer_id)) ||
            (item.frequency == 'MONTHLY' && validateCronMonthly(item.frequency_value, item.customer_id))
        ) {
            console.log(`Pushing ${item.customer_id}`);
            merchant_info.push(payloadMid);
        }
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
    let sendMessagePromises = merchant_info.map(async (v) => {
        const params = {
            MessageBody: JSON.stringify(v),
            QueueUrl: queueUrl
        };
        console.log('params that are pushed to the sqs', params);
        const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
        return sqs.sendMessage(params).promise();
    });
    let promiseExecutionResponse = await Promise.all(sendMessagePromises);
    console.log('Executed successfully', promiseExecutionResponse);
    sequelize.close && (await sequelize.close());
    return response({ isSuccessful: true });
};
