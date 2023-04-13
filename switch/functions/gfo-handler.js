const { response, TokenAuthorize, cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { gfoRequestValidators } = require('../validators/gfo-request-validator');
const axios = require('axios');
const logger = logHelpers.logger;
const logMetadata = {
    location: 'SwitchService ~ gfoHandler'
};

export const gfo = async (event, context) => {
    logMetadata['awsRequestId'] = context.awsRequestId;

    const requestId = context.awsRequestId;
    let api_response = {
        request_id: requestId
    };
    try {
        //api authorization
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken);
        //payload validation
        if (!event.body) {
            throw new Error('Parameters missing');
        }
        let payload = JSON.parse(event.body);
        logger.info(logMetadata, 'Encrypted payload', payload);
        let decryptedPayload = cryptFunctions.decryptPayload(payload.data, process.env.SWITCH_PAYLOD_ENCRYPTION_KEY);
        decryptedPayload = JSON.parse(decryptedPayload);
        decryptedPayload = await gfoRequestValidators.validateAsync(decryptedPayload);
        logger.info(logMetadata, 'Decrypted payload', decryptedPayload);

        // to accomadate the multiprovider
        const GOOGLE_FOOD_ORDERING_GATEWAY = 'ADYEN';
        if (GOOGLE_FOOD_ORDERING_GATEWAY === 'ADYEN') {
            let adyenSaleRespone = await processAdyenSale(decryptedPayload);
            adyenSaleRespone = adyenSaleRespone.data;
            logger.info(logMetadata, 'adyenSaleRespone', adyenSaleRespone);
            delete adyenSaleRespone.request_id; //dettaching the request id from proxy
            api_response = {
                ...api_response,
                ...adyenSaleRespone
            };
            return response(api_response);
        }
        //keeping the below section to extend the gfo service to other providers, by sandeep
        else if (GOOGLE_FOOD_ORDERING_GATEWAY === 'PAYU') {
            // just an example to accomodate the another provider
            throw new Error('Payu is not supported on the google food ordering');
        } else {
            throw new Error('Please provide the valid GFO gateway, at the moment we support only AYDEN');
        }
    } catch (e) {
        let error_message = e.message || 'No error message found!';
        const errorResponse = {
            request_id: requestId,
            status: 'Error',
            message: `Transaction could not processed! (${error_message})`
        };
        logger.error(logMetadata, 'Catch error', e);
        logger.error(logMetadata, 'errorResponse', errorResponse);
        return response(errorResponse, 500);
    }
};

const processAdyenSale = async (payload, mockResponse = false) => {
    //mocking response for local testing
    if (mockResponse == 'success') {
        return {
            request_id: 'alskdfj-alsdkfjals-alskdflas',
            status: 'success',
            payment_id: 123456789
        };
    } else if (mockResponse == 'fail') {
        throw new Error('Forcing api failure for local testing');
    }
    try {
        return await axios({
            method: 'post',
            url: `${process.env.ANTAR_API_BASE_URL}/gfo/sale`,
            data: payload,
            headers: {
                'Content-Type': 'application/json',
                api_token: process.env.ANTAR_GFO_API_AUTHORIZE_TOKEN
            }
        });
    } catch (e) {
        logger.info(logMetadata, 'Axios catch error', e);
        let axios_error_message = e.response.data.error.message || 'No axios error message';
        logger.info(logMetadata, 'axios_error_message', axios_error_message);
        throw new Error(axios_error_message);
    }
};
