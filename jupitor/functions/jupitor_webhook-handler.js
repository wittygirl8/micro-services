const { response, helpers, logHelpers, judopayHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const { JupitorService } = require('../jupitor.service');
const moment = require('moment-timezone');
const jupitorService = new JupitorService();
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const TIMEZONE = 'europe/london';
const RequestTypes = {
    PAYMENT: 'Payment'
};
const metaDataKey = 'yourPaymentMetaData';

let logger = logHelpers.logger;

export const judoWebhookHandler = async (event, context) => {
    let logMetadata = {
        location: 'judowebhook ~ judoWebhookHandler',
        awsRequestId: context.awsRequestId
    };

    const requestId = `reqid_${context.awsRequestId}`;

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, GatewayRequestLog, Payment, Customer, Tier } = db;
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    try {
        const payload = JSON.parse(event.body);

        logger.info(logMetadata, ' judoWebhookHandler ~ payload', payload);

        const type = payload.receipt.type;

        const ref = payload.receipt.receiptId;
        const amount = payload.receipt.amount;
        const authCode = payload.receipt.message.replace('AuthCode: ', '');

        //const consumerToken = payload.receipt.consumer.consumerToken;
        // const customerId = payload.consumer.yourConsumerReference;
        const transactionReceipt = await judopayHelpers.getTransaction(ref);
        logger.info(logMetadata, ' judoWebhookHandler ~ transactionReceipt', transactionReceipt);
        const receiptMetaData = transactionReceipt[metaDataKey];
        const orderId = receiptMetaData.cartID ? receiptMetaData.cartID : receiptMetaData.order_id;
        const merchantId = receiptMetaData.merchantID ? receiptMetaData.merchantID : receiptMetaData.merchant_id;
        const customerId = receiptMetaData.customerID ? receiptMetaData.customerID : receiptMetaData.customer_id;
        const webhookUrl = receiptMetaData.WebhookUrl;
        const date = new Date(payload.receipt.createdAt);
        const createdAt = moment.utc(date).format('YYYY/MM/DD hh:mm:ss');
        const merchantReference = receiptMetaData.MerchantReference;
        //logging the api request
        await GatewayRequestLog.create({
            gateway: 'JUDOPAY-WEBHOOK',
            order_id: orderId,
            merchant_id: merchantId,
            request_data: JSON.stringify(payload),
            path_script: 'jupitor/judo-webhook-handler.js'
        });

        if (type == RequestTypes.PAYMENT) {
            const paymentRecords = await Payment.findOne({
                where: {
                    CrossReference: ref,
                    payment_status: 'OK'
                }
            });

            if (!paymentRecords) {
                const orderRecord = {
                    host: receiptMetaData.host,
                    customers_id: receiptMetaData.customer_id,
                    firstname: receiptMetaData.firstname,
                    lastname: receiptMetaData.lastname,
                    email: receiptMetaData.email,
                    houseno: receiptMetaData.AvsHouseNumber || '',
                    flat: receiptMetaData.flat || '',
                    address1: receiptMetaData.address1 || '',
                    address2: receiptMetaData.address2 || '',
                    postcode: receiptMetaData.AvsPostcode || '',
                    total: receiptMetaData.Amount
                };

                //getting feeInfo based on tier
                const feeInfo = await helpers.getFeeInfo(
                    {
                        total_amount: amount,
                        merchant_id: merchantId
                    },
                    { Customer, Tier }
                );

                let address = `${orderRecord.houseno} ${orderRecord.flat},${orderRecord.address1} \n ${orderRecord.address2}. ${orderRecord.postcode}`;

                let paymentRef = await Payment.create({
                    order_id: orderId,
                    customer_id: merchantId,
                    time: createdAt,
                    provider: 'T2S',
                    firstname: orderRecord.firstname,
                    lastname: orderRecord.lastname,
                    email: orderRecord.email,
                    address: address,
                    total: feeInfo.total,
                    fees: feeInfo.fee,
                    payed: feeInfo.net,
                    CrossReference: ref,
                    payment_status: 'OK',
                    week_no: moment().tz(TIMEZONE).format('W'),
                    payment_provider: 'JUDOPAY',
                    last_4_digits: payload.receipt.cardDetails.cardLastfour,
                    TxAuthNo: authCode
                });
                const t2sPayload = {
                    transaction_id: paymentRef.id,
                    customer_id: customerId,
                    order_info_id: orderId,
                    amount: amount,
                    reference: merchantReference
                };
                const requestPayload = {
                    order_id: orderId,
                    webhook_url: webhookUrl
                };
                await jupitorService.notifyT2SSubscriber(
                    requestPayload,
                    t2sPayload,
                    paymentRef.id,
                    logMetadata.awsRequestId
                );
            }
        }
        sequelize.close && (await sequelize.close());
        return response();
    } catch (e) {
        console.log('error in catch - webhook', e);
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        sequelize.close && (await sequelize.close());
        return response(errorResponse, 500);
    }
};

/*
        function roundNumber(num) {
    var num_sign = num >= 0 ? 1 : -1;
    return parseFloat((Math.round(num * Math.pow(10, 2) + num_sign * 0.0001) / Math.pow(10, 2)).toFixed(2));
}

            const feesInfo = await Tier.findOne({
                    attributes: ['fixed_fee', 'percentage_fee'],
                    include: [
                        {
                            attributes: ['id'],
                            model: Customer,
                            where: {
                                id: merchant_id
                            }
                        }
                    ],
                    raw: true
                });

                let bank_fee = amount * 0.034;
                bank_fee = bank_fee + 0.2;
                if (feesInfo) {
                    //fee based on fee tier
                    bank_fee = amount * (feesInfo['percentage_fee'] / 100);
                    bank_fee = bank_fee + feesInfo['fixed_fee'];
                }
                bank_fee = roundNumber(bank_fee);
                let left_fee = amount - bank_fee;
                left_fee = roundNumber(left_fee);
*/

/*
                if (payload.webhook_url && payload.webhook_url !== 'undefined') {
                    if (!process.env.IS_OFFLINE) {
                        await WebhookSQS.notifyT2SSubscriber(
                            {
                                order_id: order_id,
                                customerInfo,
                                card_payment_id: paymentRef.id
                            },
                            {
                                awsRequestId: logMetadata.awsRequestId,
                                location: 'Judo ~ notifyT2SSubscriber',
                                QUEUE_URL: process.env.QUEUE_URL
                            }
                        );
                    }
                } else {
                    logger.info(logMetadata, `Order id: ${payload.order_id}, Webhook url missing with T2S payload`);
                } */
