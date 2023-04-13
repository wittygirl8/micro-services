const Joi = require('@hapi/joi');

export const antarRefundSchema = Joi.object({
    order_id: Joi.string()
        .min(6)
        .max(50)
        .pattern(/^[0-9]+$/),
    merchant_id: Joi.number().integer().required(),
    amount: Joi.number().positive().precision(2).required(),
    reason: Joi.string().required(),
    host: Joi.string().allow(null, '')
});
