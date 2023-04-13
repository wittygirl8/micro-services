var { emailHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true
};

const { MypayService } = require('../mypay.service');
const mypayService = new MypayService();

export const main = async (event, context, callback) => {
    let payload = JSON.parse(event.body);
    logger.info('Payload on Webhook ', payload);

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, DnaResponse, PaymentTransaction, PaymentTransactionDetails, Customer } = db;

    let description = '';
    let invoiceId = payload.invoiceId;

    if (payload.invoiceId.includes(' #AO')) {
        const invoiceSplitArray = payload.invoiceId.split(' #AO');
        description = invoiceSplitArray[0];
        invoiceId = invoiceSplitArray[1];
    }

    const data = invoiceId.split('O')[1];
    const payment_transaction_id = invoiceId.split('O')[0].replace('T', '');
    const infoArray = data.split('M');
    const extracted_order_id = infoArray[0];
    const merchantId = infoArray[1];

    const firstName = payload.cardholderName.split(' ')[0];
    const lastName = payload.cardholderName.replace(firstName, '');

    logger.info({ extracted_order_id });
    logger.info({ payment_transaction_id });
    logger.info({ merchantId });

    //signature has to auth
    //authentication

    logger.info('Saving Dna Webhook Response in DB');

    await DnaResponse.create({ dna_response: event.body, order_id: extracted_order_id });

    logger.info('Saved Dna Webhook Response and upding transaction status in DB');

    if (payload.success) {
        await PaymentTransaction.update(
            {
                total: payload.amount,
                cross_reference: payload.id,
                fees: 0,
                payed: payload.amount,
                last_4_digits: payload.cardPanStarred.substr(payload.cardPanStarred.length - 4),
                payment_status: 'OK'
            },
            {
                where: { order_id: extracted_order_id }
            }
        );

        //   logger.info("Updated ", updatedData);

        logger.info('Updated transaction status now upading transaction details tablre.');

        await PaymentTransactionDetails.create({
            payment_transaction_id,
            firstname: firstName,
            lastname: lastName,
            origin: 'DNA',
            description
        });

        logger.info('Added in PaymentTransaction Details now fetching customer Email');

        const userData = await PaymentTransaction.findOne({
            attributes: ['email', 'order_id'],
            where: {
                order_id: extracted_order_id
            },
            raw: true
        });
        logger.info({ userData });

        logger.info('Fetched in userEmail, now fetching merchant Email');

        let userSetting = await Customer.findOne({
            attributes: ['payment_provider', 'business_name', 'business_email'],
            where: {
                id: merchantId
            },
            raw: true
        });

        logger.info({ userSetting });

        let name = firstName;
        let toWhome = userSetting.business_name;
        let email = userData.email ? userData.email : '';

        let confirmation_message = `<h1>Hi ${name},</h1><p>Your payment of <b>&pound; ${payload.amount.toFixed(
            2
        )}</b>&nbsp; to <b>${toWhome}</b> has been successfully received.<br> <br> Please note your transaction reference <span style="color: #3869D4; font-weight: 300;"> ${invoiceId} </span> </p>`;

        email &&
            (await emailHelpers.sendEmail(
                {
                    email: email,
                    subject: `Order confirmation - ${invoiceId}`,
                    message: confirmation_message
                },
                'OMNIPAY'
            ));

        let data = {
            merchantId,
            type: 'sale',
            via: 'PayByQR', // PayByLink
            amount: payload.amount * 100,
            customerName: payload.cardholderName
        };
        logger.info(`Push notification Request data ~${JSON.stringify(data)}`);
        let pushNotificationresponse = await mypayService.sendPushNotification(data);
        logger.info(`Push Notification Response data ${pushNotificationresponse}`);
    }

    await sequelize.close();

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'successful'
        }),
        headers
    };

    //save dna response into 1 table

    //   return helpers.LambdaHttpResponse2(200, {}, headers);
};
