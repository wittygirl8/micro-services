import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
const { response, cronHelper, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
import { v4 as uuidv4 } from 'uuid';
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

let logger = logHelpers.logger;
export const sendCsvUK = async (event, context) => {
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Crons } = db;
    let requestId = `reqid_${context.awsRequestId}`;
    let logMetadata = {
        location: 'MessagingService ~ sendCSVUKPublisher',
        awsRequestId: context.awsRequestId
    };

    try {
        let startTime = Date.now();
        let cronResult = await cronHelper.start(
            {
                script: 'cron-csv-uk-publisher.js',
                path: event.requestContext.path,
                url: '',
                week_no: moment().tz(TIMEZONE).format('W'),
                started_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                output: 'Publishers Mids: ' //intentionally kept space
            },
            Crons
        );

        var countQuery = `SELECT count(*) as 'count' FROM batch LEFT JOIN other_customer_details ON other_customer_details.customers_id = batch.customer_id LEFT JOIN customers ON customers.id = batch.customer_id WHERE batch.status='PENDING' AND customers.country_id = 1 AND customers.business_name not like '%test%' ORDER by batch.batch_id`;

        var [countResult] = await sequelize.query(countQuery);
        countResult = countResult[0];
        countResult = countResult.count;

        console.log('countResult: ', countResult, typeof countResult);
        if (countResult == 0) {
            await cronHelper.finish(
                {
                    output: `No pending transactions.`,
                    finished_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    status: 'FINISHED'
                },
                Crons,
                cronResult.id
            );

            return response({
                request_id: requestId,
                message: 'No pending transactions',
                data: {
                    success: 'ok'
                }
            });
        }

        var fetchedRows = 0;
        var pageSize = 10; //100

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
        let messageGroupID = uuidv4();

        var index = 1;
        var totalValue = 0;
        var totalCount = 0;
        var recordIDs = [];
        var publishersMid = '';
        while (countResult != 0) {
            var q = `SELECT batch.*, other_customer_details.accountnumber, other_customer_details.sortcode, other_customer_details.bankname, other_customer_details.accountholder FROM batch LEFT JOIN other_customer_details ON other_customer_details.customers_id = batch.customer_id LEFT JOIN customers ON customers.id = batch.customer_id WHERE batch.status='PENDING' AND customers.country_id = 1 AND customers.business_name not like '%test%' ORDER by batch.batch_id LIMIT ${pageSize} OFFSET ${fetchedRows}`;

            var batchInformation = await sequelize.query(q);

            batchInformation = batchInformation[0];

            console.log('batchInformation: ', batchInformation);

            countResult = parseInt(countResult) - batchInformation.length;
            fetchedRows = fetchedRows + batchInformation.length;

            console.log('countResult: ', countResult);
            console.log('fetchedRows: ', fetchedRows);

            var finalRecords = await batchInformation.filter((e) => {
                if (e.accountnumber && e.accountnumber.length == 8 && e.sortcode && e.sortcode.length == 6) {
                    var total = Number(e.total.replace('-', ''));
                    totalValue += Number(total.toFixed(2));
                    totalCount++;
                    recordIDs.push(e.batch_id);
                    publishersMid += `${e.customer_id}, `;
                    return e;
                }
            });

            console.log('finalRecords: ', finalRecords);
            const params = {
                MessageBody: JSON.stringify({
                    record: JSON.stringify(finalRecords),
                    startTime: startTime,
                    cron_record_id: cronResult.id,
                    is_last: countResult == 0 ? true : false,
                    record_no: index,
                    EMAIL_QUEUE_URL: process.env.EMAIL_QUEUE_URL,
                    requestId: context.awsRequestId,
                    total_value: totalValue,
                    total_count: totalCount,
                    record_ids: recordIDs
                }),
                QueueUrl: queueUrl,
                MessageGroupId: messageGroupID
            };
            index++;
            logger.info(logMetadata, 'Params pushed to queue', params);
            const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
            var executedResult = await sqs.sendMessage(params).promise();
            logger.info(logMetadata, 'ExecutedResult', executedResult);
        }

        publishersMid += ` Publisher ends. Consumer: `;
        var cron_update_status = {};
        cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), publishersMid);
        await cronHelper.finish(cron_update_status, Crons, cronResult.id);

        sequelize.close && (await sequelize.close());
        return response({ isSuccessful: true });
    } catch (error) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: error.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        sequelize.close && (await sequelize.close());
        return response({ errorResponse }, 500);
    }
};
