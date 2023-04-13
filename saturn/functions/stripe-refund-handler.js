import { parse } from 'path';

const { response, messages, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const db = connectDB(
    process.env.DB_HOST,
    process.env.DB_DATABASE,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    process.env.IS_OFFLINE
);

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

const { Sequelize, StripeRefund, Customer, StripeFeeAdjustments } = db;

const { stripeController, customerController } = require('../business-logic');
const qs = require('qs');
const btoa = require('btoa');
const axios = require('axios');
let logger = logHelpers.logger;
var logMetadata = {
    location: 'SaturnService ~ stripeRefund'
};
const basicAuth = (username, password = '') => {
    const authHeader = `${username}:${password}`;
    const base64encodedAuthHeader = btoa(authHeader);
    return `Basic ${base64encodedAuthHeader}`;
};

export const stripeRefund = async (event) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    const MERCHANT_API_KEY = process.env.DATMAN_GATEWAY_API_KEY;
    logger.info(`~StripeRefund~Payload`, event.body);
    let {
        txnId,
        refundAmount,
        reason,
        paymentIntent,
        //vpsTxnId: stripeAccountID,
        clientReferenceId,
        total,
        fees,
        payed
    } = JSON.parse(event.body);
    try {
        const { api_key } = event.headers;

        logger.info(`~ stripeRefund ~ api keys`, { api_key, MERCHANT_API_KEY });
        if (!api_key || api_key !== MERCHANT_API_KEY) {
            await stripeController.logStripeRefundResponse(
                txnId,
                reason,
                {
                    error: messages.UNAUTHORISED
                },
                StripeRefund,
                logMetadata
            );

            return response(
                {
                    message: messages.UNAUTHORISED
                },
                401
            );
        }

        if (!txnId) {
            await stripeController.logStripeRefundResponse(
                txnId,
                reason,
                {
                    error: messages.NO_TXN_ID
                },
                StripeRefund,
                logMetadata
            );

            return response(
                {
                    message: messages.NO_TXN_ID
                },
                400
            );
        }

        if (!paymentIntent) {
            await stripeController.logStripeRefundResponse(
                txnId,
                reason,
                {
                    error: messages.NO_PAYMENT_INTENT_PROVIDED
                },
                StripeRefund,
                logMetadata
            );

            return response(
                {
                    message: messages.NO_PAYMENT_INTENT_PROVIDED
                },
                400
            );
        }
        let merchantID = await helpers.getSplitTransaction(clientReferenceId).merchantId;
        var customerInfo = await customerController.getStripeCeredentialsDetails(merchantID, Customer);

        logger.info(`~ stripeRefund ~ customerInfo`, JSON.stringify(customerInfo));

        const authHeader = basicAuth(customerInfo.STRIPE_SK);

        const getPaymentIntentDetailsconfig = {
            method: 'get',
            url: `https://api.stripe.com/v1/payment_intents/${paymentIntent}`,
            headers: {
                // 'Stripe-Account': stripeAccountID,
                Authorization: authHeader
            }
        };

        logger.info(`~ stripeRefund ~ config`, getPaymentIntentDetailsconfig);

        const paymentIntentDetails = await axios(getPaymentIntentDetailsconfig);

        logger.info(`~ stripeRefund ~ paymentIntentDetails`, paymentIntentDetails);
        const {
            id: stripeChargeId,
            amount: chargeAmount,
            amount_refunded: amountRefunded
        } = paymentIntentDetails.data.charges.data[0];
        refundAmount = Math.floor(refundAmount * 100); //converting refundAmount into cents.
        const amountAvailableToRefund = chargeAmount - amountRefunded;
        logger.info(`~ stripeRefund ~ refundAmount`, refundAmount);
        logger.info(`~ stripeRefund ~ amountAvailableToRefund`, amountAvailableToRefund);
        if (refundAmount > amountAvailableToRefund) {
            // trying to do a refund with a user passed value
            await stripeController.logStripeRefundResponse(
                txnId,
                reason,
                {
                    error: messages.REFUND_REQUESTED_FOR_MORE_THAN_AVAILABLE_REFUND_AMOUNT(
                        refundAmount,
                        amountAvailableToRefund
                    )
                },
                StripeRefund,
                logMetadata
            );

            return response(
                {
                    message: messages.REFUND_REQUESTED_FOR_MORE_THAN_AVAILABLE_REFUND_AMOUNT(
                        refundAmount,
                        amountAvailableToRefund
                    )
                },
                400
            );
        }
        //cancel request
        const amountToRefund = refundAmount ? refundAmount : amountAvailableToRefund;

        const cutomer = await customerController.getCustomerDetails(merchantID, Customer);

        const data = qs.stringify({
            amount: String(amountToRefund),
            reverse_transfer:
                cutomer.stripe_acc_type === 'MASTER-YOGO' || cutomer.stripe_acc_type === 'MASTER-ARDIT' ? false : true
        });

        const refundPaymentConfig = {
            method: 'post',
            url: `https://api.stripe.com/v1/charges/${stripeChargeId}/refunds`,
            headers: {
                // 'Stripe-Account': stripeAccountID,
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        const refundPayment = await axios(refundPaymentConfig).then((res) => res.data);

        logger.info(`~ stripeRefund ~ refundPayment`, refundPayment);
        await stripeController.logStripeRefundResponse(txnId, reason, refundPayment, StripeRefund, logMetadata);

        const amountInPounds = amountToRefund / 100; // we pass amount in cents to the stripe api.

        //update db not required as this is already handled from frontend which requests the stripe refund.
        // await updateRefundDetails(amountInPounds, reason, txnId);

        //log stripe api response

        //Recover the set up fee returned to customer during refund
        await stripeController.recoverRefundedSetupfee(
            txnId,
            payed,
            merchantID,
            total,
            fees,
            Sequelize,
            StripeFeeAdjustments,
            logMetadata
        );

        return response(
            {
                message: messages.REFUND_SUCCESS(amountInPounds)
            },
            200
        );
    } catch (e) {
        await stripeController.logStripeRefundResponse(
            txnId,
            reason,
            {
                error: messages.REFUND_FAILED
            },
            StripeRefund,
            logMetadata
        );
        let errorResponse = {
            message: e.message || messages.REFUND_FAILED
        };
        logger.info(`~ stripeRefund ~ errorResponse`, errorResponse);
        return response(errorResponse, 400);
    }
};
