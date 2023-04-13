import AWS from 'aws-sdk';
const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
var DnaHelpers = require('../logic/dna-helpers');
const s3 = new AWS.S3({
    accessKeyId: 'AKIAYQHXHQ6NTEZYPQUX',
    secretAccessKey: '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',
    signatureVersion: 'v4',
    region: 'eu-west-1'
});

let logger = logHelpers.logger;
export const sendAttachment = async (event, context) => {
    let requestId = `reqid_${context.awsRequestId}`;
    let logMetadata = {
        location: 'MessagingService ~ DNABatchProcessing',
        awsRequestId: context.awsRequestId
    };

    try {
        let fileName = moment().tz(TIMEZONE).format('YYYY_MM_DD') + '_DN';
        let preSignedUrls = await DnaHelpers.getFromS3Bucket(fileName, s3);
        let zipFile = await DnaHelpers.generateZipFile(preSignedUrls);
        console.log(`zipFile:`, zipFile);
        let moreInfo = {
            // total_count: ,
            // total_value : ,
            email_queue_url: process.env.EMAIL_QUEUE_URL
        };
        await DnaHelpers.sendEmail(zipFile, moreInfo);
        return response({ message: 'Success' });
    } catch (error) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: error.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        return response({ errorResponse }, 500);
    }
};
