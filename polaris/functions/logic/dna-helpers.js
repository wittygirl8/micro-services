import AWS from 'aws-sdk';
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
const md5 = require('md5');
const S3_BUCKET_NAME = 'temporary-dna-payouts-files';
const JSZip = require('jszip');
const axios = require('axios');
import { v4 as uuidv4 } from 'uuid';

export const getDbConnection = async () => {
    let db = await connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    return db;
};

export const generateCsv = async (record, summaryInfo) => {
    if (Array.isArray(record) && record.length > 0) {
        //This should be passed form the publisher, for now I am hardcoding it
        const fileName = `${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_DN_B${summaryInfo.record_no}.csv`;
        const appendedDate = moment().tz(TIMEZONE).format('YYYYMMDD');
        const appendedTime = moment().tz(TIMEZONE).format('HHmmss');

        let csvData = '';
        let accountholder, recordType, eQaccount, formatedTotal, payeeName, reference;
        for (const row of record) {
            accountholder = await md5(row.account_holder);
            accountholder = accountholder.replace(/\W/g, '');
            recordType = '7';
            eQaccount = '5886-10031029';
            formatedTotal = Number.parseFloat(row.total / 100).toFixed(2);
            payeeName = `${row.customer_id}-${accountholder.replace(' ', '-').toUpperCase()}`.substr(0, 18);
            reference = `${row.customer_id}-${row.batch_id}-${accountholder}`.substr(0, 16).toUpperCase();
            csvData += `${recordType},${eQaccount},${row.sort_code},${row.account_number},${formatedTotal},,${payeeName},${reference}\n`;
        }
        const csvHeader = `1, ${fileName}, ${appendedDate}, ${appendedTime}, Y\n`;
        const csvContent = csvData;
        const csvFooter = `9, ${summaryInfo.total_count}, ${summaryInfo.total_value / 100 ?.toFixed(2)} `;

        const csv = csvHeader + csvContent + csvFooter;
        return { csv, fileName };
    }
};

export const s3Upload = async (csvData, fileName, s3) => {
    return await new Promise((resolve, reject) => {
        try {
            var params = { Bucket: S3_BUCKET_NAME, Key: fileName, Body: csvData };
            s3.upload(params, (err, response) => {
                if (err) reject(err);
                else resolve(response);
            });
        } catch (error) {
            console.log(error);
            reject(error);
        }
    });
};

const getS3SignedUrl = async (file, s3) => {
    return new Promise((resolve, reject) => {
        try {
            var params = {
                Bucket: S3_BUCKET_NAME,
                Key: file,
                Expires: 60 * 60 * 24
            };
            s3.getSignedUrl('getObject', params, function (err, url) {
                if (err) reject(err);
                else resolve(url);
            });
        } catch (error) {
            console.log(error);
            reject(error);
        }
    });
};

export const getFromS3Bucket = async (prefix, s3) => {
    return new Promise((resolve, reject) => {
        try {
            var params = {
                Bucket: S3_BUCKET_NAME,
                Prefix: prefix
            };
            s3.listObjectsV2(params, async (err, data) => {
                if (err) reject(err);
                else {
                    var urlcontent = data.Contents;
                    var files = urlcontent.map((e) => {
                        return {
                            filename: e.Key,
                            path: `https://${data.Name}.s3.${'eu-west-1'}.amazonaws.com/${e.Key}`
                        };
                    });

                    const urls = await Promise.all(
                        files.map(async (file) => {
                            let path = await getS3SignedUrl(file.filename, s3);
                            return { path, filename: file.filename };
                        })
                    );
                    console.log('urls', urls);
                    resolve(urls);
                }
            });
        } catch (error) {
            console.log(error);
            reject(error);
        }
    });
};

export const generateZipFile = async (filesUrl) => {
    try {
        console.log('generateZipFile: ', filesUrl);
        const zip = new JSZip();
        for (var f of filesUrl) {
            var response = await axios.get(f.path);
            zip.file(f.filename, response.data);
        }
        return await zip.generateAsync({ type: 'nodebuffer' });
    } catch (error) {
        console.error('Error while generating Zip File: ', error);
        return error;
    }
};

export const sendEmail = async (zipFileContent, moreInfo) => {
    try {
        console.log('Sending the email for :', zipFileContent);
        var payload = {
            // attachments: ([
            //     {
            //         filename: `${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_DNA.zip`,
            //         content: Buffer.from(zipFileContent).toString('base64'),
            //         encoding: 'base64'
            //     }
            // ]),
            source_email: 'info@datman.je',
            to_address: 'sandeep@datman.je', //"aymen@datman.je",
            cc_address: 'sukesh@mypay.co.uk', //"sandeep@datman.je",
            subject: `DNA ${moment().tz(TIMEZONE).format('YYYY_MM_DD')}_DNA.zip`,
            html: `Hello,<br><br> I have checked and verified all the payments in the attached zip file. I can confirm they are fine to be released.<br><bt>Please note there are ${
                moreInfo?.total_count
            } payments, to the value of ${moreInfo?.total_value?.toFixed(2)}<br><br>Regards,<br>Ardian Mula<br>`
        };
        console.log('Before pushing to sqs');
        const sqs = new AWS.SQS({});
        console.log('Printing sqs', sqs);

        const email_objectStringified = JSON.stringify({
            payload
        });
        console.log('email_objectStringified: ', email_objectStringified);
        console.log('email_queue_url: ', moreInfo.email_queue_url);
        const email_params = {
            MessageGroupId: uuidv4(),
            MessageBody: email_objectStringified,
            QueueUrl: moreInfo.email_queue_url
        };

        console.log('Email params for sending email - ', email_params);
        let result = await sqs.sendMessage(email_params).promise();
        console.log('After pushing to sqs', result);
        return result;
    } catch (err) {
        console.error('Error while sending email: ', err);
    }
};
