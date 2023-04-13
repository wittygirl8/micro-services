var { response, cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
const schemaValidate = require('./earth-helper/schema-validation');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;

export const decryptAddCardData = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ decryptAddCardData',
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

    const { sequelize } = db;
    var t2s_sequelize = t2sDb.sequelize;
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        const encryptedPayload = JSON.parse(event.body);

        let decryptedPayload = cryptFunctions.decryptPayload(
            encryptedPayload.data,
            process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
        );
        //checking for corrupt data
        if (JSON.parse(JSON.stringify(decryptedPayload)).hasOwnProperty('error')) {
            throw { message: 'Invalid request', type: '' };
        }

        decryptedPayload = JSON.parse(decryptedPayload);
        decryptedPayload = await schemaValidate.addCardPayloadSchema.validateAsync(decryptedPayload);

        let api_response = {
            request_id: requestId,
            message: 'Decrypted Data',
            data: {
                ...decryptedPayload
            }
        };

        logger.info(logMetadata, 'api_response', api_response);
        await sequelize.close();
        await t2s_sequelize.close();

        return response(api_response);
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message,
                redirect_url: e.redirect_url
            }
        };

        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();
        await t2s_sequelize.close();

        return response(errorResponse, 500);
    }
};
