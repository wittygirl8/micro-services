export const checkTopUpTransaction = async (params) => {
    const { payload, db, id } = params;
    const { ReferralBonusTransaction } = db;
    const { shopper_id, order_id, action, referral_user_type } = payload;

    let TopUpTransaction = await ReferralBonusTransaction.findOne({
        attributes: ['amount', 'currency_code'],
        where: {
            shopper_id,
            order_ref: `${order_id}`,
            payment_id: id,
            action_type: 'TOPUP',
            referral_user_type,
            status: 1
        },
        raw: true
    });

    if (!TopUpTransaction && action === 'REVERSE') {
        throw new Error(`Top up transaction not found`);
    }

    return TopUpTransaction;
};
