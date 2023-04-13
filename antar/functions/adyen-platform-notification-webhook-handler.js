const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
// const { hmacValidator } = require('@adyen/api-library');
let logger = logHelpers.logger;
let payoutStatusMapping = {
    Initiated: 'PENDING',
    Confirmed: 'SENT',
    Failed: 'FAILED'
};
// hardcodiing for now, but this will get it from the env
// const hmacKey = '4A04065D05CB2AB38F83CE23EDC060225448403F26954C48B541CA62DD14223A';

export const adyenPlatformNotificationWebhookHandler = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ adyenPlatformNotificationWebhookHandler',
        awsRequestId: context.awsRequestId
    };

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Customer } = db;
    try {
        var payload = JSON.parse(event.body);
        logger.info(logMetadata, 'Webhook payload', payload);

        let eventType = payload.eventType;
        logger.info(logMetadata, 'eventType', eventType);

        if (eventType == 'PAYMENT_FAILURE') {
            throw { message: `PAYMENT_FAILURE event occured` };
        } else if (eventType == 'ACCOUNT_HOLDER_PAYOUT') {
            //with this event, we need to do the following
            //1. add the payload into a log table
            //2. insert into payout_transaction table

            // populating payout webhook log
            await sequelize.query(
                `INSERT into adyen_payout_webhook_log
                    SET 
                    payout_reference = :payout_reference,
                    psp_reference = :psp_reference,
                    response_data = :response_data`,
                {
                    replacements: {
                        //using this replace to handle escape string in raw queries
                        payout_reference: `${payload.content.payoutReference}` || 'no_payout_reference',
                        psp_reference: `${payload.pspReference}` || 'no_psp_reference',
                        response_data: `${JSON.stringify(payload)}`
                    }
                }
            );

            let CustomerRecord = await Customer.findOne({
                where: {
                    id: payload.content.accountHolderCode
                },
                raw: true
            });
            logger.info(logMetadata, 'CustomerRecord', CustomerRecord);
            let validationStatus;
            for (let i = 0; i < payload.content.amounts.length; i++) {
                let payout_transaction_query = `INSERT into payout_transaction SET  merchant_id = :merchant_id, amount = :amount, currency = :currency, provider_reference = :provider_reference, status = :status, more_info = :more_info, payment_provider = :payment_provider`;
                let payout_transaction_replacement_object = {
                    merchant_id: `${payload.content.accountHolderCode}`,
                    amount: `${payload.content.amounts[i].value}`,
                    currency: `${payload.content.amounts[i].currency}`,
                    provider_reference: payload.content.payoutReference || 'no_provider_reference',
                    status: `${payoutStatusMapping[payload.content.status.statusCode]}`,
                    more_info: `${JSON.stringify(payload.content.status)}`,
                    payment_provider: 'ADYEN'
                };
                if (payload.content.estimatedArrivalDate) {
                    payout_transaction_query = payout_transaction_query.concat(`, expected_date = :expected_date `);
                    payout_transaction_replacement_object['expected_date'] = `${payload.content.estimatedArrivalDate}`;
                }
                console.log({ payout_transaction_query });
                console.log({ payout_transaction_replacement_object });

                //do some validation before populating the payout_transaction table
                validationStatus = checkPayoutValidation({
                    payloadContent: payload.content,
                    currency: payload.content.amounts[i].currency,
                    CustomerRecord
                });
                logger.info(logMetadata, 'validationStatus', validationStatus);
                if (validationStatus.status) {
                    await sequelize.query(payout_transaction_query, {
                        replacements: payout_transaction_replacement_object
                    });
                } else {
                    logger.info(logMetadata, 'payout_transaction_skipped', validationStatus.message);
                }
            }
        }

        sequelize.close && (await sequelize.close());
        return response('[accepted]');
    } catch (e) {
        logger.error(logMetadata, 'Catch Error', e.message);
        //log the error for futher investigation
        let pspReference = payload.content.paymentPspReference || payload.pspReference;
        let merchantReference = payload.content.paymentMerchantReference || payload.content.merchantReference;
        await sequelize.query(
            `INSERT into adyen_webhook_log
                SET 
                notification_type = 'PLATFORM-NOTIFICATION',
                pspReference = :pspReference,
                merchantReference = :merchantReference,
                event = :event,
                error_info = :error_info,
                raw_data = :raw_data`,
            {
                replacements: {
                    //using this replace to handle escape string in raw queries
                    pspReference: pspReference,
                    merchantReference: merchantReference || 'no_merchant_reference',
                    event: payload.eventType,
                    error_info: e.message,
                    raw_data: JSON.stringify(payload)
                }
            }
        );
        sequelize.close && (await sequelize.close());
        //returning success back to adyen even though its an error for us
        //internal investigation to be done regarding the error
        //and always acknowledge adyen as received with 200 success "accepted"
        return response('[accepted]');
        // return response(errorResponse, 500);
    }
};

let checkPayoutValidation = (params) => {
    //1. check if the payoutstatus is valid
    if (!payoutStatusMapping.hasOwnProperty(params.payloadContent.status.statusCode)) {
        return {
            status: false,
            message: `Invalid payout status received from Adyen ${params.payloadContent.status.statusCode}`
        };
    }
    //2. check if accountHolderCode is a valid datman merchant
    if (!params.CustomerRecord) {
        return {
            status: false,
            message: `Invalid merchant/accountHolderCode ${params.payloadContent.accountHolderCode}`
        };
    }
    //3. validate currency to alpha, max 4 characters
    if (!/^[a-zA-Z]{1,4}$/.test(params.currency)) {
        return { status: false, message: `Invalid currency ${params.currency}` };
    }
    return { status: true };
};
