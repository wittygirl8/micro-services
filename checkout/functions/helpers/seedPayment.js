const { payment_providers } = require('../utils/enums');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const seedPayment = async (dbInstance, documentXray, obj, event) => {
    documentXray.addAnnotation('order_id', obj.order_id);

    let paymentRecord = await dbInstance.Payments.create({
        order_ref: obj.order_id,
        merchant_id: obj.merchant_id,
        country_code: obj.amountItems.country_code_2letters,
        currency_code: obj.amountItems.country_code_3letters,
        gross: obj.amountItems.total,
        fee: obj.amountItems.fee,
        net: obj.amountItems.net,
        payment_provider_id: payment_providers['CHECKOUT-HF'],
        // transaction_status_id: 0,
        psp_reference: null,
        internal_reference: null,
        reason: null,
        // withdrawn_status: 0,
        source_ip: event?.requestContext?.identity?.sourceIp ? event?.requestContext?.identity?.sourceIp : '0.0.0.0',
        firstname: obj.first_name,
        lastname: obj.last_name,
        email_address: obj.email,
        address: obj.address,
        // delete_status: 0,
        day: moment().tz(TIMEZONE).format('D'),
        week: moment().tz(TIMEZONE).format('W'),
        month: moment().tz(TIMEZONE).format('M'),
        year: moment().tz(TIMEZONE).format('YYYY'),
        transaction_mode_id: '',
        transaction_method_id: obj?.cc_token ? '2' : '1'
    });

    if (!paymentRecord) {
        throw { message: 'Issue in seeding transaction' };
    }

    // create OxxxxMxxxxT reference
    let omt = `O${obj.order_id}M${obj.merchant_id}T${paymentRecord.id}`;
    documentXray.addAnnotation('omt', omt);
    return { omt, transaction_id: paymentRecord.id, paymentRecord };
};
