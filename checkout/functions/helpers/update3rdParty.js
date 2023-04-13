var { CheckoutService } = require('../../checkout.service');
const checkoutService = new CheckoutService();
const ni = require('nanoid');

const T2S_MERCHANT_PROVIDER = 'DNA';

export const update3rdParty = async (notificationData, documentXray, awsRequestId) => {
    // try {
    if (process.env.IS_OFFLINE) {
        return true;
    }

    console.log('notificationData', notificationData);
    let { metadata, source, amount } = notificationData;
    console.log('source', source);

    //prepare payload to send
    let t2sPayload = {
        transaction_id: metadata.transaction_id,
        customer_id: metadata.customer_id,
        order_info_id: metadata.order_id,
        amount: amount / 100
        // reference: requestPayload.reference
    };

    let masterToken;

    if (metadata.via_saved_card === '0') {
        // create only in case of new card sale
        masterToken = ni.nanoid(32);

        t2sPayload = {
            transaction_id: metadata.transaction_id,
            customer_id: metadata.customer_id,
            order_info_id: metadata.order_id,
            amount: amount / 100,
            // reference: requestPayload.reference,
            provider: T2S_MERCHANT_PROVIDER,
            token: masterToken, //master token
            last_4_digits: source.last_4,
            expiry_date: source.expiry_month / source.expiry_year.toString().substr(2),
            card_type: source.scheme,
            one_click: 'YES',
            is_primary: 'YES'
        };
    }

    console.log('here is the t2s payload', t2sPayload);
    documentXray.addMetadata('t2s_payload', t2sPayload);

    if (metadata.webhook_url && metadata.webhook_url !== 'undefined') {
        await checkoutService.notifyT2SSubscriber(metadata, t2sPayload, metadata.transaction_id, awsRequestId);
    } else {
        documentXray.addMetadata(`Order id: ${metadata.order_id}, Webhook url missing with T2S payload`);
    }

    if (metadata.via_saved_card === '0') {
        documentXray.addMetadata('Storing master token details for Token sale');
        await checkoutService.sendDataQueue(notificationData, metadata, masterToken, awsRequestId);
    }

    // } catch (e) {
    //     console.log('from catch', e.message);
    //     throw new Error(e.message);
    // }
};
