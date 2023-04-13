var { cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const hmac = async (event, context) => {
    let decryptedPayload = cryptFunctions.decryptPayload(
        event.queryStringParameters.data,
        JSON.parse(process.env.CHECKOUT).payloadEncryptionKey
    );
    // decryptedPayload['total'] = (parseFloat(decryptedPayload['total'])*100).toString()

    let payload = JSON.parse(decryptedPayload);
    payload['total'] = (parseFloat(payload?.total) * 100).toString();
    payload['cvv'] = event.queryStringParameters?.v;
    console.log('the payload with cvv', payload);
    return payload;
};
