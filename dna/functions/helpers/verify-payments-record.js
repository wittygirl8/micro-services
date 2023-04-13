const { payment_providers_enum } = require('../utils/enums');

export const verifyPaymentsRecord = async (dbInstance, obj) => {
    //all adyen transaction should be populated into Payments table, not card_payment table
    const paymentStatus = await dbInstance.Payments.findOne({
        where: {
            order_ref: obj.order_id,
            merchant_id: obj.merchant_id,
            transaction_status_id: {
                [dbInstance.Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
            }
        }
    });

    console.log('paymentStatus', paymentStatus?.dataValues);

    //throw error, if transaction could not be found
    if (!paymentStatus) {
        throw { message: 'No transaction found' };
    }

    if (paymentStatus.payment_provider_id !== payment_providers_enum['DNA']) {
        throw { message: 'This payment provider is not supported' };
    }

    if (Number(obj.amount) > Number(paymentStatus.gross) || Number(obj.amount) <= 0) {
        throw { message: 'Invalid amount' };
    }

    if (!paymentStatus.psp_reference) {
        throw { message: 'Transaction could not be refunded (A#71001)' };
    }

    return paymentStatus;
};
