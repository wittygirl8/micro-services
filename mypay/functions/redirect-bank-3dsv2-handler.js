var { response, flakeGenerateDecimal, mypayHelpers, emailHelpers, saleHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { GetCustomerName } = require('./logic/helper-functions');
const cs_default_signature_key = 'shjX4KH9xyGXfGn6';
let logger = logHelpers.logger;
const { parse } = require('querystring');

const CS_RESPONSE_CODE = {
    THREEDS_REQUIRED: 65802,
    THREEDS_REFERENCE_ALREADY_PROCESSED: 66848
};

export const redirectFromBankV2 = async (event, context) => {
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const {
        sequelize,
        MypayTempTransaction,
        Payment,
        Customer,
        MypayTempTransactionsMeta,
        MypayCardstreamTransactionLog,
        MypayShopper,
        CardstreamRequestLog
    } = db;
    const requestId = 'reqid_' + flakeGenerateDecimal();
    let logMetadata = {
        location: 'MyPayService ~ redirectBankHandler',
        orderId: '',
        awsRequestId: context.awsRequestId
    };
    // try {
    let payload = JSON.parse(JSON.stringify(parse(event.body)));
    console.log({ payload });
    //now read the CSrequestLog reference from the url
    let queryStringParameters = event.queryStringParameters;
    console.log({ queryStringParameters });

    var CSrequestLog = await CardstreamRequestLog.findOne({
        where: { id: queryStringParameters.RequestLogId }
    });
    let threeDSRef = CSrequestLog.md; //a valid redirect url should have this value, else throw error
    console.log('threeDSRef', { threeDSRef });

    let valid_acs_payload_key = payload.hasOwnProperty('threeDSMethodData')
        ? 'threeDSMethodData'
        : payload.hasOwnProperty('cres')
        ? 'cres'
        : false;
    console.log({ valid_acs_payload_key });
    logger.info(`3dsv2 state debug - performing ${valid_acs_payload_key} `);

    if (!valid_acs_payload_key) {
        throw { message: 'Fields missing' }; //some essentials are missing
    }

    let cs_continuation_request_object =
        valid_acs_payload_key === 'threeDSMethodData'
            ? { threeDSMethodData: payload.threeDSMethodData }
            : valid_acs_payload_key === 'cres'
            ? { cres: payload.cres }
            : {};
    console.log({ cs_continuation_request_object });

    let cs_request = {
        threeDSRef,
        threeDSResponse: cs_continuation_request_object
    };

    cs_request = await objectToQueryString(cs_request);
    console.log('cs_request_final ', cs_request);
    let cs_api_request_signature_required = false;

    // try {
    logger.info('3dsv2 state debug - initiating continuation request');
    var cs_response = await saleHelpers.processCardStreamPayment(
        cs_request,
        cs_default_signature_key,
        cs_api_request_signature_required
    );
    logger.info('3dsv2 state debug - continuation request SUCCESS');
    logger.info(logMetadata, { cs_response });
    // } catch (err) {
    //     logger.info('3dsv2 state debug - continuation request FAILED');
    //     return await EarthBusinessLogic.GetErrorApiResponse({
    //         encryptedPayload,
    //         requestPayload,
    //         requestId,
    //         CSrequestLog,
    //         CatchError: err
    //     });
    // }

    // //bank passes these two values after 3d authentication
    // const q = queryString.parse(event.body, { parseNumbers: true });
    // const payload = {
    //     threeDSMD: q.MD,
    //     threeDSPaRes: q.PaRes
    // };

    // //process cardstream transaction
    // let cs_response = await saleHelpers.processCardStreamPayment(payload, cs_default_signature_key);

    if (
        //further 3ds authentication & continuation request is still required
        cs_response['responseCode'] === CS_RESPONSE_CODE['THREEDS_REQUIRED']
    ) {
        logger.info('3dsv2 state debug - THREEDS_REQUIRED again');
        let api_response;
        if (
            //'creq' is there in the response and 3ds version is still V2
            cs_response['threeDSRequest[creq]'] &&
            cs_response['threeDSVersion'].startsWith('2.')
        ) {
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

            api_response = {
                statusCode: 301,
                headers: {
                    location: `${process.env.MYPAY_FRONTEND_REDIRECT_URL}/omnipay/AcsRedirect/action=creq&creq=${
                        cs_response['threeDSRequest[creq]']
                    }&threeDSURL=${encodeURIComponent(`${cs_response['threeDSURL']}`)}`
                }
            };
            return api_response;
        }
    }

    //if code reaches here, the transaction must be a success one through 3dsV2
    // check if threeDSRef is already processed, in case this request is a duplicate one
    if (cs_response.responseCode === CS_RESPONSE_CODE['THREEDS_REFERENCE_ALREADY_PROCESSED']) {
        //check card_payment table again until we found one entry
        logger.info('3dsv2 state debug - THREEDS_REQUIRED ALREADY_PROCESSED');
        let api_response = {
            statusCode: 301,
            headers: {
                Location: process.env.MYPAY_FRONTEND_REDIRECT_URL + '/redirect/' + encodeURIComponent(redirect_info)
            },
            body: {
                request_id: requestId,
                message: 'success',
                data: {}
            }
        };
        return api_response;
    }

    let sessionInfo = await mypayHelpers.validateSession(
        {
            session_id: cs_response.transactionUnique
        },
        {
            MypayTempTransaction
        }
    ); //temp_transactions based on the id

    let [cardholder_firstname, cardholder_lastname] = `${cs_response.customerName}`.split(' ', 2);
    let metaInfo = await MypayTempTransactionsMeta.findOne({
        where: {
            id: sessionInfo.meta_id
        }
    });

    if (
        cs_response.responseCode === 0 &&
        (cs_response.threeDSAuthenticated === 'Y' || cs_response.threeDSAuthenticated === 'A')
    ) {
        //log response
        let CardstreamTransactioLog = await MypayCardstreamTransactionLog.create({
            action: cs_response.action,
            xref: cs_response.xref,
            raw_response: JSON.stringify(cs_response)
        });

        let userSetting = await Customer.findOne({
            attributes: ['payment_provider', 'business_name'],
            where: {
                id: sessionInfo.customer_id
            },
            raw: true
        });

        let shopperInformation = await MypayShopper.findOne({
            where: {
                id: sessionInfo.shopper_id
            },
            raw: true
        });

        // create an object for transaction
        let transacRef = `tr_${cs_response.xref}`;
        let mydate = new Date();

        const fee_percent = 0;
        const fees = (cs_response.amount * fee_percent) / 10000;
        const payed = cs_response.amount - fees;

        // push the transaction to main transaction table
        await Payment.create({
            customer_id: sessionInfo.customer_id,
            order_id: `MP_${sessionInfo.user_order_ref}`,
            total: (cs_response.amount / 100).toFixed(2),
            fees,
            payed: (payed / 100).toFixed(2),
            firstname: GetCustomerName({ shopperInformation, cardholder_firstname, cardholder_lastname }, 'firstname'),
            lastname: GetCustomerName({ shopperInformation, cardholder_firstname, cardholder_lastname }, 'lastname'),
            email: shopperInformation.email,
            address: shopperInformation.address,
            payment_provider: userSetting.payment_provider,
            correlation_id: CardstreamTransactioLog.dataValues.id,
            CrossReference: sessionInfo.ref,
            VendorTxCode: cs_response.xref,
            TxAuthNo: cs_response.authorisationCode,
            payment_status: 'OK',
            last_4_digits: `${cs_response.cardNumberMask}`.substr(-4),
            day: mydate.getDate(),
            month: mydate.getMonth() + 1,
            week_no: mydate.getWeek(),
            year: mydate.getFullYear(),
            origin: 'Mypay-API',
            method: 'NewCard-3D',
            more_info: JSON.parse(metaInfo?.data)?.from || 'UNKNOWN'
        });

        await MypayTempTransaction.update(
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
        }</b> has been successfully received.<br> <br> Please note your transaction refrence <span style="color: #3869D4; font-weight: 300;"> ${transacRef} </span> </p>`;

        await emailHelpers.sendEmail(
            {
                email: shopperInformation.recipients_email,
                subject: 'Order confirmation',
                message: confirmation_message
            },
            'OMNIPAY'
        );

        //getting redirect url from metaInfo
        let redirect_info = await mypayHelpers.getRedirectInfo({
            metaData: JSON.parse(metaInfo.data),
            sessionInfo,
            transacRef
        });
        redirect_info = Buffer.from(JSON.stringify(redirect_info)).toString('base64');
        let api_response = {
            statusCode: 301,
            headers: {
                Location: process.env.MYPAY_FRONTEND_REDIRECT_URL + '/redirect/' + encodeURIComponent(redirect_info)
            },
            body: {
                request_id: requestId,
                message: 'success',
                data: {}
            }
        };
        console.log({ api_response });
        await sequelize.close();
        return response(api_response.body, api_response.statusCode, api_response.headers);
    } else {
        let api_response = {
            statusCode: 301,
            headers: {
                Location:
                    process.env.MYPAY_FRONTEND_REDIRECT_URL +
                    '/failure/' +
                    encodeURIComponent(
                        `Transaction failed - ${cs_response.responseMessage}-${cs_response.responseCode}`
                    ) +
                    '/' +
                    encodeURIComponent(sessionInfo.ref)
            },
            body: {
                request_id: requestId,
                message: 'success',
                data: {}
            }
        };
        console.log('api_error_response ', api_response);
        await sequelize.close();
        return response(api_response.body, api_response.statusCode, api_response.headers);
    }
    // } catch (e) {
    //     await sequelize.close();
    //     let errorResponse = {
    //         error: {
    //             request_id: requestId,
    //             message: e.message,
    //             type: mypayHelpers.constants.ref_name.ERROR_TYPE
    //         }
    //     };
    //     console.log('Main Exception: ', errorResponse)
    //     return response(errorResponse, 500);
    // }
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
