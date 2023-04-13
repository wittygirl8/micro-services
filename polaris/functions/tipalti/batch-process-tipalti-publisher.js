import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var TipaltiHelpers = require('../logic/tipalti-helpers');
let logger = logHelpers.logger;
const PAYLOAD_COUNTER_CUTOFF = 100;

export const processBatch = async (event, context) => {
    try {
        var logMetadata = {
            location: 'Tipalti ~ processBatch ~ Publisher',
            awsRequestId: context.awsRequestId
        };
        var error_message = '';

        // console.log(process.env);
        //db connection establish
        var db = await TipaltiHelpers.getDbConnection();

        const payoutBatches = await db.PayoutBatch.findAll({
            where: {
                status: 'PENDING',
                payout_provider: 'TIPALTI'
            },
            attributes: ['batch_id'],
            raw: true
        });

        db.sequelize.close && (await db.sequelize.close());

        // logger.info(logMetadata, {payoutBatches});

        let payoutInfo = new Array();
        let payoutInfoTemp = new Array();
        let payloadCounter = 0;
        let totalProcessedCount = 0;
        payoutBatches.forEach((item) => {
            // var payloadMid = {
            //     batch_id: item.batch_id
            // };
            var payloadMid = item.batch_id;
            payloadCounter++;
            totalProcessedCount++;
            payoutInfoTemp.push(payloadMid);
            if (payloadCounter >= PAYLOAD_COUNTER_CUTOFF) {
                // payoutInfo[payloadCounterBatchNo] = new Array();
                payoutInfo.push(payoutInfoTemp);
                payoutInfoTemp = [];
                payloadCounter = 0; //reset the conter
            }
        });

        //there could be some remaining records at the end, check them populate them aswell
        if (payoutInfoTemp.length !== 0) {
            payoutInfo.push(payoutInfoTemp);
        }

        logger.info(logMetadata, { payoutInfo });
        if (payoutInfo.length === 0) {
            error_message = 'No pending Tipalti payouts found!';
            logger.info(logMetadata, { error_message });
            throw { message: error_message };
        }
        console.log(`Total ${totalProcessedCount} records found and grouped into ${payoutInfo.length} batches`);

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
                MessageBody: JSON.stringify({
                    payout_provider: 'TIPALTI',
                    batch_ids: JSON.stringify(v)
                }),
                QueueUrl: queueUrl
            };
            console.log({ params });
            const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
            return await sqs.sendMessage(params).promise();
        });
        let promiseExecutionResponse = await Promise.all(sendMessagePromises);
        console.log({ promiseExecutionResponse });
        db.sequelize.close && (await db.sequelize.close());
        return response({ isSuccessful: true });
    } catch (e) {
        let errorResponse = e.message;
        logger.error(logMetadata, 'errorResponse', errorResponse);
        (await db.sequelize.close) && (await db.sequelize.close());
        return response({ errorResponse }, 500);
    }
};
