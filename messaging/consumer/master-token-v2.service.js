import AWS from 'aws-sdk';
const crypto = require('crypto');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { cryptFunctions, schema, logHelpers, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const messagingBussinessLogic = require('./logic/messagingBussinessLogic');
const processCsVerify = require('./logic/cardstream-process');
const { serialize } = require('php-serialize');
let logger = logHelpers.logger;
const currentCodeEnv = helpers.getCodeEnvironment();
const arrayProductionEnvValues = ['production', 'pre-prod'];
const parseURL = require('querystring');
var FormData = require('form-data');

export class MasterTokenV2Service {
    async masterToken(event) {
        const promises = event.Records.map((message) => {
            return this.processMasterToken(message);
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async postProcessMessage(executions) {
        const hasAtLeastOneError = executions.some((result) => result.success === false);

        if (hasAtLeastOneError) {
            let options = {};

            if (process.env.IS_OFFLINE) {
                options = {
                    apiVersion: '2012-11-05',
                    region: 'localhost',
                    endpoint: 'http://0.0.0.0:9324',
                    sslEnabled: false
                };
            }
            const sqs = new AWS.SQS(options);

            const processSuccesItems = executions.filter((result) => result.success === true);

            for (let successMsg of processSuccesItems) {
                const params = {
                    QueueUrl: process.env.QUEUE_URL,
                    ReceiptHandle: successMsg.event.receiptHandle
                };

                try {
                    await sqs.deleteMessage(params).promise();
                } catch (error) {
                    // Do nothing, need to make the code idempotent in such case
                }
            }

            // For errors, lambda instance will not be available till visisibility timeout expires
            const processErrorItemsMsgIds = executions
                .filter((result) => result.success === false)
                .map((result) => result.event.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        } else {
            return { success: true };
        }
    }

    async processMasterToken(event, context = {}) {
        try {
            let logMetadata = {
                location: 'MasterTokenV2Service ~ processMasterToken ~',
                awsRequestId: context.awsRequestId
            };

            const db = connectDB(
                process.env.DB_HOST,
                process.env.DB_DATABASE,
                process.env.DB_USERNAME,
                process.env.DB_PASSWORD,
                process.env.IS_OFFLINE
            );
            var { sequelize, MasterToken } = db;

            let { payload } = JSON.parse(event.body);

            var reqParams = cryptFunctions.decryptPayload(payload, process.env.MX_PAYLOAD_ENCRYPTION_KEY);
            try {
                reqParams = await schema.masterTokenV2Consumer.validateAsync(JSON.parse(reqParams));
            } catch (e) {
                let payload_log = Object.assign({}, reqParams);
                reqParams.type !== 1 &&
                    (payload_log.metaData.card_number = `${'*'.repeat(payload_log.metaData.card_number.length - 4)}
                    ${payload_log.metaData.card_number.substr(payload_log.metaData.card_number.length - 4)}`);
                payload_log.metaData.expiry_month = `${'*'.repeat(payload_log.metaData.expiry_month.length)}`;
                payload_log.metaData.expiry_year = `${'*'.repeat(payload_log.metaData.expiry_year.length)}`;
                reqParams.type !== 1 && (payload_log.metaData.cvv = `${'*'.repeat(payload_log.metaData.cvv.length)}`);
                let errorResponse = {
                    error: {
                        awsRequestId: context.awsRequestId,
                        type: 'error',
                        message: e.message,
                        body: payload_log
                    }
                };

                logger.error(logMetadata, 'errorResponse', errorResponse);

                sequelize.close && (await sequelize.close());
                return { event, success: false };
            }

            logger.info(logMetadata, 'Transaction Unique', reqParams.metaData.transactionUnique);

            //find data from master token table with master token and provider (provided in payload by host lamda)
            var currentProvider = await MasterToken.findOne({
                attributes: ['id'],
                where: {
                    master_token: reqParams.metaData.master_token,
                    provider: reqParams.metaData.provider,
                    customer_id: reqParams.metaData.customer_id
                }
            });
            logger.info(logMetadata, 'CurrentProvider Data in DB', currentProvider);

            var avs_token = serialize([
                {
                    AvsHouseNumber: reqParams.metaData.address ? reqParams.metaData.address : '',
                    AvsPostcode: reqParams.metaData.postcode ? reqParams.metaData.postcode : ''
                }
            ]);
            logger.info(logMetadata, 'AVS Token', avs_token);

            if (reqParams.type === 1) {
                // process DNA or Checkout HF
                await messagingBussinessLogic.modifyMasterToken(
                    currentProvider,
                    reqParams.metaData,
                    avs_token,
                    MasterToken
                );
            } else if (reqParams.type === 2) {
                // process CardStream and Optomany
                for (let i = 0; i < reqParams.gateways.length; i++) {
                    if (reqParams.gateways[i] === 'CARDSTREAM') {
                        reqParams.metaData.provider = 'CARDSTREAM';
                        reqParams.metaData.provider_token = await this.cardStreamTokenisation(
                            db,
                            reqParams.metaData,
                            context.awsRequestId
                        );

                        logger.info(
                            logMetadata,
                            'Processing tokenization for type2 from Master token v2 service for CS'
                        );

                        let exist = await processCsVerify.alreadyExist(db, reqParams);

                        if (reqParams?.metaData?.provider_token) {
                            await messagingBussinessLogic.processCsProvider(
                                exist,
                                reqParams.metaData,
                                avs_token,
                                MasterToken
                            );
                        } else {
                            logger.error(
                                logMetadata,
                                'error happened while adding details to db for CS',
                                'provider_token not generated!!'
                            );
                        }
                    } else if (reqParams.gateways[i] === 'OPTOMANY') {
                        let checkTokenFromCs = await this.cardStreamTokenisation(
                            db,
                            reqParams.metaData,
                            context.awsRequestId
                        );

                        if (checkTokenFromCs) {
                            reqParams.metaData.provider = 'OPTOMANY';
                            reqParams.metaData.provider_token = await this.optomanyTokenisation(
                                reqParams.metaData,
                                context.awsRequestId
                            );

                            logger.info(
                                logMetadata,
                                'Processing tokenization for type2 from Master token v2 service for OPTO'
                            );

                            let exist = await processCsVerify.alreadyExist(db, reqParams);

                            if (reqParams?.metaData?.provider_token) {
                                await messagingBussinessLogic.processCsProvider(
                                    exist,
                                    reqParams.metaData,
                                    avs_token,
                                    MasterToken
                                );
                            } else {
                                logger.error(
                                    logMetadata,
                                    'error happened while adding details to db for OPTO',
                                    'provider_token not generated!!'
                                );
                            }
                        }
                    }
                }
            }

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (e) {
            logger.error(logMetadata, 'MasterTokenV2Service ~ processMasterTokenError', e);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }

    async cardStreamTokenisation(dbInstanse, metaData, awsRequestId) {
        let logMetadata = {
            location: 'MasterTokenServiceV2 ~ cardStreamTokenisation',
            awsRequestId: awsRequestId
        };

        try {
            let response = await processCsVerify.getCsVerify(dbInstanse, metaData, {
                parseNumbers: true
            });

            if (
                (response?.cv2Check === 'matched' && response?.postcodeCheck === 'matched') ||
                response?.responseCode === 0
            ) {
                return 'egtoken_' + response['xref'];
            } else {
                logger.info(logMetadata, '~ MasterTokenServiceV2 ~ cardStreamTokenisationError ~ ', response);
                return false;
            }
        } catch (error) {
            logger.error(logMetadata, '~ MasterTokenServiceV2 ~ cardStreamTokenisationError ~ ', error);
            return error;
        }
    }

    async optomanyTokenisation(metaData, awsRequestId) {
        let logMetadata = {
            location: 'MasterTokenServiceV2 ~ optomanyTokenisation',
            awsRequestId: awsRequestId
        };

        return new Promise((resolve, reject) => {
            try {
                logger.info(logMetadata, 'currentCodeEnv', currentCodeEnv);
                logger.info(logMetadata, 'arrayProductionEnvValues', arrayProductionEnvValues);
                logger.info(
                    logMetadata,
                    'arrayProductionEnvValues.includes(currentCodeEnv)',
                    arrayProductionEnvValues.includes(currentCodeEnv)
                );

                if (!arrayProductionEnvValues.includes(currentCodeEnv)) {
                    //In non-production environments, as we could not tokenize a CARDSTREAM card, responding back with a dummy opto token
                    //this dummy one can be replaced with a valid opto test card token if needed
                    resolve('opto_stage_token');
                }

                var merchantStoreID = process.env.MERCHANT_STOREID_OPTO;
                var MerchantSignatureKeyId = process.env.MERCHANT_SIGNATUREKEY_ID_OPTO;
                var CountryId = process.env.COUNTRY_ID_OPTO;
                var MerchantDepartmentId = process.env.MERCHANT_DEPARTMENTID_OPTO;

                var params = {
                    Reference: Math.floor(Math.random() * 99999999999) + 1,
                    ReturnUrl: '',
                    MerchantStoreId: merchantStoreID,
                    MerchantDepartmentId: MerchantDepartmentId,
                    MerchantSignatureKeyId: MerchantSignatureKeyId,
                    CountryId: CountryId,
                    CardCollectionId: 1,
                    Tokenize: true
                };

                //optoReq is generated as a serialized collection of key pairs. Key name and value separated by a field separator character (0x1C) and these key pairs are separated by a pipe (|).
                var OptoReqPayload = '';
                for (var iterator in params) {
                    OptoReqPayload += iterator + String.fromCharCode(28) + params[iterator] + '|';
                }

                OptoReqPayload = OptoReqPayload.slice(0, -1);
                var OptoReqPayloadBase = Buffer.from(OptoReqPayload).toString('base64');

                //use the MerchantSignatureKey against the OptoReq to create a SHA256 HMAC digital signature, OptoHmac.
                var hmac = crypto.createHmac('sha256', process.env.MERCHANT_SIGNATUREKEY_OPTO);

                //passing the data to be hashed
                var OptoHmac = hmac.update(OptoReqPayload).digest('base64');
                logger.info(logMetadata, 'OptoHmac : ', OptoHmac);
                logger.info(logMetadata, 'OptoReqPayloadBase: ', OptoReqPayloadBase);
                var form = new FormData();
                form.append('Pan', metaData?.card_number);
                form.append('ExpiryMM', metaData?.expiry_month);
                form.append('ExpiryYY', metaData?.expiry_year);
                form.append('Cvv', metaData?.cvv);
                form.append('OptoReq', OptoReqPayloadBase);
                form.append('OptoHmac', OptoHmac);

                form.submit(process.env.OPTOMANY_GATEWAY_URL, function (err, res) {
                    //console.log('Opto response Encypted data: ', res);
                    if (err) {
                        logger.error(logMetadata, 'Opto response error: ', err);
                        reject(err);
                    }
                    try {
                        var obj = parseURL.parse(res.headers.location);
                        var optoResponse = obj[Object.keys(obj)[0]];
                        logger.info(logMetadata, 'optoResponse : ', optoResponse);

                        //decoding optomany response
                        let buff = Buffer.from(optoResponse, 'base64');
                        let decodedText = buff.toString('ascii');

                        //spliting it from bar and forming an array
                        var decodedByBar = decodedText.split('|');
                        var cardData = {};
                        for (var i = 0; i < decodedByBar.length; i++) {
                            var temp = decodedByBar[i].split(String.fromCharCode(28));
                            cardData[temp[0]] = temp[1];
                        }
                        resolve(cardData.MerchantTokenId);
                        return cardData.MerchantTokenId;
                    } catch (error) {
                        logger.error(logMetadata, 'Error occured while tokenizing for OPTO', error);
                    }
                });
            } catch (error) {
                logger.error(logMetadata, '~ MasterTokenServiceV2 ~ optomanyTokenisationError ~ ', error);
                reject(error);
            }
        });
    }
}
