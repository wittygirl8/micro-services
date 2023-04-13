const EarthBusinessLogic = require('./logic/earthBusinessLogic');
var { EarthService } = require('../../earth/earth.service');
const earthService = new EarthService();
const crypto = require('crypto');
var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

let logger = logHelpers.logger;

export const addCard = async (event, context) => {
    AWSXRay.capturePromise();

    const requestId = `reqid_${context.awsRequestId}`;

    let logMetadata = {
        location: 'EarthService ~ addCard',
        awsRequestId: requestId
    };

    let db = await EarthBusinessLogic.getDbConnection();
    const { MasterToken, AddCardRequestLog } = db;

    try {
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {});
        }

        let payload = JSON.parse(event.body);

        let bufferObjj = Buffer.from(payload.data, 'base64');
        let decryptedPayload = JSON.parse(bufferObjj.toString('utf8'));

        try {
            //Will run only if these 3 info are available
            if (decryptedPayload.card_number && decryptedPayload.exp_month && decryptedPayload.exp_year) {
                //creating unique master token
                var masterToken = {
                    card_number: decryptedPayload.card_number,
                    exp_month: decryptedPayload.exp_month,
                    exp_year: decryptedPayload.exp_year
                };

                //hashing the token
                var hashMasterTokenKeys = crypto.createHash('md5').update(JSON.stringify(masterToken)).digest('hex');

                let addCardLog = Object.assign({}, decryptedPayload);
                addCardLog.card_number = `${String(addCardLog.card_number).slice(-4)}`;
                addCardLog.exp_month = `${'*'.repeat(addCardLog.exp_month.length)}`;
                addCardLog.exp_year = `${'*'.repeat(addCardLog.exp_month.length)}`;

                logger.info(logMetadata, 'add card request log', addCardLog);

                //logging  the request
                await AddCardRequestLog.upsert({
                    ref_id: requestId,
                    merchant_id: decryptedPayload?.merchant_id,
                    gateway: 'CARDSTREAM',
                    request_data: JSON.stringify(addCardLog)
                });

                let params = {
                    decryptedPayload,
                    requestId,
                    hashMasterTokenKeys
                };
                // Post success executions
                await EarthBusinessLogic.executeSaveCardSuccessActions({
                    ...params
                });

                let api_response = await EarthBusinessLogic.GetCardVerifySuccessApiResponse(decryptedPayload);

                const isTokenAlreadyExist = await MasterToken.findOne({
                    attributes: ['id'],
                    where: {
                        customer_id: decryptedPayload?.customer_id,
                        last_4_digit: decryptedPayload?.card_number.substr(-4)
                    }
                });

                logger.info(logMetadata, 'isTokenAlreadyExist', isTokenAlreadyExist);

                if (decryptedPayload.webhook_url) {
                    if (!isTokenAlreadyExist) {
                        const t2sPayload = {
                            transaction_id: decryptedPayload?.order_id,
                            customer_id: decryptedPayload?.customer_id,
                            order_info_id: decryptedPayload?.order_id,
                            amount: '0',
                            reference: `mxtoken_${hashMasterTokenKeys}`
                        };

                        if (process.env.IS_OFFLINE) {
                            await earthService.notifyT2SSubscriberDirect(
                                decryptedPayload,
                                t2sPayload,
                                decryptedPayload?.order_id,
                                logMetadata.awsRequestId
                            );
                        } else {
                            let orderId = {
                                order_id: decryptedPayload?.order_id
                            };
                            await earthService.notifyT2SSubscriber(
                                orderId,
                                t2sPayload,
                                decryptedPayload?.order_id,
                                logMetadata.awsRequestId
                            );
                        }
                    } else {
                        logger.info(logMetadata, 'Token already exist, hence not notifying t2s');
                    }
                } else {
                    logger.info(logMetadata, `webhook_url not found hence not notifying t2s`);
                }

                logger.info(logMetadata, 'API Response :  ', api_response);
                await db.sequelize.close();

                //Returning the final api response
                return response(api_response);
            } else return response('Invalid card details provided.');
        } catch (err) {
            //Removing sensitive info as always
            err.data ? (err.data = '') : '';
            err.config && err.config.data ? (err.config.data = '') : '';

            const errorResponse = {
                error: {
                    request_id: requestId,
                    type: 'error',
                    message: err.message
                }
            };

            logger.error(logMetadata, 'errorResponse', errorResponse);
            await db.sequelize.close();

            return response({ errorResponse }, 500);
        }
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };
        console.log('~ addCard ~ verifying add card CS ~ ', e);

        logger.error(logMetadata, 'errorResponse', errorResponse);
        await db.sequelize.close();

        //Returning error response
        return response({ errorResponse }, 500);
    }
};
