const { getIdFromReference } = require('./get-id-from-reference');

export const logCheckoutWebhookLog = async (params) => {
    let { payload, db } = params;
    try {
        var transaction_reference = payload.data.reference || payload.data.transaction_reference;
        var logCheckoutWebhookLogInfo;
        logCheckoutWebhookLogInfo = await db.CheckoutWebhookLog.create({
            event: payload.type,
            reference: transaction_reference,
            merchant_id: getIdFromReference(transaction_reference, 'merchant_id'),
            payload: JSON.stringify(payload)
        });
        return logCheckoutWebhookLogInfo.dataValues;
    } catch (e) {
        console.log('logCheckoutWebhookLog', e.message);
        //if the webhook does not contain a reference with OMT value, then will log the entry without merchant_id
        //as there is a chance that foodgital's txn can reach here aswell
        //this can be ignored later on
        logCheckoutWebhookLogInfo = await db.CheckoutWebhookLog.create({
            event: payload.type,
            reference: transaction_reference,
            payload: JSON.stringify(payload)
        });
        return logCheckoutWebhookLogInfo.dataValues;
    }
};
