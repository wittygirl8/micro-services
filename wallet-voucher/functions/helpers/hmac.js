var { cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

export const hmac = async (event) => {
    let requestObj = JSON.parse(event.body);
    let decryptedPayload = cryptFunctions.decryptPayload(requestObj.data, process.env.REFERRAL_WALLET_BONUS_API_KEY);
    return decryptedPayload;
};
