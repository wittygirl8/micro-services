var axios = require('axios');
export const checkoutPayments = async (obj) => {
    console.log('obj checkoutPayments', obj);
    var data = JSON.stringify({
        source: {
            type: 'token',
            token: obj.provider_token
        },
        amount: parseInt(obj.amountItems.total),
        currency: obj.amountItems.country_code_3letters,
        '3ds': {
            enabled: true
        },
        processing_channel_id: obj.amountItems.checkout_pc,
        metadata: {
            webhook_url: obj.webhook_url,
            omt: obj.omt,
            transaction_id: obj?.transaction_id,
            customer_id: obj?.customer_id,
            order_id: obj?.order_id
        },
        success_url: obj.redirect_url,
        failure_url: obj.cancel_url,
        cancel_url: obj.cancel_url
    });

    var config = {
        method: 'post',
        url: JSON.parse(process.env.CHECKOUT).baseUrl + '/payments',
        headers: {
            Authorization: `Bearer ${JSON.parse(process.env.CHECKOUT).secretKey}`,
            'Content-Type': 'application/json'
        },
        data: data
    };

    let response = await axios(config).then((res) => res).catch((err) => {
        console.log('Error in checkoutPayments API', err.response);
        throw (err.response ? { status: err.response.status, message: err.response.data } :  { status: 500, message: err.message });
    });
    console.log('here is the responseeeeee', response?.data);
    return response;
};
