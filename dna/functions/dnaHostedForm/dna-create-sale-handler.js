const { response, logHelpers, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;

// Custom Validators
const { hostedFormRequestSchema, dnaPhonePaymentPayloadSchema } = require('../validators/hosted-form-request-validator');

// Custom Helpers
const { init } = require('../helpers/init');
const { getDBInstance } = require('../helpers/db');
const { checkAlreadyPaid } = require('../helpers/check-already-paid');
const { amountObject } = require('../helpers/object-amount');
const { seedPayment, logGatewayRequest } = require('../helpers/sql-operations');
const { hmac } = require('../helpers/hmac');
const { dnaSessionCreation } = require('../helpers/dna-session-creation');

export const dnaCreateSale = async (event, context) => {
    // initial setups
    let { requestId: request_id } = await init(context, { fileName: 'hosted-form-handler' });

    let logMetadata = {
        location: 'dna ~ dnaCreateSale',
        awsRequestId: context.awsRequestId
    };

    // get the db instance
    let db = await getDBInstance();
    try {
        // decrypt the payload
        let payload = await hmac(event);
        logger.info(logMetadata, 'payload', payload);

        // validate the decrypted request body payload and sanitization
        if (payload.mode === 'phone_payment') {
            payload = await dnaPhonePaymentPayloadSchema.validateAsync(payload);
        } else {
            payload = await hostedFormRequestSchema.validateAsync(payload);
        }

        const isSplitCommissionEnabled = await splitFeeHelpers.ValidateSplitFeePayload({ db, payload });

        //putting entry into gateway_request_log
        await logGatewayRequest(db, payload);

        // check if the order is already paid
        let alreadyPaid = await checkAlreadyPaid(db, { orderId: payload.order_id });
        if (alreadyPaid) {
            const errorResponse = {
                error: {
                    request_id,
                    status: 'Error',
                    message: `The order id #${payload.order_id} has been already paid`,
                    redirect_url: payload.redirect_url
                }
            };
            logger.error(logMetadata, errorResponse);
            await db.sequelize.close();
            return response(errorResponse, 409);
        }

        // calculate fee and get the amount items like {net. fee, total}
        let amountItems = await amountObject(db, {
            total: payload.total,
            merchantId: payload.merchant_id
        });

        // seed item to payments table
        let seedPaymentResults = await seedPayment(db, { ...payload, amountItems }, event);
        logger.info(logMetadata, 'seedPaymentResults', seedPaymentResults);

        if (isSplitCommissionEnabled) {
            // seed split fee info into the db
            await splitFeeHelpers.SeedSplitFeeInfo({
                db, // db object
                payload: { ...payload, total: payload?.total / 100 }, // payload passed form the php
                MerchantId: payload.merchant_id,
                PaymentRecord: seedPaymentResults.paymentRecord // The object when you seeded the record the payment table
            });
        }

        let masterTokenDetails;
        if (payload.cc_token && !payload.mode) {
            masterTokenDetails = {
                token: payload.cc_token,
                last_4_digit: payload.last_four_digits,
                scheme_id: payload.scheme_id,
                scheme_name: payload.scheme_name,
                expiry_date: payload.expiry_date
            };
            logger.info(logMetadata, 'masterTokenDetails : ', masterTokenDetails);
        }

        // Initiate checkout session creation
        const dnaToken = await dnaSessionCreation({ type: 'sale', amountItems, omt: seedPaymentResults.omt });
        logger.info(logMetadata, 'dnaToken', dnaToken);

        const metadata = {
            omt: seedPaymentResults.omt,
            total: amountItems.total,
            currency: amountItems.country_code_3letters,
            country: amountItems.country_code_2letters,
            terminalId: JSON.parse(process.env.DNA_HOSTED_FORM).terminalId,
            returnUrl: payload.redirect_url,
            failureReturnUrl: payload.cancel_url,
            callbackUrl: payload.webhook_url,
            email: payload.email,
            firstName: payload.first_name,
            lastName: payload.last_name,
            tokenDetails: masterTokenDetails,
            mode: payload.mode
        };

        // remote API call close Db connection
        await db.sequelize.close();

        let api_response = {
            request_id,
            message: 'The request was processed successfully',
            data: dnaToken,
            metadata
        };
        logger.info(logMetadata, 'api_response', api_response);
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id,
                status: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        await db.sequelize.close();
        return response(errorResponse, 500);
    }
};
