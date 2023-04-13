const qs = require('qs');
const axios = require('axios');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
let logger = logHelpers.logger;
const { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');

export const bankTokenization = async (event, context) => {
    let logMetadata = {
        location: 'messaging ~ bankTokenization',
        awsRequestId: context.awsRequestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, OtherCustomerDetails, Customer } = db;
    const payload = JSON.parse(event.body);
    const merchantId = payload.merchantId;
    try {
        const BANK_TOKENIZATION_API_KEY = process.env.BANK_TOKENIZATION_API_KEY;
        const { api_key } = event.headers;

        if (!api_key || api_key !== BANK_TOKENIZATION_API_KEY) {
            return response(
                {
                    message: 'UNAUTHORISED'
                },
                401
            );
        }

        const selectedCustomer = await Customer.findOne({
            attributes: ['id'],
            where: {
                id: merchantId
            }
        });

        if (!selectedCustomer) {
            return response({
                error: {
                    type: 'error',
                    message: 'Merchant does not exist!'
                }
            });
        }

        const OtherCustomerInfo = await OtherCustomerDetails.findOne({
            attributes: ['pp_token', 'other_customer_details_id'],
            where: {
                customers_id: merchantId
            }
        });
        logger.info(logMetadata, 'Existing Pin Payment token: ', OtherCustomerInfo.pp_token);

        if (!/^\d+$/.test(payload.accountNumber)) {
            await OtherCustomerInfo.update({ pp_token: null });
            // setting pp_token to null in case of api failure
            logger.info(logMetadata, 'setting pp_token to null: ');
            return response({
                error: {
                    type: 'error',
                    message: 'Invalid account number!'
                }
            });
        }

        const data = qs.stringify({
            email: payload.ownerEmail,
            name: `${merchantId}_${payload.name}`,
            'bank_account[name]': payload.accountHolderName,
            'bank_account[bsb]': payload.bsb,
            'bank_account[number]': payload.accountNumber
        });

        var config = {
            method: 'post',
            url: `${process.env.PIN_PAYMENT_BASE_URL}/1/recipients`,
            headers: {
                Authorization: `Basic ${process.env.PIN_PAYMENT_API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        const pinPaymentResponse = await axios(config);
        const ppToken = pinPaymentResponse.data.response.token;

        await OtherCustomerInfo.update({ pp_token: ppToken });
        logger.info(logMetadata, 'Pin Payment Result: ', pinPaymentResponse.data);

        return response(
            {
                message: 'Ok'
            },
            200
        );
    } catch (e) {
        let err;
        if (
            e &&
            e.response &&
            e.response.data &&
            e.response.data.messages &&
            e.response.data.messages &&
            e.response.data.messages.length !== 0
        ) {
            err = e.response.data.messages[0];
        } else {
            err = e;
        }

        logger.info(logMetadata, 'error log');
        logger.error(logMetadata, 'Error: ', err);
        try {
            const OtherCustomerInfo = await OtherCustomerDetails.findOne({
                attributes: ['pp_token', 'other_customer_details_id'],
                where: {
                    customers_id: merchantId
                }
            });
            logger.info(logMetadata, 'Existing Pin Payment token: ', OtherCustomerInfo.pp_token);
            await OtherCustomerInfo.update({ pp_token: null });
            // setting pp_token to null in case of api failure
            logger.info(logMetadata, 'setting pp_token to null: ');
        } catch (error) {
            err = error;
            logger.info(error, 'database error');
        }

        let errorResponse = {
            error: {
                type: 'error',
                message: err.message
            }
        };
        return response(errorResponse, 500);
    }
};
