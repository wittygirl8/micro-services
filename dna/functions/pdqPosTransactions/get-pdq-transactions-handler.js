var { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const axios = require('axios');

// custom helpers
const { fetchPdqTransactions } = require('../helpers/fetch-pdq-transactions');

var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;

export const getPdqTransactions = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'PDQ Consumer ~ getPdqTransactions',
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
        logger.info(logMetadata, 'apiAuthToken', JSON.parse(process.env.PDQ_SERVICE).apiAuthToken);
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken, JSON.parse(process.env.PDQ_SERVICE).apiAuthToken);

        let queryParams = event.queryStringParameters;
        logger.info(logMetadata, 'queryParams', queryParams);

        //sanity check
        if (!queryParams || !queryParams?.from) {
            throw { message: 'from query param is required' };
        } else if (!queryParams?.first_data_mid) {
            throw { message: 'first_data_mid query param is required' };
        } else if (!queryParams?.transaction_type) {
            throw { message: 'transaction_type query param is required' };
        } else if (!['both', 'sale', 'refund'].includes(queryParams.transaction_type)) {
            throw { message: 'invalid transaction_type' };
        } else if (!queryParams?.order_by) {
            throw { message: 'order_by query param is required' };
        } else if (!['asc', 'desc'].includes(queryParams.order_by)) {
            throw { message: 'invalid order_by' };
        }

        // PDQ machine mid
        const mid = queryParams.first_data_mid;

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

        // get PDQ transactions
        const { pdqTransactionRecords, totalPages } = await fetchPdqTransactions(
            db,
            queryParams,
            merchantInfo,
            logger,
            logMetadata
        );

        let api_response = {
            request_id: requestId,
            message: 'Successfully fetched PDQ transactions',
            totalPages,
            data: pdqTransactionRecords
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
