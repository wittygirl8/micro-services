var { response, flakeGenerateDecimal, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var moment = require('moment');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;

export const verifyPayment = async (event, context) => {
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    let logMetadata = {
        location: 'SwitchService ~ verifyPayment',
        awsRequestId: context.awsRequestId
    };
    // eslint-disable-next-line
    const { sequelize, Payment, WebhookLog } = db;
    const payload = JSON.parse(event.body);
    const requestId = 'reqid_' + flakeGenerateDecimal();

    try {
        if (payload.token === 'fdzkE3HJkKru4gcNVzQVy7r2rrbcLtweBUhYYLKv') {
            logger.info(logMetadata, 'token is good');
        } else {
            return response({ message: 'invalid token' }, 500);
        }
        let currentYear = +moment().format('YYYY');

        const payments = await Payment.findAll({
            //attributes: ['order_id', 'payment_status'],
            where: {
                order_id: `${payload.order_id}`,
                payment_status: 'OK',
                day: payload.day,
                month: payload.month,
                year: payload.hasOwnProperty('year') ? payload.year : currentYear
            },
            indexHints: [{ type: 'USE', values: ['date_search'] }]
        });

        // let cardPaymentIds = payments.map((cardPaymentEntry) => cardPaymentEntry.id);

        // // eslint-disable-next-line
        // const webhooks = await WebhookLog.findAll({
        //     //attributes: ['card_payment_id', 'http_response_code', 'webhook_url'],
        //     where: {
        //         card_payment_id: cardPaymentIds
        //     }
        // });

        await sequelize.close();

        return response({
            requestId,
            message: 'The request was processed successfully',
            data: {
                success: 'ok',
                userSetting: payments
                //payments,
                //webhooks
            }
        });
    } catch (err) {
        logger.error(logMetadata, err);
        await sequelize.close();
        return response(err.message, 500);
    }
};
