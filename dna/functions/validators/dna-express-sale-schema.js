const Joi = require('joi');

export const expressSaleSchema = Joi.object({
    omt: Joi.string().required(),
    card_token: Joi.string().required(),
    amount: Joi.number().required()
}).unknown(true);
