var { response, schema, cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;

export const pay = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ cancelPayment',
        orderId: '',
        awsRequestId: context.awsRequestId
    };

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, CardstreamRequestLog } = db;
    //const transaction = await sequelize.transaction();
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        const encryptedPayload = JSON.parse(event.body);
        let decryptedPayload = JSON.parse(
            cryptFunctions.decryptPayload(encryptedPayload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY)
        );
        logger.info(logMetadata, 'decryptedPayload', decryptedPayload);
        //error message will be sent from the frontend
        let transaction_failure_message = encryptedPayload.error_message;
        if (transaction_failure_message.search('Transaction failed') !== -1) {
            transaction_failure_message = transaction_failure_message.split('-');
        }

        if (decryptedPayload.mode === 'phone_payment') {
            decryptedPayload = await schema.egPhonePaymentPayloadSchema.validateAsync(decryptedPayload); //sanitization
        } else {
            decryptedPayload = await schema.egPayloadSchema.validateAsync(decryptedPayload); //sanitization
        }

        logMetadata.orderId = decryptedPayload.order_id;

        var RequestLogId = await CardstreamRequestLog.create({
            order_id: decryptedPayload.order_id,
            payload: JSON.stringify(decryptedPayload),
            encrypted_payload: event.body,
            handler: 'earth.cancelPayment'
        });

        let t2s_payload;
        if (typeof transaction_failure_message === 'string') {
            t2s_payload = {
                reason: 'Payment failed',
                error: transaction_failure_message
            };
        } else {
            t2s_payload = {
                reason: transaction_failure_message[1],
                error: `Transaction failure, Error code : ${transaction_failure_message[2]}`
            };
        }

        const encryptedT2SPayload = cryptFunctions.encryptPayload(
            JSON.stringify(t2s_payload),
            process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY
        );
        decryptedPayload.cancel_url +=
            `${decryptedPayload.cancel_url}`.search('[?]') === -1
                ? `?data=${encryptedT2SPayload}`
                : `&data=${encryptedT2SPayload}`;

        let api_response = {
            request_id: requestId,
            message: 'Payment successfully canceled.',
            data: {
                cancel_url: decryptedPayload.cancel_url
            }
        };

        await CardstreamRequestLog.update(
            {
                response: JSON.stringify(api_response)
            },
            { where: { id: RequestLogId.id } }
        );
        logger.info(logMetadata, 'api_response', api_response);
        // sends the http response with status 200
        //await transaction.commit();
        await sequelize.close();
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message
            }
        };

        RequestLogId
            ? await CardstreamRequestLog.update(
                  {
                      response: JSON.stringify(errorResponse)
                  },
                  {
                      where: {
                          id: RequestLogId.id
                      }
                  }
              )
            : null;
        logger.error(logMetadata, 'errorResponse', errorResponse);
        //await transaction.rollback();
        await sequelize.close();
        return response({ errorResponse }, 500);
    }
};
