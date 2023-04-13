const {
    SESClient,
    SendEmailCommand,
    SendTemplatedEmailCommand,
    SendBulkTemplatedEmailCommand
} = require('@aws-sdk/client-ses');
import AWS from 'aws-sdk';
var { logHelpers } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

let logger = logHelpers.logger;
const nodemailer = require('nodemailer');

export class SESService {
    async sendBulkEmail(event, context = {}) {
        let logMetadata = {
            location: 'MessagingService ~ sendBulkEmail',
            awsRequestId: context.awsRequestId
        };
        const promises = event.Records.map((message) => {
            return this.processsSESEmails(message, logMetadata);
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions, logMetadata);
        logger.info(logMetadata, 'Final Result: ', result);
        return result;
    }

    async postProcessMessage(executions, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ sendBulkEmail ~ postProcessMessage',
            awsRequestId
        };
        const hasAtLeastOneError = executions.some((result) => result.success === false);

        logger.info(logMetadata, 'Executions result:', hasAtLeastOneError);
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
                    ReceiptHandle: successMsg.receiptHandle
                };
                try {
                    await sqs.deleteMessage(params).promise();
                } catch (error) {
                    // Do nothing, need to make the code idempotent in such case
                }
            }

            // For errors, lambda instance will not be available till visisibility timeout expires
            const processErrorItemsMsgIds = executions
                .filter((result) => result.success === false)
                .map((result) => result.message.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        } else {
            return { success: true };
        }
    }

    async processsSESEmails(message, { awsRequestId }) {
        let logMetadata = {
            location: 'MessagingService ~ sendBulkEmail ~ processsSESEmails',
            awsRequestId
        };
        logger.info(logMetadata, 'Messaging :: Consumer: processSendEmail: body - ', message.body);
        const body = JSON.parse(message.body);
        const payload = body.payload;
        logger.info(logMetadata, 'Payload: ', payload);
        try {
            const ses = new SESClient();
            var params = {};
            var sendPromise;

            if (payload.attachments) {
                var csvMedia = JSON.parse(payload.attachments);

                logger.info(logMetadata, 'csvMedia', csvMedia);

                const emailParams = {
                    from: payload.source_email,
                    to: payload.to_address,
                    bcc: payload.cc_address,
                    subject: payload.subject,
                    html: payload.html,
                    attachments: csvMedia
                };

                logger.info(logMetadata, 'emailParams', emailParams);

                var sendMailA = await this.sendMailAttachment(emailParams);
                if (sendMailA) return { message, success: true };
                else return { message, success: false };
            } else {
                if (payload.type == 'Basic' && !payload.template_name) {
                    params = {
                        Destination: {
                            CcAddresses: payload.cc_address,
                            ToAddresses: payload.to_address
                        },
                        Message: {
                            Body: {
                                Html: {
                                    Charset: 'UTF-8',
                                    Data: payload.html_body
                                }
                            },
                            Subject: {
                                Charset: 'UTF-8',
                                Data: payload.subject
                            }
                        },
                        Source: payload.source_email,
                        ReplyToAddresses: payload.reply_to_address
                    };
                    logger.info(logMetadata, 'Basic Without template: ', params);
                    sendPromise = await ses.send(new SendEmailCommand(params));
                } else if (payload.type == 'Basic' && payload.template_name) {
                    params = {
                        Destination: {
                            CcAddresses: payload.cc_address,
                            ToAddresses: payload.to_address
                        },
                        Source: payload.source_email, //SENDER_ADDRESS
                        Template: payload.template_name, // TEMPLATE_NAME
                        TemplateData: payload.replacement_tag_name,
                        ReplyToAddresses: payload.reply_to_address
                    };
                    logger.info(logMetadata, 'Basic with template: ', params);
                    sendPromise = await ses.send(new SendTemplatedEmailCommand(params));
                } else if (payload.type == 'Bulk' && payload.template_name) {
                    params = {
                        Destinations: [
                            {
                                Destination: {
                                    CcAddresses: payload.cc_address,
                                    ToAddresses: payload.to_address
                                },
                                ReplacementTemplateData: payload.replacement_tag_name
                            }
                        ],
                        Source: payload.source_email, // SENDER_ADDRESS
                        Template: payload.template_name, //TEMPLATE
                        DefaultTemplateData: payload.default_tag_name,
                        ReplyToAddresses: payload.reply_to_address
                    };
                    logger.info(logMetadata, 'Bulk with template: ', params);
                    sendPromise = await ses.send(new SendBulkTemplatedEmailCommand(params));
                } else {
                    logger.info(logMetadata, 'Bulk without template: ', params);
                    return { message: 'Bulk email without template is not possible.', success: false };
                }
                logger.info(logMetadata, 'Params: ', params);
                logger.info(logMetadata, 'Result: ', sendPromise);
                return { message, success: true };
            }
        } catch (error) {
            logger.error(logMetadata, 'Send Email error:', message.messageId, error);
            return { message, success: false };
        }
    }

    async sendMailAttachment(emailParams) {
        return new Promise((resolve, reject) => {
            try {
                console.log(emailParams, 'emailPArams');
                const transporter = nodemailer.createTransport({
                    SES: new AWS.SES({
                        apiVersion: '2010-12-01',
                        region: 'eu-west-1'
                    })
                });

                console.log('transporter: ', transporter);
                transporter.sendMail(emailParams, (error, info) => {
                    if (error) {
                        console.error(error, '*****');
                        reject(error);
                    }
                    console.log('transporter.sendMail result', info);
                    resolve(info);
                });
            } catch (error) {
                console.log(error, '#####');
                reject(error);
            }
        });
    }
}
