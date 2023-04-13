var { cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const hmac = async (event) => {
    let decryptedPayload = cryptFunctions.decryptPayload(
        JSON.parse(event.body).data,
        JSON.parse(process.env.DNA_HOSTED_FORM).encriptionKey
    );

    let payload = JSON.parse(decryptedPayload);
    payload['total'] = (parseFloat(payload.total) * 100).toFixed();
    return payload;
};
