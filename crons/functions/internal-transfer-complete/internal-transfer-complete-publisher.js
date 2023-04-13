import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
var { response, cronHelper, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export const internalTransferPublisher = async (event, context) => {
    var startTime = Date.now();

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
    const { sequelize, Crons, InternalTransferTransaction } = db;
    const requestId = `reqid_${context.awsRequestId}`;

    let logMetadata = {
        location: 'MessagingService ~ internalTransferCompletePublisher',
        awsRequestId: context.awsRequestId
    };
    try {
        var cronResult = await cronHelper.start(
            {
                script: 'internal_transfer_complete_cron.js',
                path: event.requestContext.path,
                url: '',
                week_no: moment().tz(TIMEZONE).format('W'),
                started_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                output: ' ' //intentionally kept space
            },
            Crons
        );

        var pendingTransations = await InternalTransferTransaction.findAll({
            attributes: ['ref'],
            where: {
                status: 'PENDING'
            }
        });

        logger.info(logMetadata, 'cronResult ID', cronResult.id);
        logger.info(logMetadata, 'pendingTransations ref', pendingTransations);

        if (Array.isArray(pendingTransations) && !pendingTransations.length) {
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

        var messageGroupID = uuidv4(); //all payload which we are pushing in queue must belong to same group so FIFO fasion is followed

        for (const [index, v] of pendingTransations) {
            var isLast = index == pendingTransations.length - 1 ? true : false;
            const params = {
                MessageBody: JSON.stringify({
                    ref: v.ref,
                    startTime: startTime,
                    cron_record_id: cronResult.id,
                    is_last: isLast
                }),
                QueueUrl: queueUrl,
                MessageGroupId: messageGroupID
            };
            logger.info(logMetadata, 'Params pushed to queue', params);
            const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
            var executedResult = await sqs.sendMessage(params).promise();
            logger.info(logMetadata, 'ExecutedResult', executedResult);
        }

        sequelize.close && (await sequelize.close());
        return response({ isSuccessful: true });
    } catch (error) {
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
