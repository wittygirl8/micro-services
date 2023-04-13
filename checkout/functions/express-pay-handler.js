const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

// Custom Helpers
const { init } = require('./helpers/init_v2');
const { getDBInstance } = require('./helpers/db');
const { checkAlreadyPaid } = require('./helpers/checkAlreadyPaid_v2');
const { apiKeyAuth } = require('./helpers/apiKeyAuth');
const { amountObject } = require('./helpers/objectAmount_v2');
const { expressSaleSchema } = require('./validators/checkout-express-sale-schema');
const { getIdFromReference } = require('./helpers/get-id-from-reference');
const { checkoutExpressSale } = require('./helpers/checkout-express-sale');
const { seedExpressSaleLog, updateExpressSaleLog } = require('./helpers/express-sale-log');

let logger = logHelpers.logger;

export const handler = async (event, context) => {
    let logMetadata = {
        location: 'checkout ~ CheckoutExpressPay_v1',
        awsRequestId: context.awsRequestId
    };

    try {
        var db = await getDBInstance();
        //initial setups
        var { requestId, payload } = await init(event, context, {});

        payload = await expressSaleSchema.validateAsync(payload);
        logger.info(logMetadata, 'express pay checkout payload', payload);

        //auth
        await apiKeyAuth(event);

        // seed checkout_express_sale_log table
        var expressLogResponse = await seedExpressSaleLog({
            payload,
            db
        });

        const orderId = getIdFromReference(payload.omt, 'order_id');

        await checkAlreadyPaid(db, { orderId });

        let amountItems = await amountObject(db, {
            total: payload.amount,
            merchantId: getIdFromReference(payload.omt, 'merchant_id')
        });
        logger.info(logMetadata, 'amountItems', amountItems);

        let saleResponse = await checkoutExpressSale({ payload, order_id: orderId, amountItems });
        logger.info(logMetadata, 'saleResponse', saleResponse);

        let api_response = {
            request_id: requestId,
            message: 'Sale processed successfully',
            data: {
                status: saleResponse.data?.status,
                amount: payload.amount,
                TxAuthNo: saleResponse.data?.auth_code,
                last_4_digits: saleResponse.data?.source?.last4,
                psp_reference: saleResponse.data?.id,
                internal_reference: saleResponse.data?.reference
            }
        };
        logger.info(logMetadata, 'api_response', api_response);

        let updateExpressLogResponse = await updateExpressSaleLog({
            db,
            updateObject: {
                initial_sale_status: saleResponse.data?.status,
                response: JSON.stringify(api_response),
                webhook_status: 'PENDING'
            },
            whereConditionObject: { id: expressLogResponse.id }
        });
        logger.info(logMetadata, 'updateExpressLogResponse', updateExpressLogResponse);

        await db.sequelize.close();
        return response(api_response, saleResponse.statusCode);
    } catch (e) {
        logger.error(logMetadata, 'Exception', e.message);

        let errorResponse = {
            request_id: requestId,
            message: e.message
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);

        expressLogResponse?.id &&
            (await updateExpressSaleLog({
                db,
                updateObject: {
                    initial_sale_status: '0',
                    response: JSON.stringify(errorResponse)
                },
                whereConditionObject: { id: expressLogResponse?.id }
            }));
        await db.sequelize.close();
        return response(errorResponse, e.code || 500);
    }
};
