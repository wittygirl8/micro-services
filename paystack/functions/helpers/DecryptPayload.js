var { cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const DecryptPayload = async (data) => {
    try {
        let decryptedPayload = cryptFunctions.decryptPayload(
            data,
            process.env.PAYSTACK_PAYLOAD_DECRYPTION_KEY
        );
    
        let payload = JSON.parse(decryptedPayload);
        // payload['total'] = (parseFloat(payload?.total) * 100).toString();
        return payload;    
    } catch (e) {
        console.log('DecryptPayload Exception', e.message);
        throw {code: (e.code || 500), message: "Invalid request!"};
    }
    
};
