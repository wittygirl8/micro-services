const Joi = require('joi');

export const hostedFormRequestSchema = Joi.object({
    merchant_id: Joi.number().required(),
    order_id: Joi.number().required(),
    customer_id: Joi.number().required(),
    total: Joi.number().precision(2).required(),
    provider: Joi.string().valid('T2S', 'FH', 'BF').required(),
    host: Joi.string().domain().required(),
    redirect_url: Joi.string().uri().required(),
    cancel_url: Joi.string().uri().required(),
    webhook_url: Joi.string().uri().required(),
    cash_payment_url: Joi.string().allow(null, ''),
    cc_token: Joi.string().allow(null, ''),
    last_four_digits: Joi.string().allow(null, ''),
    first_name: Joi.string(),
    last_name: Joi.string(),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
    house_number: Joi.string(),
    flat: Joi.string(),
    address_line1: Joi.string(),
    address_line2: Joi.string(),
    postcode: Joi.string(),
    address: Joi.string(),
    db_total: Joi.boolean(),
    reference: Joi.string(),
    mode: Joi.string().allow(null, ''),
    scheme_id: Joi.string().allow(null, ''),
    scheme_name: Joi.string().allow(null, ''),
    expiry_date: Joi.string().allow(null, ''),
    is_billing_address: Joi.number()
}).unknown(true);

export const dnaRefundSchema = Joi.object({
    order_id: Joi.string()
        .min(6)
        .max(50)
        .pattern(/^[0-9]+$/),
    merchant_id: Joi.number().integer().required(),
    amount: Joi.number().positive().precision(2).required(),
    reason: Joi.string().required(),
    host: Joi.string().allow(null, '')
});

export const dnaPhonePaymentPayloadSchema = Joi.object({
    merchant_id: Joi.number().required(),
    order_id: Joi.number().required(),
    customer_id: Joi.number().allow(null, ''),
    total: Joi.number().precision(2).required(),
    provider: Joi.string().valid('T2S', 'FH', 'BF').required(),
    host: Joi.string().domain().required(),
    redirect_url: Joi.string().uri().required(),
    cancel_url: Joi.string().uri().required(),
    webhook_url: Joi.string().uri().required(),
    cash_payment_url: Joi.string().required(),
    cc_token: Joi.string(),
    last_four_digits: Joi.number(),
    first_name: Joi.string(),
    last_name: Joi.string(),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
    house_number: Joi.string().allow(null, ''),
    flat: Joi.string().allow(null, ''),
    address_line1: Joi.string().allow(null, ''),
    address_line2: Joi.string().allow(null, ''),
    postcode: Joi.string().allow(null, ''),
    address: Joi.string().allow(null, ''),
    db_total: Joi.boolean().allow(null, ''),
    reference: Joi.string(),
    gateway_switched: Joi.boolean(),
    mode: Joi.string().allow(null, '')
}).unknown(true);
