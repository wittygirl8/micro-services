const axios = require('axios');

export const checkoutExpressSale = async (obj) => {
    console.log('obj expressPaySale', obj);

    const { payload, order_id, amountItems } = obj;

    const data = JSON.stringify({
        source: {
            type: 'id',
            id: payload.card_token,
            cvv: payload.cvv
        },
        amount: parseInt(amountItems.total),
        currency: amountItems.country_code_3letters,
        reference: payload.omt,
        '3ds': {
            enabled: false,
            exemption: 'trusted_listing'
        },
        processing_channel_id: amountItems.checkout_pc,
        metadata: {
            omt: payload.omt,
            order_id: order_id,
            transaction_id: payload.payment_id,
            sale_mode: 'express-sale'
        }
    });

    const config = {
        method: 'post',
        url: JSON.parse(process.env.CHECKOUT).baseUrl + '/payments',
        headers: {
            Authorization: `Bearer ${JSON.parse(process.env.CHECKOUT).secretKey}`,
            'Content-Type': 'application/json'
        },
        data: data
    };

    let api_response = await axios(config)
        .then((response) => {
            return { statusCode: 200, data: response.data };
        })
        .catch((error) => {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                return {
                    statusCode: error.response.status,
                    data: `${error.response.data.error_type} - ${error.response.data.error_codes.toString()}`
                };
            }
            return { statusCode: 500, data: error.message };
        });

    console.log('api_response', JSON.stringify(api_response));

    if (api_response.statusCode >= 400) {
        throw { code: api_response.statusCode, message: api_response.data };
    }
    return api_response;
};
