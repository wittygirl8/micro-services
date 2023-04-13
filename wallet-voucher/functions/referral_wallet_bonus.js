/*
 * @Description: Api for adding balance to the given shopper_id or reversal of amount added to wallet
 * @sampleRequest: {"shopper_id": "12345678",   "order_id": "1234567890", "action" : "TOPUP", "referral_user_type":"REFERRER"}
 */

const { logHelpers, schema, response, cryptFunctions } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const { init } = require('./helpers/init');
const { hmac } = require('./helpers/hmac');
const { getDBInstance } = require('./helpers/db');
const { getOrderDetails } = require('./helpers/getOrderDetails');
const { checkAlreadyExists } = require('./helpers/checkAlreadyExists');
const { checkTopUpTransaction } = require('./helpers/checkTopUpTransaction');
const { getCurrencyCode } = require('./helpers/getCurrencyCode');
const { getBonusRange } = require('./helpers/getBonusRange');
const { validateShopperId } = require('./helpers/validateShopperId');
const { populateRequestLog } = require('./helpers/populateRequestLog');
const { getResponse } = require('./helpers/getResponse');
const { processRequest } = require('./helpers/processRequest');

export const main = async (event, context) => {
    var { logger, logMetadata } = await init(event, context, { fileName: 'referral_wallet_bonus' });

    var db = await getDBInstance();

    try {
        let { sequelize, Sequelize } = db;
        var rawData = await hmac(event);

        logger.info(logMetadata, 'Request Payload', rawData);
        var payload = await schema.RefferralWalletBonusSchema.validateAsync(JSON.parse(rawData));

        const { shopper_id, amount, order_id, action } = payload;
        payload.amount = (Math.round((Number(payload.amount) + Number.EPSILON) * 100) / 100).toFixed(2);

        let wallet_id = await validateShopperId({ shopper_id, db });

        let orderDetails = await getOrderDetails({ order_id, payload, db, Sequelize });

        await checkAlreadyExists({ payload, id: orderDetails?.id, db });

        let TopUpTransaction = await checkTopUpTransaction({ payload, id: orderDetails?.id, db, action });

        let MerchantDetails = await getCurrencyCode({ customer_id: orderDetails?.customer_id, payload, db });

        let BonusRange = await getBonusRange({ country_id: MerchantDetails.country_id, payload, db });

        let api_response = await getResponse({ logMetadata, status: 'success' });

        await processRequest({
            BonusRange,
            amount,
            payload,
            action,
            MerchantDetails,
            orderDetails,
            wallet_id,
            api_response,
            TopUpTransaction,
            db
        });

        await populateRequestLog({ payload, db, api_response });
        await sequelize.close();
        return response(api_response);
    } catch (e) {
        logger.error(logMetadata, 'ErrorResponse', e.message);

        let api_response = await getResponse({ logMetadata, status: 'failed', e, payload });
        console.log(api_response);

        await populateRequestLog({ payload, db, api_response });
        return response(api_response, 200);
    }
};
