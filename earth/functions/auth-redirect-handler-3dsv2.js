var { response, saleHelpers, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
// var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
// const { serialize } = require('php-serialize');
//we are updating the provider as 'optomany' since we will update the provider as OPTOMANY here
// const T2S_MERCHANT_PROVIDER = 'OPTOMANY';
let logger = logHelpers.logger;
const { parse } = require('querystring');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

const currentCodeEnv = helpers.getCodeEnvironment();
const PRODUCTION = 'production';
let api_response;
const CS_RESPONSE_CODE = {
    THREEDS_REQUIRED: 65802,
    THREEDS_REFERENCE_ALREADY_PROCESSED: 66848
};
const ORIGIN_3DS_V2 = 'WebForm-CS-3D-V2';

export const redirect = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    var logMetadata = {
        location: 'EarthService ~ redirectV2',
        orderId: '',
        awsRequestId: context.awsRequestId
    };

    var db = await EarthBusinessLogic.getDbConnection();

    const requestId = `reqid_${context.awsRequestId}`;
    try {
        //since this is a form-data submit from external url, we need to parse the query string from body first, that will give object without quoting keys
        //hence make it stringfy to the object with quoting keys
        //then JSON.parse it make a valid json object
        let payload = JSON.parse(JSON.stringify(parse(event.body)));
        console.log({ payload });
        //now read the CSrequestLog reference from the url
        let queryStringParameters = event.queryStringParameters;
        console.log({ queryStringParameters });

        var CSrequestLog = await db.CardstreamRequestLog.findOne({
            where: { id: queryStringParameters.RequestLogId }
        });
        let threeDSRef = CSrequestLog.md; //a valid redirect url should have this value, else throw error
        console.log({ threeDSRef });

        if (!CSrequestLog) {
            //some essentials are missing
            throw {
                message: 'Could not complete this transaction! Please try again'
            };
        }

        //getting the CS signature key
        let csSettigs = await db.CardstreamSettings.findAll({
            attributes: ['name', 'value']
        }).then(function (resultSet) {
            let settings = {};
            resultSet.forEach((resultSetItem) => {
                settings[resultSetItem.name] = resultSetItem.value;
            });
            return settings;
        });

        //couple of thing can happen at this point
        //1. 'threeDSMethodData' comes as part of device finger printing - that requires continuation request (stage-1) with CS to get threeDSRequest[creq]
        //2. 'cres' comes as part of continuation request using 'creq', proceeds for continutation request stage-2
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

        //we need a way to imitate a fallback to 3dsv1 when 3dsv2 requested
        //fallback to 3dsv1 can be triggered in 'stage' env when continuation request payload sent without converting to query parameters
        //hence using a static/hardcoded order_id value to imitate this behaviour, this will be helpful for the qa to test this scenario
        let flag_fallback_to_3dsv1 =
            currentCodeEnv !== PRODUCTION && CSrequestLog.order_id === 1122334455 ? true : false;

        let cs_request = {
            threeDSRef,
            threeDSResponse: cs_continuation_request_object
        };
        console.log({ cs_request });

        cs_request = !flag_fallback_to_3dsv1 ? await EarthBusinessLogic.objectToQueryString(cs_request) : cs_request;
        console.log('cs_request_final ', cs_request);

        //skip CS signature creation in production, as 3dsv2 continuation request works only without signature (as per the initial POC done)
        let cs_api_request_signature_required = !flag_fallback_to_3dsv1 ? false : true;
        console.log({ cs_api_request_signature_required });

        //declaring some additional essentials for later use
        var requestPayload = JSON.parse(CSrequestLog.payload);
        var encryptedPayload = JSON.parse(CSrequestLog.encrypted_payload);
        logMetadata.orderId = requestPayload.order_id;

        let getContinuationRequestStatus = false;
        getContinuationRequestStatus = await EarthBusinessLogic.checkContinuationRequestStatus({
            order_id: requestPayload.order_id,
            merchant_id: requestPayload.merchant_id,
            logMetadata
        });
        if (getContinuationRequestStatus) {
            return await EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
        }

        await db.sequelize.close(); //closing the connection before any third party api call
        console.log(`cs_payload request for debugging~auth-redirect-3dsV2:`, cs_request);
        //need to enclose it with try catch, check the codebase of authredirect
        try {
            logger.info('3dsv2 state debug - initiating continuation request', requestPayload.order_id);
            var cs_response = await saleHelpers.processCardStreamPayment(
                cs_request,
                csSettigs.api_key,
                cs_api_request_signature_required
            );
            logger.info('3dsv2 state debug - continuation request SUCCESS', requestPayload.order_id);
            logger.info(logMetadata, { cs_response });
        } catch (err) {
            logger.info('3dsv2 state debug - continuation request FAILED', requestPayload.order_id);
            return await EarthBusinessLogic.GetErrorApiResponse({
                encryptedPayload,
                requestPayload,
                requestId,
                CSrequestLog,
                CatchError: err
            });
        }

        db = await EarthBusinessLogic.getDbConnection();

        if (
            //further 3ds authentication & continuation request is still required
            cs_response['responseCode'] === CS_RESPONSE_CODE['THREEDS_REQUIRED']
        ) {
            logger.info('3dsv2 state debug - THREEDS_REQUIRED again', requestPayload.order_id);
            api_response = await EarthBusinessLogic.getAcsRedirectApiResponse({
                cs_response,
                CardstreamRequestLog: db.CardstreamRequestLog,
                CardstreamRequestReferenceLog: db.CardstreamRequestReferenceLog,
                queryStringParameters
            });

            await db.sequelize.close();
            if (api_response.statusCode === 301) {
                return api_response; //this is for Frontend
            }
            return response(api_response.body, api_response.statusCode); //this one for api testing
        }

        //if code reaches here, the transaction must be a success one through 3dsV2
        // check if threeDSRef is already processed, in case this request is a duplicate one
        if (cs_response.responseCode === CS_RESPONSE_CODE['THREEDS_REFERENCE_ALREADY_PROCESSED']) {
            //check card_payment table again until we found one entry
            logger.info('3dsv2 state debug - THREEDS_REQUIRED ALREADY_PROCESSED', requestPayload.order_id);
            getContinuationRequestStatus = await EarthBusinessLogic.checkContinuationRequestStatus(
                {
                    order_id: requestPayload.order_id,
                    merchant_id: requestPayload.merchant_id,
                    card_payment_id: CSrequestLog.card_payment_id,
                    logMetadata
                },
                true
            );
            if (getContinuationRequestStatus === true) {
                return await EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
            } else if (
                typeof getContinuationRequestStatus === 'object' &&
                getContinuationRequestStatus.status === 'success'
            ) {
                //this part occurs only when authRedirectHandler been called multiple times (by the browser automatically, or when user hits refresh)
                //in this case, cs_response will be fetched again using txn api
                //therefore, re-assigning the real txn response to cs_response to continue
                cs_response = getContinuationRequestStatus.cs_response;
            }
        }

        db = await EarthBusinessLogic.getDbConnection();

        await helpers.saveTransactionStatus(
            {
                cardStreamResponse: cs_response,
                id: CSrequestLog.card_payment_id
            },
            db.CardStreamResponse,
            db.RiskCheckResponse
        );

        var params = {
            id: CSrequestLog.card_payment_id,
            VendorTxCode: cs_response['transactionUnique'],
            TxAuthNo: cs_response['authorisationCode'],
            CrossReference: cs_response['xref'],
            last_4_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            reason: cs_response['cancelReason'] || cs_response['responseMessage'],
            origin: ORIGIN_3DS_V2,
            merchant_id: requestPayload.merchant_id,
            transaction_mode_id: 2
        };

        if (
            cs_response.responseCode !== 0 ||
            (cs_response.threeDSAuthenticated !== 'Y' && cs_response.threeDSAuthenticated !== 'A')
        ) {
            //something wrong happened with card stream api && send email to customer
            await EarthBusinessLogic.transactionFailedNotify(requestPayload, cs_response);

            //something wrong happened with card stream api
            logger.info('3dsv2 state debug - card stream api something went wrong', requestPayload.order_id);

            return await EarthBusinessLogic.GetErrorApiResponse2({
                encryptedPayload,
                requestPayload,
                requestId,
                cs_response,
                CSrequestLog,
                db,
                logger,
                logMetadata,
                payment_params: params
            });
        }

        //peroform all post success action
        await EarthBusinessLogic.executeSuccessActions({
            requestPayload,
            cs_response,
            CSrequestLog,
            db,
            logger,
            logMetadata,
            payment_params: params
        });

        api_response = await EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
        logger.info(logMetadata, { api_response });
        // sends the http response with status 301 and redirect back to merchant website
        await db.CardstreamRequestLog.update(
            {
                response: JSON.stringify({ api_response })
            },
            {
                where: {
                    id: CSrequestLog.id
                }
            }
        );
        //await transaction.commit();
        await db.sequelize.close();
        return api_response;
    } catch (e) {
        logger.info('3dsv2 state debug - continuation request FAILED');
        console.log({ e });
        return await EarthBusinessLogic.GetErrorApiResponse3({
            encryptedPayload,
            requestPayload,
            requestId,
            CSrequestLog,
            db,
            logger,
            logMetadata,
            CatchError: e,
            payment_params: params
        });
    }
};
