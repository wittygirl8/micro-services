const axios = require('axios');

export const VerifyPaystackTransaction = async (params) => {
    let { paystack_txn_reference } = params;
    try {

        var config = {
            method: 'get',
            url: `${process.env.PAYSTACK_API_DOMAIN}/transaction/verify/${paystack_txn_reference}`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        let response = await axios(config);
        console.log('VerifyTxnResponse', JSON.stringify(response.data));
        return response.data.data;
    } catch (e) {
        console.log('VerifyPaystackTranaction Exception', e.message);
        throw new Error(e.message);
    }
};
