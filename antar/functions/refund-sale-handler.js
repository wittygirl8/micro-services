const { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const axios = require('axios');
const moment = require('moment-timezone');
const schema = require('../schema/refund-schema');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export const RefundSale = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ RefundSale',
        awsRequestId: context.awsRequestId
    };

    const requestId = `reqid_${context.awsRequestId}`;
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, PaymentTransaction } = db;
    try {
        //authorization
        logger.info(logMetadata, event.headers);
        let AuthToken = event.headers.api_token;
        console.log('process.env.ANTAR_GFO_API_AUTHORIZE_TOKEN', process.env.ANTAR_GFO_API_AUTHORIZE_TOKEN);
        await TokenAuthorize(AuthToken, process.env.ANTAR_GFO_API_AUTHORIZE_TOKEN);

        if (!event.body) {
            throw { message: 'Payload missing' };
        }
        let payload = JSON.parse(event.body);
        logger.info(logMetadata, 'RequestPayload', payload);
        payload = await schema.antarRefundSchema.validateAsync(payload);
        logger.info(logMetadata, 'ValidatedPayload', payload);

        //all adyen transaction should be populated into PaymentTransaction table, not card_payment table
        const paymentStatus = await PaymentTransaction.findOne({
            where: {
                order_id: payload.order_id,
                merchant_id: payload.merchant_id,
                payment_status: 'OK'
            }
        });

        //throw error, if transaction could not be found
        if (!paymentStatus) {
            throw { message: 'No transaction found' };
        }

        if (Number(payload.amount) > Number(paymentStatus.total) || Number(payload.amount) <= 0) {
            throw { message: 'Invalid amount' };
        }

        if (!paymentStatus.cross_reference) {
            throw { message: 'Transaction could not be refunded (A#71001)' };
        }

        let AdyenTxnResponse = await AdyenAPIService({
            endpoint: `payments/${paymentStatus.cross_reference}/refunds`,
            request_payload: {
                reference: `${payload.order_id}Refund${moment().tz(TIMEZONE).format('YYYYMMDDhhmmss')}:`,
                amount: {
                    value: Math.round(payload.amount * 100),
                    currency: 'GBP'
                },
                merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT_NAME
            }
        });
        logger.info(logMetadata, 'AdyenTxnResponse', AdyenTxnResponse.data);
        let message = 'Refund has been processed successfully';
        let api_response = {
            request_id: requestId,
            message,
            data: {
                order_id: payload.order_id,
                amount: payload.amount
            }
        };
        logger.info(logMetadata, 'api_response', api_response);

        sequelize.close && (await sequelize.close());
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                status: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        sequelize.close && (await sequelize.close());
        return response(errorResponse, 500);
    }
};

let AdyenAPIService = async (params) => {
    logger.info(params.logMetadata, 'AdyenAPIService~params', params);
    return await axios({
        method: 'post',
        url: `${process.env.ADYEN_API_ENDPOINT}/${params.endpoint}`,
        data: params.request_payload,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(
                `${process.env.ADYEN_API_AUTH_USERNAME}:${process.env.ADYEN_API_AUTH_PASSWORD}`
            ).toString('base64')}`
        }
    });
};
