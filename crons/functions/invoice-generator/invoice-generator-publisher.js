import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
var { response, cronHelper, logHelpers, helpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;
import { v4 as uuidv4 } from 'uuid';
let currentCodeEnv = helpers.getCodeEnvironment();

export const invoiceGeneratorPublisher = async (event, context) => {
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
    const { sequelize, Crons, Customer } = db;
    const requestId = `reqid_${context.awsRequestId}`;

    let logMetadata = {
        location: 'MessagingService ~ invoiceGeneratorPublisher',
        awsRequestId: context.awsRequestId
    };
    try {
        var cronResult = await cronHelper.start(
            {
                script: 'invoice_generator.js',
                path: event.requestContext.path,
                url: '',
                week_no: moment().tz(TIMEZONE).format('W'),
                started_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                output: 'Publisher Mids: '
            },
            Crons
        );

        logger.info(logMetadata, 'Cron ID', cronResult.id);

        var currentday = moment().isoWeekday();

        if (currentCodeEnv == 'production' && currentday != 6) {
            await cronHelper.finish(
                {
                    output: `-- Corrupt file or bad name.`,
                    finished_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    status: 'FINISHED'
                },
                Crons,
                cronResult.id
            );

            logger.error(logMetadata, 'Error', 'Corrupt file or bad name');
            return response(
                {
                    request_id: requestId,
                    message: 'Corrupt file or bad name.'
                },
                500
            );
        }

        var specialRentData = await sequelize.query(
            `SELECT * FROM customer_special_rent WHERE active_status = 'ACTIVE' AND CURRENT_DATE() BETWEEN start_date and end_date`
        );

        specialRentData = specialRentData[0];
        logger.info(logMetadata, 'specialRentData', specialRentData);

        var user_ip_address = event.requestContext.identity.sourceIp;

        logger.info(logMetadata, 'user_ip_address', user_ip_address);

        var customerData = await Customer.findAll({
            attributes: ['id', 'contract_rent'],
            where: {
                progress_status: '2'
            }
        });

        logger.info(logMetadata, 'customerData', customerData);
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

        var customerDataLength = customerData.length - 1;

        var messageGroupID = uuidv4();
        var index = 0;
        var publishersMid = '';

        for (var v in customerData) {
            var isLast = index == customerDataLength ? true : false;

            publishersMid += v.dataValues.id;

            const params = {
                MessageBody: JSON.stringify({
                    customer_id: v.dataValues.id,
                    user_ip_address: user_ip_address,
                    specialRentData: JSON.stringify(specialRentData),
                    cron_record_id: cronResult.id,
                    requestId: requestId,
                    contract_rent: v.dataValues.contract_rent,
                    is_last: isLast,
                    startTime
                }),
                QueueUrl: queueUrl,
                MessageGroupId: messageGroupID
            };
            logger.info(logMetadata, 'payload pushing to queue', params);
            const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
            var executionResult = await sqs.sendMessage(params).promise();
            logger.info(logMetadata, 'executionResult: ', executionResult);
            index++;
        }

        publishersMid += ` Publisher ends. Consumer: `;
        var cron_update_status = {};
        cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), publishersMid);
        await cronHelper.finish(cron_update_status, Crons, cronResult.id);

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
