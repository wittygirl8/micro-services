const { payment_providers_enum } = require('../utils/enums');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const seedPayment = async (dbInstance, obj, event) => {
    console.log('order_id', obj.order_id);
    const ipAddress = event['requestContext']['identity']['sourceIp'];

    let payment_providers = await dbInstance.PaymentProviders.findOne({
        attributes: ['id'],
        where: {
            provider_name: 'DNA'
        },
        raw: true
    });

    let paymentRecord = await dbInstance.Payments.create({
        order_ref: obj.order_id,
        merchant_id: obj.merchant_id,
        country_code: obj.amountItems.country_code_2letters,
        currency_code: obj.amountItems.country_code_3letters,
        gross: obj.amountItems.total,
        fee: obj.amountItems.fee,
        net: obj.amountItems.net,
        payment_provider_id: payment_providers.id || payment_providers_enum['DNA'],
        // transaction_status_id: 0,
        psp_reference: null,
        internal_reference: null,
        reason: null,
        // withdrawn_status: 0,
        source_ip: ipAddress ? ipAddress : '0.0.0.0',
        firstname: obj.first_name,
        lastname: obj.last_name,
        email_address: obj.email,
        address: obj.address,
        // delete_status: 0,
        day: moment().tz(TIMEZONE).format('D'),
        week: moment().tz(TIMEZONE).format('W'),
        month: moment().tz(TIMEZONE).format('M'),
        year: moment().tz(TIMEZONE).format('YYYY'),
        transaction_mode_id: 1,
        transaction_method_id: obj.cc_token ? 2 : obj.mode === 'phone_payment' ? 3 : 1
    });

    if (!paymentRecord) {
        throw { message: 'Issue in seeding transaction' };
    }

    // create OxxxxMxxxxT reference
    let omt = `O${obj.order_id}M${obj.merchant_id}T${paymentRecord.id}`;
    console.log('omt', omt);
    return { omt, paymentRecord };
};

export const logGatewayRequest = async (dbInstance, obj) => {
    console.log('order_id', obj.order_id);

    let gatewayRequestLogDetails = await dbInstance.GatewayRequestLog.create({
        gateway: 'DNA',
        order_id: obj.order_id,
        merchant_id: obj.merchant_id,
        request_data: JSON.stringify(obj),
        path_script: 'dna/hosted-form-handler.js'
    });

    if (!gatewayRequestLogDetails) {
        throw { message: 'Issue in logging gateway request' };
    }
};
