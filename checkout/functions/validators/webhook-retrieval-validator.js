const Joi = require('joi');

export const webhookRetrievalSchema = Joi.object({
    type: Joi.string().valid('payment_approved')
}).unknown(true);
