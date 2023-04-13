import AWS from 'aws-sdk';

var { cryptFunctions, logHelpers, helpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const EarthBusinessLogic = require('./earthBusinessLogic');
const currentCodeEnv = helpers.getCodeEnvironment();
const logger = logHelpers.logger;
const RISKCHECK = {
    DECLINE: 'decline',
    APPROVE: 'approve',
    PARTIALLY_MATCH: 'partially matched',
    MATCHED: 'matched'
};
const PRODUCTION = 'production';
const PRE_PROD = 'pre-prod';
let logMetadata = {
    location: 'MasterTokenFunction ~ ',
    orderId: '',
    awsRequestId: ''
};

const { EarthService } = require('../../earth.service');
const earthService = new EarthService();
const { MasterTokenV2Service } = require('../../../../services/messaging/consumer/master-token-v2.service');
const masterTokenV2Service = new MasterTokenV2Service();

export const updateMasterTokenTable = async (params, MasterToken) => {
    try {
        //if master token was provided and billing address was provided by user, so we need to update eg token  in mx table with bill suffix
        // and is_billing to be set to true for both opto and eg token associated with that master token
        const { master_token, card_token, customer_id, avs_token } = params;
        //updating eg tokenn with bill and setting is_billing_address to true for eg
        await MasterToken.update(
            {
                token: `egtoken_${card_token}`,
                avs_token: avs_token,
                is_billing_address: true
            },
            {
                where: {
                    master_token: master_token,
                    customer_id: customer_id,
                    provider: params.payment_provider
                }
            }
        );
        //usetting is_billing_address to true from opto
        await MasterToken.update(
            {
                is_billing_address: true,
                avs_token: avs_token
            },
            {
                where: {
                    master_token: master_token,
                    customer_id: customer_id,
                    provider: 'OPTOMANY'
                }
            }
        );
    } catch (error) {
        logger.info(logMetadata, 'updateMasterTokenTable ', 'error in updateMasterTokenTable');
        return error;
    }
};

export const sendDataQueue = async (payload, cs_response, master_token, requestPayload) => {
    //payload to send to master token handler
    try {
        if (requestPayload.customer_id) {
            const masterTokenPayload = {
                card_number: payload.card_number,
                expiry_month: payload.exp_month,
                expiry_year: payload.exp_year,
                cvv: payload.cvv,
                provider: 'CARDSTREAM',
                provider_token: `egtoken_${cs_response.xref}`,
                is_billing_address: true,
                last_4_digit: `${cs_response.cardNumberMask}`.substr(-4),
                customer_id: String(requestPayload.customer_id),
                other_provider: 'OPTOMANY',
                first_name: requestPayload.first_name,
                last_name: requestPayload.last_name,
                postcode: payload.billing_post_code,
                address: payload.billing_address,
                master_token: master_token,
                merchant_id: String(requestPayload.merchant_id),
                transactionUnique: cs_response.transactionUnique,
                tokenize_optomany: cs_response.currencyCode === 826 ? true : false // as per ND-2894, optomany tokenization should happen only when txn is a GBP
            };

            let encrptedQueueData = cryptFunctions.encryptPayload(
                JSON.stringify(masterTokenPayload),
                process.env.MX_PAYLOAD_ENCRYPTION_KEY
            );

            await earthService.tokeniseCard(encrptedQueueData);
            return true;
        } else {
            logger.info(logMetadata, 'sendDataQueue Else', `Not creating master token, as no customer id provided!`);
            return null;
        }
    } catch (error) {
        logger.error(logMetadata, 'errorResponse SendData Queue', error);
        console.log('error', error);
        return error;
    }
};

export const sendDataQueueAddCard = async (decryptedPayload, hashMasterTokenKeys, requestId) => {
    let logMetadata = {
        location: 'MasterTokenFunction ~ sendDataQueueAddCard',
        requestId
    };
    try {
        if (decryptedPayload.customer_id) {
            console.log('Running sendDataQueueAddCard');
            const masterTokenPayloadCs = {
                type: 2,
                metaData: {
                    card_number: decryptedPayload.card_number,
                    expiry_month: decryptedPayload.exp_month,
                    expiry_year: decryptedPayload.exp_year,
                    cardSchemeId: '',
                    cardSchemeName: '',
                    cardIssuingCountry: '',
                    cvv: decryptedPayload.cvv,
                    provider: 'CARDSTREAM',
                    provider_token: '',
                    is_billing_address: true,
                    last_4_digit: `${decryptedPayload?.card_number.substr(-4)}`,
                    customer_id: String(decryptedPayload.customer_id),
                    postcode: decryptedPayload.billing_post_code,
                    address: decryptedPayload.billing_address,
                    master_token: `mxtoken_${hashMasterTokenKeys}`,
                    merchant_id: String(decryptedPayload.merchant_id),
                    transactionUnique: ''
                },
                gateways: ['CARDSTREAM', 'OPTOMANY']
            };

            let encrptedQueueData = cryptFunctions.encryptPayload(
                JSON.stringify(masterTokenPayloadCs),
                process.env.MX_PAYLOAD_ENCRYPTION_KEY
            );

            await saveCardTokenise(encrptedQueueData);
            return true;
        } else {
            logger.info(logMetadata, 'sendDataQueue Else', `Not creating master token, as no customer id provided!`);
            return null;
        }
    } catch (error) {
        logger.error(logMetadata, 'errorResponse SendData CS Queue', error);
        console.log('error', error);
        return error;
    }
};

export const saveCardTokenise = async (payload) => {
    try {
        console.log('MasterTokenFunction ~ Running saveCardTokenise');
        let options = {};
        let queueUrl = process.env.QUEUE_URL_MASTERTOKEN_V2;

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
            queueUrl = process.env.LOCAL_QUEUE_URL_MASTERTOKEN_V2;
        }
        const sqs = new AWS.SQS(options);

        const objectStringified = JSON.stringify({
            payload
        });

        console.log('Queue Url SQS for Master token V2: ', queueUrl);

        const params = {
            MessageBody: objectStringified,
            QueueUrl: queueUrl
        };
        if (process.env.IS_OFFLINE) {
            await masterTokenV2Service.processMasterToken({ body: objectStringified }, {});
        }
        await sqs.sendMessage(params).promise();
    } catch (error) {
        console.log('QUEUE Error: ' + error);
    }
};

export const shouldTokenize = async (params) => {
    let { cs_response, requestPayload, db } = params;

    const countryInfo = await db.Country.findOne({
        attributes: ['id', 'billing_address_enabled', 'override_tokenisation_over_3ds'],
        include: [
            {
                attributes: ['id'],
                model: db.Customer,
                where: {
                    id: requestPayload.merchant_id
                }
            }
        ],
        raw: true
    });
    countryInfo.billing_address_enabled = parseInt(countryInfo.billing_address_enabled);

    let override_tokenisation_over_3ds = parseInt(countryInfo.override_tokenisation_over_3ds);

    let ThreeDsValidated = cs_response.threeDSAuthenticated === 'Y';
    let CvvMatched = cs_response.cv2Check === RISKCHECK.MATCHED;
    let RiskCheckApproved =
        currentCodeEnv === PRODUCTION || currentCodeEnv === PRE_PROD
            ? cs_response.riskCheck === RISKCHECK.APPROVE
            : true;
    //postcode check is needed only when billing address is enabled
    let PostCodeCheck1 = countryInfo.billing_address_enabled && cs_response.postcodeCheck === RISKCHECK.MATCHED;
    let PostCodeCheck2 = !countryInfo.billing_address_enabled;
    let PostCodeMatched = PostCodeCheck1 || PostCodeCheck2;

    console.log({ countryInfo });
    console.log({ ThreeDsValidated });
    console.log({ CvvMatched });
    console.log({ RiskCheckApproved });
    console.log({ PostCodeCheck1 });
    console.log({ PostCodeCheck2 });
    console.log({ PostCodeMatched });

    return (ThreeDsValidated || override_tokenisation_over_3ds) && CvvMatched && RiskCheckApproved && PostCodeMatched;
};

export const isSavedCard = (requestLog) => {
    return requestLog.handler === 'earth.createTokenSale';
};

export const getErrorUrl = (encryptedPayload, requestPayload, cs_response) => {
    let errObj = {
        errorMessage: EarthBusinessLogic.getFailedErrorMessage(cs_response),
        errorCode: EarthBusinessLogic.getFailedErrorCode(cs_response, requestPayload)
    };
    let reason = encodeURIComponent(JSON.stringify(errObj));
    const base_error_url = `${process.env.EARTH_ENDPOINT}/error/${encodeURIComponent(encryptedPayload.data)}`;
    let error_url = encryptedPayload ? base_error_url : '';
    if (requestPayload.base64Data) {
        error_url = `${base_error_url}/${encodeURIComponent(requestPayload.base64Data)}`;
    }
    if (cs_response.cv2Check || cs_response.postcodeCheck || cs_response.responseCode) {
        error_url += `?reason=${reason}`;
    }
    return error_url;
};

export const getProvider = async (params, Customer) => {
    try {
        console.log(params);
        let providers = ['CARDSTREAM', 'CARDSTREAM-CH'];

        var { payment_provider } = await Customer.findOne({
            where: { id: params.merchant_id }
        });

        if (providers.includes(payment_provider)) {
            return payment_provider;
        } else {
            return 'CARDSTREAM';
        }
    } catch (error) {
        logger.info(logMetadata, 'authredirect~getprovidermx ', 'error in getting provider');
        return error;
    }
};
