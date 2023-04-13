var { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const axios = require('axios');

// custom helpers
const { pdqTransactionSchema } = require('../validators/pdq-transaction-validator');
const { createPdqTransaction } = require('../helpers/create-pdq-transaction');
const { createRequestLog, updateRequestLog } = require('../helpers/process-pdq-request-log');

var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
let StatusResult = {
    FAILED: 0,
    PROCESSED: 1
};

export const processPdqPayments = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'PDQ Consumer ~ processPdqPayments',
        awsRequestId: context.awsRequestId
    };

    var db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const requestId = `reqid_${context.awsRequestId}`;

    try {
        logger.info(logMetadata, 'process.env', process.env);
        logger.info(logMetadata, 'PDQ_SERVICE', process.env.PDQ_SERVICE);
        logger.info(logMetadata, 'apiAuthToken', JSON.parse(process.env.PDQ_SERVICE).apiAuthToken);
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken, JSON.parse(process.env.PDQ_SERVICE).apiAuthToken);

        let payload = JSON.parse(event.body);
        logger.info(logMetadata, 'payload', payload);

        // create entry into PdqTransactionRequestLog table
        const requestLogId = await createRequestLog(db, payload, logger, logMetadata);

        //sanity check
        payload = await pdqTransactionSchema.validateAsync(payload);

        // PDQ machine mid
        const mid = payload.merchant_id;

        logger.info(logMetadata, 'Bifrost Endpoints ', process.env.BIFROST_API_ENDPOINT);
        logger.info(logMetadata, 'Bifrost API Token ', process.env.BIFROST_API_TOKEN);

        // get first data merchant info
        let merchantInfo = await axios
            .get(`${process.env.BIFROST_API_ENDPOINT}/api/v1/bifrost/get-first-data-merchant-id/${mid}`, {
                headers: { api_token: process.env.BIFROST_API_TOKEN }
            })
            .then((res) => res.data)
            .catch((err) => {
                logger.error(logMetadata, 'Bifrost Response error', err.response);
                throw { message: err.response?.data };
            });

        logger.info(logMetadata, 'Bifrost Response ', merchantInfo);

        await createPdqTransaction(db, payload, merchantInfo, logger, logMetadata);

        // update status of PdqTransactionRequestLog
        await updateRequestLog(db, StatusResult.PROCESSED, requestLogId, logger, logMetadata);

        let api_response = {
            request_id: requestId,
            message: 'Successfully processed PDQ transaction'
        };
        logger.info(logMetadata, 'api_response', api_response);
        await db.sequelize.close();

        // sends the http response with status 200
        return response(api_response);
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await db.sequelize.close();
        return response(errorResponse, 500);
    }
};
