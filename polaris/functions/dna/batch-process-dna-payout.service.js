/*
 * @step# : 4
 * @Description: This consumer picks the message published by ProcessDNAPublisher from BatchProcessDnaQueue and initiates for payout by invoking the dna service
 * @Test: No input required, running the lambda will do the processing
 */

import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { logHelpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');
var DnaHelpers = require('../logic/dna-helpers');
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;

const s3 = new AWS.S3({
    accessKeyId: 'AKIAYQHXHQ6NTEZYPQUX',
    secretAccessKey: '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',
    signatureVersion: 'v4',
    region: 'eu-west-1'
});

export class BatchProcessDnaPayoutService {
    async init(event, context) {
        let logMetadata = {
            location: 'DnaPayout~ProcessPayment',
            awsRequestId: `reqid_${context.awsRequestId}` || 'no_aws_reference'
        };

        logger.info(logMetadata, `Payout Processing Started`, event);
        let LoopingArray = event?.Records;
        if (process.env.IS_OFFLINE) {
            LoopingArray = [
                {
                    messageId: '81d86113-c5cc-4ad7-b0da-06bed936c157',
                    receiptHandle:
                        'AQEBMUkB8WcPEKr7Ire9kpQD+Ye9IlwQq75oCxyfjtiHt/HOP4FBjpGp5ykrTbEfmD183966dqH8/ezkXCSeKFoh+bFXram/uw1pIuwpM29+ovfXTwopch3x0hWKUyThb9yym9DaP9nKhprWXxXBGySbDIO0Otmte99xLs7zzWFMjvAU//WDt378cZC1GQeaIk+JSLkajbm9HY7kC6rNJKc1Bpt/D+IlW2lmUIa1uzhgJ+vtSby0USvWGYUldU4o904rEnzG+vYVrE6Cw1V49UIyas0PI2ayN+QHiIkfd3R24Z83RY57o1YWV8Ihf7hK5oNffrHmK2DD6Qr9yzycvVHw8vIAJjoPFO1klfUKNW1iqhxwCGuRJNmmj/py/x2FVGDqEMbbDnDzb/ah9IBNzaWbdg==',
                    body:
                        '{"record":"[{\\"batch_id\\":1492,\\"customer_id\\":1234568,\\"total\\":14404,\\"status\\":\\"PENDING\\",\\"date_pending\\":\\"2022-10-11T16:18:03.000Z\\",\\"date_sent\\":null,\\"date_complete\\":null,\\"date_expected\\":null,\\"week_no\\":41,\\"not_received\\":0,\\"not_received_date\\":null,\\"account_number\\":\\"1234*******\\",\\"sort_code\\":\\"ABCDEF\\",\\"bank_name\\":\\"TEST BANK\\",\\"account_holder\\":\\"testing\\",\\"updated_at\\":\\"2022-10-14T14:23:06.000Z\\",\\"created_at\\":\\"2022-10-11T15:18:03.000Z\\",\\"pp_token\\":\\"rp_xFf1uh5hkhYrvdr-MkaLBg\\",\\"transfer_token\\":\\"\\",\\"payout_provider\\":\\"DNA_BARCLAYS\\",\\"currency\\":\\"GBP\\",\\"accountnumber\\":\\"12345678\\",\\"sortcode\\":\\"123456\\",\\"bankname\\":\\"TEST BANK\\",\\"accountholder\\":\\"testing\\"},{\\"batch_id\\":1496,\\"customer_id\\":63189380,\\"total\\":14404,\\"status\\":\\"PENDING\\",\\"date_pending\\":\\"2022-10-11T16:18:03.000Z\\",\\"date_sent\\":null,\\"date_complete\\":null,\\"date_expected\\":null,\\"week_no\\":41,\\"not_received\\":0,\\"not_received_date\\":null,\\"account_number\\":\\"1234*******\\",\\"sort_code\\":\\"ABCDEF\\",\\"bank_name\\":\\"TEST BANK\\",\\"account_holder\\":\\"testing\\",\\"updated_at\\":\\"2022-10-14T14:23:06.000Z\\",\\"created_at\\":\\"2022-10-11T15:18:03.000Z\\",\\"pp_token\\":\\"rp_xFf1uh5hkhYrvdr-MkaLBg\\",\\"transfer_token\\":\\"\\",\\"payout_provider\\":\\"DNA_BARCLAYS\\",\\"currency\\":\\"GBP\\",\\"accountnumber\\":\\"12345680\\",\\"sortcode\\":\\"123458\\",\\"bankname\\":\\"testing bank name\\",\\"accountholder\\":\\"testing account holder\\"}]","startTime":1665757406245,"cron_record_id":707,"is_last":true,"record_no":1,"EMAIL_QUEUE_URL":"https://sqs.eu-west-1.amazonaws.com/584634042267/SendEmailQueue-hotfix.fifo","requestId":"aa6ff971-3e72-4add-953b-eebda7def2c3","total_value":28808,"total_count":2,"record_ids":[1492,1496]}',
                    attributes: {
                        ApproximateReceiveCount: '1',
                        AWSTraceHeader: 'Root=1-634970dc-7917d1556d53d9f90f53fb73;Parent=d6220a290d426a6d;Sampled=1',
                        SentTimestamp: '1665757406813',
                        SenderId: 'AROAYQHXHQ6N75VNBCO34:datman-polaris-hotfix-ProcessDNAPublisher',
                        ApproximateFirstReceiveTimestamp: '1665757406822'
                    },
                    messageAttributes: {},
                    md5OfBody: 'a766cc622758ddf600f7ef5a217b2e9e',
                    eventSource: 'aws:sqs',
                    eventSourceARN: 'arn:aws:sqs:eu-west-1:584634042267:BatchProcessDnaQueue-hotfix',
                    awsRegion: 'eu-west-1'
                }
            ]; //for local testing
        }
        logger.info(logMetadata, { LoopingArray });
        const promises = LoopingArray.map((message) => {
            let payload = JSON.parse(message.body);
            console.log({ payload });

            return this.DnaPayoutProcessing(message, logMetadata);
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async DnaPayoutProcessing(message, logMetaData) {
        let payload = JSON.parse(message.body);
        let batch_ids = payload.record_ids;
        logger.info(logMetaData, 'DnaPayoutProcessing', { payload });

        // DNA message will be sent from publisher as a set of batch_ids, max limit upto 100.
        // Loop through the ids and prepare the final/single/large payload for DNA API request
        var db = await DnaHelpers.getDbConnection();
        const payoutBatchesCount = await db.PayoutBatch.count({
            where: {
                batch_id: {
                    [db.Sequelize.Op.in]: batch_ids
                },
                status: 'PENDING',
                payout_provider: 'DNA_BARCLAYS'
            },
            raw: true
        });
        console.log(`Found ${payoutBatchesCount.length} records for payoutBatches`);
        if (payoutBatchesCount > 0) {
            logger.info(logMetaData, 'DnaPayoutProcessing', { message: 'PayoutBatches are in PENDING status' });
            return { message, success: false };
        }

        // generate CSV file
        const record = JSON.parse(payload.record);
        let generateCsvResults = await DnaHelpers.generateCsv(record, payload);
        console.log('fileName', generateCsvResults?.fileName);
        let s3Results = await DnaHelpers.s3Upload(Buffer.from(generateCsvResults.csv), generateCsvResults.fileName, s3);
        console.log('s3Results', s3Results);

        return { message, success: true };
    }

    async postProcessMessage(executions) {
        console.log('Executions result:', executions);
        let options = {};

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
        }
        const sqs = new AWS.SQS(options);

        const processSuccesItems = executions.filter((result) => result?.success === true);

        for (let successMsg of processSuccesItems) {
            const params = {
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: successMsg.message.receiptHandle
            };

            console.log(params, 'successMsg');
            try {
                await sqs.deleteMessage(params).promise();
            } catch (error) {
                // Do nothing, need to make the code idempotent in such case
            }
        }

        // For errors, lambda instance will not be available till visisibility timeout expires
        const processErrorItemsMsgIds = executions
            .filter((result) => result.success === false)
            .map((result) => result.event.messageId);
        throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
    }
}
