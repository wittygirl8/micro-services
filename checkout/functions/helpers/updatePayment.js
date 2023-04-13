const { transaction_status } = require('../utils/enums');

export const updatePayment = async (dbInstance, obj) => {
    console.log('updating the db instance', obj);
    let updateStatus = await dbInstance.Payments.update(
        {
            transaction_status_id: transaction_status.OK,
            psp_reference: obj.checkout_payment_id,
            internal_reference: obj.omt,
            last_4_digits: obj.source?.last_4,
            TxAuthNo: obj.txAuthCode
        },
        { where: { id: obj.transaction_id } }
    );
    console.log('updated and the results are here', updateStatus);
    return true;
};
