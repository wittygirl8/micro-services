var { response, flakeGenerateDecimal, mypayHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const axios = require('axios');
let logger = logHelpers.logger;
const ENUM_TYPE = {
    QR_PAYMENT: 'QR_PAYMENT',
    OMNIPAY: 'OMNIPAY',
    QR_PAYMENT_V2: 'QR_PAYMENT_V2',
    QR_PAYMENT_V3: 'QR_PAYMENT_V3'
};
export const createSessionInternal = async (event, context, callback) => {
    if (Object.prototype.hasOwnProperty.call(event, 'keep-warm')) {
        logger.info('Warming createSessionInternal');
        return callback(null, {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Required for CORS support to work
                'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
            },
            body: { message: 'warm is done' }
        });
    }

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const {
        sequelize,
        MypayShopper,
        MypayItem,
        MypayTempTransactionsMeta,
        MypaySecurityCredentials,
        MypayTempTransaction,
        Customer
    } = db;
    const requestId = 'reqid_' + flakeGenerateDecimal();
    let logMetadata = {
        location: 'MyPayService ~ createSessionHandler',
        orderId: '',
        awsRequestId: context.awsRequestId
    };
    let payload = JSON.parse(event.body);

    logger.info(logMetadata, 'payload', payload);

    try {
        logger.info(logMetadata, 'event.headers.Authorization', event.headers.Authorization);
        let customer_id;
        let merchantInfo;
        if (
            payload.hasOwnProperty('payment_type') &&
            (payload.payment_type === ENUM_TYPE.QR_PAYMENT ||
                payload.payment_type === ENUM_TYPE.QR_PAYMENT_V2 ||
                payload.payment_type === ENUM_TYPE.QR_PAYMENT_V3)
        ) {
            /*payload contains to get merchant_id by its respective UUID
            {
                "merchant_qr_id": "0a138803-c2d6-43d4-b485-de50a11df9c7",
                "payment_type": "QR_PAYMENT"
            }
             */

            logger.info(logMetadata, 'In try block ');

            payload = {
                ...payload,
                customer_type: ENUM_TYPE.OMNIPAY
            };

            if (
                payload.hasOwnProperty('merchant_qr_id') &&
                (payload.payment_type === ENUM_TYPE.QR_PAYMENT_V2 || payload.payment_type === ENUM_TYPE.QR_PAYMENT_V3)
            ) {
                /**
                 * call biforst Here to get datman mid then create session
                 */

                logger.info(logMetadata, 'In bifrost block');

                const uuid = payload.merchant_qr_id;
                const payment_type = payload.payment_type;

                logger.info(logMetadata, 'Merchant QR id or uuid and payment type ', { uuid, payment_type });

                if (!uuid) throw new Error(`Invalid Merchant!`);

                logger.info(logMetadata, 'Bifrost Endpoints ', process.env.BIFROST_ENDPOINTS);
                logger.info(logMetadata, 'Bifrost API Token ', process.env.BIFROST_API_TOKEN);
                logger.info(
                    logMetadata,
                    'Bifrost API URL ',
                    `${process.env.BIFROST_ENDPOINTS}/api/v1/bifrost/get-merchant-id?uuid=${uuid}&payment_type=${payment_type}`
                );

                let data = await axios.get(
                    `${process.env.BIFROST_ENDPOINTS}/api/v1/bifrost/get-merchant-id?uuid=${uuid}&payment_type=${payment_type}`,
                    {
                        headers: { api_token: process.env.BIFROST_API_TOKEN }
                    }
                );

                logger.info(logMetadata, 'Bifrost Response ', data);

                customer_id = data.data['merchantId'];
            } else {
                merchantInfo = await mypayHelpers.getMerchantInfo(payload, { Customer });
                if (!merchantInfo) {
                    throw new Error(`Merchant doesn't exist`);
                }
                customer_id = merchantInfo.id;
            }
            logger.info(logMetadata, 'merchantInfo', merchantInfo);
        } else {
            //check authentication
            customer_id = await mypayHelpers.hmacAuthentication(
                {
                    authorization: event.headers.Authorization,
                    payload
                },
                {
                    MypaySecurityCredentials
                }
            );
        }

        logger.info(logMetadata, 'customer_id', customer_id);
        logger.info(logMetadata, 'mypayHelpers.constants', mypayHelpers.constants.refs);
        //populating items table
        let itemReference = mypayHelpers.generateNanoId(mypayHelpers.constants.refs.ITEM_REF);
        let createItemResponse = await MypayItem.create({
            data: JSON.stringify(payload.items),
            ref: itemReference
        });

        //populating shoppers table
        let shopperReference = mypayHelpers.generateNanoId(mypayHelpers.constants.refs.SHOPPER_REF);
        let createShopperResponse = await MypayShopper.create({
            ref: shopperReference,
            first_name: payload.shoppers.first_name,
            last_name: payload.shoppers.last_name,
            email: payload.shoppers.email,
            address: payload.shoppers.address
        });

        //populating meta
        let createMetaResponse = await MypayTempTransactionsMeta.create({
            data: JSON.stringify(payload.meta_data)
        });

        //populate Temp Transactions table
        let tempTransactionReference = mypayHelpers.generateNanoId(mypayHelpers.constants.refs.TEMP_TRANS_REF);
        let createTempTransactionResponse = await MypayTempTransaction.create({
            ref: tempTransactionReference,
            customer_id,
            user_order_ref: payload.user_order_ref,
            shopper_id: createShopperResponse.dataValues.id,
            item_id: createItemResponse.dataValues.id,
            meta_id: createMetaResponse.dataValues.id,
            amount: payload.amount,
            currency_code: payload.currency_code,
            status: 'IN_PROGRESS'
        });

        let api_response = {
            request_id: requestId,
            message: 'success',
            data: {
                session_id: createTempTransactionResponse.dataValues.ref
            }
        };
        await sequelize.close();
        return response(api_response);
    } catch (e) {
        await sequelize.close();
        let errorResponse = {
            error: {
                request_id: requestId,
                message: e.message,
                type: mypayHelpers.constants.ref_name.ERROR_TYPE
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        return response(errorResponse, 500);
    }
};
