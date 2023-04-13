const { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
let logger = logHelpers.logger;

// Custom Validators
const { expressSaleSchema } = require('../validators/dna-express-sale-schema');

// Custom Helpers
const { init } = require('../helpers/init');
const { getDBInstance } = require('../helpers/db');
const { checkAlreadyPaid } = require('../helpers/check-already-paid');
const { amountObject } = require('../helpers/object-amount');
const { getIdFromReference } = require('../helpers/get-id-from-reference');
const { dnaSessionCreation } = require('../helpers/dna-session-creation');
const { dnaExpressSale } = require('../helpers/dna-express-sale');
const { seedExpressSaleLog, updateExpressSaleLog } = require('../helpers/express-sale-log');

export const dnaExpressPay = async (event, context) => {
    // initial setups
    let { requestId } = await init(context);

    let logMetadata = {
        location: 'dna ~ dnaExpressPay',
        awsRequestId: context.awsRequestId
    };

    // get the db instance
    let db = await getDBInstance();
    try {
        // decrypt the payload
        let payload = JSON.parse(event.body);

        // validate the decrypted request body payload
        await expressSaleSchema.validateAsync(payload);
        logger.info(logMetadata, 'express pay DNA payload', payload);

        let authToken = event.headers.api_token;
        console.log('Refund API Auth Token', JSON.parse(process.env.DNA_HOSTED_FORM).apiAuthToken);
        await TokenAuthorize(authToken, JSON.parse(process.env.DNA_HOSTED_FORM).apiAuthToken);

        // seed dna_express_sale_log table
        var expressLogResponse = await seedExpressSaleLog({
            payload,
            db
        });

        const orderId = getIdFromReference(payload.omt, 'order_id');

        // check if the order is already paid
        const alreadyPaid = await checkAlreadyPaid(db, { orderId });
        if (alreadyPaid) {
            throw { status: 'Error', message: `The order id #${orderId} has been already paid` }
        }

        // calculate fee and get the amount items like {net. fee, total}
        let amountItems = await amountObject(db, {
            total: payload.amount,
            merchantId: getIdFromReference(payload.omt, 'merchant_id')
        });
        logger.info(logMetadata, 'amountItems', amountItems);

        // Initiate checkout session creation
        const dnaToken = await dnaSessionCreation({ type: 'sale', amountItems, omt: payload.omt });
        logger.info(logMetadata, 'dnaToken', dnaToken);

        var saleResponse = await dnaExpressSale(db, { payload, amountItems, dnaToken }, logMetadata.awsRequestId);
        logger.info(logMetadata, 'saleResponse', saleResponse.data);

        if (saleResponse.data?.success === false) {
            throw {
                message: `Sale not success`,
                reason: `error code: ${saleResponse.data?.errorCode} - ${saleResponse.data?.message}`
            };
        }

        const last_4_digits = saleResponse.data.cardPanStarred?.substr(saleResponse.data.cardPanStarred?.length - 4);

        let api_response = {
            request_id: requestId,
            message: 'Sale processed successfully',
            data: {
                internal_reference: saleResponse.data.invoiceId,
                psp_reference: saleResponse.data.id,
                TxAuthNo: saleResponse.data.authCode,
                last_4_digits: last_4_digits
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
        return response(api_response, saleResponse.status);
    } catch (e) {
        logger.error(logMetadata, 'Exception', e.message);

        let errorResponse = {
            request_id: requestId,
            message: e.message,
            reason: e.reason
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);

        expressLogResponse?.id &&
            (await updateExpressSaleLog({
                db,
                updateObject: {
                    initial_sale_status: saleResponse?.status || '0',
                    response: JSON.stringify(errorResponse)
                },
                whereConditionObject: { id: expressLogResponse?.id }
            }));
        await db.sequelize.close();
        return response(errorResponse, e.code || 500);
    }
};
