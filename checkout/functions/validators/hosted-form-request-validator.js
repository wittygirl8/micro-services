const Joi = require('joi');

export const hostedFormRequestSchema = Joi.object({
    host: Joi.string().required(),
    order_id: Joi.number().required(),
    customer_id: Joi.number().required(),
    merchant_id: Joi.number().required(),
    total: Joi.number().precision(2).required(),
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    house_number: Joi.string().required(),
    flat: Joi.string().required(),
    address_line1: Joi.string(),
    address_line2: Joi.string(),
    address: Joi.string().required(),
    postcode: Joi.string().required(),
    email: Joi.string().required(),
    redirect_url: Joi.string().uri().required(),
    cancel_url: Joi.string().uri().required(),
    webhook_url: Joi.string().uri().required(),
    db_total: Joi.boolean(),
    cc_token: Joi.string().optional(),
    cvv: Joi.number().when('cc_token', { is: Joi.exist(), then: Joi.required(), otherwise: Joi.optional() })
}).unknown(true);
