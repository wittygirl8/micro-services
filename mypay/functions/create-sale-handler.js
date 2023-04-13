var { response, flakeGenerateDecimal, mypayHelpers, emailHelpers, saleHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { GetCustomerName } = require('./logic/helper-functions');
let logger = logHelpers.logger;
const { MypayService } = require('../mypay.service');
const mypayService = new MypayService();
export const createSale = async (event, context, callback) => {
    if (Object.prototype.hasOwnProperty.call(event, 'keep-warm')) {
        logger.info('Warming createSale');
        return callback(null, {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Required for CORS support to work
                'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
            },
            body: { message: 'warm is done' }
        });
    }

    let logMetadata = {
        location: 'MyPayService ~ createSaleHandler',
        orderId: '',
        awsRequestId: context.awsRequestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const {
        sequelize,
        Payment,
        Customer,
        MypayShopper,
        MypayTempTransaction,
        MypayTempTransactionsMeta,
        MypayUsersCardstreamSettings,
        MypayCardstreamTransactionLog,
        CardstreamRequestLog
    } = db;

    const requestId = 'reqid_' + flakeGenerateDecimal();
    try {
        let payload = JSON.parse(event.body);
        //check for mandatory fields,
        //this should be prevented by either serverless request schema
        //or joi validation should be implemented
        if (
            !payload.session_id ||
            !payload.cardno ||
            !payload.cvv ||
            !payload.exp_mm ||
            !payload.exp_yy ||
            !payload.cardholder_name
        ) {
            throw { message: 'Fields missing' };
        }

        let [cardholder_firstname, cardholder_lastname] = `${payload.cardholder_name}`.split(' ', 2);
        cardholder_lastname = cardholder_lastname ? cardholder_lastname : ''; //in some cases secod name wont be there
        // validate session id
        let sessionInfo = await mypayHelpers.validateSession(
            {
                session_id: payload.session_id
            },
            {
                MypayTempTransaction
            }
        ); //temp_transactions based on the id

        // get merchant settings
        let userSetting = await Customer.findOne({
            attributes: ['payment_provider', 'business_name', 'threeds_version'],
            where: {
                id: sessionInfo.customer_id
            },
            raw: true
        });

        if (userSetting.payment_provider === 'CARDSTREAM') {
            //get merchant cardstream based settings
            let csSettings = await MypayUsersCardstreamSettings.findOne({
                where: {
                    customer_id: sessionInfo.customer_id
                },
                raw: true
            });

            let shopperInformation = await MypayShopper.findOne({
                where: {
                    id: sessionInfo.shopper_id
                },
                raw: true
            });

            let metaInfo = await MypayTempTransactionsMeta.findOne({
                where: {
                    id: sessionInfo.meta_id
                }
            });
            var RequestLogId = await CardstreamRequestLog.create({
                // order_id: JSON.stringify(payload_log.order_id),
                // payload: JSON.stringify(payload_log),
                // encrypted_payload: JSON.stringify({ data: JSON.parse(event.body).data }),
                handler: 'omnipay.createSale'
            });

            let api_response = await createCsTransaction(
                {
                    requestId,
                    sessionInfo,
                    userSetting,
                    csSettings,
                    payload,
                    shopperInformation,
                    metaInfo,
                    cardholder_firstname,
                    cardholder_lastname,
                    RequestLogId
                },
                {
                    Payment,
                    MypayTempTransaction,
                    MypayCardstreamTransactionLog,
                    CardstreamRequestLog
                },
                logMetadata,
                event
            );

            logger.info(logMetadata, 'api_response', api_response);
            await sequelize.close();
            return response(api_response.body, api_response.statusCode);
        } else {
            throw { message: 'Invalid provider' };
        } //
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

let createCsTransaction = async (params, models, logMetadata, event) => {
    let {
        requestId,
        sessionInfo,
        userSetting,
        csSettings,
        payload,
        shopperInformation,
        metaInfo,
        cardholder_firstname,
        cardholder_lastname,
        RequestLogId
    } = params;
    // prepare the object for cs
    let cs_payload = {
        action: 'SALE',
        amount: sessionInfo.amount,
        merchantID: csSettings.cs_merchant_id,
        type: 1,
        currencyCode: sessionInfo.currency_code, //826
        countryCode: csSettings.country_code, //826
        cardNumber: payload.cardno,
        cardExpiryMonth: payload.exp_mm,
        cardExpiryYear: payload.exp_yy,
        cardCVV: payload.cvv,
        customerName: `${GetCustomerName({ shopperInformation, cardholder_firstname, cardholder_lastname }, 'both')}`,
        customerAddress: shopperInformation.address,
        transactionUnique: sessionInfo.ref,
        duplicateDelay: 1
    };

    if (userSetting.threeds_version === '2') {
        cs_payload = {
            ...cs_payload,
            ...payload?.deviceInfo,
            deviceCapabilities: 'javascripts',
            remoteAddress: event?.requestContext?.identity?.sourceIp
                ? event?.requestContext?.identity?.sourceIp
                : '0.0.0.0',
            deviceScreenResolution: payload?.deviceInfo?.deviceScreenResolution,
            threeDSRedirectURL: process.env.MYPAY_BANK_REDIRECT_URL + '/3dsv2' + '?RequestLogId=' + RequestLogId.id
        };
    }
    // payload_log for printing body with masking sensitive data, do not print the card details unmasked
    let payload_log = Object.assign({}, cs_payload);
    payload_log.cardNumber = `${'*'.repeat(payload_log.cardNumber.length - 4)}${payload_log.cardNumber.substr(
        payload_log.cardNumber.length - 4
    )}`;
    payload_log.cardExpiryMonth = `${'*'.repeat(payload_log.cardExpiryMonth.length)}`;
    payload_log.cardExpiryYear = `${'*'.repeat(payload_log.cardExpiryYear.length)}`;
    payload_log.cardCVV = `${'*'.repeat(payload_log.cardCVV.length)}`;
    logger.info(logMetadata, 'cs_payload', payload_log);

    /* console.log("test_api");
  let test_response = await axios.get(
    "https://jsonplaceholder.typicode.com/todos/1",
    payload
  );
  console.log("test_response", test_response); */
    let response = await saleHelpers.processCardStreamPayment(cs_payload, csSettings.cs_signature_key);
    logger.info(logMetadata, 'cs response', response);

    var cs_threeDS_version_supported = `${response?.threeDSVersion}`.startsWith('2.') ? 'v2' : 'v1';
    await models.CardstreamRequestLog.update(
        {
            response: JSON.stringify(response),
            md: response['threeDSMD'] ? response['threeDSMD'] : response['threeDSRef'] ? response['threeDSRef'] : '',
            transaction_type: cs_threeDS_version_supported === 'v1' ? '3D' : '3DV2'
        },
        { where: { id: RequestLogId.id } }
    );

    //if response is failure
    if (response['responseCode'] === 65802) {
        //return response back for 3d transaction

        if (cs_threeDS_version_supported === 'v2') {
            console.log({ here: response['threeDSRequest[threeDSMethodData]'] });
            let ThreeDSV2_response = {
                statusCode: 201,
                body: {
                    request_id: requestId,
                    message: 'The request was processed successfully',
                    data: {
                        success: '3dsV2',
                        threeDSreq: {
                            threeDSURL: response['threeDSURL']
                        }
                        // RequestLogId: RequestLogId.id, //adding this parameter in the response only for some api testing dependencies (ND-2859). Frontend does'nt need this
                        // order_id: encrptedPayload?.order_id
                    }
                }
            };
            //this happens when 3dsv2 device fingerprinting
            if (response?.['threeDSRequest[threeDSMethodData]']) {
                ThreeDSV2_response.body.data['showIframe'] = false; //not in use
                ThreeDSV2_response.body.data.threeDSreq['threeDSMethodData'] =
                    response['threeDSRequest[threeDSMethodData]'];
            }
            //this happens when 3dsv2 requires CHALLENGE
            if (response?.['threeDSRequest[creq]']) {
                ThreeDSV2_response.body.data['showIframe'] = true; //not in use
                ThreeDSV2_response.body.data.threeDSreq['creq'] = response['threeDSRequest[creq]'];
            }
            return ThreeDSV2_response;
        }

        //3dsV1 flow
        return {
            statusCode: 201,
            body: {
                request_id: requestId,
                message: 'The request was processed successfully',
                data: {
                    success: '3d',
                    threeDSreq: {
                        acsUrl: response['threeDSACSURL'],
                        md: response['threeDSMD'],
                        paReq: response['threeDSPaReq'],
                        termUrl: process.env.MYPAY_BANK_REDIRECT_URL
                    }
                }
            }
        };
    } else if (response['responseCode'] !== 0) {
        throw { message: 'Transaction failed: CS-' + response.responseMessage + '-' + response.responseCode };
    }
    // console.log('cs_response',response);
    // push the response from the cardstream transaction
    let CardstreamTransactioLog = await models.MypayCardstreamTransactionLog.create({
        action: response.action,
        xref: response.xref,
        raw_response: JSON.stringify(response)
    });
    // console.log('CardstreamTransactioLog',CardstreamTransactioLog.dataValues.id)

    // create an object for transaction
    let transacRef = `tr_${response.xref}`;
    let mydate = new Date();

    const fee_percent = 0; //fee can be changed here later based on business requirement
    const fees = (response.amount * fee_percent) / 10000;
    const payed = response.amount - fees;

    // push the transaction to main transaction table
    await models.Payment.create({
        customer_id: sessionInfo.customer_id,
        order_id: `MP_${sessionInfo.user_order_ref}`,
        total: (response.amount / 100).toFixed(2),
        fees,
        payed: (payed / 100).toFixed(2),
        firstname: GetCustomerName({ shopperInformation, cardholder_firstname, cardholder_lastname }, 'firstname'),
        lastname: GetCustomerName({ shopperInformation, cardholder_firstname, cardholder_lastname }, 'lastname'),
        email: shopperInformation.email,
        address: shopperInformation.address,
        payment_provider: userSetting.payment_provider,
        correlation_id: CardstreamTransactioLog.dataValues.id,
        CrossReference: sessionInfo.ref,
        VendorTxCode: response.xref,
        TxAuthNo: response.authorisationCode,
        payment_status: 'OK',
        last_4_digits: `${response.cardNumberMask}`.substr(-4),
        day: mydate.getDate(),
        month: mydate.getMonth() + 1,
        week_no: mydate.getWeek(),
        year: mydate.getFullYear(),
        origin: 'Mypay-API',
        method: 'NewCard',
        more_info: JSON.parse(metaInfo?.data)?.from || 'UNKNOWN'
    });

    await models.MypayTempTransaction.update(
        {
            status: 'PROCESSED'
        },
        {
            where: { ref: sessionInfo.ref }
        }
    );

    //sending payment confirmation email to payer
    let confirmation_message = `<h1>Hi ${GetCustomerName(
        { shopperInformation, cardholder_firstname, cardholder_lastname },
        'firstname'
    )},</h1><p>Your payment of <b>&pound; ${(sessionInfo.amount / 100).toFixed(2)}</b>&nbsp; to <b>${
        userSetting.business_name
    }</b> has been successfully received.<br> <br> Please note your transaction reference <span style="color: #3869D4; font-weight: 300;"> ${transacRef} </span> </p>`;
    shopperInformation.recipients_email &&
        (await emailHelpers.sendEmail(
            {
                email: shopperInformation.recipients_email,
                subject: 'Order confirmation',
                message: confirmation_message
            },
            'OMNIPAY'
        ));
    if (payload.hasOwnProperty('phone_number') && payload.phone_number) {
        const sms_text = `Hi ${GetCustomerName(
            { shopperInformation, cardholder_firstname, cardholder_lastname },
            'firstname'
        )},\nYour payment of ${(sessionInfo.amount / 100).toFixed(2)} to ${
            userSetting.business_name
        } has been successfully received. Please note your transaction reference ${transacRef}`;
        const smsParams = {
            message_text: sms_text,
            phone_number: payload.phone_number //should be in the E.164 phone number structure
        };
        await mypayService.sendSMS(smsParams);
    }

    let data = {
        merchantId: sessionInfo.customer_id,
        type: 'sale',
        via: 'PayByQR', // PayByLink
        amount: sessionInfo.amount,
        customerName: shopperInformation.first_name + shopperInformation.last_name
    };

    console.log(`Push notification Request data ~${JSON.stringify(data)}`);
    let pushNotificationresponse = await mypayService.sendPushNotification(data);
    console.log(`Push Notification Response data ${pushNotificationresponse}`);

    //getting redirect url from metaInfo
    let redirect_info = await mypayHelpers.getRedirectInfo({
        metaData: JSON.parse(metaInfo.data),
        sessionInfo,
        transacRef
    });
    //return success response for non-3d transactions
    return {
        statusCode: 200,
        body: {
            request_id: requestId,
            message: 'success',
            data: {
                transaction_id: transacRef,
                redirect_info
            }
        }
    };
};

Date.prototype.getWeek = function (dowOffset) {
    /*getWeek() was developed by Nick Baicoianu at MeanFreePath: http://www.meanfreepath.com */

    dowOffset = typeof dowOffset === 'number' ? dowOffset : 0; //default dowOffset to zero
    var newYear = new Date(this.getFullYear(), 0, 1);
    var day = newYear.getDay() - dowOffset; //the day of week the year begins on
    day = day >= 0 ? day : day + 7;
    var daynum =
        Math.floor(
            (this.getTime() - newYear.getTime() - (this.getTimezoneOffset() - newYear.getTimezoneOffset()) * 60000) /
                86400000
        ) + 1;
    var weeknum;
    //if the year starts before the middle of a week
    if (day < 4) {
        weeknum = Math.floor((daynum + day - 1) / 7) + 1;
        if (weeknum > 52) {
            let nYear = new Date(this.getFullYear() + 1, 0, 1);
            let nday = nYear.getDay() - dowOffset;
            nday = nday >= 0 ? nday : nday + 7;
            /*if the next year starts before the middle of
                    the week, it is week #1 of that year*/
            weeknum = nday < 4 ? 1 : 53;
        }
    } else {
        weeknum = Math.floor((daynum + day - 1) / 7);
    }
    return weeknum;
};
