const { payment_providers } = require('../utils/enums');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const SeedPayment = async (params) => {
    let {db, payload, MerchantInfo: FeeInfo, SplitFeeObject, event} = params;
    console.log('order_id', payload.order_id);

    let paymentRecord = await db.Payments.create({
        order_ref: payload.order_id,
        merchant_id: payload.merchant_id,
        country_code: FeeInfo.country_code,
        currency_code: FeeInfo.currency_code,
        gross: payload.total,
        fee: FeeInfo.fee,
        net: FeeInfo.net,
        payment_provider_id: payment_providers['PAYSTACK-HF'],
        source_ip: event?.requestContext?.identity?.sourceIp ? event?.requestContext?.identity?.sourceIp : '0.0.0.0',
        firstname: payload.first_name,
        lastname: payload.last_name,
        email_address: payload.email,
        address: payload.address,
        day: moment().tz(TIMEZONE).format('D'),
        week: moment().tz(TIMEZONE).format('W'),
        month: moment().tz(TIMEZONE).format('M'),
        year: moment().tz(TIMEZONE).format('YYYY'),
        transaction_method_id: 1
    });

    if(SplitFeeObject?.length > 0){
        SplitFeeObject.forEach(async (split_fee_item) => {
            //should populate split commission table first
            let PaymentsSplitCommissionInfo  = await db.PaymentsSplitCommission.create({
                partner_merchant_id: split_fee_item.partner_merchant_id,
                merchant_id: payload.merchant_id,
                merchant_payments_id : paymentRecord.id ,
                amount: split_fee_item.amount,
                fee_type: split_fee_item.commission_value_type,
                fee_value: split_fee_item.commission_value,
                commission_type_id: split_fee_item.commission_type_id
            })

            //now populating payments table
            let SplitCommissionTxnInfo = await db.Payments.create({
                order_ref: `${payload.order_id}SC${PaymentsSplitCommissionInfo.id}`,
                merchant_id: split_fee_item.partner_merchant_id,
                country_code: FeeInfo.country_code,
                currency_code: FeeInfo.currency_code,
                gross: split_fee_item.amount,
                fee: 0,
                net: split_fee_item.amount,
                payment_provider_id: payment_providers['PAYSTACK-HF'],
                source_ip: event?.requestContext?.identity?.sourceIp ? event?.requestContext?.identity?.sourceIp : '0.0.0.0',
                firstname: payload.first_name,
                lastname: payload.last_name,
                email_address: payload.email,
                address: payload.address,
                day: moment().tz(TIMEZONE).format('D'),
                week: moment().tz(TIMEZONE).format('W'),
                month: moment().tz(TIMEZONE).format('M'),
                year: moment().tz(TIMEZONE).format('YYYY'),
                transaction_method_id: 1
            });

            //now populating payments table
            await db.PaymentsSplitCommission.update(
                {
                    partner_payments_id: SplitCommissionTxnInfo.id
                },
                { where: { id:  PaymentsSplitCommissionInfo.id} }
            );
        })
    }
    // create OxxxxMxxxxT reference
    let UniqueReference = `O${payload.order_id}M${payload.merchant_id}T${paymentRecord.id}`;
    console.log({UniqueReference});
    return { 
        UniqueReference, 
        transaction_id: paymentRecord.id 
    };
};
