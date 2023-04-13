const { response, flakeGenerateDecimal, schema, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment');
let logger = logHelpers.logger;

console.log('process.env.IS_OFFLINE', process.env.IS_OFFLINE);
export const verifyPaymentStatus = async (event, context) => {
    const requestId = 'reqid_' + flakeGenerateDecimal();
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    let logMetadata = {
        location: 'SwitchService ~ verifyPaymentStatus',
        awsRequestId: context.awsRequestId
    };

    // eslint-disable-next-line
    var { sequelize, Payment, WebhookLog } = db;
    try {
        // ctx.callbackWaitsForEmptyEventLoop = false;
        const payload = JSON.parse(event.body);
        await schema.t2sPaymentVerifictionPaylodSchema.validateAsync(payload);
        if (payload.token !== 'fdzkE3HJkKru4gcNVzQVy7r2rrbcLtweBUhYYLKv') {
            return response({ message: 'invalid token' }, 500);
        }
        logger.info(logMetadata, 'token is good');
        // finding out the last 30 day date
        const last30Days = moment().subtract(30, 'days').format('YYYY-MM-DD');
        //reversing the payload date in YYYY-MM-DD since isBetween fn accepts date in YYYY-MM-DD format
        const payloadDate = payload.order_date.split('-').reverse().join('-');
        const today = moment().format('YYYY-MM-DD');
        //isBetween takes 3 args first 2 args are from date - to date, 3rd arg is granularity,
        // and 4th arg is inclusivity(here we are including last30Days date & today's date)
        const isValidDate = moment(payloadDate).isBetween(last30Days, today, 'days', '[]');

        if (!isValidDate) {
            return response({ message: `Date should be within last 30 days from the current date` }, 500);
        }

        const payments = await Payment.findAll({
            attributes: ['id', 'order_id', 'payment_status'], //Do not remove id, it is needed for webhooks
            where: {
                order_id: payload.order_ids,
                day: payload.order_date.split('-')[0],
                month: payload.order_date.split('-')[1],
                payment_status: 'OK',
                year: payload.order_date.split('-')[2]
            },
            indexHints: [{ type: 'USE', values: ['date_search'] }]
        });

        // let cardPaymentIds = payments.map((cardPaymentEntry) => cardPaymentEntry.id);

        // // eslint-disable-next-line
        // const webhooks = await WebhookLog.findAll({
        //     attributes: ['card_payment_id', 'http_response_code', 'webhook_url'],
        //     where: {
        //         card_payment_id: cardPaymentIds
        //     }
        // });

        await sequelize.close();
        return response({
            requestId,
            message: 'The request was processed successfully',
            data: {
                verifyPayment: payments
                //payments,
                //webhooks
            }
        });
    } catch (err) {
        logger.error(logMetadata, 'Error Block======>', err);
        await sequelize.close();
        return response(err.message, 500);
    }
};
