const { response, TokenAuthorize, cryptFunctions, splitFeeHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

// Custom Helpers
const { init } = require('./helpers/init_v2');
const { getDBInstance } = require('./helpers/db');
const { checkAlreadyPaid } = require('./helpers/checkAlreadyPaid_v2');
const { seedPayment } = require('./helpers/seedPayment_v2');
const { amountObject } = require('./helpers/objectAmount_v2');
const { requestProviderToken } = require('./helpers/checkoutTokens');
const { checkoutPayments } = require('./helpers/checkoutPayments');

// Custom Validators
const { walletTokenRequestSchema } = require('./validators/wallet-token-request-validator');

const logger = logHelpers.logger;
const logMetadata = {
    location: 'Checkout ~ walletTokensHandler'
};

// Enums
const PAYMENT_METHOD = {
    GOOGLE_PAY: 'googlepay',
    APPLE_PAY: 'applepay'
};

export const handler = async (event, context) => {
    // get the db instance
    let db = await getDBInstance();

    try {
        //api authorization
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken);
        //payload validation
        if (!event.body) {
            throw new Error('Parameters missing');
        }
        //initial setups
        let { requestId, payload } = await init(event, context, {});

        logger.info(logMetadata, 'Encrypted payload', payload);
        let decryptedPayload = cryptFunctions.decryptPayload(payload.data, process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY);
        decryptedPayload = JSON.parse(decryptedPayload);
        decryptedPayload = await walletTokenRequestSchema.validateAsync(decryptedPayload);
        decryptedPayload.Amount = decryptedPayload.Amount * 100 // for UK, AUS, NZ & USA amount = 100 is equivalent to 1 payment request amount.
        logger.info(logMetadata, 'Decrypted payload', decryptedPayload);

        let address = `${decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : ''} ${decryptedPayload.flat ? decryptedPayload.flat : ''} ${decryptedPayload.address1 ? decryptedPayload.address1 : ''
            } ${decryptedPayload.address2 ? decryptedPayload.address2 : ''} ${decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : ''}`;

        // transform the payload as per our case
        let newPayload = {
            host: decryptedPayload.host,
            order_id: decryptedPayload.order_id,
            customer_id: decryptedPayload.customer_id,
            merchant_id: decryptedPayload.merchant_id,
            total: decryptedPayload.Amount,
            first_name: decryptedPayload.firstname,
            last_name: decryptedPayload.lastname,
            address: address,
            email: decryptedPayload.email,
            redirect_url: decryptedPayload.RedirectUrl,
            cancel_url: decryptedPayload.CancelUrl,
            webhook_url: decryptedPayload.WebhookUrl,
            type: decryptedPayload.gatewayParameters?.gateway,
            token_data: decryptedPayload.gatewayParameters?.instrumentToken
        }

        decryptedPayload.split_fee && (newPayload.split_fee = decryptedPayload.split_fee);

        // validate the request splitFee payload
        const isSplitCommissionEnabled = await splitFeeHelpers.ValidateSplitFeePayload({ db, payload: newPayload });
        logger.info(logMetadata, 'isSplitCommissionEnabled', isSplitCommissionEnabled);

        // check if the order is already paid
        await checkAlreadyPaid(db, { orderId: newPayload.order_id });

        // calculate fee and get the amount items like {net. fee, total}
        let amountItems = await amountObject(db, {
            total: newPayload.total,
            merchantId: newPayload.merchant_id
        });

        // seed item to payments table
        let seedPaymentResult = await seedPayment(db, {
            ...newPayload,
            amountItems,
            event,
            transaction_method_id:
                newPayload?.type === PAYMENT_METHOD.GOOGLE_PAY ? 8 : newPayload?.type === PAYMENT_METHOD.APPLE_PAY ? 9 : ''
        });

        if (isSplitCommissionEnabled) {
            // process split commission
            await splitFeeHelpers.SeedSplitFeeInfo({
                db, // dbobject
                payload: { ...newPayload, total: newPayload.total / 100 }, // payload passed form the php
                MerchantId: newPayload.merchant_id,
                PaymentRecord: seedPaymentResult.paymentRecord // The object when you seeded the record the payment table
            });
        }

        // request provider Token
        let providerToken_results = await requestProviderToken({
            ...newPayload
        });

        console.log('providerToken_results', providerToken_results.data);

        // Generating the checkout Redirect URL for the merchant
        let checkoutPaymentsResult = await checkoutPayments({
            ...newPayload,
            provider_token: providerToken_results.data?.token,
            type: providerToken_results.data?.type,
            amountItems,
            ...seedPaymentResult
        });
        console.log('checkoutPaymentsResult', checkoutPaymentsResult?.data, checkoutPaymentsResult?.status);

        await db.sequelize.close();
        return response(
            {
                request_id: requestId,
                message: 'success',
                data: {
                    token: providerToken_results?.data,
                    payments: checkoutPaymentsResult?.data
                }
            },
            checkoutPaymentsResult.status
        );
    } catch (e) {
        await db.sequelize.close();
        console.log('error', e);
        return response({ message: e?.message, stack: e?.stack }, e.status ? e.status : 500);
    }
};
