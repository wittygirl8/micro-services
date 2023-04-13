var { response, saleHelpers, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
//we are updating the provider as 'optomany' since we will update the provider as OPTOMANY here
let logger = logHelpers.logger;
const { parse } = require('querystring');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const currentCodeEnv = helpers.getCodeEnvironment();
const PRODUCTION = 'production';

export const redirect = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    let logMetadata = {
        location: 'EarthService ~ redirect',
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

        //check if mandatory parameters are missing
        var mandatoryFields = ['MD', 'PaRes'];
        if (!mandatoryFields.every((prop) => payload.hasOwnProperty(prop))) {
            throw { message: 'Fields missing' };
        }

        //retreive requested payload from log table
        var requestLog = await db.CardstreamRequestLog.findOne({
            where: { md: payload.MD }
        });

        if (!requestLog) {
            throw {
                message: 'Could not complete this transaction! Please try again'
            };
        }
        var requestPayload = JSON.parse(requestLog.payload);
        var encryptedPayload = JSON.parse(requestLog.encrypted_payload);

        logMetadata.orderId = requestPayload.order_id;
        logger.info('3dsv1 state debug - recieved request from ACS', requestPayload.order_id);
        //below line is to crash the application on non prod env when specific order_id 7777777 is passed
        if (currentCodeEnv !== PRODUCTION && requestPayload.total === 7.77) {
            throw new Error('Intentionally crashed the application');
        }

        //getting cs settings
        let csSettigs = await db.CardstreamSettings.findAll({
            attributes: ['name', 'value']
        }).then(function (resultSet) {
            let settings = {};
            resultSet.forEach((resultSetItem) => {
                settings[resultSetItem.name] = resultSetItem.value;
            });
            return settings;
        });

        //closing the db connection to avoid any potential connection timeouts inside checkContinuationRequestStatus()
        await db.sequelize.close();
        //check for idempotency of this acsResponse, so that below things can be preventd,
        //1. the duplicate continuation request to cardstream can be prevented
        //2. showing error message on EG frontend
        let getContinuationRequestStatus = false;
        getContinuationRequestStatus = await EarthBusinessLogic.checkContinuationRequestStatus({
            order_id: requestPayload.order_id,
            merchant_id: requestPayload.merchant_id,
            logMetadata
        });

        if (getContinuationRequestStatus) {
            return EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
        }

        try {
            logger.info('3dsv1 state debug - initiating continuation request', requestPayload.order_id);
            var cs_response = await saleHelpers.processCardStreamPayment(
                {
                    threeDSMD: payload.MD,
                    threeDSPaRes: payload.PaRes
                },
                csSettigs.api_key
            );
            logger.info('3dsv1 state debug - continuation request SUCCESS', requestPayload.order_id);
            logger.info(logMetadata, 'cs_response:', cs_response);
        } catch (err) {
            logger.info('3dsv1 state debug - continuation request FAILED', requestPayload.order_id);
            console.log('cs_response~Postprocessing', err);
            return await EarthBusinessLogic.GetErrorApiResponse({
                encryptedPayload,
                requestPayload,
                requestId,
                CSrequestLog: requestLog,
                CatchError: err
            });
        }

        //check if the MD is already processed one (to avoid multiRedirects/Refreshes to this request)
        if (cs_response.responseCode === 66347) {
            //check card_payment table again until we found one entry
            getContinuationRequestStatus = await EarthBusinessLogic.checkContinuationRequestStatus(
                {
                    order_id: requestPayload.order_id,
                    merchant_id: requestPayload.merchant_id,
                    card_payment_id: requestLog.card_payment_id,
                    logMetadata
                },
                true
            );
            if (getContinuationRequestStatus === true) {
                return EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
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

        console.info('CardPaymentID~RequestLog', requestLog.card_payment_id);
        /* eslint-disable no-redeclare */
        await helpers.saveTransactionStatus(
            {
                cardStreamResponse: cs_response,
                id: requestLog.card_payment_id
            },
            db.CardStreamResponse,
            db.RiskCheckResponse
        );

        var merchantDataPayload = cs_response.merchantData ? JSON.parse(cs_response.merchantData) : '';
        logger.info('merchantDataPayload:~', merchantDataPayload, 'cs_response.responseCode', cs_response.responseCode);
        var params = {
            id: requestLog.card_payment_id,
            VendorTxCode: cs_response['transactionUnique'],
            TxAuthNo: cs_response['authorisationCode'],
            CrossReference: cs_response['xref'],
            last_4_digits: `${cs_response['cardNumberMask']}`.substr(-4),
            reason: cs_response['cancelReason'] || cs_response['responseMessage'],
            origin: 'WebForm-CS-3D',
            merchant_id: requestPayload.merchant_id,
            transaction_mode_id: 2
        };
        logger.info('redirect~params', params);

        if (
            cs_response.responseCode !== 0 ||
            (cs_response.threeDSAuthenticated !== 'Y' && cs_response.threeDSAuthenticated !== 'A')
        ) {
            //something wrong happened with card stream api
            //notify customers for failed transaction
            await EarthBusinessLogic.transactionFailedNotify(requestPayload, cs_response);
            return await EarthBusinessLogic.GetErrorApiResponse2({
                encryptedPayload,
                requestPayload,
                requestId,
                cs_response,
                db,
                logger,
                logMetadata,
                CSrequestLog: requestLog,
                payment_params: params
            });
        }

        //peroform all post success action
        await EarthBusinessLogic.executeSuccessActions({
            requestPayload,
            cs_response,
            db,
            logger,
            logMetadata,
            CSrequestLog: requestLog,
            payment_params: params
        });

        let api_response = EarthBusinessLogic.GetSuccessApiResponse(requestPayload);
        logger.info(logMetadata, { api_response });
        // sends the http response with status 301 and redirect back to merchant website
        await db.CardstreamRequestLog.update(
            {
                response: JSON.stringify({ api_response, response })
            },
            {
                where: {
                    id: requestLog.id
                }
            }
        );
        logger.info(logMetadata, 'api_response', api_response);
        //await transaction.commit();
        await db.sequelize.close();
        return api_response;
    } catch (e) {
        console.log({ e });
        return await EarthBusinessLogic.GetErrorApiResponse3({
            encryptedPayload,
            requestPayload,
            db,
            logger,
            logMetadata,
            cs_response,
            CSrequestLog: requestId,
            CatchError: e,
            payment_params: params
        });
    }
};
