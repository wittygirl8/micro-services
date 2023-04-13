const AWS = require('aws-sdk');
import { v4 as uuidv4 } from 'uuid';
var { response, flakeGenerateDecimal, schema, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');

let logger = logHelpers.logger;

export const orderReceipt = async (event, context) => {
    let logMetadata = {
        location: 'MessagingService ~ orderReceiptHandler',
        awsRequestId: context.awsRequestId
    };

    const requestId = 'reqid_' + flakeGenerateDecimal();

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    var { sequelize } = db;

    try {
        const SES_API_KEY = process.env.DATMAN_SES_HANDLER_API_KEY;
        const { api_key } = event.headers;

        if (!api_key || api_key !== SES_API_KEY) {
            logger.error(logMetadata, 'Error', 'UNAUTHORISED');
            return response(
                {
                    message: 'UNAUTHORISED'
                },
                401
            );
        }

        let reqParams = JSON.parse(event.body);

        reqParams = await schema.orderReceiptSchema.validateAsync(reqParams);

        var channelUrl = '';
        var payload = '';

        // let PaymentRecords = await Payment.findAll({
        //     where: {
        //         order_id: reqParams.orderId
        //     }
        // });

        // //will add placeholder replacement logic soon
        // logger.info(logMetadata, 'PaymentRecords', JSON.stringify(PaymentRecords));

        if (reqParams.communication_channel == 'EMAIL') {
            channelUrl = process.env.EMAIL_QUEUE_URL;

            var regexEmail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // eslint-disable-line

            if (!regexEmail.test(reqParams.to_address)) {
                return response(
                    {
                        message: 'Please provide valid emails'
                    },
                    500
                );
            }

            payload = {
                type: 'Basic',
                subject: 'Order Receipt',
                html_body: reqParams.emailText,
                cc_address: [],
                to_address: [reqParams.to_address],
                template_name: '',
                source_email: reqParams.from_address,
                replacement_tag_name: '',
                reply_to_address: [],
                default_tag_name: ''
            };
        } else if (reqParams.communication_channel == 'SMS') {
            channelUrl = process.env.SMS_QUEUE_URL;
            var regexPhone = /^[+-]?\d+$/;
            if (!regexPhone.test(reqParams.mobile_number)) {
                return response(
                    {
                        message: 'Please provide valid phone number'
                    },
                    500
                );
            }

            payload = {
                message_text: reqParams.smsText,
                phone_number: reqParams.mobile_number
            };
        }
        let options = {};

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            channelUrl = process.env.LOCAL_QUEUE_URL;
        }

        const sqs = new AWS.SQS(options);

        const objectStringified = JSON.stringify({
            payload
        });

        logger.info(logMetadata, 'Channel', reqParams.communication_channel);
        logger.info(logMetadata, 'Queue Url', channelUrl);
        logger.info(logMetadata, 'objectStringified', objectStringified);

        const params = {
            MessageGroupId: uuidv4(),
            MessageBody: objectStringified,
            QueueUrl: channelUrl
        };

        var res = await sqs.sendMessage(params).promise();
        logger.info(logMetadata, 'send message result', res);
        await sequelize.close();
        return response({
            message: 'The request was processed successfully',
            data: {
                success: 'ok'
            }
        });
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();
        return response(errorResponse, 500);
    }
};
