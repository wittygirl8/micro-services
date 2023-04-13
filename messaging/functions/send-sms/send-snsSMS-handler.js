const AWS = require('aws-sdk');
import { v4 as uuidv4 } from 'uuid';
var { response, flakeGenerateDecimal } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const sendSMS = async (event) => {
    const requestId = 'reqid_' + flakeGenerateDecimal();
    try {
        const SES_API_KEY = process.env.DATMAN_SES_HANDLER_API_KEY;
        const { api_key } = event.headers;

        if (!api_key || api_key !== SES_API_KEY) {
            return response(
                {
                    message: 'UNAUTHORISED'
                },
                401
            );
        }

        let payload = JSON.parse(event.body);
        var regex = /^[+-]?\d+$/;
        if (!regex.test(payload.phone_number) || !payload.message_text) {
            return response(
                {
                    message: 'Please provide valid phone number or message'
                },
                500
            );
        }
        let options = {};

        let queueUrl = process.env.QUEUE_URL;

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            queueUrl = process.env.LOCAL_QUEUE_URL;
        }

        const sqs = new AWS.SQS(options);

        const objectStringified = JSON.stringify({
            payload
        });

        console.log('Send message', queueUrl, objectStringified);
        console.log('Messaging :: Messaging service Send SMS:: Payload :: ', objectStringified);
        const params = {
            MessageGroupId: uuidv4(),
            MessageBody: objectStringified,
            QueueUrl: queueUrl
        };

        await sqs.sendMessage(params).promise();
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
        return response(errorResponse, 500);
    }
};
