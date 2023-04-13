var { updateT2sOrderStripe, response, logHelpers, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const db = connectDB(
    process.env.DB_HOST,
    process.env.DB_DATABASE,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    process.env.IS_OFFLINE
);
let logger = logHelpers.logger;

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

const { Payment, Customer, StripeFeeAdjustments, StripePaymentInfo } = db;

const { paymentsController, customerController, stripeFeeAdjustmentsController } = require('../business-logic');

let handleCheckoutSession = async (transactionId, last4digits, paymentIntentId, customerId) => {
    logger.info(`~ stripePaymentStatus ~ provider reference id ~ ${transactionId}`);

    await paymentsController.updatePaymentRecord({
        payment_status: 'OK',
        transactionId,
        last4digits,
        paymentIntentId,
        Payment
    });

    await stripeFeeAdjustmentsController.updateStripeFeeAdjustmentsRecord(
        {
            paymentStatus: 'OK',
            cardPaymentId: transactionId,
            customerId: customerId
        },
        StripeFeeAdjustments
    );
};
export const stripePaymentStatus = async (event, context) => {
    let logMetadata = {
        location: 'SaturnService ~ stripePaymentStatus',
        awsRequestId: context.awsRequestId
    };
    try {
        AWSXRay.capturePromise();
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {}); //do nothing
        }
        logger.info(`~ stripePaymentStatus ~ info ~ Stripe Payment Status Started`);
        if (event.body) {
            let body = JSON.parse(event.body);
            const sig =
                event.headers['Stripe-Signature'] != null
                    ? event.headers['Stripe-Signature']
                    : event.headers['stripe-signature'];
            if (!sig || sig == null) {
                logger.info(logMetadata, 'Stripe signature missing');
                return response(
                    {
                        received: false,
                        err: 'Stripe signature missing'
                    },
                    400
                );
            }

            logger.info(`~ stripePaymentStatus ~ stripePaymentStatus_headers`, event.headers);
            let c_event;
            let stripeObject = body.data.object;

            logger.info(logMetadata, 'stripeObject', stripeObject);

            var transactionId = helpers.getSplitTransaction(stripeObject.client_reference_id).transactionId;

            var paymentInfoStripe = await StripePaymentInfo.findOne({
                where: {
                    card_payment_id: transactionId
                }
            });

            logger.info(logMetadata, 'paymentInfoStripe', paymentInfoStripe);

            if (paymentInfoStripe == null || paymentInfoStripe == undefined) {
                return response(
                    {
                        received: false,
                        err: 'Payment not found'
                    },
                    400
                );
            }

            logger.info(`~ stripePaymentStatus ~ stripePaymentStatus Body`, body);
            logger.info(`~ stripePaymentStatus ~ stripePaymentStatus stripeObject`, stripeObject);

            let paymentIntentId = stripeObject.payment_intent;
            let OrderTotal = parseFloat(stripeObject.amount_total / 100);

            logger.info(`stripeInfo~merchant_id:`, paymentInfoStripe);

            var customerCredInfo = await customerController.getStripeCeredentialsDetails(
                paymentInfoStripe.merchant_id,
                Customer
            );
            let stripe = require('stripe')(customerCredInfo.STRIPE_SK);
            // c_event = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WH)
            c_event = stripe.webhooks.constructEvent(event.body, sig, customerCredInfo.STRIPE_WH);
            logger.info(`~ stripePaymentStatus ~ checkout session completed`, c_event);

            if (c_event.type === 'checkout.session.completed') {
                let last4digits = '0000';
                await handleCheckoutSession(
                    transactionId,
                    last4digits,
                    paymentIntentId,
                    paymentInfoStripe.merchant_id,
                    logMetadata
                );

                logger.info(`process.env.T2S_API_TOKEN:`, process.env.T2S_API_TOKEN);

                var webhook_data = {
                    T2S_WEBHOOK_API_KEY: process.env.T2S_API_TOKEN,
                    amount: OrderTotal,
                    order_info_id: paymentInfoStripe.order_id,
                    webhook_url: paymentInfoStripe.webhook_url
                };
                logger.info(`webhookData:`, webhook_data);
                var success = await updateT2sOrderStripe(webhook_data);
                if (success) {
                    return response(
                        {
                            received: true
                        },
                        200
                    );
                }
            } else {
                logger.info(`~ stripePaymentStatus ~ checkout session not completed`, c_event);
            }
        }
    } catch (err) {
        let errorResponse = {
            received: false,
            err: err.message
        };

        logger.error(`~ stripePaymentStatus ~ errorResponse`, err.stack);
        logger.error(`~ stripePaymentStatus ~ errorResponse`, errorResponse);
        response(errorResponse, 400);
    }
};
