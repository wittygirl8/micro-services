export const checkAlreadyExists = async (params) => {
    const { payload, db, id } = params;
    const { ReferralBonusTransaction } = db;
    const { order_id, action, referral_user_type } = payload;

    let checkIfExists = await ReferralBonusTransaction.findOne({
        attributes: ['id'],
        where: {
            order_ref: `${order_id}`,
            payment_id: id,
            action_type: action,
            referral_user_type,
            status: 1
        },
        raw: true
    });

    if (checkIfExists?.id) {
        throw new Error(`Duplicate Request`);
    }

    return checkIfExists?.id;
};
