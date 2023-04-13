const { transaction_status } = require('../utils/enums');
const { GetIDFromReference } = require('./GetIDFromReference');

export const UpdatePayments = async (params) => {
    let { payload, db } = params;
    //updating the main payments record for the order
    let PaymentsUpdateStatus = await db.Payments.update(
        {
            transaction_status_id: transaction_status.OK,
            psp_reference: payload.data.id,
            internal_reference: payload.data.reference,
            TxAuthNo: payload?.data?.authorization?.authorization_code,
            last_4_digits: payload?.data?.authorization?.last4,
        },
        { where: { id: GetIDFromReference(payload.data.reference,'txn_id') } }
    );

    //check if there is any split fee involved as part of this txn,
    //if yes, then update the split fee txn entries and associated 
    if(payload?.data?.metadata?.SplitFeeObjectLength){
        //get the payments ids from the splitcommission table first
        //loop through it and update the payments table
        await db.PaymentsSplitCommission.findAll({
            attributes: ['id','partner_payments_id'],
            where : {
                merchant_payments_id: GetIDFromReference(payload.data.reference,'txn_id')
            },
            raw: true
        }).then(function (response) {
            response.forEach(async (record) => {
                //update payments table as success
                await db.Payments.update(
                    {
                        transaction_status_id: transaction_status.OK,
                        psp_reference: payload.data.id,
                        internal_reference: payload.data.reference,
                        TxAuthNo: payload?.data?.authorization?.authorization_code,
                        last_4_digits: payload?.data?.authorization?.last4,
                    },
                    { where: { id: record.partner_payments_id } }
                );
                
                //update split commission table as success
                await db.PaymentsSplitCommission.update(
                    {
                        order_ref: GetIDFromReference(payload.data.reference,'order_id'),
                        payment_status: 1
                    },
                    { where: { id: record.id } }
                );
            });
        });
    }
};
