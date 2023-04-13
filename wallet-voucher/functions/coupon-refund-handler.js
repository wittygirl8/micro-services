var { MerchantResponse, schema, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const CouponRefund = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    let logMetadata = {
        location: 'SwitchService ~ CouponRefund',
        awsRequestId: context.awsRequestId
    };

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Payment, FhCouponLog } = db;
    try {
        //authorization
        logger.info(logMetadata, event.headers);
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken);

        if (!event.body) {
            throw { message: 'Payload missing' };
        }
        let payload = JSON.parse(event.body);
        payload = await schema.couponRefundSchema.validateAsync(payload); //sanitization

        //logging the api request here

        let FhCouponLogExists = await FhCouponLog.findOne({
            where: {
                order_id: payload.order_id
            }
        });
        //throw error in case no coupon sale entry exists
        if (!FhCouponLogExists) {
            throw { message: 'No record found for the given order_id' };
        }

        //check if coupon sale is already refunded
        if (FhCouponLogExists.is_refunded) {
            MerchantResponse({ message: 'Coupon value was reverted' });
        }

        //update card_payment table
        await Payment.update(
            {
                refund: 'Order cancelled',
                total: '0.00',
                fees: '0.00',
                payed: '0.00'
            },
            { where: { id: FhCouponLogExists.card_payment_id } }
        );

        //update fh_coupon_log as refunded aswell
        await FhCouponLog.update(
            {
                is_refunded: 1,
                refunded_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
            },
            { where: { id: FhCouponLogExists.id } }
        );
        let SuccessResponse = {
            message: 'Coupon value was reverted'
        };
        return MerchantResponse(SuccessResponse);
    } catch (e) {
        let ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'errorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
