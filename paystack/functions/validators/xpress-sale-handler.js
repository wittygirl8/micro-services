const Joi = require('joi');

export const XpressSaleSchema = Joi.object({
    payment_id: Joi.number().required(),
    txn_reference: Joi.string().required(),
    card_token: Joi.string().required(),
    amount: Joi.number().required(),
    email: Joi.string().required(),
}).unknown(true);
