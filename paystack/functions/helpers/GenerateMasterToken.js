const crypto = require('crypto');
export const GenerateMasterToken = async (params) => {
    let {payload} = params;
    var masterTokenKeys = {
        //using signature from the payload, as that will be unique for every card as per paystack documentation
        card_number: `${payload?.data?.authorization?.signature}`,
        exp_month: payload?.data?.authorization?.exp_month,
        exp_year: payload?.data?.authorization?.exp_year
    };

    //hashed the concatenated string, this will be master token
    let hash = crypto.createHash('md5').update(JSON.stringify(masterTokenKeys)).digest('hex');
    return `mxtoken_${hash}`;
}