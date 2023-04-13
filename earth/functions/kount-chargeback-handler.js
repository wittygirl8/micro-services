var { response, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

let currentCodeEnv = helpers.getCodeEnvironment();
var axios = require('axios');
var qs = require('qs');
let logger = logHelpers.logger;

export const kountChargebacks = async (event, context) => {
    // const requestId = 'reqid_' + flakeGenerateDecimal();

    let logMetadata = {
        location: 'EarthService ~ kountChargebacks',
        awsRequestId: context.awsRequestId
    };

    const requestId = `reqid_${context.awsRequestId}`;
    try {
        const paylod = JSON.parse(event.body);
        logger.info(logMetadata, 'Payload', paylod);
        //check if payload has required fields
        if (!paylod.transaction_id || !paylod.chargeback_code) {
            return response(
                {
                    message: 'failed',
                    err: 'mandatory keys are missing transaction_id, chargeback_code'
                },
                500
            );
        }

        //this is test kount api url
        var url = 'https://api.test.kount.net/rpc/v1/orders/rfcb.json';

        if (currentCodeEnv == 'production') {
            url = 'https://api.kount.net/rpc/v1/orders/rfcb.json';
        }

        var reqBody = {};

        reqBody[`rfcb[${paylod.transaction_id}]`] = 'C';
        reqBody[`cbcode[${paylod.transaction_id}]`] = paylod.chargeback_code;

        var data = qs.stringify(reqBody);

        var config = {
            method: 'post',
            url: url,
            headers: {
                'x-kount-api-key': process.env.KOUNT_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };
        var repo = await axios(config);

        let api_response = {
            request_id: requestId,
            message: ''
        };
        if (repo.data && repo.data.status == 'ok') {
            api_response.message = 'Chargeback added successfully.';
        } else {
            return response(
                {
                    error: {
                        request_id: requestId,
                        type: 'Error',
                        message: repo.data.errors
                    }
                },
                500
            );
        }

        return response(api_response);
    } catch (e) {
        logger.error(logMetadata, e);
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        return response({ errorResponse }, 500);
    }
};
