const { response, helpers, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

// Custom Validators
const { hostedFormRequestSchema } = require('./validators/hosted-form-request-validator');

// Custom Helpers
const { init } = require('./helpers/init');
const { getDBInstance } = require('./helpers/db');
const { checkAlreadyPaid } = require('./helpers/checkAlreadyPaid');
const { amountObject } = require('./helpers/objectAmount');
const { seedPayment } = require('./helpers/seedPayment');
const { checkoutSessionCreation } = require('./helpers/checkoutSessionCreation');
const { errorPage } = require('./helpers/errorPage');
const { hmac } = require('./helpers/hmac');
const { urlShortnerService } = require('./helpers/urlShortnerService');

export const handler = async (event, context) => {
    // console.log('all envs', process.env);
    try {
        // decrypt
        var payload = await hmac(event, context);

        // initial setups
        var { requestId, documentXray } = await init(event, context, { fileName: 'hosted-form-handler' });

        // get the db instance
        var db = await getDBInstance();

        // validate the request body payload
        await hostedFormRequestSchema.validateAsync(payload, documentXray);

        // validate the request splitFee payload
        const isSplitCommissionEnabled = await splitFeeHelpers.ValidateSplitFeePayload({ db, payload });
        console.log('isSplitCommissionEnabled', isSplitCommissionEnabled);

        // check if the order is already paid
        let alreadyPaid = await checkAlreadyPaid(db, documentXray, { orderId: payload.order_id });
        if (alreadyPaid == true) {
            let ar = {
                request_id: requestId,
                message: `The order id #${payload.order_id} has been already paid`,
                data: {}
            };
            return response(ar, 301, { Location: payload.redirect_url });
        }

        // calculate fee and get the amount items like {net. fee, total}
        let amountItems = await amountObject(db, documentXray, {
            total: payload.total,
            merchantId: payload.merchant_id
        });

        // seed item to payments table
        let seedPaymentResults = await seedPayment(db, documentXray, { ...payload, amountItems, event });

        if (isSplitCommissionEnabled) {
            //blackBoxFunction1: Split Commission - Direct + gpay apple pay
            await splitFeeHelpers.SeedSplitFeeInfo({
                db, // dbobject
                payload: { ...payload, total: payload?.total / 100 }, // payload passed form the php
                MerchantId: payload.merchant_id,
                PaymentRecord: seedPaymentResults.paymentRecord // The object when you seeded the record the payment table
            });
        }

        // temporary shorten Url
        let urls = await urlShortnerService(payload);
        console.log('urls', urls);

        // Initiate checkout session creation
        let result = await checkoutSessionCreation(db, documentXray, {
            ...payload,
            ...seedPaymentResults,
            amountItems,
            ...urls
            // via_saved_card: false
        });

        // remote API call close Db connection
        await db.sequelize.close();
        // Close xray segment
        documentXray.close();

        return response(result, 301, { Location: result._links.redirect.href });
    } catch (e) {
        // documentXray.close();
        // documentXray.addError(e.message);
        await db.sequelize.close();
        return {
            body: await errorPage({ requestId, orderId: payload.order_id, message: e.message }),
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            }
        };
    }
};
