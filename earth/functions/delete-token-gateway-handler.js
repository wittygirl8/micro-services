var { response, schema, cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const EG_TOKEN_PREFIX = 'egtoken_';
let logger = logHelpers.logger;

export const deleteTokenGateway = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ deleteTokenGateway',
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
    const t2sDb = connectDB(
        process.env.T2S_DB_HOST,
        process.env.T2S_DB_DATABASE,
        process.env.T2S_DB_USERNAME,
        process.env.T2S_DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, CardstreamRequestLog, CardstreamTokenLog } = db;
    var t2s_sequelize = t2sDb.sequelize;
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;

    try {
        const token = event.pathParameters.token;
        let payload = JSON.parse(event.body);

        //logging request
        var RequestLogId = await CardstreamRequestLog.create({
            encrypted_payload: JSON.stringify({ payload, token }),
            handler: 'deleteTokenGateway'
        });

        //validate encrypted and decrypted payload schema
        payload = await schema.encryptedDataSchema.validateAsync(payload);
        let decryptedPayload = cryptFunctions.decryptPayload(payload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        decryptedPayload = await schema.egPayloadSchema.validateAsync(JSON.parse(decryptedPayload));

        logMetadata.orderId = decryptedPayload.order_id;

        //delete from t2s token table
        await t2s_sequelize.query(`DELETE FROM customer_payment_information
            WHERE token = '${EG_TOKEN_PREFIX}${token}'
            AND customer_id = ${decryptedPayload.customer_id} LIMIT 1`);
        //delete token from cardstream table
        const deleteTokenRes = await CardstreamTokenLog.update(
            {
                is_deleted: 'YES'
            },
            {
                where: {
                    customer_id: decryptedPayload.customer_id,
                    token: token
                }
            }
        );
        //print no.of tokens deleted
        logger.info(logMetadata, 'deleteTokenRes', deleteTokenRes);

        const api_response = {
            request_id: requestId,
            message: 'Token deleted',
            data: {}
        };

        await CardstreamRequestLog.update(
            {
                order_id: decryptedPayload.order_id,
                payload: JSON.stringify(decryptedPayload),
                response: JSON.stringify(api_response)
            },
            {
                where: {
                    id: RequestLogId.id
                }
            }
        );
        logger.info(logMetadata, 'api_response', api_response);
        await sequelize.close();
        await t2s_sequelize.close();
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: '',
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
        await sequelize.close();
        await t2s_sequelize.close();
        return response(errorResponse, 500);
    }
};
