export const processWalletTopup = async (params) => {
    try {
        const { payload, MerchantDetails, orderDetails, wallet_id, validAmount, db } = params;
        const { TransactionWallet, ReferralBonusTransaction } = db;
        const { shopper_id, order_id, action, referral_user_type } = payload;
        const { id } = orderDetails;
        const { currency_code } = MerchantDetails;
        var transaction_type_id;

        if (referral_user_type == 'REFERRER') {
            transaction_type_id = 5;
        } else if (referral_user_type == 'REFEREE') {
            transaction_type_id = 7;
        }

        await TransactionWallet.create({
            wallet_id,
            shopper_id,
            transaction_type_id,
            amount: validAmount,
            card_payment_id: id,
            order_id
        });

        await ReferralBonusTransaction.create({
            shopper_id,
            order_ref: order_id,
            payment_id: id,
            action_type: action,
            amount: validAmount * 100,
            currency_code,
            referral_user_type,
            status: 1
        });

        payload.amount = (Math.round((Number(validAmount) + Number.EPSILON) * 100) / 100).toFixed(2);
        return payload;
    } catch (error) {
        console.log('processWalletTopup~error', error);
        return;
    }
};
