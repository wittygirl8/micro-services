const axios = require('axios');

const newCardSale = async (obj) => {
    console.log('new card', obj);
    var data = JSON.stringify({
        amount: parseInt(obj.amountItems.total),
        // amount: 12.4,
        currency: obj.amountItems.country_code_3letters,
        reference: obj.omt,
        processing_channel_id: obj.amountItems.checkout_pc,
        // not sure about this info need to verify from checkout.
        billing: {
            address: {
                country: obj.amountItems.country_code_2letters
            }
        },
        metadata: {
            webhook_url: obj.webhook_url,
            omt: obj.omt,
            transaction_id: obj.transaction_id,
            customer_id: obj.customer_id,
            order_id: obj.order_id,
            via_saved_card: 0
        },
        customer: {
            name: `${obj.first_name} ${obj.last_name}`,
            email: obj.email
        },
        '3ds': {
            enabled: true
        },
        success_url: obj.redirect_url,
        failure_url: obj.cancel_url,
        cancel_url: obj.cancel_url
    });

    var config = {
        method: 'post',
        url: JSON.parse(process.env.CHECKOUT).baseUrl + '/hosted-payments',
        headers: {
            Authorization: JSON.parse(process.env.CHECKOUT).secretKey,
            'Content-Type': 'application/json'
        },
        data: data
    };
    return await axios(config);
};

const saveCardSale = async (obj) => {
    var data = JSON.stringify({
        amount: parseInt(obj.amountItems.total),
        currency: obj.amountItems.country_code_3letters,
        reference: obj.omt,
        processing_channel_id: obj.amountItems.checkout_pc,
        // not sure about this info need to verify from checkout.
        // billing: {
        //     address: {
        //         country: obj.amountItems.country_code_2letters
        //     }
        // },
        metadata: {
            webhook_url: obj.webhook_url,
            omt: obj.omt,
            transaction_id: obj.transaction_id,
            customer_id: obj.customer_id,
            order_id: obj.order_id,
            via_saved_card: 1,
            merchant_id: obj.merchant_id
        },
        customer: {
            name: `${obj.first_name} ${obj.last_name}`,
            email: obj.email
        },
        '3ds': {
            enabled: true
        },
        success_url: obj.redirect_url,
        failure_url: obj.cancel_url,
        cancel_url: obj.cancel_url,
        source: {
            id: obj.cc_token,
            type: 'id',
            cvv: obj.cvv
        }
    });

    console.log('request to checkout', JSON.parse(data));
    var config = {
        method: 'post',
        url: JSON.parse(process.env.CHECKOUT).baseUrl + '/payments',
        headers: {
            Authorization: `Bearer ${JSON.parse(process.env.CHECKOUT).secretKey}`,
            'Content-Type': 'application/json'
        },
        data: data
    };
    return await axios(config);
};

export const checkoutSessionCreation = async (dbInstance, documentXray, obj) => {
    // try {
    console.log('checkoutSessionCreation object', obj);
    var response;
    if (obj?.cc_token) {
        console.log('cc_token', obj.cc_token);
        response = await saveCardSale(obj);
    } else {
        console.log('cc_token', obj.cc_token);
        response = await newCardSale(obj);
    }
    console.log('response from checkoutSessionCreation', response.data);
    return response.data;
    // } catch (e) {
    //     console.log('api error', JSON.stringify(e.response.data));
    //     throw new Error(JSON.stringify(e.response.data));
    // }
};
