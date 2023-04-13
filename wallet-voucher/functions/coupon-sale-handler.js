var { MerchantResponse, schema, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const CouponSale = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    let logMetadata = {
        location: 'SwitchService ~ CouponSale',
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
        payload = await schema.couponSaleSchema.validateAsync(payload); //sanitization

        //logging the api request

        //check for order_id existance
        let FhCouponLogExists = await FhCouponLog.findOne({
            where: {
                order_id: payload.order_id,
                customer_id: payload.merchant_id
            }
        });
        if (FhCouponLogExists) {
            return MerchantResponse({
                payment_id: FhCouponLogExists.card_payment_id
            });
        }

        //create payment entry
        //with voucher entry, we wont populate with order_id as that will cause some conflicts with functionality like refunds and payments
        //this is as per the comments from Brent from the legecy php code
        let paymentRef = await Payment.create({
            customer_id: payload.merchant_id,
            firstname: payload.firstname,
            lastname: payload.lastname,
            address: payload.address,
            email: payload.email,
            total: payload.value.toFixed(2),
            fees: '0.00',
            payed: payload.value.toFixed(2),
            week_no: moment().tz(TIMEZONE).format('W'),
            provider: 'FH',
            payment_status: 'OK',
            payment_provider: 'VOUCHER',
            origin: 'API',
            method: 'FoodhubCoupon'
        });

        //populating fh coupon log
        await FhCouponLog.create({
            customer_id: payload.merchant_id,
            order_id: payload.order_id,
            coupon_id: payload.order_id,
            card_payment_id: paymentRef.id,
            value: payload.value,
            referrer: '', //adding empty value here jus to follow the legacy php code
            day: moment().tz(TIMEZONE).format('D'),
            month: moment().tz(TIMEZONE).format('M'),
            year: moment().tz(TIMEZONE).format('Y'),
            created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
        });

        let SuccessResponse = {
            payment_id: paymentRef.id
        };
        return MerchantResponse(SuccessResponse);
    } catch (e) {
        let ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'errorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
