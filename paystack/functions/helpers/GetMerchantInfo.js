const { helpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');

export const GetMerchantInfo = async (params) => {
    let { db, total, merchantId } = params;
    console.log('merchant_id', merchantId);

    //get country
    const MerchantInfo = await db.Customer.findOne({
        attributes: ['country_id', 'fee_tier_id'],
        where: { id: merchantId },
        raw: true
    });

    if(!MerchantInfo){
        throw { code: 400, message: 'Merchant not found' };
    }

    const { fee_tier_id, country_id } = MerchantInfo;

    console.log('fee_tier_id', fee_tier_id);
    console.log('country_id', country_id);
    const { percentage_fee, fixed_fee } = await db.Tier.findOne({
        where: { id: fee_tier_id }
    });

    //get currency and country code
    const {
        iso, // country code AU, GB etc - only 2 digits alphabets
        currency_name // currency code GBP, AUD - only 3 digits alphabets
    } = await db.Country.findOne({
        where: { id: country_id },
        raw: true
    });

    let fee = await helpers.roundOfInteger(total * Number(percentage_fee / 100) + Number(fixed_fee * 100));
    let net = Math.floor((total - fee) * 100) / 100;
    let amountItems = {
        fee,
        net,
        country_code: iso,
        currency_code: currency_name
    };
    console.log('amountItems', amountItems);
    return amountItems;
};
