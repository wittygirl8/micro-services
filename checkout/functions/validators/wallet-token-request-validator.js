const Joi = require('joi');

export const walletTokenRequestSchema = Joi.object({
    host: Joi.string().domain().allow(null, ''),
    merchant_id: Joi.number().required(),
    order_id: Joi.string()
        .required()
        .min(6)
        .max(50)
        .pattern(/^[0-9]+$/)
        .error((errors) => {
            errors.forEach((err) => {
                switch (err.code) {
                    case 'string.pattern.base':
                        err.message = 'order_id should be numbers';
                        break;
                    case 'string.min':
                        err.message = `order_id should be at least ${err.local.limit} characters!`;
                        break;
                    case 'string.max':
                        err.message = `order_id should be at most ${err.local.limit} characters!`;
                        break;
                    default:
                        break;
                }
            });
            return errors;
        }),
    customer_id: Joi.string()
        .pattern(/^[0-9+]+$/)
        .error((errors) => {
            errors.forEach((err) => {
                switch (err.code) {
                    case 'string.pattern.base':
                        err.message = 'customer_id should be a valid number (0-9)';
                        break;
                    default:
                        break;
                }
            });
            return errors;
        }),
    provider: Joi.string().valid('T2S', 'FH', 'BF').allow(null, ''),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string()
        .min(10)
        .max(15)
        .pattern(/^[0-9+]+$/)
        .allow(null, '')
        .error((errors) => {
            errors.forEach((err) => {
                switch (err.code) {
                    case 'string.pattern.base':
                    case 'string.min':
                    case 'string.max':
                        err.message = 'Phone number is invalid!';
                        break;
                    default:
                        break;
                }
            });
            return errors;
        }),
    name: Joi.string().allow(null, ''),
    Amount: Joi.number().precision(2).required(),
    AvsHouseNumber: Joi.string().allow(null, ''),
    AvsPostcode: Joi.string().allow(null, ''),
    MerchantReference: Joi.string().allow(null, ''),
    RedirectUrl: Joi.string().uri().required(),
    CancelUrl: Joi.string().uri().required(),
    WebhookUrl: Joi.string().uri().allow(null, ''),
    customer_joining_date: Joi.string().allow(null, ''),
    firstname: Joi.string().allow(null, ''),
    lastname: Joi.string().allow(null, ''),
    flat: Joi.string().allow(null, ''),
    address1: Joi.string().allow(null, ''),
    address2: Joi.string().allow(null, ''),
    gatewayParameters: Joi.object({
        gateway: Joi.string().valid('googlepay', 'applepay').required(),
        instrumentToken: Joi.object()
    }).required(),
    split_fee: Joi.array().items().allow(null, '')
}).unknown(true);
