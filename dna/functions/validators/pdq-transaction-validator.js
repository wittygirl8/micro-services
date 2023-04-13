import Joi from 'joi';

export const pdqTransactionSchema = Joi.object({
    transaction_type: Joi.string().valid('sale', 'refund').required(),
    uti: Joi.string().required(),
    amount: Joi.number().required(),
    msg_status: Joi.string().valid('success', 'failure', 'cancel').required(),
    transaction_date: Joi.string().required(),
    transaction_id: Joi.string().required(),
    merchant_id: Joi.string().required(),
    approved: Joi.boolean(),
    cancelled: Joi.boolean(),
    last_status: Joi.string(),
    sig_required: Joi.boolean(),
    pin_verified: Joi.boolean(),
    authmode: Joi.string(),
    currency: Joi.string(),
    version: Joi.string()
}).unknown(true);
