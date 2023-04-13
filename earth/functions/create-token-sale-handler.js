var { response, schema, cryptFunctions, saleHelpers, helpers, splitFeeHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const mxFn = require('./logic/masterTokenFunction');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
const { serialize, unserialize } = require('php-serialize');
const moment = require('moment-timezone');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const currentCodeEnv = helpers.getCodeEnvironment();
const ni = require('nanoid');
const valid = require('card-validator');
const TIMEZONE = 'europe/london';
const RISKCHECK = {
    DECLINE: 'decline'
};
let logger = logHelpers.logger;
const PRODUCTION = 'production';
var { EarthService } = require('../earth.service');

const earthService = new EarthService();

export const createTokenSale = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ createTokenSale',
        orderId: '',
        awsRequestId: context.awsRequestId
    };

    var db = await EarthBusinessLogic.getDbConnection();
    var t2sDb = await EarthBusinessLogic.getT2SDbConnection();

    var t2s_sequelize = t2sDb.sequelize;
    //const transaction = await db.sequelize.transaction();
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        var payload = JSON.parse(event.body);
        console.log({ payload });
        var kountSessionID = payload.session_id;
        if (!kountSessionID) {
            kountSessionID = ni.nanoid(32);
            logger.info(logMetadata, 'kountSessionID', kountSessionID, kountSessionID.length);
        }
        payload = await schema.createTokenSaleSchema.validateAsync(payload);

        const isInValidCvv = !valid.cvv(payload.cvv).isValid;
        if (isInValidCvv) {
            throw new Error('Invalid CVV number');
        }

        let encrptedPayload = cryptFunctions.decryptPayload(payload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        encrptedPayload = await schema.egPayloadSchema.validateAsync(JSON.parse(encrptedPayload));
        await splitFeeHelpers.ValidateSplitFeePayload({db, payload: encrptedPayload})

        logMetadata.orderId = encrptedPayload.order_id;
        logger.info('3dsv2 state debug - Initial Sale initiated for saved card', encrptedPayload.order_id);

        payload = {
            ...encrptedPayload,
            card_token: payload.card_token,
            cvv: payload.cvv,
            base64Data: payload.base64Data,
            master_token: payload.master_token,
            billing_address: payload.billing_address,
            billing_post_code: payload.billing_post_code,
            deviceInfo: payload?.deviceInfo
        };

        //since we are logging the request payload in db, need to mask the card details as part of pci_dss compliance
        let payload_log = Object.assign({}, payload);
        payload_log.cvv = `${'*'.repeat(payload_log.cvv.length)}`;
        var RequestLogId = await db.CardstreamRequestLog.create({
            order_id: JSON.stringify(payload_log.order_id),
            payload: JSON.stringify(payload_log),
            encrypted_payload: JSON.stringify({ data: JSON.parse(event.body).data }),
            handler: 'earth.createTokenSale'
        });

        //check order already paid with card_payment table
        let requestObj = { order_id: `${payload.order_id}`, merchant_id: payload.merchant_id };
        console.log(requestObj, 'Inputs');
        let PaymentRecords = await EarthBusinessLogic.getPaymentRecords(
            requestObj,
            db.Customer,
            db.Payment,
            db.Payments
        );
        let paidStatus = false;
        console.log(PaymentRecords, 'Payments Records');
        PaymentRecords.map((record) => {
            let payment_status = record.transaction_status_id ? record.transaction_status_id : record.payment_status;
            let validateStatusArr = [1, 'OK'];
            if (validateStatusArr.includes(payment_status)) {
                paidStatus = true;
            }
        });

        if (paidStatus) {
            throw { message: 'Payment already done' };
        }

        let payload_total = payload.total.toFixed(2);
        let order_info_total;
        if (payload.db_total) {
            //if total to be read from T2S db, retreive the details
            let [t2s_order_info] = await t2s_sequelize.query(
                `SELECT * FROM order_info WHERE id=${payload.order_id} LIMIT 1`
            );
            t2s_order_info = t2s_order_info[0];
            if (typeof t2s_order_info !== 'undefined') {
                order_info_total = parseFloat(t2s_order_info.total);
                order_info_total = order_info_total.toFixed(2);
                if (payload_total !== order_info_total) {
                    logger.info(
                        logMetadata,
                        `Order amount mismatch between payload and order_info ${t2s_order_info.id} => ${payload_total} != ${order_info_total}`
                    );
                }
            } else {
                logger.info(logMetadata, `Order id could not be found  - ${payload.order_id}`);
            }
        }

        let total_amount = payload.db_total ? (order_info_total ? order_info_total : payload_total) : payload_total;

        //get tier id this merchant belongs to
        var { fee_tier_id, cardstream_id, threeds_version } = await db.Customer.findOne({
            where: { id: payload.merchant_id }
        });

        //get fee percentage and fixed fee from tier table
        var { percentage_fee, fixed_fee } = await db.Tier.findOne({
            where: { id: fee_tier_id }
        });

        percentage_fee = percentage_fee / 100;

        let fee = await helpers.roundOfInteger(total_amount * Number(percentage_fee) + Number(fixed_fee));

        let net_amount = (total_amount - fee).toFixed(2);

        var paymentRefObj = {
            customer_id: payload.merchant_id,
            firstname: payload.first_name,
            lastname: payload.last_name,
            address: payload.address,
            email: payload.email,
            total: total_amount,
            fees: fee.toFixed(2),
            payed: net_amount,
            provider: payload.provider,
            payment_status: 'UNTRIED',
            payment_provider: 'CARDSTREAM',
            order_id: payload.order_id,
            day: moment().tz(TIMEZONE).format('D'),
            week_no: moment().tz(TIMEZONE).format('W'),
            month: moment().tz(TIMEZONE).format('M'),
            year: moment().tz(TIMEZONE).format('YYYY'),
            ip_address: event?.requestContext?.identity?.sourceIp
                ? event?.requestContext?.identity?.sourceIp
                : '0.0.0.0',
            method: 'CardOnFile',
            transaction_method_id: 2, //CardOnFile-Form
            transaction_mode_id: 1 //NON-3DS
        };

        var paymentRef = await EarthBusinessLogic.createPaymentEntry({
            payload,
            paymentRefObj,
            db
        });

        //below line is to crash the application on non prod env when specific amount 77 is passed
        if (currentCodeEnv !== PRODUCTION && payload.total === 77) {
            throw new Error('Intentionally crashed the application');
        }

        const countryInfo = await db.Country.findOne({
            attributes: ['id', 'iso_country_code', 'iso_currency_code'],
            include: [
                {
                    attributes: ['id'],
                    model: db.Customer,
                    where: {
                        id: payload.merchant_id
                    }
                }
            ],
            raw: true
        });

        //do cardstream transaction
        //getting cardstream related settings
        let csSettigs = await db.CardstreamSettings.findAll({
            attributes: ['name', 'value']
        }).then(function (resultSet) {
            let settings = {};
            resultSet.forEach((resultSetItem) => {
                settings[resultSetItem.name] = resultSetItem.value;
            });
            return settings;
        });
        const masterTokenInfo = await db.MasterToken.findOne({
            attributes: ['id', 'avs_token', 'master_token', 'is_billing_address'],
            where: {
                master_token: payload.master_token,
                provider: 'CARDSTREAM',
                customer_id: payload.customer_id
            }
        });
        logger.info(logMetadata, 'masterTokenInfo', masterTokenInfo);
        let avs_billing_address = payload.billing_address;
        let avs_postal_code = payload.billing_post_code;
        if (masterTokenInfo && masterTokenInfo.is_billing_address) {
            logger.info(logMetadata, 'is_billing_address', masterTokenInfo.is_billing_address);
            const unserializeAvsToken = unserialize(masterTokenInfo.avs_token);
            logger.info(logMetadata, 'unserializeAvsToken', unserializeAvsToken);
            avs_billing_address = unserializeAvsToken[0].AvsHouseNumber || payload.billing_address;
            avs_postal_code = unserializeAvsToken[0].AvsPostcode || payload.billing_post_code;
        }

        // prepare params
        let cs_payload = EarthBusinessLogic.getInitialCsRequestPayloadToken({
            payload,
            total_amount,
            csSettigs,
            cardstream_id,
            countryInfo,
            kountSessionID,
            paymentRef,
            avs_billing_address,
            avs_postal_code
        });

        if (threeds_version === '2') {
            cs_payload = {
                ...cs_payload,
                ...EarthBusinessLogic.set3dsv2Info({ RequestLogId, payload, event })
            };
        }

        await db.sequelize.close();
        await t2s_sequelize.close();
        // console.log({ cs_payload });
        console.log(`cs_payload request for debugging~Token sale:`, cs_payload);
        try {
            var cs_response = await saleHelpers.processCardStreamPayment(cs_payload, csSettigs.api_key);
            cs_response = JSON.parse(JSON.stringify(cs_response));
            console.log({ cs_response });
        } catch (err) {
            // Overwriting data to avoid printing of sensitive data
            err.data ? (err.data = '') : '';
            err.config && err.config.data ? (err.config.data = '') : '';
            logger.error(logMetadata, 'ErrorResponse', err);

            let errorResponse = {
                error: {
                    request_id: requestId,
                    type: 'error',
                    message: err.message
                }
            };
            return response({ errorResponse }, 500);
        }
        db = await EarthBusinessLogic.getDbConnection();

        await helpers.saveTransactionStatus(
            {
                cardStreamResponse: cs_response,
                id: paymentRef.id
            },
            db.CardStreamResponse,
            db.RiskCheckResponse
        );

        logger.info(logMetadata, 'cs_response', cs_response);

        let errorCode = EarthBusinessLogic.getFailedErrorCode(cs_response, payload);
        let failedMessage = EarthBusinessLogic.getFailedErrorMessage(cs_response);

        var params = {
            id: paymentRef.id,
            VendorTxCode: cs_response['transactionUnique'],
            TxAuthNo: cs_response['authorisationCode'],
            CrossReference: cs_response['xref'],
            last_4_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            reason: cs_response['cancelReason'] || cs_response['responseMessage'],
            origin: 'WebForm-CS',
            merchant_id: payload.merchant_id
        };

        let cs_threeDS_version_supported = EarthBusinessLogic.getCsThreeDsVersion(cs_response);
        //if 3d, throw 3d response back for authentication
        if (cs_response['responseCode'] === 65802) {
            await EarthBusinessLogic.update3dsInprogress({
                db,
                card_payment_id: paymentRef.id,
                card_payment_params: params,
                RequestLogId: RequestLogId.id,
                cs_response
            });

            if (cs_threeDS_version_supported === 'v2') {
                //3ds v2 flow
                //threeDSRef to store somewhere
                console.log({ here: cs_response['threeDSRequest[threeDSMethodData]'] });
                let ThreeDSV2_response = {
                    statusCode: 201,
                    body: {
                        request_id: requestId,
                        message: 'The request was processed successfully',
                        data: {
                            success: '3dsV2',
                            threeDSreq: {
                                threeDSURL: cs_response['threeDSURL']
                            }
                        }
                    }
                };
                //this happens when 3dsv2 device fingerprinting
                if (cs_response.hasOwnProperty('threeDSRequest[threeDSMethodData]')) {
                    ThreeDSV2_response.body.data['showIframe'] = false;
                    ThreeDSV2_response.body.data.threeDSreq['threeDSMethodData'] =
                        cs_response['threeDSRequest[threeDSMethodData]'];
                }
                //this happens when 3dsv2 requires CHALLENGE
                if (cs_response.hasOwnProperty('threeDSRequest[creq]')) {
                    ThreeDSV2_response.body.data['showIframe'] = true;
                    ThreeDSV2_response.body.data.threeDSreq['creq'] = cs_response['threeDSRequest[creq]'];
                }

                logger.info(logMetadata, 'ThreeDSV2_response', ThreeDSV2_response);

                //await transaction.commit();
                await db.sequelize.close();
                await t2s_sequelize.close();

                return response(ThreeDSV2_response.body, ThreeDSV2_response.statusCode);
            }

            let ThreeDS_response = {
                statusCode: 201,
                body: {
                    request_id: requestId,
                    message: 'The request was processed successfully',
                    data: {
                        success: '3d',
                        threeDSreq: {
                            acsUrl: cs_response['threeDSACSURL'],
                            md: cs_response['threeDSMD'],
                            paReq: cs_response['threeDSPaReq'],
                            termUrl: process.env.EARTH_API_ENDPOINT + '/sale/redirect'
                        }
                    }
                }
            };

            //await transaction.commit();
            await db.sequelize.close();
            await t2s_sequelize.close();
            logger.info(logMetadata, 'ThreeDS_response', ThreeDS_response);
            return response(ThreeDS_response.body, ThreeDS_response.statusCode);
        } else if (cs_response['responseCode'] !== 0) {
            //something wrong happened with card stream api
            let errorResponse = {
                error: {
                    request_id: requestId,
                    message: errorCode,
                    failedMessage: failedMessage,
                    type: 'PAYMENT_FAILED'
                }
            };
            //Notify customer via email
            await EarthBusinessLogic.transactionFailedNotify(payload, cs_response);

            await db.CardstreamRequestLog.update(
                {
                    response: JSON.stringify(errorResponse)
                },
                { where: { id: RequestLogId.dataValues.id } }
            );
            if (
                cs_response['vcsResponseCode'] === 5 ||
                (cs_response['responseCode'] === 5 && cs_response['riskCheck'] !== RISKCHECK.DECLINE)
            ) {
                //according to docs vcsResponseCode : 5 is VSC error
                await EarthBusinessLogic.updatePaymentStatus(
                    {
                        ...params,
                        payment_status: 'DECLINE'
                    },
                    db.Payment,
                    db.Payments,
                    db.Customer,
                    db.TransactionStatuses
                );
            } else if (
                cs_response['responseCode'] === 5 &&
                cs_response['riskCheck'] &&
                cs_response['riskCheck'] === RISKCHECK.DECLINE
            ) {
                // if risk check not equal to approve -> risk check declined
                logger.error(logMetadata, "cs_response['riskCheck']", cs_response['riskCheck']);
                params.reason = 'risk check declined';
                await EarthBusinessLogic.updatePaymentStatus(
                    {
                        ...params,
                        payment_status: 'RISK-CHECK-DECLINE'
                    },
                    db.Payment,
                    db.Payments,
                    db.Customer,
                    db.TransactionStatuses
                );
            } else {
                await EarthBusinessLogic.updatePaymentStatus(
                    {
                        ...params,
                        payment_status: 'FAILED'
                    },
                    db.Payment,
                    db.Payments,
                    db.Customer,
                    db.TransactionStatuses
                );
            }
            await db.sequelize.close();
            await t2s_sequelize.close();
            logger.error(logMetadata, "cs_response['responseCode'] !== 0", errorResponse);
            return response({ errorResponse }, 500);
        }

        //update card_payment table with payment status
        let requestJson = {
            VendorTxCode: cs_response.transactionUnique,
            TxAuthNo: cs_response.authorisationCode,
            CrossReference: cs_response.xref,
            payment_status: 'OK',
            last_4_digits: `${cs_response.cardNumberMask}`.substr(-4),
            origin: 'WebForm-CS',
            card_payment_id: paymentRef.id,
            merchant_id: payload.merchant_id
        };

        logger.info('requestJson~', requestJson);

        await EarthBusinessLogic.updateSalePayments(requestJson, payload, db);

        const avs_token = serialize([
            {
                AvsHouseNumber: avs_billing_address,
                AvsPostcode: avs_postal_code
            }
        ]);
        //update master token table
        !!payload.master_token &&
            (await mxFn.updateMasterTokenTable(
                {
                    master_token: payload.master_token,
                    card_token: cs_response.xref,
                    avs_token: avs_token,
                    customer_id: payload.customer_id
                },
                db.MasterToken
            ));
        //Now call the webhook url passed on encrypted values
        //prepare the t2s payload to send
        const t2sPayload = {
            transaction_id: paymentRef.id,
            customer_id: payload.customer_id,
            order_info_id: payload.order_id,
            amount: total_amount,
            reference: payload.reference
        };
        if(payload?.split_fee?.length){
            let SplitStatusNotifyPayload = await splitFeeHelpers.GetSplitNotifyPayload({
                db,
                order_id : payload.order_id
            })
            console.log({SplitStatusNotifyPayload})
            t2sPayload['SplitFeeStatus'] = SplitStatusNotifyPayload
        }
        if (payload.webhook_url) {
            if (process.env.IS_OFFLINE) {
                await earthService.notifyT2SSubscriberDirect(
                    payload,
                    t2sPayload,
                    paymentRef.id,
                    logMetadata.awsRequestId
                );
            } else {
                await earthService.notifyT2SSubscriber(payload, t2sPayload, paymentRef.id, logMetadata.awsRequestId);
            }
        } else {
            logger.info(logMetadata, `Order id: ${payload.order_id}, Webhook url missing with T2S payload`);
        }

        let redirectUrl =
            payload.hasOwnProperty('redirect_url') && payload.redirect_url !== ''
                ? payload.redirect_url
                : 'https://' + payload.host + '/payment.php?simple=1&bSuccess&id=' + payload.order_id;
        //give success response back
        let api_response = {
            request_id: requestId,
            message: 'The request was processed successfully',
            data: {
                success: 'ok',
                redirectUrl
            }
        };

        //cardstream transaction log update with payload and response
        await db.CardstreamRequestLog.update(
            {
                response: JSON.stringify({ api_response, response }),
                card_payment_id: paymentRef.id,
                transaction_type: 'NON-3D'
            },
            { where: { id: RequestLogId.dataValues.id } }
        );
        logger.info(logMetadata, 'api_response', api_response);
        // sends the http response with status 200
        //await transaction.commit();
        await db.sequelize.close();
        await t2s_sequelize.close();

        return response(api_response);
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };
        //logging request with error response
        RequestLogId
            ? await db.CardstreamRequestLog.update(
                  {
                      response: JSON.stringify(errorResponse)
                  },
                  { where: { id: RequestLogId.dataValues.id } }
              )
            : null;

        paymentRef &&
            (await EarthBusinessLogic.updatePaymentStatus(
                {
                    ...params,
                    reason: e.message,
                    id: paymentRef.id,
                    payment_status: 'ERROR'
                },
                db.Payment,
                db.Payments,
                db.Customer,
                db.TransactionStatuses
            ));
        logger.error(logMetadata, 'errorResponse', errorResponse);
        //await transaction.rollback();
        await db.sequelize.close();
        await t2s_sequelize.close();

        return response({ errorResponse }, 500);
    }
};

/* //prepare payload to send
const t2sPayload = {
    action          :   'payment_success',
    order_id        :   payload.order_id,
    transaction_id  :   paymentRef.id
}
//secret key need to  be taken from db table //for now taking from env.
const encryptedT2SPayload =  cryptFunctions.encryptPayload(JSON.stringify(t2sPayload), process.env.SWITCH_PAYLOAD_ENCRYPTION_KEY);
let webhookResLog;
if(payload.webhook_url){

    webhookResLog = await axios.post(payload.webhook_url, {encryptedT2SPayload});
    await WebhookLog.create({
        action              : 'payment_success',
        card_payment_id     : paymentRef.id,
        webhook_url         : payload.webhook_url,
        payload             : JSON.stringify(t2sPayload),
        encrypted_payload   : encryptedT2SPayload,
        http_response_code  : webhookResLog.status
    })
}else {
    const payload_data = {
        order_info_id    : payload.order_id,
        amount      : total_amount
    }

    //const cs_mode = event.requestContext.stage === 'prod' ? 'live': 'test'
    let currentCodeEnv= helpers.getCodeEnvironment(event)
    webhookResLog =  await saleHelpers.notifyT2SAboutOrder(payload_data,currentCodeEnv);

    await WebhookLog.create({
        action              :'payment_success-api_call',
        webhook_url         : webhookResLog.url,
        card_payment_id     : paymentRef.id,
        payload             : JSON.stringify(payload_data),
        http_response_code  : webhookResLog.response.status
    });
} */

//Now we need to connect t2s db and do the update order_info table
/* await saleHelpers.updateT2SOrder(
      {
        order_id: payload.order_id,
        merchant_id: payload.merchant_id,
        type: t2s_order_info.sending,
        timezone: TIMEZONE,
      },
      t2s_sequelize
    ); */
