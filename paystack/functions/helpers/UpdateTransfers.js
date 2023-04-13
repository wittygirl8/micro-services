const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
const { UpdatePaymentsPayoutStatus } = require('./UpdatePaymentsPayoutStatus');

export const UpdateTransfers = async (params) => {
    let {db, payload, LogPaystackWebhookLogInfo} = params;
    let UpdatePayoutBatchInfo;
    let transaction_status_id;
    if(payload.event === 'transfer.success'){
        transaction_status_id = 5;
        console.log('Inside Transfer success')
        //if all success, update the batch status to SENT
        UpdatePayoutBatchInfo = await db.PayoutBatch.update({
            status: 'COMPLETE',
            date_complete: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
        },{
            where: {
                batch_id: payload.data.reference
            },
            raw: true
        })
        console.log({UpdatePayoutBatchInfo})
    }

    if(["transfer.failed", "transfer.reversed"].includes(payload.event)){
        transaction_status_id = 6;
        console.log('Inside Transfer failed')
        UpdatePayoutBatchInfo = await db.PayoutBatch.update({
            status: 'FAILED'
        },{
            where: {
                batch_id: payload.data.reference
            },
            raw: true
        })
        console.log({UpdatePayoutBatchInfo})
    }

    await UpdatePaymentsPayoutStatus({
        db,
        batch_id: payload.data.reference,
        transaction_status_id
    })

    let PaystackTransferLogUpdateInfo = await db.PaystackTransferLog.update({
        webhook_status: payload?.data?.status,
        webhook_amount: payload?.data?.amount,
        paystack_webhook_log_id: LogPaystackWebhookLogInfo.id
    },{
        where: {
            payout_batch_id: payload.data.reference,
            transfer_code: payload.data.transfer_code
        },
        raw: true
    })
    console.log({PaystackTransferLogUpdateInfo})
}