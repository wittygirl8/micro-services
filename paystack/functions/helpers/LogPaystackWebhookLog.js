const { GetIDFromReference } = require('./GetIDFromReference');

export const LogPaystackWebhookLog = async (params) => {
    let { payload, db } = params;
    try{
        var transaction_reference =  payload.data.reference || payload.data.transaction_reference;
        var LogPaystackWebhookLogInfo;
        LogPaystackWebhookLogInfo = await db.PaystackWebhookLog.create({
            event: payload.event,
            reference: transaction_reference,
            merchant_id: GetIDFromReference(transaction_reference,'merchant_id'),
            payload: JSON.stringify(payload)
        })
        return LogPaystackWebhookLogInfo.dataValues
    }catch(e){
        console.log('LogPaystackWebhookLog', e.message)
        //if the webhook does not contain a reference with OMT value, then will log the entry without merchant_id
        //as there is a chance that foodgital's txn can reach here aswell
        //this can be ignored later on
        LogPaystackWebhookLogInfo = await db.PaystackWebhookLog.create({
            event: payload.event,
            reference: transaction_reference,
            payload: JSON.stringify(payload)
        })
        return LogPaystackWebhookLogInfo.dataValues
    }
}