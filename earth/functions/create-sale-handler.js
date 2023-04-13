var { response, schema, cryptFunctions, saleHelpers, helpers, logHelpers, splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
const mxFn = require('./logic/masterTokenFunction');
const moment = require('moment-timezone');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const ni = require('nanoid');
const valid = require('card-validator');
const TIMEZONE = 'europe/london';
//we are updating the provider as 'optomany', as with t2s side, we are disclose the latest provider with them, and they are always gonna call the OPTOMANY endpoint
const T2S_MERCHANT_PROVIDER = 'OPTOMANY';
const crypto = require('crypto');
const currentCodeEnv = helpers.getCodeEnvironment();
let logger = logHelpers.logger;
let logMetadata = {
    location: 'EarthService ~ createSale',
    orderId: '',
    awsRequestId: ''
};
const RISKCHECK = {
    DECLINE: 'decline'
};
const PRODUCTION = 'production';
var { EarthService } = require('../earth.service');

const earthService = new EarthService();
export const createSale = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }

    logMetadata.awsRequestId = context.awsRequestId;
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        var db = await EarthBusinessLogic.getDbConnection();
        var t2sDb = await EarthBusinessLogic.getT2SDbConnection();

        var t2s_sequelize = t2sDb.sequelize;
        //var transaction = await db.sequelize.transaction();

        var payload = JSON.parse(event.body);
        const csPayloadEncData = cryptFunctions.encryptPayload(event.body, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        var kountSessionID = payload.session_id;
        if (!kountSessionID) {
            kountSessionID = ni.nanoid(32);
            logger.info(logMetadata, 'kountSessionID', kountSessionID, kountSessionID.length);
        }

        try {
            payload = await schema.createSaleSchema.validateAsync(payload); //sanitization
        } catch (e) {
            let payload_log = Object.assign({}, payload);
            payload_log.card_number = `${'*'.repeat(
                payload_log.card_number.length - 4
            )}${payload_log.card_number.substr(payload_log.card_number.length - 4)}`;
            payload_log.exp_month = `${'*'.repeat(payload_log.exp_month.length)}`;
            payload_log.exp_year = `${'*'.repeat(payload_log.exp_year.length)}`;
            payload_log.cvv = `${'*'.repeat(payload_log.cvv.length)}`;
            let errorResponse = {
                error: {
                    request_id: requestId,
                    type: 'error',
                    message: e.message,
                    body: payload_log
                }
            };

            logger.error(logMetadata, 'errorResponse', errorResponse);
            //update request log saying its error
            RequestLogId
                ? await db.CardstreamRequestLog.update(
                      {
                          response: JSON.stringify(errorResponse)
                      },
                      { where: { id: RequestLogId.id } }
                  )
                : null;
            //await transaction.rollback();

            await db.sequelize.close();
            await t2s_sequelize.close();

            return response({ errorResponse }, 500);
        }

        const numberValidation = valid.number(payload.card_number);

        const isInValidCard =
            !numberValidation.isValid ||
            !valid.expirationMonth(payload.exp_month).isValid ||
            !valid.expirationYear(payload.exp_year).isValid ||
            !valid.cvv(payload.cvv, numberValidation.card.code.size).isValid;
        if (isInValidCard) {
            throw new Error('Invalid Card');
        }

        payload.data = payload.data.replace(/&response.*$/i, '');
        let encrptedPayload = cryptFunctions.decryptPayload(payload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        encrptedPayload = JSON.parse(encrptedPayload);
        if (encrptedPayload.mode === 'phone_payment') {
            encrptedPayload = await schema.egPhonePaymentPayloadSchema.validateAsync(encrptedPayload); //sanitization
        } else {
            encrptedPayload = await schema.egPayloadSchema.validateAsync(encrptedPayload); //sanitization
        }
        //on top of the joi validation, we do some additional validation with regards to split payload
        await splitFeeHelpers.ValidateSplitFeePayload({db, payload: encrptedPayload})


        logMetadata.orderId = encrptedPayload.order_id;
        logger.info('3dsv2 state debug - Initial Sale initiated', encrptedPayload.order_id);

        payload = {
            ...encrptedPayload,
            card_number: payload.card_number,
            exp_month: payload.exp_month,
            exp_year: payload.exp_year,
            cvv: payload.cvv,
            save_card: payload.save_card,
            base64Data: payload.base64Data,
            billing_address: payload.billing_address,
            billing_post_code: payload.billing_post_code,
            same_as_delivery_address: payload.same_as_delivery_address,
            deviceInfo: payload?.deviceInfo
        };

        //since we are logging the request payload in db, need to mask the card details as part of pci_dss compliance
        let payload_log = Object.assign({}, payload);
        payload_log.card_number = `${'*'.repeat(payload_log.card_number.length - 4)}${payload_log.card_number.substr(
            payload_log.card_number.length - 4
        )}`;
        payload_log.exp_month = `${'*'.repeat(payload_log.exp_month.length)}`;
        payload_log.exp_year = `${'*'.repeat(payload_log.exp_year.length)}`;
        payload_log.cvv = `${'*'.repeat(payload_log.cvv.length)}`;
        logger.info(logMetadata, 'payload_log', payload_log);

        //logging the api request
        var RequestLogId = await db.CardstreamRequestLog.create({
            order_id: JSON.stringify(payload_log.order_id),
            payload: JSON.stringify(payload_log),
            encrypted_payload: JSON.stringify({ data: JSON.parse(event.body).data }),
            handler: 'earth.createSale'
        });

        //get tier id this merchant belongs to
        var { fee_tier_id, cardstream_id, threeds_version } = await db.Customer.findOne({
            where: { id: payload.merchant_id }
        });

        let requestObj = { order_id: `${payload.order_id}`, merchant_id: payload.merchant_id };
        console.log(requestObj, 'Inputs');
        let PaymentRecords = await EarthBusinessLogic.getPaymentRecords(
            requestObj,
            db.Customer,
            db.Payment,
            db.Payments
        );
        let paidStatus = false;
        console.log({ PaymentRecords });
        PaymentRecords.map((record) => {
            let payment_status = record.transaction_status_id ? record.transaction_status_id : record.payment_status;
            let validateStatusArr = [1, 'OK'];
            if (validateStatusArr.includes(payment_status)) {
                paidStatus = true;
            }
        });

        //if true, throw error message
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
            method: payload.mode == 'phone_payment' ? 'WebForm-CS-phone' : 'NewCard',
            transaction_method_id: payload.mode == 'phone_payment' ? 3 : 1, //1=>NewCard
            transaction_mode_id: 1
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

        //concat card number(starting 6 digit and last 4 digit), card expiry date and cvv to generate a unique key which will be called master token
        var masterTokenKeys = {
            card_number: payload.card_number,
            exp_month: payload.exp_month,
            exp_year: payload.exp_year
        };

        //hashed the concatenated string, this will be master token
        const hashMasterTokenKeys = crypto.createHash('md5').update(JSON.stringify(masterTokenKeys)).digest('hex');

        // prepare cs params
        let cs_payload = EarthBusinessLogic.getInitialCsRequestPayload({
            payload,
            total_amount,
            cardstream_id,
            countryInfo,
            hashMasterTokenKeys,
            csPayloadEncData,
            kountSessionID,
            paymentRef
        });

        if (payload.mode == 'phone_payment') {
            cs_payload = {
                ...cs_payload,
                ...EarthBusinessLogic.setMotoInfo(payload)
            };
        } else if (threeds_version === '2') {
            //populate more fields
            cs_payload = {
                ...cs_payload,
                ...EarthBusinessLogic.set3dsv2Info({ RequestLogId, payload, event })
            };
        }
        await db.sequelize.close();
        await t2s_sequelize.close();
        // console.log({cs_payload})
        try {
            let cs_payload_log = { ...cs_payload };
            cs_payload_log.cardNumber = '';
            cs_payload_log.cardExpiryMonth = '';
            cs_payload_log.cardCVV = '';
            cs_payload_log.cardExpiryYear = '';

            console.log(`cs_payload request for debugging~create-sale-handler`, cs_payload_log);
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

        logger.info('PaymentRef.id', paymentRef, paymentRef.id);

        await helpers.saveTransactionStatus(
            {
                cardStreamResponse: cs_response,
                id: paymentRef.id
            },
            db.CardStreamResponse,
            db.RiskCheckResponse
        );

        // logger.info(logMetadata, 'Check now 3d or non 3D', cs_response);

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

        if (cs_response['responseCode'] === 65802) {
            //getting 3ds Version
            let cs_threeDS_version_supported = EarthBusinessLogic.getCsThreeDsVersion(cs_response);
            console.log({ cs_threeDS_version_supported });

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
                            },
                            RequestLogId: RequestLogId.id, //adding this parameter in the response only for some api testing dependencies (ND-2859). Frontend does'nt need this
                            order_id: encrptedPayload?.order_id
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

            //3dsV1 flow
            let ThreeDS_response = {
                statusCode: 201,
                body: {
                    request_id: requestId,
                    message: 'The request was processed successfully',
                    data: {
                        success: '3d',
                        threeDSreq: {
                            acsUrl: cs_response['threeDSACSURL'] || cs_response['threeDSURL'],
                            md: cs_response['threeDSMD'] || cs_response['threeDSRequest[MD]'],
                            paReq: cs_response['threeDSPaReq'] || cs_response['threeDSRequest[PaReq]'],
                            termUrl: process.env.EARTH_API_ENDPOINT + '/sale/redirect'
                        },
                        order_id: encrptedPayload?.order_id
                    }
                }
            };
            logger.info(logMetadata, 'ThreeDS_response', ThreeDS_response);

            //await transaction.commit();
            await db.sequelize.close();
            await t2s_sequelize.close();

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
                { where: { id: RequestLogId.id } }
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
            logger.error(logMetadata, "cs_response['responseCode'] !== 0", errorResponse);
            await db.sequelize.close();
            await t2s_sequelize.close();
            return response({ errorResponse }, 500);
        }

        //transaction is non-3d secure and is success
        //update card_payment table

        let shouldTokenize = await mxFn.shouldTokenize({
            cs_response,
            requestPayload: payload,
            db
        });

        console.log('shouldTokenize', shouldTokenize);

        if (payload.save_card && payload.customer_id && shouldTokenize ) {
            //keeping the card token with datman
            await db.CardstreamTokenLog.upsert({
                token: cs_response['xref'],
                customer_id: payload.customer_id,
                last_four_digits: `${cs_response['cardNumberMask']}`.substr(-4),
                card_scheme: cs_response['cardScheme'],
                card_issuer: cs_response['cardIssuer'],
                is_deleted: 'NO'
            });
            await mxFn.sendDataQueue(
                payload,
                cs_response,
                `mxtoken_${hashMasterTokenKeys}`,
                payload
            )
        }

        let requestJson = {
            VendorTxCode: cs_response['transactionUnique'],
            TxAuthNo: cs_response['authorisationCode'],
            CrossReference: cs_response['xref'],
            payment_status: 'OK',
            last_4_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            origin: 'WebForm-CS',
            card_payment_id: paymentRef.id,
            merchant_id: payload.merchant_id
        };

        await EarthBusinessLogic.updateSalePayments(requestJson, payload,  db);

        //using transaction caused some db issues, hence disabling it, need to do more investigation on this

        //Now call the webhook url passed on encrypted values
        //prepare the t2s payload to send based on card remember

        let t2sPayload;
        if (payload.save_card && payload.customer_id && shouldTokenize) {
            t2sPayload = {
                transaction_id: paymentRef.id,
                customer_id: payload.customer_id,
                provider: T2S_MERCHANT_PROVIDER,
                token: `mxtoken_${hashMasterTokenKeys}`,
                last_4_digits: `${cs_response.cardNumberMask}`.substr(-4),
                expiry_date: cs_response.cardExpiryDate,
                card_type: cs_response.cardType,
                one_click: 'YES',
                is_primary: 'YES',
                order_info_id: payload.order_id,
                amount: total_amount,
                reference: payload.reference
            };
        } else {
            t2sPayload = {
                transaction_id: paymentRef.id,
                customer_id: payload.customer_id,
                order_info_id: payload.order_id,
                amount: total_amount,
                reference: payload.reference
            };
        }
        
        if(payload?.split_fee?.length){
            let SplitStatusNotifyPayload = await splitFeeHelpers.GetSplitNotifyPayload({
                db,
                order_id : payload.order_id
            })
            console.log({SplitStatusNotifyPayload})
            t2sPayload['SplitFeeStatus'] = SplitStatusNotifyPayload
        }

        logger.info(logMetadata, `Webhook url ${payload.webhook_url}`);
        logger.info(logMetadata, `webhook url type ${typeof payload.webhook_url}`);
        logger.info(logMetadata, `order_id  ${payload.order_id}`);

        if (payload.webhook_url && payload.webhook_url !== 'undefined') {
            delete payload.card_number;
            delete payload.exp_month;
            delete payload.exp_year;
            delete payload.cvv;

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

        //give success response back
        let redirectUrl =
            payload.hasOwnProperty('redirect_url') && payload.redirect_url !== ''
                ? payload.redirect_url
                : 'https://' + payload.host + '/payment.php?simple=1&bSuccess&id=' + payload.order_id;
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
            { where: { id: RequestLogId.id } }
        );
        logger.info(logMetadata, 'api_response', api_response);
        //await transaction.commit();
        // sends the http response with status 200
        await db.sequelize.close();
        await t2s_sequelize.close();

        return response(api_response);
    } catch (e) {
        //In case of error data should not be printed as it will have sensitive details

        logger.error(logMetadata, 'ErrorResponse', e);

        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };

        logger.error(logMetadata, 'errorResponse', errorResponse);
        //update request log saying its error
        RequestLogId
            ? await db.CardstreamRequestLog.update(
                  {
                      response: JSON.stringify(errorResponse)
                  },
                  { where: { id: RequestLogId.id } }
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
        //await transaction.rollback();

        await db.sequelize.close();
        await t2s_sequelize.close();

        return response({ errorResponse }, 500);
    }
};
