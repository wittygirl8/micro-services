import AWS from 'aws-sdk';
const axios = require('axios');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
var { cryptFunctions, schema, logHelpers, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const messagingBussinessLogic = require('./logic/messagingBussinessLogic');
const crypto = require('crypto');
const queryString = require('query-string');
const parseURL = require('querystring');
var FormData = require('form-data');
const valid = require('card-validator');
const { serialize } = require('php-serialize');
let logger = logHelpers.logger;
const currentCodeEnv = helpers.getCodeEnvironment();
const arrayProductionEnvValues = ['production', 'pre-prod'];

export class MasterTokenService {
    async mastertoken(event) {
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
                location: 'MasterTokenService ~ processMasterToken ~',
                awsRequestId: context.awsRequestId
            };

            const db = connectDB(
                process.env.DB_HOST,
                process.env.DB_DATABASE,
                process.env.DB_USERNAME,
                process.env.DB_PASSWORD,
                process.env.IS_OFFLINE
            );
            var { sequelize, MasterToken, Customer } = db;

            let { payload } = JSON.parse(event.body);

            var reqParams = cryptFunctions.decryptPayload(payload, process.env.MX_PAYLOAD_ENCRYPTION_KEY);

            try {
                reqParams = await schema.masterTokenConsumer.validateAsync(JSON.parse(reqParams));
            } catch (e) {
                let payload_log = Object.assign({}, reqParams);

                payload_log.card_number = `${'*'.repeat(
                    payload_log.card_number.length - 4
                )}${payload_log.card_number.substr(payload_log.card_number.length - 4)}`;
                payload_log.exp_month = `${'*'.repeat(payload_log.exp_month.length)}`;
                payload_log.exp_year = `${'*'.repeat(payload_log.exp_year.length)}`;
                payload_log.cvv = `${'*'.repeat(payload_log.cvv.length)}`;
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

            const isInValidCard =
                !valid.number(reqParams.card_number).isValid ||
                !valid.expirationMonth(reqParams.expiry_month).isValid ||
                !valid.expirationYear(reqParams.expiry_year).isValid ||
                !valid.cvv(reqParams.cvv).isValid;
            if (isInValidCard) {
                throw new Error('Invalid Card');
            }

            logger.info(logMetadata, 'Transaction Unique', reqParams.transactionUnique);

            let payment_provider = await messagingBussinessLogic.getProvider(
                { merchant_id: reqParams.merchant_id, payment_provider: reqParams.provider },
                Customer
            );

            logger.info(logMetadata, 'PaymentProvider~', payment_provider);
            //find data from master token table with master token and provider (provided in payload by host lamda)
            var currentProvider = await MasterToken.findOne({
                attributes: ['id'],
                where: {
                    master_token: reqParams.master_token,
                    provider: payment_provider,
                    customer_id: reqParams.customer_id
                }
            });
            console.log('CurrentProvider Data in DB: ' + currentProvider);

            var avs_token = serialize([
                {
                    AvsHouseNumber: reqParams.address ? reqParams.address : '',
                    AvsPostcode: reqParams.postcode ? reqParams.postcode : ''
                }
            ]);

            //if no data found against for this provider against this master token, then generate one and insert in table
            if (!currentProvider) {
                await MasterToken.create({
                    master_token: reqParams.master_token,
                    provider: payment_provider,
                    token: reqParams.provider_token,
                    last_4_digit: reqParams.last_4_digit,
                    customer_id: reqParams.customer_id,
                    avs_token: avs_token,
                    is_billing_address: reqParams.is_billing_address
                });
            } else {
                await MasterToken.update(
                    {
                        token: reqParams.provider_token,
                        avs_token: avs_token,
                        is_billing_address: reqParams.is_billing_address
                    },
                    {
                        where: {
                            master_token: reqParams.master_token,
                            provider: reqParams.provider,
                            customer_id: reqParams.customer_id
                        }
                    }
                );
            }

            var otherProvider = await MasterToken.findOne({
                attributes: ['id'],
                where: {
                    master_token: reqParams.master_token,
                    provider: reqParams.other_provider,
                    customer_id: reqParams.customer_id
                }
            });

            logger.info(logMetadata, '~ processMasterToken ~ OtherProvider Data in DB: ', otherProvider);
            otherProvider &&
                (await MasterToken.update(
                    {
                        avs_token: avs_token,
                        is_billing_address: reqParams.is_billing_address
                    },
                    {
                        where: {
                            master_token: reqParams.master_token,
                            provider: reqParams.other_provider,
                            customer_id: reqParams.customer_id
                        }
                    }
                ));
            let other_provider_token;
            //if no data found against for other provider against this master token, then generate one and insert in table
            if (!otherProvider) {
                //functions helps in regestring card data in provider system and provide token
                if (reqParams.other_provider == 'CARDSTREAM' || reqParams.other_provider == 'CARDSTREAM-CH') {
                    other_provider_token = await this.cardStreamTokenisation(event);
                } else if (reqParams.other_provider == 'OPTOMANY') {
                    if (reqParams.tokenize_optomany === false) {
                        //if optomany tokenization not required, stop the execution here
                        sequelize.close && (await sequelize.close());
                        return { event, success: true };
                    }

                    other_provider_token = await this.optomanyTokenisation(event);
                    console.log('other_provider_token', other_provider_token);
                }

                if (other_provider_token) {
                    if (!otherProvider) {
                        await MasterToken.create({
                            master_token: reqParams.master_token,
                            provider: reqParams.other_provider,
                            token: other_provider_token,
                            last_4_digit: reqParams.last_4_digit,
                            customer_id: reqParams.customer_id,
                            avs_token: avs_token,
                            is_billing_address: reqParams.is_billing_address
                        });
                    } else {
                        await MasterToken.update(
                            {
                                token: other_provider_token,
                                avs_token: avs_token,
                                is_billing_address: reqParams.is_billing_address
                            },
                            {
                                where: {
                                    master_token: reqParams.master_token,
                                    provider: reqParams.other_provider,
                                    customer_id: reqParams.customer_id
                                }
                            }
                        );
                    }
                } else {
                    logger.info(logMetadata, 'other_provider_token was not succesful');
                    sequelize.close && (await sequelize.close());
                    return { event, success: false };
                }
            }

            sequelize.close && (await sequelize.close());
            return { event, success: true };
        } catch (e) {
            console.log('~ MasterTokenService ~ processMasterTokenError ~ ', e);
            sequelize.close && (await sequelize.close());
            return { event, success: false };
        }
    }

    async cardStreamTokenisation(event) {
        let logMetadata = {
            location: 'MasterTokenService ~ cardStreamTokenisation'
        };
        try {
            let { payload } = JSON.parse(event.body);
            var reqParams = cryptFunctions.decryptPayload(payload, process.env.MX_PAYLOAD_ENCRYPTION_KEY);
            reqParams = JSON.parse(reqParams);
            const db = connectDB(
                process.env.DB_HOST,
                process.env.DB_DATABASE,
                process.env.DB_USERNAME,
                process.env.DB_PASSWORD,
                process.env.IS_OFFLINE
            );

            var { sequelize, CardstreamSettings, Country, Customer } = db;

            //getting cardstream related settings
            let csSettigs = await CardstreamSettings.findAll({
                attributes: ['name', 'value']
            }).then(function (resultSet) {
                let settings = {};
                resultSet.forEach((resultSetItem) => {
                    settings[resultSetItem.name] = resultSetItem.value;
                });
                return settings;
            });

            var { cardstream_id } = await Customer.findOne({
                where: { id: reqParams.merchant_id }
            });

            const countryInfo = await Country.findOne({
                attributes: ['id', 'iso_country_code', 'iso_currency_code'],
                include: [
                    {
                        attributes: ['id'],
                        model: Customer,
                        where: {
                            id: reqParams.merchant_id
                        }
                    }
                ],
                raw: true
            });

            sequelize.close && (await sequelize.close());

            var signature = csSettigs.api_key;

            if (reqParams.first_name) {
                reqParams.first_name = reqParams.first_name.replace(/[^a-zA-Z ]/g, '');
            }

            if (reqParams.last_name) {
                reqParams.last_name = reqParams.last_name.replace(/[^a-zA-Z ]/g, '');
            }

            let cs_payload = {
                action: 'VERIFY',
                amount: 0,
                merchantID: cardstream_id,
                type: 1,
                currencyCode: countryInfo.iso_currency_code,
                countryCode: countryInfo.iso_country_code,
                cardNumber: reqParams.card_number,
                cardExpiryMonth: reqParams.expiry_month,
                cardExpiryYear: reqParams.expiry_year,
                cardCVV: reqParams.cvv,
                customerName: `${reqParams.first_name} ${reqParams.last_name}`,
                customerPostCode: reqParams.postcode,
                customerAddress: reqParams.address,
                transactionUnique: reqParams.transactionUnique,
                duplicateDelay: 1,
                threeDSRequired: 'N',
                riskCheckRequired: 'N'
            };
            // get the keys in the object
            var items = Object.keys(cs_payload);

            var string = '';

            // sort the array of keys
            items.sort();

            // for each key loop over in order
            items.forEach(function (item) {
                string += item + '=' + encodeURIComponent(cs_payload[item]) + '&';
            });

            // remove the trailing &
            string = string.slice(0, -1);

            // below replaces are to ensure the escaping is the same as php's http_build_query()
            string = string.replace(/\(/g, '%28');
            string = string.replace(/\)/g, '%29');
            string = string.replace(/%20/g, '+');

            // make the new string
            cs_payload =
                string +
                '&signature=' +
                crypto
                    .createHash('SHA512')
                    .update(string + signature)
                    .digest('hex');

            var cardStreamTokenRequest = {
                url: 'https://gateway.cardstream.com/direct/',
                method: 'POST',
                data: cs_payload
            };

            try {
                let axiosData = await axios(cardStreamTokenRequest);
                let response = queryString.parse(axiosData.data, { parseNumbers: true });
                logger.info(logMetadata, 'MasterTokenService  ~ response ', response);

                if (response.responseCode == 0) {
                    return 'egtoken_' + response['xref'];
                } else {
                    logger.info(logMetadata, '~ MasterTokenService ~ cardStreamTokenisationError ~ ', response);
                    return false;
                }
            } catch (err) {
                // Overwriting data to avoid printing of sensitive data
                err.data ? (err.data = '') : '';
                err.config && err.config.data ? (err.config.data = '') : '';
                logger.error(logMetadata, '~ MasterTokenService ~ cardStreamTokenisationError ~ ', err);

                return err;
            }
        } catch (error) {
            logger.error(logMetadata, '~ MasterTokenService ~ cardStreamTokenisationError ~ ', error);
            return error;
        }
    }

    async optomanyTokenisation(event) {
        return new Promise((resolve, reject) => {
            try {
                console.log({ currentCodeEnv });
                console.log({ arrayProductionEnvValues });
                console.log(
                    'arrayProductionEnvValues.includes(currentCodeEnv)',
                    arrayProductionEnvValues.includes(currentCodeEnv)
                );

                if (!arrayProductionEnvValues.includes(currentCodeEnv)) {
                    //In non-production environments, as we could not tokenize a CARDSTREAM card, responding back with a dummy opto token
                    //this dummy one can be replaced with a valid opto test card token if needed
                    resolve('opto_stage_token');
                }
                let { payload } = JSON.parse(event.body);
                var reqParams = cryptFunctions.decryptPayload(payload, process.env.MX_PAYLOAD_ENCRYPTION_KEY);

                reqParams = JSON.parse(reqParams);

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
                console.log('OptoHmac : ' + OptoHmac);
                console.log('OptoReqPayloadBase: ', OptoReqPayloadBase);
                var form = new FormData();
                form.append('Pan', reqParams.card_number);
                form.append('ExpiryMM', reqParams.expiry_month);
                form.append('ExpiryYY', reqParams.expiry_year);
                form.append('Cvv', reqParams.cvv);
                form.append('OptoReq', OptoReqPayloadBase);
                form.append('OptoHmac', OptoHmac);

                form.submit(process.env.OPTOMANY_GATEWAY_URL, function (err, res) {
                    //console.log('Opto response Encypted data: ', res);
                    if (err) {
                        console.log(err);
                        reject(err);
                    }
                    var obj = parseURL.parse(res.headers.location);
                    var optoResponse = obj[Object.keys(obj)[0]];

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
                });
            } catch (error) {
                console.log('~ MasterTokenService ~ optomanyTokenisationError ~ ', error);
                reject(error);
            }
        });
    }
}
