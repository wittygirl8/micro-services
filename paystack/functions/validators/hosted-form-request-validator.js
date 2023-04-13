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
    reference: Joi.string(),
    split_fee: Joi.array()
        .unique((a, b) => a.partner_merchant_id === b.partner_merchant_id && a.type_id === b.type_id)
        .error(errors => {
                
            errors.forEach(err => {
                // console.log({err})
                switch (err.code) {
                    case "array.unique":
                        err.message = ` partner_merchant_id and type_id must be unique (${err?.local?.label})`;
                    break;
                    default:
                    break;
                }
            });

            return errors;
        })
        .items({
            partner_merchant_id: Joi.number().required(),
            type_id: Joi.number().greater(0).less(6).required(),
            value_type: Joi.string().valid('amount','percentage').required(),
            value: Joi.when('value_type', {
                switch: [
                    { is: 'amount', then: Joi.number().precision(2).greater(0).less(Joi.ref('....total')).required() },
                    { is: 'percentage', then: Joi.number().integer().greater(0).less(100).required() },
                ]
        }).error(errors => {
            
            errors.forEach(err => {
                // console.log({err})
                switch (err.code) {
                    case "number.integer":
                        err.message = ` ${err.local.label || 'value' } must be integer [0-100] when value_type 'percentage'`;
                    break;
                    case "number.less":
                        err.message = ` ${err.local.label || 'value' } must be less than total`;
                    break;
                    default:
                    break;
                }
            });

            return errors;
          }),
    })
}).unknown(true);
