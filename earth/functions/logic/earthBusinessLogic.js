import { transactionFailNotificationEmail } from '../../../../layers/helper_lib/src/email_template/transaction-failed-error';
var { saleHelpers, logHelpers, cryptFunctions, emailHelpers, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const mxFn = require('./masterTokenFunction');
const { serialize } = require('php-serialize');
//we are updating the provider as 'optomany' since we will update the provider as OPTOMANY here
const T2S_MERCHANT_PROVIDER = 'OPTOMANY';
let logger = logHelpers.logger;
var { EarthService } = require('../../earth.service');
const RISKCHECK = {
    DECLINE: 'decline'
};
const earthService = new EarthService();
const ORIGIN_3DS_VERSION = {
    v1: 'WebForm-CS-3D',
    v2: 'WebForm-CS-3D-V2'
};
export const getDbConnection = async () => {
    let db = await connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    //reinitiating the model variables
    return db;
};

export const getT2SDbConnection = async () => {
    let db = await connectDB(
        process.env.T2S_DB_HOST,
        process.env.T2S_DB_DATABASE,
        process.env.T2S_DB_USERNAME,
        process.env.T2S_DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    //reinitiating the model variables
    return db;
};

export const updatePaymentStatus = async (params, Payment, Payments, Customer, TransactionStatuses) => {
    try {
        console.log({ params });
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];
        var { payment_provider } = await Customer.findOne({
            where: { id: params.merchant_id }
        });
        console.log('updatePaymentStatus~params', params, payment_provider);

        var { transaction_status_id } = await TransactionStatuses.findOne({
            where: { status: params.payment_status }
        });

        console.log({ transaction_status_id });

        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            return await Payments.update(
                {
                    psp_reference: params.CrossReference,
                    TxAuthNo: params.TxAuthNo,
                    internal_reference: params.VendorTxCode,
                    transaction_status_id: transaction_status_id,
                    last_4_digits: params.last_4_digits,
                    reason: params.reason,
                    transaction_mode_id: params.transaction_mode_id ? params.transaction_mode_id : 1
                },
                { where: { id: params.id } }
            );
        } else {
            return await Payment.update(
                {
                    VendorTxCode: params.VendorTxCode,
                    TxAuthNo: params.TxAuthNo,
                    CrossReference: params.CrossReference,
                    payment_status: params.payment_status,
                    last_4_digits: params.last_4_digits,
                    origin: params.origin,
                    reason: params.reason
                },
                {
                    where: {
                        id: params.id
                    }
                }
            );
        }
    } catch (error) {
        console.log('updatePaymentStatus~error', error);
        return error;
    }
};

export const updatePayments = async (params, payload, db) => {
    try {
        let { Customer, Payment, Payments, TransactionStatuses } = db;
        console.log({ params });
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];
        var { payment_provider } = await Customer.findOne({
            where: { id: params.merchant_id }
        });

        console.log('updatePayments~params', params, payment_provider);

        var { transaction_status_id } = await TransactionStatuses.findOne({
            where: { status: params.payment_status }
        });

        let PaymentsUpdateResponse;
        let transaction_table = 'payments';
        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            PaymentsUpdateResponse = await Payments.update(
                {
                    psp_reference: params.CrossReference,
                    TxAuthNo: params.TxAuthNo,
                    internal_reference: params.VendorTxCode,
                    transaction_status_id: transaction_status_id,
                    last_4_digits: params.last_4_digits
                },
                {
                    where: {
                        id: params.card_payment_id
                    }
                }
            );
            console.log({ PaymentsUpdateResponse });

            return PaymentsUpdateResponse;
        } else {
            transaction_table = 'card_payment';
            PaymentsUpdateResponse = await Payment.update(
                {
                    VendorTxCode: params.VendorTxCode,
                    TxAuthNo: params.TxAuthNo,
                    CrossReference: params.CrossReference,
                    payment_status: params.payment_status,
                    last_4_digits: params.last_4_digits,
                    origin: params.origin,
                    reason: params.reason,
                    more_info: params.more_info
                },
                {
                    where: {
                        id: params.card_payment_id
                    }
                }
            );
        }

        if (payload?.split_fee?.length) {
            await splitFeeHelpers.UpdateSplitFeeInfo(
                {
                    db,
                    payments_id: params.card_payment_id
                },
                transaction_table
            );
        }

        return PaymentsUpdateResponse;
    } catch (error) {
        console.log('updatePayments~error', error);
        return error;
    }
};

export const createPaymentEntry = async (params) => {
    let { payload, paymentRefObj, db } = params;
    let { merchant_id } = payload;

    try {
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];
        var { payment_provider, currency, country_id } = await db.Customer.findOne({
            where: { id: merchant_id }
        });

        let PaymentRecord;
        let transaction_table;
        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            let { iso } = await db.Country.findOne({
                where: {
                    id: country_id
                },
                raw: true
            });

            let payment_providers = await db.PaymentProviders.findOne({
                attributes: ['id'],
                where: {
                    provider_name: payment_provider
                },
                raw: true
            });

            let payment_provider_id = payment_providers?.id || 3;
            transaction_table = 'payments';
            PaymentRecord = await db.Payments.create({
                merchant_id: paymentRefObj.customer_id,
                firstname: paymentRefObj.firstname,
                lastname: paymentRefObj.lastname,
                address: paymentRefObj.address,
                email_id: paymentRefObj.email,
                gross: paymentRefObj.total * 100,
                fee: paymentRefObj.fees * 100,
                net: paymentRefObj.payed * 100,
                payment_provider_id: payment_provider_id,
                order_ref: paymentRefObj.order_id,
                week: paymentRefObj.week_no,
                month: paymentRefObj.month,
                year: paymentRefObj.year,
                source_ip: paymentRefObj.ip_address,
                country_code: iso,
                currency_code: String(currency).toUpperCase(),
                withdrawn_status: 0,
                email_address: paymentRefObj.email,
                delete_status: 0,
                day: paymentRefObj.day,
                transaction_method_id: paymentRefObj.transaction_method_id,
                transaction_mode_id: paymentRefObj.transaction_mode_id
            });
        } else {
            transaction_table = 'card_payment';
            PaymentRecord = await db.Payment.create({
                customer_id: paymentRefObj.customer_id,
                firstname: paymentRefObj.firstname,
                lastname: paymentRefObj.lastname,
                address: paymentRefObj.address,
                email: paymentRefObj.email,
                total: paymentRefObj.total,
                fees: paymentRefObj.fees,
                payed: paymentRefObj.payed,
                provider: paymentRefObj.provider,
                payment_status: paymentRefObj.payment_status,
                payment_provider: paymentRefObj.payment_provider,
                order_id: paymentRefObj.order_id,
                week_no: paymentRefObj.week_no,
                ip: paymentRefObj.ip_address,
                method: paymentRefObj.method,
                month: paymentRefObj.month,
                year: paymentRefObj.year,
                day: paymentRefObj.day
            });
        }

        await splitFeeHelpers.SeedSplitFeeInfo(
            {
                db,
                payload,
                MerchantId: merchant_id,
                PaymentRecord: PaymentRecord.dataValues
            },
            transaction_table
        );

        console.log(PaymentRecord.dataValues, 'Payment record::');
        return PaymentRecord;
    } catch (e) {
        console.log('createPaymentEntry~Exception', e.message);
        throw { code: e?.code || 500, message: e?.message };
    }
};

export const getPaymentRecords = async (params, Customer, Payment, Payments) => {
    try {
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];
        var { payment_provider } = await Customer.findOne({
            where: { id: params.merchant_id }
        });

        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            console.log(payment_provider, 'Payment_providers');
            let response = await Payments.findAll({
                where: {
                    order_ref: `${params.order_id}`,
                    merchant_id: params.merchant_id,
                    transaction_status_id: 1
                },
                raw: true
            });
            return response;
        } else {
            console.log(payment_provider, 'Payment_providers');
            let response = await Payment.findAll({
                where: {
                    order_id: `${params.order_id}`,
                    customer_id: params.merchant_id,
                    payment_status: 'OK'
                },
                raw: true
            });

            return response;
        }
    } catch (error) {
        console.log('getPaymentRecords~error', error);
        return error;
    }
};

export const updateSalePayments = async (params, payload, db) => {
    try {
        let { Customer, Payment, Payments, TransactionStatuses } = db;
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];

        var { payment_provider } = await Customer.findOne({
            where: { id: params.merchant_id }
        });

        console.log('updateSalePayments~', payment_provider);

        var { transaction_status_id } = await TransactionStatuses.findOne({
            where: { status: params.payment_status }
        });

        let PaymentUpdateResponse;
        let transaction_table = 'payments';
        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            PaymentUpdateResponse = await Payments.update(
                {
                    psp_reference: params.CrossReference,
                    TxAuthNo: params.TxAuthNo,
                    internal_reference: params.VendorTxCode,
                    transaction_status_id: transaction_status_id,
                    last_4_digits: params.last_4_digits
                },
                {
                    where: {
                        id: params.card_payment_id
                    }
                }
            );
            console.log({ PaymentUpdateResponse });

            return PaymentUpdateResponse;
        } else {
            transaction_table = 'card_payment';
            PaymentUpdateResponse = await Payment.update(
                {
                    VendorTxCode: params.VendorTxCode,
                    TxAuthNo: params.TxAuthNo,
                    CrossReference: params.CrossReference,
                    payment_status: params.payment_status,
                    last_4_digits: params.last_4_digits,
                    origin: params.origin
                },
                {
                    where: {
                        id: params.card_payment_id
                    }
                }
            );
        }

        if (payload?.split_fee?.length) {
            await splitFeeHelpers.UpdateSplitFeeInfo(
                {
                    db,
                    payments_id: params.card_payment_id
                },
                transaction_table
            );
        }

        return PaymentUpdateResponse;
    } catch (error) {
        console.log('updateSalePayments~error', error);
        return error;
    }
};

export const getPaymentRecordForRefund = async (params, Customer, Payment, Payments) => {
    try {
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH', 'STRIPE'];
        var { payment_provider } = await Customer.findOne({
            where: { id: params.customer_id }
        });
        let response;
        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            response = await Payments.findOne({
                where: {
                    order_ref: `${params.order_id}`,
                    merchant_id: params.customer_id,
                    transaction_status_id: 1
                },
                raw: true
            });

            if (response) {
                response.total = response.gross / 100;
                response.CrossReference = response.internal_reference;
            }
        } else {
            response = await Payment.findOne({
                where: {
                    order_id: `${params.order_id}`,
                    customer_id: params.customer_id,
                    payment_status: 'OK'
                },
                raw: true
            });
        }
        return response;
    } catch (error) {
        console.log('getPaymentRecordForRefund~error', error);
        return error;
    }
};

export const set3dsv2Info = (params) => {
    let { RequestLogId, payload, event } = params;

    const REDIRECT_V2_ENDPOINT = `sale/redirect/3dsv2?RequestLogId=${RequestLogId.id}`;

    function fetchDeviceDetails(payload, event) {
        let obj = {
            deviceChannel: payload?.deviceInfo?.deviceChannel,
            deviceIdentity: payload?.deviceInfo?.deviceIdentity,
            deviceTimeZone: payload?.deviceInfo?.deviceTimeZone,
            deviceCapabilities: payload?.deviceInfo?.deviceCapabilities
                ? payload?.deviceInfo?.deviceCapabilities
                : 'javascripts',
            deviceScreenResolution: payload?.deviceInfo?.deviceScreenResolution,
            deviceAcceptEncoding: event?.headers?.['Accept-Encoding'],
            deviceAcceptLanguage: payload?.deviceInfo?.deviceAcceptLanguage,
            remoteAddress: event?.requestContext?.identity?.sourceIp
                ? event?.requestContext?.identity?.sourceIp
                : '0.0.0.0',
            deviceAcceptContent: 'application/x-www-form-urlencoded'
        };
        console.log({ obj });
        return obj;
    }

    function fetch3dsConfigs(payload) {
        return {
            threeDSOptions: `cardholderEmail=${payload.email}`,
            threeDSRedirectURL: `${process.env.EARTH_API_ENDPOINT}/${REDIRECT_V2_ENDPOINT}`
        };
    }

    return {
        ...fetchDeviceDetails(payload, event),
        ...fetch3dsConfigs(payload)
    };
};

export const getFailedErrorCode = (cs_response, payload) => {
    let errorCode = '';
    let postcodeCheck = cs_response?.postcodeCheck;
    let cv2Check = cs_response?.cv2Check;
    let expCsResponse = "'expiry' element must contain a valid card expiry date";
    let errorAppnd = '';
    if (cv2Check === 'not matched') {
        errorAppnd += `50${Math.floor(Math.random() * (999 - 100 + 1) + 100)}-`;
    }
    if (cs_response?.threeDSVendorCode || cs_response?.threeDSVendorCode === expCsResponse) {
        errorAppnd += `60${Math.floor(Math.random() * (999 - 100 + 1) + 100)}-`;
    }
    if (postcodeCheck === 'partially matched' || postcodeCheck === 'not matched') {
        errorAppnd += `70${Math.floor(Math.random() * (999 - 100 + 1) + 100)}-`;
    }
    if (
        postcodeCheck === 'partially matched' ||
        postcodeCheck === 'not matched' ||
        cv2Check === 'not matched' ||
        cs_response?.threeDSVendorCode === expCsResponse
    ) {
        errorCode = `Payment failed : ${errorAppnd}M${payload.merchant_id}A${payload?.total
            .toString()
            .replace(/\./, '')}L${cs_response?.cardNumberMask.substr(cs_response?.cardNumberMask.length - 4)}`;
    }

    let threedsCode = `40${Math.floor(Math.random() * (999 - 100 + 1) + 100)}-`;
    if (
        cs_response.responseCode === 65803 ||
        cs_response.responseCode === 65566 ||
        cs_response.responseCode === 65801 ||
        cs_response.responseMessage === 'Disallowed cardnumber' ||
        !cs_response
    ) {
        errorCode = `Payment failed : ${threedsCode}M${payload.merchant_id}A${payload?.total
            .toString()
            .replace(/\./, '')}L${cs_response?.cardNumberMask.substr(cs_response?.cardNumberMask.length - 4)}`;
    }
    return errorCode;
};

export const getFailedErrorMessage = (cs_response) => {
    let failedMessage = '';
    let postcodeCheck = cs_response?.postcodeCheck;
    let cv2Check = cs_response?.cv2Check;
    let expCsResponse = "'expiry' element must contain a valid card expiry date";

    if (postcodeCheck === 'partially matched' || postcodeCheck === 'not matched') {
        failedMessage = 'Wrong billing address entered. Please check your billing details and try again.';
    }
    if (
        cv2Check === 'not matched' ||
        cs_response?.responseCode === 66416 ||
        cs_response?.threeDSResponseCode === 65800 ||
        cs_response?.threeDSVendorCode === expCsResponse
    ) {
        failedMessage = 'Payment declined by your bank due to wrong card details provided.';
    }
    if (
        (postcodeCheck === 'partially matched' || postcodeCheck === 'not matched') &&
        (cv2Check === 'not matched' ||
            cs_response?.responseCode === 66416 ||
            cs_response?.threeDSResponseCode === 65800 ||
            cs_response?.threeDSVendorCode === expCsResponse)
    ) {
        failedMessage = 'Wrong card details & billing address entered. Please check your details and try again.';
    }

    if (
        cs_response.responseCode === 65803 ||
        cs_response.responseCode === 65566 ||
        cs_response.responseCode === 65801 ||
        cs_response.responseMessage === 'Disallowed cardnumber' ||
        !cs_response
    ) {
        failedMessage = 'Payment declined by your bank, wrong details provided.';
    }
    return failedMessage;
};

export const getCsThreeDsVersion = (cs_response) => {
    return `${cs_response?.threeDSVersion}`.startsWith('2.') ? 'v2' : 'v1';
};

export const update3dsInprogress = async (params) => {
    let { db, card_payment_id, card_payment_params, RequestLogId, cs_response } = params;
    let threeds_reference_key = cs_response['threeDSMD'] ? 'threeDSMD' : cs_response['threeDSRef'] ? 'threeDSRef' : '';
    let threeds_reference = cs_response['threeDSMD']
        ? cs_response['threeDSMD']
        : cs_response['threeDSRef']
        ? cs_response['threeDSRef']
        : '';
    let threeds_version = getCsThreeDsVersion(cs_response) === 'v1' ? '3D' : '3DV2';
    await db.CardstreamRequestReferenceLog.create({
        cardstream_request_log_id: RequestLogId,
        reference_key: threeds_reference_key,
        reference_version: getCsThreeDsVersion(cs_response),
        reference_value: threeds_reference
    });
    await db.CardstreamRequestLog.update(
        {
            card_payment_id: card_payment_id,
            md: threeds_reference,
            transaction_type: threeds_version
        },
        { where: { id: RequestLogId } }
    );

    card_payment_params.transaction_mode_id = 2;
    card_payment_params.reason = '';
    await updatePaymentStatus(
        {
            ...card_payment_params,
            payment_status: '3DS-PROGRESS'
        },
        db.Payment,
        db.Payments,
        db.Customer,
        db.TransactionStatuses
    );
    return true;
};

export const getInitialCsRequestPayload = (params) => {
    let {
        payload,
        total_amount,
        cardstream_id,
        countryInfo,
        hashMasterTokenKeys,
        csPayloadEncData,
        kountSessionID,
        paymentRef
    } = params;
    let data = {
        action: 'SALE',
        amount: total_amount,
        merchantID: cardstream_id,
        type: 1,
        currencyCode: countryInfo.iso_currency_code,
        countryCode: countryInfo.iso_country_code,
        cardNumber: payload.card_number,
        cardExpiryMonth: payload.exp_month,
        cardExpiryYear: payload.exp_year,
        cardCVV: payload.cvv,
        customerName: `${payload.first_name} ${payload.last_name}`,
        customerPostCode: `${payload.billing_post_code}`,
        customerEmail: payload.email,
        customerAddress: `${payload.billing_address}`,
        transactionUnique: `O${payload.order_id}M${payload.merchant_id}T${paymentRef.id}`,
        duplicateDelay: 1,
        merchantData: JSON.stringify({
            t2s_token: `mxtoken_${hashMasterTokenKeys}`,
            base64Data: payload.base64Data,
            masterToken: `mxtoken_${hashMasterTokenKeys}`,
            csPayloadEncData: csPayloadEncData
        }),
        riskCheckPref: 'review=continue,escalate=continue,not known=continue,not checked=continue,approve=continue',
        riskCheckOptions: JSON.stringify({
            SESS: kountSessionID,
            ORDR: payload.order_id
        })
    };
    return data;
};

export const setMotoInfo = (payload) => {
    let data = {
        type: 2, //MOTO
        riskCheckRequired: 'N',
        avscv2CheckRequired: 'Y',
        addressCheckPref: 'not known, not checked, matched, not matched, partially matched',
        postcodeCheckPref: 'matched',
        cv2CheckPref: 'matched'
    };
    if (!payload.same_as_delivery_address === false) {
        data['customerPostCode'] = payload.billing_post_code;
        data['customerAddress'] = payload.billing_address;
    }
    return data;
};

export const getInitialCsRequestPayloadToken = (params) => {
    let {
        payload,
        total_amount,
        cardstream_id,
        countryInfo,
        kountSessionID,
        paymentRef,
        avs_billing_address,
        avs_postal_code
    } = params;
    let data = {
        action: 'SALE',
        amount: total_amount,
        merchantID: cardstream_id,
        type: 1,
        currencyCode: countryInfo.iso_currency_code,
        countryCode: countryInfo.iso_country_code,
        cardCVV: payload.cvv,
        xref: payload.card_token,
        cloneFields: 'cardNumber,cardExpiryMonth,cardExpiryYear,customerAddress,customerPostcode',
        customerName: `${payload.first_name} ${payload.last_name}`,
        customerAddress: `${avs_billing_address}`,
        customerPostCode: `${avs_postal_code}`,
        customerEmail: payload.email,
        transactionUnique: `O${payload.order_id}M${payload.merchant_id}T${paymentRef.id}`,
        duplicateDelay: 1,
        riskCheckPref: 'review=continue,escalate=continue,not known=continue,not checked=continue,approve=continue',
        riskCheckOptions: JSON.stringify({
            SESS: kountSessionID,
            ORDR: payload.order_id
        }),
        merchantData: JSON.stringify({
            base64Data: payload.base64Data,
            masterTokenData: JSON.stringify({
                master_token: payload.master_token,
                card_token: payload.card_token,
                updateMasterToken: !!payload.master_token //in case master token is provided by t2s and it went through 3D sale we must update table only when sale happened successfully
            })
        })
    };
    return data;
};

export const checkContinuationRequestStatus = async (
    params,
    recursive_check = false,
    continuationRequestCheckCounter = 0
) => {
    //this function checks for card_payment entry existance, if found, return true, else false
    //if recursive_check marked as 'true', it will poll the the card_payment twice and CS api once, until some result is back
    //opening a new db connection here, as existing db connection will be closed prior to this function call (to avoid any potential db connection issues)
    let db = await getDbConnection();

    let { sequelize, Payment, Customer, Payments } = db;
    let PaymentRecords = await getPaymentRecords(params, Customer, Payment, Payments);
    await sequelize.close();
    //if record exists, return true
    if (PaymentRecords.length) {
        return true;
    }
    logger.info(params.logMetadata, 'continuationRequestCheckCounter', continuationRequestCheckCounter);
    if (recursive_check) {
        if (continuationRequestCheckCounter >= 2) {
            //after checking with db twice, go for cardstream txn api
            let CSTxnApiConfig = {
                method: 'GET',
                endpoint: `transactions?w=(transactionUnique in ('O${params.order_id}M${params.merchant_id}T${params.card_payment_id}'))`
            };
            logger.info(params.logMetadata, 'CSTxnApiConfi', CSTxnApiConfig);
            let CSTxnApiResponse = await saleHelpers.CardstreamRestApi(CSTxnApiConfig);
            logger.info(params.logMetadata, 'CSTxnApiResponse', CSTxnApiResponse);
            if (CSTxnApiResponse.responseCode == 0) {
                logger.info(params.logMetadata, 'Txn is succesful!');
                return { status: 'success', cs_response: CSTxnApiResponse }; //returning string 'success' instead of true, so that rest of the code will execute instead of callback
            }
            logger.info(
                params.logMetadata,
                `Txn failed with continuation request! - CS Respone code is: ${CSTxnApiResponse.responseCode}`
            );
            throw { message: 'Transaction failed (4088)', code: 4088 };
        }

        logger.info(
            params.logMetadata,
            `Recursively checking for card_payment status, attempt-${++continuationRequestCheckCounter}`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return await checkContinuationRequestStatus(params, recursive_check, continuationRequestCheckCounter);
    }

    return false;
};

export const GetSuccessApiResponse = async (params) => {
    let SuccessUrl =
        params.hasOwnProperty('redirect_url') && params.redirect_url !== ''
            ? params.redirect_url
            : 'https://' + params.host + '/payment.php?simple=1&bSuccess&id=' + params.order_id;
    let api_response = {
        statusCode: 301,
        headers: {
            location: SuccessUrl
        },
        body: null
    };
    return api_response;
};

export const GetCardVerifySuccessApiResponse = async (decryptedPayload) => {
    let SuccessUrl = decryptedPayload?.redirect_url;
    let api_response = {
        statusCode: 301,
        headers: {
            location: `${SuccessUrl}`
        },
        body: null
    };
    return api_response;
};

export const objectToQueryString = async (initialObj) => {
    const reducer = (obj, parentPrefix = null) => (prev, key) => {
        const val = obj[key];
        key = encodeURIComponent(key);
        const prefix = parentPrefix ? `${parentPrefix}[${key}]` : key;

        if (val == null || typeof val === 'function') {
            prev.push(`${prefix}=`);
            return prev;
        }

        if (['number', 'boolean', 'string'].includes(typeof val)) {
            prev.push(`${prefix}=${encodeURIComponent(val)}`);
            return prev;
        }

        prev.push(Object.keys(val).reduce(reducer(val, prefix), []).join('&'));
        return prev;
    };

    return Object.keys(initialObj).reduce(reducer(initialObj), []).join('&');
};

export const GetErrorApiResponse = async (params) => {
    let { encryptedPayload, requestPayload, requestId, CatchError, CSrequestLog, cs_response } = params;
    const error_url = mxFn.getErrorUrl(encryptedPayload, requestPayload, cs_response);
    let errorResponse = {
        error: {
            request_id: requestId,
            type: 'error',
            message: CatchError.message
        },
        headers: {
            location: error_url
        }
    };

    db = await getDbConnection();
    //update request log saying its error
    CSrequestLog
        ? await db.CardstreamRequestLog.update(
              {
                  response: JSON.stringify(errorResponse)
              },
              {
                  where: {
                      id: CSrequestLog.id
                  }
              }
          )
        : null;

    logger.error(logMetadata, 'errorResponse', errorResponse);
    await db.sequelize.close();

    let api_response = {
        statusCode: 301,
        headers: {
            location: errorResponse.headers.location
        },
        body: JSON.stringify(errorResponse.error.message)
    };
    return api_response;
};

export const getAcsRedirectApiResponse = async (params) => {
    let { cs_response, CardstreamRequestLog, CardstreamRequestReferenceLog, queryStringParameters } = params;
    let api_response;
    if (
        //'creq' is there in the response and 3ds version is still V2
        cs_response['threeDSRequest[creq]'] &&
        cs_response['threeDSVersion'].startsWith('2.')
    ) {
        //at this point, CS has generated new threeDSRef, need to update the same for later use
        await CardstreamRequestLog.update(
            {
                md: cs_response['threeDSRef']
            },
            {
                where: {
                    id: queryStringParameters.RequestLogId
                }
            }
        );
        await CardstreamRequestReferenceLog.create({
            cardstream_request_log_id: queryStringParameters.RequestLogId,
            reference_key: 'threeDSRef',
            reference_value: cs_response['threeDSRef'],
            reference_version: 'v2'
        });

        //post form submit to acs (it goes to eg frontend then does the acs form submit, as it cannot be done from backend directly :-(
        api_response = {
            statusCode: 301,
            headers: {
                location: `${process.env.EARTH_ENDPOINT}/AcsRedirect/action=creq&creq=${
                    cs_response['threeDSRequest[creq]']
                }&threeDSURL=${encodeURIComponent(`${cs_response['threeDSURL']}`)}`
            }
        };

        //giving 200 response for some api testing dependencies through postman (ND-2859). Frontend expect the http code 301 always
        if (queryStringParameters.hasOwnProperty('json')) {
            api_response = {
                statusCode: 200,
                body: {
                    data: {
                        creq: cs_response['threeDSRequest[creq]'],
                        threedsRef: cs_response['threeDSRef']
                    }
                }
            };
        }
    } else if (
        //fallback to 3ds-V1
        cs_response['threeDSDetails[fallback]'] === 'Y' &&
        cs_response['threeDSVersion'].startsWith('1.')
    ) {
        //form submit v1
        //at this point, CS has generated 'MD' instead of 'threeDSRef', need to update the same for later post redirect
        await CardstreamRequestLog.update(
            {
                md: cs_response['threeDSRequest[MD]']
            },
            {
                where: {
                    id: queryStringParameters.RequestLogId
                }
            }
        );
        await CardstreamRequestReferenceLog.create({
            cardstream_request_log_id: queryStringParameters.RequestLogId,
            reference_key: 'threeDSRequest[MD]',
            reference_value: cs_response['threeDSRequest[MD]'],
            reference_version: 'v1'
        });
        console.log('threeDSRequest[MD]', cs_response['threeDSRequest[MD]']);
        console.log('threeDSRequest[PaReq]', cs_response['threeDSRequest[PaReq]']);
        console.log('threeDSURL', cs_response['threeDSURL']);
        api_response = {
            statusCode: 301,
            headers: {
                location: `${process.env.EARTH_ENDPOINT}/AcsRedirect/action=PaReq&acsUrl=${encodeURIComponent(
                    `${cs_response['threeDSURL']}`
                )}&md=${cs_response['threeDSRequest[MD]']}&paReq=${encodeURIComponent(
                    `${cs_response['threeDSRequest[PaReq]']}`
                )}&termUrl=${encodeURIComponent(`${process.env.EARTH_API_ENDPOINT}/sale/redirect`)}`
            }
        };
    }
    console.log({ api_response });
    return api_response;
};

export const GetErrorApiResponse2 = async (params) => {
    let {
        encryptedPayload,
        requestPayload,
        requestId,
        cs_response,
        CSrequestLog,
        payment_params,
        db,
        logger,
        logMetadata
    } = params;
    //something wrong happened with card stream api
    const error_url = mxFn.getErrorUrl(encryptedPayload, requestPayload, cs_response);
    let threeDsfailedMsg = getFailedErrorMessage(cs_response);
    let threeDsfailedCode = getFailedErrorCode(cs_response, requestPayload);
    let errorResponse = {
        error: {
            request_id: requestId,
            message: `Payment failed: ${threeDsfailedMsg}`,
            error_code: threeDsfailedCode,
            type: 'PAYMENT_FAILED'
        },
        headers: {
            location: error_url
        }
    };
    await db.CardstreamRequestLog.update(
        {
            response: JSON.stringify(errorResponse)
        },
        {
            where: {
                id: CSrequestLog.id
            }
        }
    );
    let payment_status = 'FAILED';
    if (
        cs_response['vcsResponseCode'] === 5 ||
        (cs_response['responseCode'] === 5 && cs_response['riskCheck'] !== RISKCHECK.DECLINE)
    ) {
        payment_status = 'DECLINE';
    } else if (
        cs_response['responseCode'] === 5 &&
        cs_response['riskCheck'] &&
        cs_response['riskCheck'] === RISKCHECK.DECLINE
    ) {
        payment_params.reason = 'risk check declined';
        payment_status = 'RISK-CHECK-DECLINE';
    }

    await updatePaymentStatus(
        {
            ...payment_params,
            payment_status: 'FAILED'
        },
        db.Payment,
        db.Payments,
        db.Customer,
        db.TransactionStatuses
    );

    await db.sequelize.close();
    logger.error(logMetadata, 'errorResponse', errorResponse);
    let api_response = {
        statusCode: 301,
        headers: {
            location: errorResponse.headers.location
        },
        body: JSON.stringify(errorResponse.error.message)
    };
    return api_response;
};

export const transactionFailedNotify = async (requestPayload, cs_response) => {
    // var logMetadata = {
    //     location: 'EarthService ~ transactionFailedNotify',
    //     orderId: requestPayload.order_id,
    //     emailTo: requestPayload.email
    // };
    // let currencySign = cs_response?.currencySymbol ? cs_response?.currencySymbol : '£';
    // let failure_message = `<div>
    //     <p>Dear ${requestPayload?.first_name} ${requestPayload?.last_name}, <br><br>
    //     Unfortunately your order <b>#${requestPayload?.order_id}</b> for ${currencySign}${requestPayload?.total} was not completed.</p>
    //     <p>If an amount was debited from your account, it will be refunded to your card within 3 to 5 working days.</p>
    // </div>`;
    // let copyRightYear = new Date().getFullYear();
    // const mailBody = await transactionFailNotificationEmail(failure_message, copyRightYear);
    // requestPayload.email &&
    //     (await emailHelpers.sendEmail(
    //         {
    //             email: requestPayload.email,
    //             subject: `Payment Failed - #${requestPayload.order_id}`,
    //             mailBody,
    //             from: '"Datman" <info@datman.je>'
    //         },
    //         'DATMAN'
    //     ));
    // logger.info(logMetadata, 'Email content for the failed order: ', failure_message);
};

export const executeSuccessActions = async (params) => {
    let { requestPayload, cs_response, CSrequestLog, db, logger, logMetadata, payment_params } = params;

    if (requestPayload.save_card && requestPayload.customer_id) {
        await db.CardstreamTokenLog.create({
            token: cs_response['xref'],
            customer_id: requestPayload.customer_id,
            last_four_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            card_scheme: cs_response['cardScheme'],
            card_issuer: cs_response['cardIssuer'],
            is_deleted: 'NO'
        });
    }

    let updateObj = {
        VendorTxCode: cs_response?.transactionUnique,
        TxAuthNo: cs_response?.authorisationCode,
        CrossReference: cs_response?.xref,
        last_4_digits: `${cs_response?.cardNumberMask}`.substr(-4),
        payment_status: 'OK',
        origin: ORIGIN_3DS_VERSION[getCsThreeDsVersion(cs_response)],
        reason: '',
        more_info: cs_response?.threeDSVersion,
        card_payment_id: CSrequestLog.card_payment_id,
        merchant_id: requestPayload.merchant_id,
        transaction_mode_id: payment_params.transaction_mode_id
    };

    logger.info(updateObj, 'Successful transaction update');

    await updatePayments(updateObj, requestPayload, db);

    logger.info(logMetadata, `threeDSAuthenticated`, cs_response.threeDSAuthenticated);
    logger.info(logMetadata, `addressCheck`, cs_response.addressCheck);
    logger.info(logMetadata, `postcodeCheck`, cs_response.postcodeCheck);
    logger.info(logMetadata, `cv2Check`, cs_response.cv2Check);
    logger.info(logMetadata, `riskCheck`, cs_response.riskCheck);

    var merchantDataPayload = cs_response.merchantData ? JSON.parse(cs_response.merchantData) : '';
    console.log('merchantDataPayload: ', merchantDataPayload);

    const shouldTokenize = await mxFn.shouldTokenize({
        cs_response,
        requestPayload,
        db
    });

    logger.info(logMetadata, 'shouldTokenize', shouldTokenize);
    const isSavedCard = mxFn.isSavedCard(CSrequestLog);
    logger.info(logMetadata, 'isSavedCard', isSavedCard);
    //update master token table
    if (shouldTokenize && isSavedCard && merchantDataPayload.masterTokenData) {
        logger.info(logMetadata, 'merchantDataPayload', merchantDataPayload.masterTokenData);

        const mxData = JSON.parse(merchantDataPayload.masterTokenData);
        const avs_token = serialize([
            {
                AvsHouseNumber: cs_response.customerAddress || requestPayload.billing_address,
                AvsPostcode: cs_response.customerPostcode || requestPayload.billing_post_code
            }
        ]);
        let payment_provider = await mxFn.getProvider({ merchant_id: requestPayload.merchant_id }, db.Customer);
        logger.info('payment_provider~', payment_provider);
        logger.info(logMetadata, 'avs_token', avs_token);
        mxData.updateMasterToken &&
            (await mxFn.updateMasterTokenTable(
                {
                    master_token: mxData.master_token,
                    avs_token: avs_token,
                    card_token: cs_response.xref,
                    customer_id: requestPayload.customer_id,
                    payment_provider: payment_provider
                },
                db.MasterToken
            ));
    }

    if (!isSavedCard && shouldTokenize) {
        logger.info(logMetadata, 'sendDataQueue', 'sending data to Queue ~ shouldTokenize', shouldTokenize);
        let decryptedCSPayload = cryptFunctions.decryptPayload(
            merchantDataPayload.csPayloadEncData,
            process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
        );
        decryptedCSPayload = JSON.parse(decryptedCSPayload);
        await mxFn.sendDataQueue(decryptedCSPayload, cs_response, merchantDataPayload.masterToken, requestPayload);
    }

    //Now call the webhook url passed on encrypted values
    //prepare the t2s payload to send based on the type of sale based on card used
    let t2sPayload;
    let sale_amount = (cs_response.amount / 100).toFixed(2);
    //if the sale been made using saved card token, or the user opted for not to remember his new card, dont send the card token releated information back
    if (isSavedCard || !requestPayload.save_card || !requestPayload.customer_id) {
        t2sPayload = {
            transaction_id: CSrequestLog.card_payment_id,
            customer_id: requestPayload.customer_id,
            order_info_id: requestPayload.order_id,
            amount: sale_amount,
            reference: requestPayload.reference
        };
    } else if (shouldTokenize) {
        //it must be sale made using new card with user opted to remember the card
        t2sPayload = {
            transaction_id: CSrequestLog.card_payment_id,
            customer_id: requestPayload.customer_id,
            provider: T2S_MERCHANT_PROVIDER,
            token: merchantDataPayload.masterToken, //master token
            last_4_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            expiry_date: cs_response.cardExpiryDate,
            card_type: cs_response.cardType,
            one_click: 'YES',
            is_primary: 'YES',
            order_info_id: requestPayload.order_id,
            amount: sale_amount,
            reference: requestPayload.reference
        };
    } else {
        t2sPayload = {
            transaction_id: CSrequestLog.card_payment_id,
            customer_id: requestPayload.customer_id,
            order_info_id: requestPayload.order_id,
            amount: sale_amount,
            reference: requestPayload.reference
        };
    }

    if(requestPayload?.split_fee?.length){
        let SplitStatusNotifyPayload = await splitFeeHelpers.GetSplitNotifyPayload({
            db,
            order_id : requestPayload.order_id
        })
        console.log({SplitStatusNotifyPayload})
        t2sPayload['SplitFeeStatus'] = SplitStatusNotifyPayload
    }
    logger.info(logMetadata, 'requestPayload', requestPayload);
    logger.info(logMetadata, 't2sPayload', t2sPayload);

    if (requestPayload.webhook_url) {
        if (process.env.IS_OFFLINE) {
            await earthService.notifyT2SSubscriberDirect(
                requestPayload,
                t2sPayload,
                CSrequestLog.card_payment_id,
                logMetadata.awsRequestId
            );
        } else {
            await earthService.notifyT2SSubscriber(
                requestPayload,
                t2sPayload,
                CSrequestLog.card_payment_id,
                logMetadata.awsRequestId
            );
        }
    } else {
        logger.info(logMetadata, `Order id: ${requestPayload.order_id}, Webhook url missing with T2S payload`);
    }

    return true;
};

export const executeSaveCardSuccessActions = async (params) => {
    let { decryptedPayload, hashMasterTokenKeys, requestId } = params;

    if (hashMasterTokenKeys) {
        await mxFn.sendDataQueueAddCard(decryptedPayload, hashMasterTokenKeys, requestId);
    } else {
        logger.info(logMetadata, `Some error occured while sending data to queue!`);
    }
    return true;
};

export const GetErrorApiResponse3 = async (params) => {
    let {
        encryptedPayload,
        requestPayload,
        requestId,
        CatchError,
        cs_response,
        CSrequestLog,
        payment_params,
        db,
        logger,
        logMetadata
    } = params;
    const error_url = mxFn.getErrorUrl(encryptedPayload, requestPayload, cs_response);
    let errorResponse = {
        error: {
            request_id: requestId,
            type: 'error',
            message: CatchError.message
        },
        headers: {
            location: error_url
        }
    };
    let db_update = CatchError.code != 4088;
    //update request log saying its error
    CSrequestLog &&
        db_update &&
        (await db.CardstreamRequestLog.update(
            {
                response: JSON.stringify(errorResponse)
            },
            {
                where: {
                    id: CSrequestLog.id
                }
            }
        ));

    CSrequestLog &&
        db_update &&
        (await updatePaymentStatus(
            {
                ...payment_params,
                reason: CatchError.message,
                id: CSrequestLog.card_payment_id,
                payment_status: 'ERROR'
            },
            db.Payment,
            db.Payments,
            db.Customer,
            db.TransactionStatuses
        ));

    logger.error(logMetadata, 'errorResponse', errorResponse);

    await db.sequelize.close();
    let api_response = {
        statusCode: 301,
        headers: {
            location: errorResponse.headers.location
        },
        body: JSON.stringify(errorResponse.error.message)
    };
    return api_response;
};
