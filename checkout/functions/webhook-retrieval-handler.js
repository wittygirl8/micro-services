const { response, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

// Custom Validators
const { webhookRetrievalSchema } = require('./validators/webhook-retrieval-validator');

// Custom Helpers
const { updatePayment } = require('./helpers/updatePayment');
const { update3rdParty } = require('./helpers/update3rdParty');
const { init } = require('./helpers/init');
const { webhookAuth } = require('./helpers/webhookAuth');
const { getDBInstance } = require('./helpers/db');
const { getIdFromReference } = require('./helpers/get-id-from-reference');
const { updateExpressSaleLog } = require('./helpers/express-sale-log');
const { logCheckoutWebhookLog } = require('./helpers/log-checkout-webhook-log');

export const handler = async (event, context) => {
    try {
        let payload = JSON.parse(event.body);
        console.log('incoming request', payload);

        // initial setups
        var { requestId, documentXray } = await init(event, context, { fileName: 'webhook-checkout-handler' });
        // get the db instance
        var db = await getDBInstance();

        // validate the request body payload and ignore the other then specified events
        await webhookRetrievalSchema.validateAsync(payload);

        //auth
        await webhookAuth(event, documentXray);

        //log the webhook response for future reference
        let logCheckoutWebhookLogInfo = await logCheckoutWebhookLog({
            db,
            payload
        });
        console.log({ logCheckoutWebhookLogInfo });

        //if sale initiated through express checkout, then we dont need to update payments table through this webhook
        if (payload?.data?.metadata?.sale_mode === 'express-sale') {
            //update the paystack_xpress_sale_log entry with webhook status
            let payment_id = getIdFromReference(payload?.data?.reference, 'txn_id');
            console.log({ payment_id });
            let updateExpressLogResponse = await updateExpressSaleLog({
                db,
                updateObject: {
                    webhook_status: payload.data?.response_summary,
                    webhook_log_id: logCheckoutWebhookLogInfo.id
                },
                whereConditionObject: {
                    payment_id,
                    webhook_status: {
                        [db.Sequelize.Op.ne]: null
                    }
                }
            });
            console.log({ updateExpressLogResponse });
            throw { message: 'Sale through xpress-sale, no further actions required' };
        }

        await updatePayment(db, {
            transaction_id: payload.data.metadata.transaction_id,
            checkout_payment_id: payload.data.id,
            omt: payload.data.metadata.omt,
            source: payload.data.source,
            txAuthCode: payload.data.auth_code,
        });

        //blackBoxFunction2: Split Commission - Direct + gpay apple pay
        await splitFeeHelpers.UpdateSplitFeeInfo({
            db, // dbobject
            payments_id: payload.data.metadata.transaction_id // payment_id/cardpayment_id
        });

        //update to the attached webhook url
        await update3rdParty(payload.data, documentXray, context.awsRequestId);

        // Http response
        let httpResponse = {
            request_id: requestId,
            message: 'The request was processed successfully',
            data: {
                success: 'ok'
            }
        };
        documentXray.addMetadata('httpResponse', httpResponse);
        await db.sequelize.close();
        documentXray.close();
        console.log('https response to user', httpResponse);
        return response(httpResponse);
    } catch (e) {
        documentXray.addError(e.message);
        await db.sequelize.close();

        return response({ message: e?.message });
        // return {
        //     body: JSON.stringify({ message: e?.message }),
        //     statusCode: 200,
        //     headers: {
        //         'Content-Type': 'text/html'
        //     }
        // };
    }
};
