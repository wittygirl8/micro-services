import { v4 as uuidv4 } from 'uuid';
const AWS = require('aws-sdk');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { logHelpers, cronHelper, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;
const S3_BUCKET = JSON.parse(process.env.S3_BUCKET_CRED);
const s3 = new AWS.S3({
    accessKeyId: S3_BUCKET.accessKeyId,
    secretAccessKey: S3_BUCKET.secretAccessKey,
    signatureVersion: 'v4',
    region: 'eu-west-1'
});

export class CsvIrelandService {
    async init(event) {
        console.log(event);
        const promises = event.Records.map((message) => {
            console.log('csv published messaged', message);
            return this.processCSV(message);
        });
        const executions = await Promise.all(promises);
        let result = await this.postProcessMessage(executions);
        return result;
    }

    async postProcessMessage(executions) {
        const hasAtLeastOneError = executions.some((result) => result.success === false);

        console.log('Executions result:', executions);
        if (hasAtLeastOneError) {
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

            const processSuccesItems = executions.filter((result) => result.success === true);

            for (let successMsg of processSuccesItems) {
                const params = {
                    QueueUrl: process.env.QUEUE_URL,
                    ReceiptHandle: successMsg.event.receiptHandle
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
        } else {
            return { success: true };
        }
    }

    async processCSV(event) {
        console.log('Messaging :: Consumer: processCSV: body - ', event.body);
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        const { sequelize, Crons, Batch } = db;

        let logMetadata = {
            location: 'MessagingService ~ processCSVconsumer',
            awsRequestId: ''
        };

        try {
            const reqBody = JSON.parse(event.body);
            let {
                record,
                cron_record_id,
                is_last,
                startTime,
                record_no,
                total_count,
                EMAIL_QUEUE_URL,
                requestId,
                total_value,
                record_ids
            } = reqBody;

            logMetadata.awsRequestId = requestId;

            record = JSON.parse(record);

            if (Array.isArray(record) && record.length > 0) {
                const fileName = `${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_B${record_no}.csv`;
                var appendedDate = moment().tz(TIMEZONE).format('YYYYMMDD');
                var appendedTime = moment().tz(TIMEZONE).format('HHmmss');

                let csvData = '';
                var recordCount = 0;
                var recordTotal = 0;
                var merchantIdsAffected = '';
                for (const row of record) {
                    var recordType = '5';
                    var eQaccount = '5886-10031029';
                    var reference = `${row.customer_id}-${row.batch_id}`.substr(0, 16).toUpperCase();
                    var formattedTotal = Number.parseFloat(row.total.replace('-', '')).toFixed(2);
                    var payeeName = row.accountholder.replace(/\W/g, '').toUpperCase();
                    var customers_address_1 = row.customers_number.replace(/\W/g, '').substring(0, 35);
                    var customers_address_2 = row.customers_street.replace(/\W/g, '').substring(0, 35);
                    var customers_address_3 = row.customers_city.replace(/\W/g, '').substring(0, 35);
                    var business_address_1 = row.bank_address_1.replace(/\W/g, '').substring(0, 35);
                    var business_address_2 = row.bank_address_2.replace(/\W/g, '').substring(0, 35);
                    var bank_name = row.bankname.replace(/\W/g, '');

                    csvData += `${recordType}, ${eQaccount},,,,,T,${reference},N,GBP,0,EUR,${formattedTotal},,,F,165886,10031029,GBP,,,,,${customers_address_1}, ${customers_address_2}, ${customers_address_3}, ${business_address_1}, ${business_address_2},,${row.accountnumber},${payeeName},,,,,,${bank_name},Republic of Ireland,N,Y,,,,,,,\n`;

                    recordCount++;

                    var numData = Number(row.total.replace('-', ''));
                    recordTotal += Number(numData.toFixed(2));
                    merchantIdsAffected += `${row.customer_id}, `;
                }

                var csvHeader = `1, eQIntPaymnt${record_no}, ${appendedDate}, ${appendedTime}\n`;
                var csvContent = csvData;
                var csvFooter = `9, ${recordCount}, ${recordTotal.toFixed(2)}`;

                var s3Result = await helpers.s3Upload(csvHeader + csvContent + csvFooter, fileName, s3);

                logger.info(logMetadata, 's3Result', s3Result);

                var cron_update_status = {};
                var cronOutput = `${merchantIdsAffected} `;

                if (is_last) {
                    logger.info(logMetadata, 'record_ids', record_ids);

                    var batchResult = await Batch.update(
                        {
                            date_sent: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                            status: 'SENT'
                        },
                        { where: { batch_id: record_ids } }
                    );

                    console.log('batchResult: ', batchResult);

                    let downloadedFiles = await helpers.getFromS3Bucket(
                        `${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_B`,
                        s3
                    );

                    logger.info(logMetadata, 'downloadedFiles from s3', downloadedFiles);

                    var mediaContent = await helpers.generateZipFile(downloadedFiles);

                    logger.info(logMetadata, 'mediaContent', mediaContent);

                    var payload = {
                        attachments: JSON.stringify([
                            {
                                filename: `${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_DATM02.zip`,
                                content: Buffer.from(mediaContent).toString('base64'),
                                encoding: 'base64'
                            }
                        ]),
                        source_email: 'info@datman.je',
                        to_address: 'isika@mypay.co.uk', //"aymen@datman.je",
                        cc_address: 'nitish@datman.je', //"muzammil@datman.je",
                        subject: `DATM02 -Ireland-${fileName}`,
                        html: `Hello,<br><br> I have checked and verified all the payments in the attached zip file. I can confirm they are fine to be released.<br><bt>Please note there are ${total_count} payments, to the value of ${total_value.toFixed(
                            2
                        )}<br><br>Regards,<br>Ardian Mula<br>`
                    };

                    logger.info(logMetadata, 'email Payload', payload);

                    let options = {};

                    let queueUrl = EMAIL_QUEUE_URL;

                    const sqs = new AWS.SQS(options);

                    const objectStringified = JSON.stringify({
                        payload
                    });

                    console.log('Send message', queueUrl, objectStringified);
                    console.log('Messaging :: Messaging service Send Email:: Payload :: ', objectStringified);
                    const params = {
                        MessageGroupId: uuidv4(),
                        MessageBody: objectStringified,
                        QueueUrl: queueUrl
                    };

                    var executedResult = await sqs.sendMessage(params).promise();

                    logger.info(logMetadata, 'executedResult', executedResult);

                    cron_update_status = {
                        finished_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                        status: 'FINISHED'
                    };

                    cronOutput += ` Time Execution: ${(Date.now() - startTime) / 1000} seconds`;
                }

                cron_update_status['output'] = sequelize.fn('CONCAT', sequelize.col('output'), cronOutput);

                await cronHelper.finish(cron_update_status, Crons, cron_record_id);
            } else {
                logger.info(logMetadata, 'No Records found');
            }

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (error) {
            console.log(error);
            logger.error(logMetadata, '~ processCSV ~ error ~ ', error);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }
}
