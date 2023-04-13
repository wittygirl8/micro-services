export const processTopupReversal = async (params) => {
    try {
        const { payload, orderDetails, wallet_id, TopUpTransaction, db } = params;
        const { TransactionWallet, ReferralBonusTransaction } = db;
        const { shopper_id, order_id, action, referral_user_type } = payload;
        const { id } = orderDetails;
        var transaction_type_id;

        if (referral_user_type == 'REFERRER') {
            transaction_type_id = 6;
        } else if (referral_user_type == 'REFEREE') {
            transaction_type_id = 8;
        }

        await TransactionWallet.create({
            wallet_id,
            shopper_id,
            transaction_type_id,
            amount: TopUpTransaction.amount / 100,
            card_payment_id: id,
            order_id
        });

        await ReferralBonusTransaction.create({
            shopper_id,
            order_ref: order_id,
            payment_id: id,
            action_type: action,
            amount: TopUpTransaction.amount,
            currency_code: TopUpTransaction.currency_code,
            referral_user_type,
            status: 1
        });

        payload.amount = (TopUpTransaction.amount / 100).toFixed(2);
        return payload;
    } catch (error) {
        console.log('processTopupReversal~error', error);
        return;
    }
};
