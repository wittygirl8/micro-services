const { helpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');

export const amountObject = async (dbInstance, obj) => {

    //get country
    const { fee_tier_id, country_id } = await dbInstance.Customer.findOne({
        attributes: ['country_id', 'fee_tier_id'],
        where: { id: obj.merchantId },
        raw: true
    });

    console.log('fee_tier_id', fee_tier_id);
    console.log('country_id', country_id);
    const { percentage_fee, fixed_fee } = await dbInstance.Tier.findOne({
        where: { id: fee_tier_id }
    });

    //get currency and country code
    const {
        iso, // country code AU, GB etc - only 2 digits alphabets
        currency_name, // currency code GBP, AUD - only 3 digits alphabets
        checkout_pc
    } = await dbInstance.Country.findOne({
        where: { id: country_id },
        raw: true
    });

    let fee = await helpers.roundOfInteger(obj.total * Number(percentage_fee / 100) + Number(fixed_fee * 100));
    let net = Math.floor((obj.total - fee) * 100) / 100;
    let amountItems = {
        fee,
        net,
        total: obj.total,
        country_code_2letters: iso,
        country_code_3letters: currency_name,
        checkout_pc
    };
    console.log('amountItems', amountItems);
    return amountItems;
};
