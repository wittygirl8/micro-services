const { response, helpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const currentCodeEnv = helpers.getCodeEnvironment();
var TipaltiHelpers = require('../logic/tipalti-helpers');
const { parse } = require('querystring');
let PAYOUT_STATUS_MAPPING = {
    completed: 'COMPLETE',
    payments_group_declined: 'FAILED',
    payment_cancelled: 'FAILED',
    deferred: 'FAILED',
    error: 'FAILED'
};
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const main = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ tipaltiPayoutWebhookHandler',
        awsRequestId: context.awsRequestId
    };
    //sample webhook curl request format can be found at the bottom of the code
    //Tipalti webhook events and payloads Document: https://support.tipalti.com/Content/Topics/Development/IPNs/ipncontent.htm#TypesOfIPNs
    try {
        var payload = event.body;
        console.log(payload);

        if (currentCodeEnv === 'production' || currentCodeEnv === 'pre-prod') {
            //(skipping this validation in staging as some events cannot be triggered from tipalti sandbox dashboard)
            //acknowledge the webhook receipt with tipalti and validate it, by calling their acknowledgement api
            let verifyIpnRequest = await TipaltiHelpers.verifyIpnRequest(payload);
            console.log(logMetadata, { verifyIpnRequest });
            if (!verifyIpnRequest.status) {
                throw { message: 'Invalid request' }; //stopping the execution here the payload is not valid
            }
        }

        // converting the querystring to json
        payload = JSON.parse(JSON.stringify(parse(payload)));
        console.log({ payload });
        let type = payload?.type;
        console.log({ type });

        var db = await TipaltiHelpers.getDbConnection();

        let addWebhookLogResponse, updatePayoutBatchStatusResponse, updatePaymentsStatusResponse;
        if (type === 'payments_group_approved') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                ref_code: JSON.parse(payload.group_payments),
                aws_request_id: context.awsRequestId,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));
        }

        if (type === 'payments_group_declined') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                ref_code: JSON.parse(payload.group_payments),
                aws_request_id: context.awsRequestId,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));

            //update payout_batch table to failed
            updatePayoutBatchStatusResponse = await TipaltiHelpers.updatePayoutBatchStatus({
                updateData: {
                    status: PAYOUT_STATUS_MAPPING[type]
                },
                ref_code: JSON.parse(payload.group_payments),
                PayoutBatch: db.PayoutBatch
            });
            console.log({ updatePayoutBatchStatusResponse });
        }

        if (type === 'payment_cancelled') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                aws_request_id: context.awsRequestId,
                ref_code: payload.ref_code,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));

            //update payout_batch table to failed
            updatePayoutBatchStatusResponse = await TipaltiHelpers.updatePayoutBatchStatus({
                updateData: {
                    status: PAYOUT_STATUS_MAPPING[type]
                },
                ref_code: payload.ref_code,
                PayoutBatch: db.PayoutBatch
            });
            console.log({ updatePayoutBatchStatusResponse });
        }

        if (type === 'deferred') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                aws_request_id: context.awsRequestId,
                ref_code: payload.ref_code,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));

            //update payout_batch table to failed
            updatePayoutBatchStatusResponse = await TipaltiHelpers.updatePayoutBatchStatus({
                updateData: {
                    status: 'FAILED'
                },
                ref_code: payload.ref_code,
                PayoutBatch: db.PayoutBatch
            });
            console.log({ updatePayoutBatchStatusResponse });
        }

        if (type === 'error') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                aws_request_id: context.awsRequestId,
                ref_code: payload.ref_code,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));

            //update payout_batch table to failed
            updatePayoutBatchStatusResponse = await TipaltiHelpers.updatePayoutBatchStatus({
                updateData: {
                    status: PAYOUT_STATUS_MAPPING[type]
                },
                ref_code: payload.ref_code,
                PayoutBatch: db.PayoutBatch
            });
            console.log({ updatePayoutBatchStatusResponse });
        }

        if (type === 'completed') {
            addWebhookLogResponse = await TipaltiHelpers.addWebhookLog({
                TipaltiWebhookLog: db.TipaltiWebhookLog,
                aws_request_id: context.awsRequestId,
                ref_code: payload.ref_code,
                payload
            });
            console.log('addWebhookLogResponse', JSON.stringify(addWebhookLogResponse));
            // ref_code,payee_id
            // value_date: (expected date)

            //update payout_batch table with status 'PAID'
            updatePayoutBatchStatusResponse = await TipaltiHelpers.updatePayoutBatchStatus({
                updateData: {
                    status: PAYOUT_STATUS_MAPPING[type],
                    date_complete: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    date_expected: moment(payload.value_date, 'MM/DD/YYYY hh:mm:ss:fff')
                        .tz(TIMEZONE)
                        .format('YYYY-MM-DD HH:mm:ss')
                },
                ref_code: payload.ref_code,
                PayoutBatch: db.PayoutBatch
            });
            console.log({ updatePayoutBatchStatusResponse });

            //update payments table to transaction_status_id to 5 as the payout is successfull
            updatePaymentsStatusResponse = await TipaltiHelpers.updatePaymentsTable({
                transaction_status_id: 5,
                ref_code: payload.ref_code,
                Payments: db.Payments,
                PayoutBatchItem: db.PayoutBatchItem
            });
            console.log({ updatePaymentsStatusResponse });
        }

        db.sequelize.close && (await db.sequelize.close());
        return response('[acknowledged]');
    } catch (e) {
        console.log('Catch Error', e.message);
        db ? db.sequelize.close && (await db.sequelize.close()) : null;
        return response(e.message);
    }
};

// curl --location --request POST 'http://localhost:8006/dev/webhook/tipalti' \
// --header 'Content-Type: application/x-www-form-urlencoded' \
// --data-urlencode 'c_date=05/18/2022+13:07:20.979' \
// --data-urlencode 'type=completed' \
// --data-urlencode 'amount_submitted=2,750.00' \
// --data-urlencode 'currency_submitted=USD' \
// --data-urlencode 'payee_id=1234568' \
// --data-urlencode 'ref_code=111114-140536' \
// --data-urlencode 'deferred_date=05/18/2022+13:07:20.954' \
// --data-urlencode 'deferred_reasons=[{"reason_code":"3","reason":"No+payment+method+selected"}]' \
// --data-urlencode 'key=621616144a0747468984e285ec5613c0key=04041a8f741d42c292e641611b87aa37&c_date=05%2f19%2f2022+12%3a42%3a10.053&type=payment_submitted&ref_code=1257123-134113&seq_ref_code=1257123-134113&payee_id=663187839&submit_date=05%2f19%2f2022+12%3a41%3a27.270&amount_submitted=27.52&currency_submitted=USD&payment_method=ACH&payee_fees=0.00&payee_fees_currency=USD&is_finalized=true&provider=Tipalti&account_identifier=6129&payer_exchange_rate=1.0000000&transaction_date=05%2f19%2f2022+12%3a42%3a07.613' \
// --data-urlencode 'group_payments=[{"ref_code":"111114-130119","payment_status":"Deferred"},{"ref_code":"111115-130119","payment_status":"Submitted"},{"ref_code":"111116-130119","payment_status":"Submitted"}]' \
// --data-urlencode 'value_date=05/18/2022+13:07:20.979'
