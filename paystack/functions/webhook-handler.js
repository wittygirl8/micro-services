const { response } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

// Custom Helpers
const { webhookAuth } = require('./helpers/webhookAuth');
const { getDBInstance } = require('./helpers/db');
const { LogPaystackWebhookLog } = require('./helpers/LogPaystackWebhookLog');
const { NotifyOrderStatusToMerchant } = require('./helpers/NotifyOrderStatusToMerchant');
const { CheckCardTokenizeStatus } = require('./helpers/CheckCardTokenizeStatus');
const { GenerateMasterToken } = require('./helpers/GenerateMasterToken');
const { MasterTokenizeCard } = require('./helpers/MasterTokenizeCard');
const { UpdatePayments } = require('./helpers/UpdatePayments');
const { UpdateRefundLog } = require('./helpers/RefundLog');
const { UpdateXpressSaleLog } = require('./helpers/XpressSaleLog');
const { GetIDFromReference } = require('./helpers/GetIDFromReference');
const { CheckAlreadyPaid } = require('./helpers/CheckAlreadyPaid');
const { RefundPaystack } = require('./helpers/RefundPaystack');
const { UpdateTransfers } = require('./helpers/UpdateTransfers');

export const main = async (event) => {
    try {
        var payload = JSON.parse(event.body);
        console.log('headers',event.headers)
        console.log('payload',JSON.stringify(payload))
        
        var db = await getDBInstance();
        
        //authenticate webhoook request to ensure its coming from right source
        await webhookAuth(event); //prod_checklist - Ensure this line is enabled/un-commented in production
        console.log('webhookAuth passed')

        //log the webhook response for future reference
        let LogPaystackWebhookLogInfo = await LogPaystackWebhookLog({
            db, payload
        });
        console.log({LogPaystackWebhookLogInfo})

        if(payload.event === 'charge.success'){

            //if sale initiated through xpress checkout, then we dont need to update payments table through this webhook
            if(payload?.data?.metadata?.sale_mode === 'xpress-sale'){
                //update the paystack_xpress_sale_log entry with webhook status
                let payment_id = GetIDFromReference(payload?.data?.reference,'txn_id');
                console.log({payment_id})
                let UpdateXpressLogResponse = await UpdateXpressSaleLog({
                    db,
                    UpdateObject: {
                        webhook_status: payload?.data?.status,
                        webhook_log_id: LogPaystackWebhookLogInfo.id
                    },
                    WhereConditionObject : {
                        payment_id,
                        webhook_status: {
                            [db.Sequelize.Op.ne]: null
                        }
                    }
                })
                console.log({UpdateXpressLogResponse})
                throw {message: 'Sale through xpress-sale, no further actions required'}
            }

            //check if transaction is already processed, if yes rever the txn as its duplicate
            let order_id = GetIDFromReference(payload?.data?.reference);
            let alreadyPaid = await CheckAlreadyPaid({ 
                db,
                order_id
            });
            console.log({alreadyPaid})
            if (alreadyPaid) {
                //initiate the refund and show error message
                let RefundResponse = await RefundPaystack({
                    db,
                    payload: {
                        transaction_reference: payload?.data?.reference,
                        amount : payload?.data?.amount,
                        refund_reason: "Duplicate Txn - Refunded",
                    }
                });
                console.log({RefundResponse});
                throw {message: 'Duplicate Txn - Refunded'}
            }
            //update payments table and log the webhook response somewhere
            await UpdatePayments({
                db, payload
            });

            //check if card token is eligible to save for future use
            let tokenize_eligible = await CheckCardTokenizeStatus({payload}); //this variable can be used to decide if tokenization of card needs to be done or not
            console.log({tokenize_eligible})
            
            let master_token = await GenerateMasterToken({payload})
            console.log({master_token})

            //master tokenize the card
            let master_tokenize_status = await MasterTokenizeCard({
                db, payload, tokenize_eligible, master_token
            })
            console.log({master_tokenize_status})

            //notify 3rd party
            await NotifyOrderStatusToMerchant({
                payload, tokenize_eligible, master_token
            })
            
        }

        if(["refund.processed", "refund.failed"].includes(payload.event)
        ){
           console.log('Inside Refund section')
            let payment_id = GetIDFromReference(payload?.data?.transaction_reference,'txn_id');
            console.log({payment_id})
            let UpdateRefundLogStatus = await UpdateRefundLog({
                db,
                UpdateObject: {
                    refund_reference: payload.data.refund_reference,
                    webhook_status: payload.event,
                    webhook_log_id: LogPaystackWebhookLogInfo.id
                },
                WhereConditionObject : {payment_id}
            })
            console.log({UpdateRefundLogStatus})
        }

        if(["transfer.success", "transfer.failed", "transfer.reversed"].includes(payload.event)){

            console.log('Inside Transfer section')
            await UpdateTransfers({
                db, payload, LogPaystackWebhookLogInfo
            })
        }

        await db.sequelize.close();
        let httpResponse = {
            status: "success"
        };
        return response(httpResponse);
    } catch (e) {
        console.log('Webhook Handler Exception', e.message)
        await db.sequelize.close();
        //for a webhook response, we need to return a 200 response to paystack once we have processed the webhook
        //the errors needs to be looked into internally
        return response(e.message);
    }
};