const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
//const moment = require('moment-timezone');
const { hmacValidator } = require('@adyen/api-library');
// const TIMEZONE = 'europe/london';
// const { AntarService } = require('../antar.service');
// const antarService = new AntarService();
let logger = logHelpers.logger;

// hardcodiing for now, but this will get it from the env
// const hmacKey = '32DDD0158472FF43760D640E1C50EF7B1239C345E041C02DAC3BA964FACE6CDB';
const hmacKey = '4A04065D05CB2AB38F83CE23EDC060225448403F26954C48B541CA62DD14223A';

export const adyenNotificationWebhookHandler = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ adyenNotificationWebhookHandler',
        awsRequestId: context.awsRequestId
    };

    //const requestId = `reqid_${context.awsRequestId}`;

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, PaymentTransaction } = db;
    try {
        let error_message;
        var payload = JSON.parse(event.body);
        logger.info(logMetadata, 'Webhook payload', payload);
        let notificationItems = payload.notificationItems;
        const HmacValidator = new hmacValidator();

        // notificationItems.forEach(async (notificationItem) => {
        for (let i = 0; i < notificationItems.length; i++) {
            // validate if this request was originated from Ayden
            let notificationObject = notificationItems[i].NotificationRequestItem;
            let isValid = HmacValidator.validateHMAC(notificationObject, hmacKey);
            if (!isValid) {
                throw { message: `HMAC Auth failed` };
            }

            let eventCode = notificationObject.eventCode;
            logger.info(logMetadata, 'eventCode', eventCode);
            let {
                merchantReference: order_id,
                pspReference: cross_reference,
                additionalData: last_4_digits
            } = notificationObject;
            if (eventCode == 'AUTHORISATION') {
                if (!notificationObject.success) {
                    throw { message: `AUTHORIZATION Sale failed - ${notificationObject.success}` };
                }
                //check if entry exists with card_payment table
                const paymentRecords = await PaymentTransaction.findOne({
                    where: {
                        order_id,
                        cross_reference,
                        payment_status: 'OK'
                    },
                    raw: true
                });
                logger.info(logMetadata, 'paymentRecords', paymentRecords);
                //if record already processed, return error back
                if (!paymentRecords) {
                    //error, this should not happen
                    throw { message: 'Card payment does not exists' };
                }

                //update transaction table with last_4_digit information if available
                last_4_digits.cardSummary &&
                    (await PaymentTransaction.update(
                        {
                            last_4_digits: last_4_digits.cardSummary
                        },
                        { where: { id: paymentRecords.id } }
                    ));
            } else if (eventCode == 'REFUND') {
                if (!notificationObject.success) {
                    error_message = `AUTHORIZATION Refund failed - ${notificationObject.success}`;
                    throw { message: error_message };
                }
                const paymentRecords = await PaymentTransaction.findOne({
                    where: {
                        order_id,
                        cross_reference,
                        payment_status: 'OK'
                    },
                    raw: true
                });
                logger.info(logMetadata, 'paymentRecords', paymentRecords);
                if (!paymentRecords) {
                    //error, this should not happen
                    throw { message: 'Card payment does not exists' };
                }

                if (!paymentRecords.refund) {
                    //error, this should not happen
                    throw { message: 'card_payment, Refund info missing' };
                }
            }
        }

        sequelize.close && (await sequelize.close());
        return response('[accepted]');
    } catch (e) {
        logger.error(logMetadata, 'Catch Error', e.message);
        //log the error for futher investigation
        await sequelize.query(
            `INSERT into adyen_webhook_log
                SET 
                notification_type = 'NOTIFICATION',
                pspReference = '${payload.notificationItems[0].NotificationRequestItem.pspReference}',
                merchantReference = '${payload.notificationItems[0].NotificationRequestItem.merchantReference}',
                event = '${payload.notificationItems[0].NotificationRequestItem.eventCode}',
                error_info = '${e.message}',
                raw_data = '${JSON.stringify(payload)}'`
        );
        sequelize.close && (await sequelize.close());
        //returning success back to adyen even though its an error for us
        //internal investigation to be done regarding the error
        //and always acknowledge adyen as received with 200 success "accepted"
        return response('[accepted]');
        // return response(errorResponse, 500);
    }
};
