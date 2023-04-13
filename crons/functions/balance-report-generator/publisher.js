import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export const BalanceReportGeneratorPublisher = async (event, context) => {
    const requestId = `reqid_${context.awsRequestId}`;
    let logMetadata = {
        location: 'CronService ~ BalanceReportGeneratorPublisher',
        awsRequestId: context.awsRequestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Sequelize, Customer } = db;

    try {
        AWSXRay.capturePromise();
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {}); //do nothing
        }
        //console.log(event.body)
        let payload = event.body ? JSON.parse(event.body) : {};

        //for some odd cases, this script will receive payload to override the defalut conf value

        console.log(payload);

        let moment_yesterday = moment().tz(TIMEZONE).subtract(1, 'days');
        let conf = {
            day: payload.day ? payload.day : moment_yesterday.format('DD'),
            month: payload.month ? payload.month : moment_yesterday.format('MM'),
            year: payload.year ? payload.year : moment_yesterday.format('YYYY'),
            merchant_id_list: payload.merchant_id_list ? payload.merchant_id_list : '',
            balance_table: payload.balance_table ? payload.balance_table : 'balance_test',
            opening_balance_calculation_type: payload.opening_balance_calculation_type
                ? payload.opening_balance_calculation_type
                : 'FULL'
        };

        conf.maxDayofMonth = moment.tz(`${conf.year}-${conf.month}-${conf.day}`, 'YYYY-MM-DD', TIMEZONE).daysInMonth(); //getting total days of current month
        conf.lastMonth = moment
            .tz(`${conf.year}-${conf.month}-${conf.day}`, 'YYYY-MM-DD', TIMEZONE)
            .subtract(1, 'months')
            .format('M'); //last month
        conf.lastMonthYear = moment
            .tz(`${conf.year}-${conf.month}-${conf.day}`, 'YYYY-MM-DD', TIMEZONE)
            .subtract(1, 'months')
            .format('Y'); //last year
        console.log(conf);

        //prepare the defalt parameters
        //overwrite the default parameters based on payload if any
        let where_condition = {
            progress_status: { [Sequelize.Op.gt]: 1 },
            business_name: { [Sequelize.Op.ne]: '' },
            date_created: {
                [Sequelize.Op.lte]: moment
                    .tz(`${conf.year}-${conf.month}-${conf.day} 23:59:59`, 'YYYY-MM-DD HH:mm:ss', TIMEZONE)
                    .format('YYYY-MM-DD HH:mm:ss')
            }
        };
        if (payload.merchant_id_list) {
            where_condition.id = { [Sequelize.Op.in]: [payload.merchant_id_list] };
        }

        const payloadArray = await Customer.findAll({
            attributes: ['id'],
            where: where_condition,
            raw: true
        }).then(function (resultSet) {
            let payloadArray = new Array();
            resultSet.forEach((resultSetItem) => {
                payloadArray.push({
                    ...conf,
                    merchant_id: resultSetItem.id
                });
            });
            return payloadArray;
        });

        //console.log(payloadArray);
        //push to sqs
        let promiseExecutionResponse = await publishingToQueue(payloadArray);
        console.log('Finished Execution', promiseExecutionResponse);

        //trigger an email to notify its initiated
        await sequelize.close();
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

let publishingToQueue = async (PayloadArray) => {
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

    let sendMessagePromises = PayloadArray.map(async (payload) => {
        const params = {
            MessageBody: JSON.stringify(payload),
            QueueUrl: queueUrl
        };
        const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
        return sqs.sendMessage(params).promise();
    });
    let promiseExecutionResponse = await Promise.all(sendMessagePromises);
    return promiseExecutionResponse;
};
