/**
 * Takes the order details and return session id
 * @param {object} orderDetails
 */
const { logHelpers } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

let logger = logHelpers.logger;

export const stripeCreateCheckoutSession = async (orderDetails, paymentReferences, { awsRequestId }) => {
    let logMetadata = {
        location: 'SaturnService ~ stripeCreateCheckoutSession',
        awsRequestId: awsRequestId
    };
    try {
        let {
            successUrl,
            cancelUrl,
            clientReferenceId,
            stripe_sk,
            stripe_acc_id,
            currency,
            application_fee_amount
        } = paymentReferences;
        let { name, email, total } = orderDetails;
        // let {stripe_sk, stripe_pk} = customerInfo
        const stripe = require('stripe')(stripe_sk);
        logger.info(logMetadata, 'stripeCreateCheckoutSession');

        let stripePaylod = {
            payment_method_types: ['card'],
            customer_email: email,
            client_reference_id: clientReferenceId,

            line_items: [
                {
                    name: name,
                    amount: `${parseInt(total * 100)}`,
                    currency,
                    quantity: 1
                }
            ],
            success_url: successUrl,
            cancel_url: cancelUrl
        };

        if (
            paymentReferences.stripe_acc_type !== 'MASTER-YOGO' &&
            paymentReferences.stripe_acc_type !== 'MASTER-ARDIT'
        ) {
            stripePaylod = {
                ...stripePaylod,
                payment_intent_data: {
                    // application_fee_amount: parseInt(parseFloat(helpers.feeCalculation(total, 2.00, 0.00)).toFixed(2) * 100),
                    application_fee_amount,
                    on_behalf_of: stripe_acc_id,
                    transfer_data: {
                        destination: stripe_acc_id
                    }
                }
            };
        }

        return new Promise((resolve, reject) => {
            stripe.checkout.sessions.create(stripePaylod).then(
                (session) => {
                    if (session.id) return resolve(session.id);
                    reject();
                },
                (err) => {
                    logger.error(logMetadata, err);
                    reject(err);
                }
            );
        });
    } catch (error) {
        logger.error(logMetadata, error);
        // eslint-disable-next-line  -- reject is not defined
        reject(error);
    }
};

export const stripeConstructWebhookEvent = async (body, sig) => {
    // eslint-disable-next-line  -- stripe is not defined
    return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WH);
};

export const stripePaymentIntentRetrieve = async (paymentIntentId, accountId) => {
    // eslint-disable-next-line  -- stripe is not defined
    return stripe.paymentIntents.retrieve(paymentIntentId, {
        stripe_account: accountId
    });
};

export const stripeAccountCreate = async (country, email, business_name, date, ip) => {
    // eslint-disable-next-line  -- stripe is not defined
    return await stripe.accounts.create({
        type: 'custom',
        country,
        email,
        requested_capabilities: ['card_payments', 'transfers'],
        business_profile: {
            name: business_name
        },
        // default_currency: currency,
        tos_acceptance: {
            date,
            ip
        }
    });
};

export const stripeGetNewClientAccount = async (code) => {
    // eslint-disable-next-line  -- stripe is not defined
    return await stripe.oauth.token({
        grant_type: 'authorization_code',
        code
    });
};

export const stripeRefund = async (data) => {
    // eslint-disable-next-line  -- stripe is not defined
    return await stripe.refunds.create(data);
};

export const logStripeRefundResponse = async (txnId, reason, stripeRefundResponse, StripeRefund, { awsRequestId }) => {
    let logMetadata = {
        location: 'SaturnService ~ logStripeRefundResponse',
        awsRequestId
    };
    const {
        id: stripe_refund_id,
        amount,
        balance_transaction: stripe_balance_transaction_id,
        charge,
        currency,
        status,
        error
    } = stripeRefundResponse;

    if (error) {
        const refundInfoToSave = {
            card_payment_id: txnId || 0, // txn Id of 0 means there was an error in processing the refund.
            stripe_refund_id: '',
            amount: 0,
            stripe_balance_transaction_id: '',
            charge: '',
            currency: '',
            status: '',
            metadata: JSON.stringify({ error }),
            reason
        };

        logger.info(logMetadata, 'refundInfoToSave ===> ', refundInfoToSave);

        const logStripeRefund = await StripeRefund.create(refundInfoToSave);
        return logStripeRefund;
    }

    let metadata = { ...stripeRefundResponse };

    const refundInfoToSave = {
        card_payment_id: txnId,
        stripe_refund_id,
        amount,
        stripe_balance_transaction_id,
        charge,
        currency,
        status,
        metadata: JSON.stringify(metadata),
        reason
    };

    logger.info(logMetadata, 'Refund info to save ===> ', refundInfoToSave);

    const logStripeRefund = await StripeRefund.create(refundInfoToSave);

    logger.info(logMetadata, 'logStripeRefund ===> ', logStripeRefund);

    return logStripeRefund;
};

export const recoverRefundedSetupfee = async (
    txnId,
    payed,
    merchantID,
    total,
    fees,
    Sequelize,
    StripeFeeAdjustments,
    logMetadata
) => {
    logger.info(logMetadata, `~ stripeRefund ~ fetchFeeDetailsSum for `, txnId);

    let fee_details = await StripeFeeAdjustments.sum('adjustment_amount', {
        where: {
            [Sequelize.Op.and]: [
                { cardPaymentId: txnId },
                { customerId: merchantID },
                { paymentStatus: { [Sequelize.Op.in]: ['OK', 'REFUND'] } }
            ]
        }
    });

    if (fee_details > 0) {
        let excessAmount = parseFloat(fee_details) + parseFloat(payed);

        if (excessAmount > 0) {
            excessAmount = 0;
        }

        let adjustment_amount = parseFloat(payed) - parseFloat(excessAmount);

        logger.info(logMetadata, `~ stripeRefund ~ ExcessAmount`, excessAmount, fee_details, payed);

        await StripeFeeAdjustments.create({
            customerId: merchantID,
            total: total,
            fees: fees,
            payed: '0.00',
            cardPaymentId: txnId,
            paymentStatus: 'REFUND',
            adjustmentAmount: adjustment_amount.toFixed(2)
        });
    }

    return;
};
