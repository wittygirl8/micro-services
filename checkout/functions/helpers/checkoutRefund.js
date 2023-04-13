export const checkoutRefund = async (documentXray, obj) => {
    var axios = require('axios');
    var data = JSON.stringify({
        amount: obj.amount
        //   "reference": "ORD-5023-4E89"
    });

    documentXray.addMetadata('refundReqPayload', data);

    var config = {
        method: 'post',
        url: JSON.parse(process.env.CHECKOUT).baseUrl + `/payments/${obj.checkout_payment_id}/refunds`,
        headers: {
            Authorization: `Bearer ${JSON.parse(process.env.CHECKOUT).secretKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        data: data
    };

    let response = await axios(config);
    documentXray.addMetadata('refundRespPayload', response.data);
    return response.data;
};
