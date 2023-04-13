const Joi = require('@hapi/joi');

export const addCardPayloadSchema = Joi.object({
    customer_id: Joi.number().allow(null, ''),
    merchant_id: Joi.number().required(),
    redirect_url: Joi.string().uri().required(),
    webhook_url: Joi.string().uri().required()
});
