import AWS from 'aws-sdk';
import { DateTime } from 'luxon';
import { getAuthToken } from '../../services/dna-service';
const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

const { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');

export const getTransactions = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    const requestId = `reqid_${context.awsRequestId}`;
    let logMetadata = {
        location: 'DNAService ~ getTransactions',
        awsRequestId: context.awsRequestId
    };

    try {
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        const { sequelize, PartnerMerchant } = db;

        var queueUrl = process.env.PDQ_TRANSACTION_QUEUE_URL;

        logger.info(logMetadata, `Transaction Queue URL: ${queueUrl}`);

        const token = await getAuthToken('partners_reporting');

        logger.info(logMetadata, 'DNA auth token aquired');

        const merchants = await PartnerMerchant.findAll({ order: [['day_minus_job_executed_at', 'DESC']] });

        sequelize.close && (await sequelize.close());

        if (merchants.length === 0) {
            return response({ processedMerchants: [], message: 'No merchants to process' }, 200);
        }

        const processedMerchants = merchants.map(({ merchant_id, partner_merchant_id, day_minus_job_executed_at }) => ({
            merchant_id,
            partner_merchant_id,
            day_minus_job_executed_at
        }));

        logger.info(logMetadata, 'Processed Merchants', processedMerchants);

        // var counter = 0;

        let options = {};

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2022-19-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            queueUrl = process.env.LOCAL_QUEUE_URL;
        }

        await Promise.all(
            processedMerchants.map(async (item) => {
                const sqsClient = AWSXRay.captureAWSClient(new AWS.SQS(options));
                await processMerchants(sqsClient, token, item, queueUrl);
            })
        );

        return response({ processedMerchants, message: 'Merchants processed' }, 200);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: '',
                message: e.message,
                data: e.response ? e.response.data : undefined
            }
        };
        console.error(logMetadata, 'error', errorResponse);
        return response(errorResponse, 500);
    }
};

const processMerchants = async (sqsClient, token, merchants, queueUrl) => {
    try {
        let toDate = DateTime.now().toUTC();

        let fromDate = DateTime.now().toUTC().minus({ days: 3 });

        console.log('Before~', fromDate, toDate);

        fromDate = fromDate.startOf('minute').toISO();

        toDate = toDate.endOf('minute').toISO();

        console.log('After~', fromDate, toDate);

        let partner_merchant_id = merchants.partner_merchant_id;
        let merchant_id = merchants.merchant_id;
        let message = { token, fromDate, toDate, partner_merchant_id, merchant_id };

        const params = {
            MessageBody: JSON.stringify(message),
            QueueUrl: queueUrl
        };

        await sqsClient.sendMessage(params).promise();
    } catch (err) {
        console.log('Error Processing~', err);
    }
};
