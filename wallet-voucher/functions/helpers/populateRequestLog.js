export const populateRequestLog = async (params) => {
    try {
        const { payload, db, api_response } = params;
        const { ReferralBonusLog } = db;

        let logRequest = await ReferralBonusLog.create({
            order_ref: payload?.order_id,
            action_type: payload?.action,
            referral_user_type: payload?.referral_user_type,
            data: JSON.stringify(payload),
            response: JSON.stringify(api_response)
        });

        return logRequest;
    } catch (error) {
        console.log('populateRequestLog~error', error);
        return;
    }
};
