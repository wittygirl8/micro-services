export const getBonusRange = async (params) => {
    const { country_id, db, payload } = params;
    const { ReferralBonusConfig } = db;

    let getBounusRangeData = await ReferralBonusConfig.findOne({
        attributes: ['minimum_amount', 'maximum_amount', 'status'],
        where: {
            country_id
        },
        raw: true
    });

    if (!getBounusRangeData || getBounusRangeData.status != 1) {
        throw new Error(`Country is not eligible`);
    }

    return getBounusRangeData;
};
