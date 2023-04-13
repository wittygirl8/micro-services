import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
var { response, logHelpers, cronHelper } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
import { v4 as uuidv4 } from 'uuid';
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const generateBatchPublisher = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Crons } = db;
    const requestId = `reqid_${context.awsRequestId}`;

    let logMetadata = {
        location: 'MessagingService ~ generateBatchPublisher',
        awsRequestId: context.awsRequestId
    };
    try {
        var startTime = Date.now();
        var cronResult = await cronHelper.start(
            {
                script: 'generate_batch.js',
                path: event.requestContext.path,
                url: '',
                week_no: moment().tz(TIMEZONE).format('W'),
                started_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                output: 'Publisher Mid: '
            },
            Crons
        );

        logger.info(logMetadata, 'Cron ID', cronResult.id);

        var customer_id_condition =
            event.queryStringParameters && event.queryStringParameters.customer_id
                ? `and customer_id IN (${event.queryStringParameters.customer_id})`
                : '';

        var query = `SELECT card_payment.id, card_payment.customer_id, card_payment.time, other_customer_details.sortcode, other_customer_details.accountnumber, other_customer_details.bankname, other_customer_details.accountholder FROM card_payment LEFT JOIN other_customer_details ON other_customer_details.customers_id = card_payment.customer_id WHERE card_payment.firstname='withdraw' AND card_payment.delete_status='0' AND card_payment.withdraw_status =1 AND card_payment.payment_status != 'INBATCH' ${customer_id_condition} GROUP by card_payment.customer_id ORDER BY time ASC`;

        logger.info(logMetadata, 'query', query);

        var resultCardPaymentSingle = await sequelize.query(query);

        resultCardPaymentSingle = resultCardPaymentSingle[0];

        logger.info(logMetadata, 'resultCardPaymentSingle', resultCardPaymentSingle);

        if (
            !resultCardPaymentSingle ||
            (Array.isArray(resultCardPaymentSingle) && resultCardPaymentSingle.length == 0)
        ) {
            await cronHelper.finish(
                {
                    output: `No data with withdrawal status.`,
                    finished_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    status: 'FINISHED'
                },
                Crons,
                cronResult.id
            );

            return response({
                request_id: requestId,
                message: 'No Data Found',
                data: {
                    success: 'ok'
                }
            });
        }
        let options = {};
        var queueUrl = process.env.QUEUE_URL;
        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            queueUrl = process.env.LOCAL_QUEUE_URL;
        }

        var messageGroupID = uuidv4();
        var resultCardPaymentSingleLength = resultCardPaymentSingle.length - 1;

        var index = 0;
        var publisherMids = '';
        for (const withdraw_record of resultCardPaymentSingle) {
            publisherMids += `${withdraw_record.customer_id}, `;
            var isLast = index == resultCardPaymentSingleLength ? true : false;
            const params = {
                MessageBody: JSON.stringify({
                    requestId: requestId,
                    withdrawRecord: JSON.stringify(withdraw_record),
                    cron_id: cronResult.id,
                    is_last: isLast,
                    startTime: startTime
                }),
                QueueUrl: queueUrl,
                MessageGroupId: messageGroupID
            };
            logger.info(logMetadata, 'payload pushing to queue', params);
            const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
            var executedResult = await sqs.sendMessage(params).promise();
            console.log('executedResult: ', executedResult);
            index++;
        }

        publisherMids += ` publishers ends. Consumer Mids: `;

        var cron_update_status = {};
        cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), publisherMids);
        await cronHelper.finish(cron_update_status, Crons, cronResult.id);

        sequelize.close && (await sequelize.close());
        return response({ isSuccessful: true });
    } catch (error) {
        console.log(error);
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: error.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();
        return response({ errorResponse }, 500);
    }
};
