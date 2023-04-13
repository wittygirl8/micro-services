const { response, helpers, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const axios = require('axios');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export const CreateGfoSaleHandler = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ CreateGfoSaleHandler',
        awsRequestId: context.awsRequestId
    };

    const requestId = `reqid_${context.awsRequestId}`;
    let api_response = {
        request_id: requestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, GatewayRequestLog, Payment, Customer, Tier, PaymentTransaction, PaymentTransactionDetails } = db;
    try {
        //authorization
        logger.info(logMetadata, event.headers);
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken, process.env.ANTAR_GFO_API_AUTHORIZE_TOKEN);

        if (!event.body) {
            throw { message: 'Payload missing (A#81001)' };
        }
        let payload = JSON.parse(event.body);
        logger.info(logMetadata, ' RequestPayload', payload);
        // payload = await schema.antarGfoSale.validateAsync(payload);
        // logger.info(logMetadata, ' ValidatedPayload', payload);

        //putting entry into gateway_request_log
        await GatewayRequestLog.create({
            gateway: 'ADYEN-GFO',
            order_id: payload.order_id,
            merchant_id: payload.merchant_id,
            request_data: JSON.stringify(payload),
            path_script: 'antar/gfo-sale-handler.js'
        });

        if (payload.gatewayParameters.gateway !== 'GFO') {
            throw new Error('Invalid Gateway value (A#81002)');
        }

        const paymentRecords = await Payment.findOne({
            where: {
                order_id: payload.order_id,
                customer_id: payload.merchant_id,
                payment_status: 'OK'
            }
        });

        //if record already processed, return error back
        if (paymentRecords) {
            return response({
                ...api_response,
                status: 'success',
                payment_id: paymentRecords.id,
                message: 'Order id already exists'
            });
        }
        console.log('PaymentTransaction', PaymentTransaction);
        const PaymentTransactionRecords = await PaymentTransaction.findOne({
            where: {
                order_id: payload.order_id,
                merchant_id: payload.merchant_id,
                payment_status: 'OK'
            }
        });

        //if record already processed, return error back
        if (PaymentTransactionRecords) {
            return response({
                ...api_response,
                status: 'success',
                payment_id: PaymentTransactionRecords.id,
                message: 'Order id already exists'
            });
        }

        //get fee info
        const feeInfo = await helpers.getFeeInfo(
            {
                total_amount: payload.Amount,
                merchant_id: payload.merchant_id
            },
            { Customer, Tier }
        );

        //get adyen credentials
        const merchantInfo = await Customer.findOne({
            attributes: ['business_name', 'adyen_sub_merchant_account'],
            where: {
                id: payload.merchant_id
            }
        });

        if (!merchantInfo) {
            throw { message: 'Invalid Merchant Id (A#81003)' };
        }

        let adyenConfigurations = {
            ADYEN_SUB_MERCHANT_ACCOUNT: merchantInfo.adyen_sub_merchant_account,
            ADYEN_MERCHANT_ACCOUNT_NAME: process.env.ADYEN_MERCHANT_ACCOUNT_NAME,
            ADYEN_API_ENDPOINT: process.env.ADYEN_API_ENDPOINT,
            ADYEN_API_AUTH_USERNAME: process.env.ADYEN_API_AUTH_USERNAME,
            ADYEN_API_AUTH_PASSWORD: process.env.ADYEN_API_AUTH_PASSWORD
        };

        //seed entry into card_payment table
        let address = `${payload.AvsHouseNumber ? payload.AvsHouseNumber : ''} ${payload.flat ? payload.flat : ''} ${
            payload.address1 ? payload.address1 : ''
        } ${payload.address2 ? payload.address2 : ''} ${payload.postcode ? payload.postcode : ''}`;

        let PaymentTransactionRef = await PaymentTransaction.create({
            order_id: payload.order_id,
            merchant_id: payload.merchant_id,
            created_at: moment().tz(TIMEZONE).format('YYYY/MM/DD hh:mm:ss'),
            provider: payload.provider,
            email: payload.email,
            total: feeInfo.total,
            fees: feeInfo.fee,
            payed: feeInfo.net,
            payment_provider: 'ADYEN'
        });
        let PaymentTransactionDetailsRef = await PaymentTransactionDetails.create({
            payment_transaction_id: PaymentTransactionRef.id,
            address: address,
            firstname: payload.firstname,
            lastname: payload.lastname,
            origin: 'GfoSaleApi'
        });
        let merchantReference = `O${payload.order_id}M${payload.merchant_id}T${PaymentTransactionRef.id}`;

        let AdyenResponse = await ProcessAdyenGoogleSale({
            ...payload,
            feeInfo,
            adyenConfigurations,
            logMetadata,
            merchantReference,
            merchantInfo
        });
        AdyenResponse = AdyenResponse.data;
        logger.info(logMetadata, 'AdyenResponse', AdyenResponse);
        if (AdyenResponse.resultCode !== 'Authorised') {
            let ResponseError = AdyenResponse.refusalReason || 'Txn failed';
            throw new Error(`${ResponseError} (A#81006)`);
        }

        //payment is Authorised/succesful, update transaction table
        await PaymentTransaction.update(
            {
                cross_reference: AdyenResponse.pspReference,
                payment_status: 'OK'
            },
            { where: { id: PaymentTransactionRef.id } }
        );
        await PaymentTransactionDetails.update(
            {
                more_info: JSON.stringify({ ADYEN_SUB_MERCHANT_ACCOUNT: merchantInfo.adyen_sub_merchant_account })
            },
            { where: { id: PaymentTransactionDetailsRef.id } }
        );
        api_response = {
            ...api_response,
            status: 'success',
            payment_id: PaymentTransactionRef.id
        };

        sequelize.close && (await sequelize.close());
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                status: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        sequelize.close && (await sequelize.close());
        return response(errorResponse, 500);
    }
};

let ProcessAdyenGoogleSale = async (params, mockResponse = false) => {
    if (mockResponse) {
        return {
            pspReference: '881539337151149C',
            resultCode: 'Authorised'
        };
    }
    logger.info(params.logMetadata, 'adyenConfigurations', params.adyenConfigurations);
    let {
        ADYEN_SUB_MERCHANT_ACCOUNT,
        ADYEN_MERCHANT_ACCOUNT_NAME,
        ADYEN_API_ENDPOINT,
        ADYEN_API_AUTH_USERNAME,
        ADYEN_API_AUTH_PASSWORD
    } = params.adyenConfigurations;

    if (!ADYEN_SUB_MERCHANT_ACCOUNT) {
        throw { message: 'Invalid merchant configuration! (A#81004)' };
    }
    let AdyenSaleAmountInfo = await GetAdyenSaleAmountCalculation({
        feeInfo: params.feeInfo,
        logMetadata: params.logMetadata
    });

    let AdyenRequestPayload = {
        merchantAccount: ADYEN_MERCHANT_ACCOUNT_NAME,
        reference: params.merchantReference,
        amount: {
            currency: 'GBP',
            value: AdyenSaleAmountInfo.Total
        },
        paymentMethod: {
            type: 'paywithgoogle',
            googlePayToken: JSON.stringify(params.gatewayParameters.instrumentToken)
        },
        shopperStatement: params.merchantInfo.business_name ? params.merchantInfo.business_name : "FOODHUB" ,
        returnUrl: 'https://your-company.com/checkout?shopperOrder=12xy..',
        splits: [
            {
                amount: {
                    value: AdyenSaleAmountInfo.Net
                },
                type: 'MarketPlace',
                account: ADYEN_SUB_MERCHANT_ACCOUNT,
                reference: `MP${params.merchantReference}`
            },
            {
                amount: {
                    value: AdyenSaleAmountInfo.Commission
                },
                type: 'Commission',
                reference: `CM${params.merchantReference}`
            }
        ]
    };
    logger.info(params.logMetadata, 'AdyenRequestPayload', AdyenRequestPayload);

    try {
        return await axios({
            method: 'post',
            url: `${ADYEN_API_ENDPOINT}/payments`,
            data: AdyenRequestPayload,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(`${ADYEN_API_AUTH_USERNAME}:${ADYEN_API_AUTH_PASSWORD}`).toString(
                    'base64'
                )}`
            }
        });
    } catch (e) {
        console.log('Axios catch error', e.response);
        throw new Error(`${e.response.data.message} A#81007`);
    }
};

let GetAdyenSaleAmountCalculation = async (params) => {
    //its very impotal for adyen api to match the total = fee + net calculation
    //1. calculate based on our fee Calculation
    //2. If #1 fails, throw error
    let Total, Commission, Net;
    Total = Math.round(params.feeInfo.total * 100);
    Commission = Math.round(params.feeInfo.fee * 100);
    Net = Math.round(params.feeInfo.net * 100);

    //in some odd cases, this universale truth (total = fee + net) fails no matter how much we try
    //its because Math.round reduces the number to last integer, when the fee/net decimal value is less than 0.50
    //after breaking my head on this for a long time, with the help of running some unit test with amount 0.01 to 1000.00
    //came up with the below magical formulae to handle this
    Commission = Commission + (Total - (Commission + Net)); //(Total - (Commission + Net)) will be either -1 or 1 always
    //jus adding the Commission with the difference between both the totals, will solve this issue

    logger.info(params.logMetadata, 'AmountCalculationAttempt#1', { Total, Commission, Net });
    if (Total !== Net + Commission) {
        logger.info(
            params.logMetadata,
            'AmountCalculationAttempt#1 mismatch',
            Total !== Net + Commission,
            Net + Commission
        );
        throw { message: 'Txn failed! (A#81005) ' };
    }
    //sending back the amount in cents
    return { Total, Commission, Net };
};
