const Joi = require('joi');

export const expressSaleSchema = Joi.object({
    payment_id: Joi.number().required(),
    omt: Joi.string().required(),
    card_token: Joi.string().required(),
    amount: Joi.number().required(),
    cvv: Joi.string().required()
}).unknown(true);
