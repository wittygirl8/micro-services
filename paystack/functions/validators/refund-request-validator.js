const Joi = require('joi');

export const RefundRequestSchema = Joi.object({
    order_id: Joi.number().required(),
    payment_id: Joi.number().required(),
    transaction_reference: Joi.string().required(),
    amount: Joi.number().required(),
    refund_reason: Joi.string().required(),
}).unknown(true);
