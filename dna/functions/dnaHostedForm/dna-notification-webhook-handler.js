var { response, logHelpers, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;

// Custom Helpers
const { getDBInstance } = require('../helpers/db');
const { updatePayments } = require('../helpers/update-payment');
const { update3rdParty } = require('../helpers/update3rdParty');
const { getIdFromReference } = require('../helpers/get-id-from-reference');
const { updateExpressSaleLog } = require('../helpers/express-sale-log');

export const dnaNotificationWebhook = async (event, context) => {
    let logMetadata = {
        location: 'dna ~ dnaNotificationWebhook',
        awsRequestId: context.awsRequestId
    };

    // get the db instance
    let db = await getDBInstance();
    try {
        let notificationObject = JSON.parse(event.body);
        logger.info(logMetadata, 'DNA webhook notificationObject', notificationObject);

        let invoiceId = notificationObject.invoiceId;

        const infoArray = invoiceId.split('M');
        const order_id = infoArray[0].substr(1);
        const [merchantId, transactionId] = infoArray[1].split('T');

        logger.info(
            logMetadata,
            `order_id: ${order_id}`,
            `merchantId: ${merchantId}`,
            `transactionId: ${transactionId}`
        );

        // signature has to authenticate

        logger.info(logMetadata, 'Saving DNA Webhook Response in DB');
        const logDnaResponseLogInfo = await db.DnaResponse.create({ dna_response: event.body, order_id });

        if (notificationObject.success) {
            let payment_id = getIdFromReference(notificationObject.invoiceId, 'txn_id');
            logger.info(logMetadata, 'payment_id', payment_id);

            //if sale initiated through express checkout, then we don't need to update payments table through this webhook
            if (!notificationObject.threeDS && !notificationObject.entryMode) {
                //update the dna_express_sale_log entry with webhook status

                logger.info(logMetadata, 'Updating DNA Express Sale Log');
                let updateExpressLogResponse = await updateExpressSaleLog({
                    db,
                    updateObject: {
                        webhook_status: notificationObject.message,
                        dna_response_log_id: logDnaResponseLogInfo.id
                    },
                    whereConditionObject: {
                        payment_id,
                        webhook_status: {
                            [db.Sequelize.Op.ne]: null
                        }
                    }
                });
                logger.info(logMetadata, 'updateExpressLogResponse', updateExpressLogResponse);
                throw { message: 'Sale through express-sale, no further actions required' };
            }

            // get payload from gateway request log
            const { request_data } = await db.GatewayRequestLog.findOne({
                where: {
                    order_id: order_id,
                    gateway: 'DNA'
                },
                raw: true
            });

            if (!request_data) {
                throw { message: 'Gateway Request log does not exists' };
            }

            let payload = JSON.parse(request_data);

            logger.info(logMetadata, 'DNA transaction is successful, updating payments table');

            // update payments table
            await updatePayments(
                db,
                { order_id, transactionId, merchantId, notificationObject },
                logMetadata.awsRequestId
            );

            if (payload?.split_fee?.length) {
                // update split fee info in db
                await splitFeeHelpers.UpdateSplitFeeInfo({
                    db, // db object
                    payments_id: payment_id // payment_id/cardpayment_id
                });
            }

            // update to the attached webhook url
            await update3rdParty(
                db,
                { order_id, transactionId, notificationObject, payload },
                logMetadata.awsRequestId
            );
        }

        await db.sequelize.close();
        return response({ message: 'successful' });
    } catch (error) {
        logger.error(logMetadata, error.message);
        await db.sequelize.close();
        return response({ message: error?.message });
    }
};
