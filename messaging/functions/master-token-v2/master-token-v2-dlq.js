var { cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const main = async (event) => {
    let { payload } = JSON.parse(event.body);

    var reqParams = cryptFunctions.decryptPayload(payload, process.env.MX_PAYLOAD_ENCRYPTION_KEY);

    console.log('Master Token V2 error messages:', {
        master_token: reqParams.master_token,
        provider: reqParams.provider,
        customer_id: reqParams.customer_id,
        merchant_id: reqParams.merchant_id
    });

    return {};
};
