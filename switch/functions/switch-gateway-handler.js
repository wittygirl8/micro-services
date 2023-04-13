var { response, schema, cryptFunctions, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');

const EG_TOKEN_PREFIX = 'egtoken_';
const merchant_ids_amount_restriction_excluded = ['63177571', '663159719', '663159685'];
const moment = require('moment-timezone');
let providerMarkDObj = {};
let logger = logHelpers.logger;
let logMetadata = {
    location: 'SwitchService ~ switchGatewayHandler',
    awsRequestId: ''
};

export const switchGateway = async (event, context) => {
    logMetadata.awsRequestId = context.awsRequestId;

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    var { sequelize, GatewayRequestLog, Payment, Customer, Country, PaymentProviders, MasterToken } = db;

    const requestId = context.awsRequestId;
    try {
        //read the encrypted payload and validate it
        let encryptedPayload = event.queryStringParameters;
        encryptedPayload = await schema.encryptedDataSchema.validateAsync(encryptedPayload);

        let decryptedPayload = cryptFunctions.decryptPayload(
            encryptedPayload.data,
            process.env.SWITCH_PAYLOD_ENCRYPTION_KEY
        );
        decryptedPayload = JSON.parse(decryptedPayload);

        //explaination -  definatly needed
        if (
            !decryptedPayload.merchant_id ||
            !decryptedPayload.order_id ||
            !decryptedPayload.customer_id ||
            !decryptedPayload.provider ||
            !decryptedPayload.host
        ) {
            logger.error(logMetadata, 'Some Keys are missing', JSON.stringify(decryptedPayload));
            return response(
                {
                    message: 'failed',
                    err: 'mandatory keys are missing merchant_id,order_id, customer_id, provider, host '
                },
                500
            );
        }

        if (decryptedPayload.Amount) {
            decryptedPayload.Amount = Math.round(decryptedPayload.Amount * 100) / 100;
        }

        let { order_id, merchant_id } = decryptedPayload;

        //logging the api request
        await GatewayRequestLog.create({
            order_id: parseInt(order_id),
            merchant_id: parseInt(merchant_id),
            gateway: 'SWITCH-GATEWAY',
            request_data: JSON.stringify({
                decrypted_data: JSON.stringify(decryptedPayload),
                encrypted_data: JSON.stringify(encryptedPayload)
            }),
            path_script: 'payment/switch-gateway-handler.js'
        });

        if (
            decryptedPayload.Amount > 100 &&
            !merchant_ids_amount_restriction_excluded.includes(decryptedPayload.merchant_id)
        ) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'text/html'
                },
                body: `<center><h2 style='margin-top:50px;'>Payment Declined!</h2></center>`
            };
        }

        let providerResponse = '';

        //get merchant info
        let merchantInfo = await Customer.findOne({
            attributes: ['payment_provider'],
            where: { id: merchant_id }
        });

        //Setting payment provider attached with the merchant
        let payment_provider = merchantInfo.payment_provider;

        //For checking Mark down will apply only for opto and cardstream
        let markdown_allowed_provider = ['OPTOMANY', 'CARDSTREAM'];

        logger.info(logMetadata, 'Merchant Info', JSON.stringify(merchantInfo));
        let common_payload = {
            host: decryptedPayload.host,
            order_id: decryptedPayload.order_id,
            provider: decryptedPayload.provider,
            customer_id: decryptedPayload.customer_id,
            merchant_id: decryptedPayload.merchant_id
        };

        //payload to be passed in every helper function
        var params = { common_payload, decryptedPayload, Country, Customer, Payment };

        //Checking provider is allowed for mark down status check
        if (markdown_allowed_provider.includes(payment_provider)) {
            //Check whether provider is active
            let ActiveProviders = await PaymentProviders.findAll({
                attributes: ['provider_status', 'provider_name']
            });

            ActiveProviders.forEach((element) => {
                providerMarkDObj[element.provider_name] = element.provider_status;
            });
            logger.info(
                logMetadata,
                'Markdown Status',
                `${payment_provider} Provider is:${providerMarkDObj[payment_provider]}`
            );

            //If provider not active, set the provider which is live at the moment
            if (providerMarkDObj[payment_provider] == 'OFF') {
                for (var key in providerMarkDObj) {
                    if (providerMarkDObj[key] == 'ON') {
                        payment_provider = key;
                        break;
                    }
                }
            }
        }

        logger.info(logMetadata, 'Active Final Payment Provider', payment_provider);
        //if the payload contains a saved card token, then check which provider it belongs to and redirect to proper provider

        if (decryptedPayload.token && decryptedPayload.last4Digits) {
            logger.info(logMetadata, 'Saved Card Sale');
            if (decryptedPayload.token.split('_')[0] === 'egtoken') {
                if (providerMarkDObj['CARDSTREAM'] == 'ON') {
                    logger.info(logMetadata, 'Inside EG gateway direct eg token');
                    payment_provider = 'CARDSTREAM';
                    providerResponse = await chooseProvider(payment_provider, params, false);
                } else if (providerMarkDObj['OPTOMANY'] == 'ON') {
                    payment_provider = 'OPTOMANY';
                    logger.info(logMetadata, 'Inside EG gateway direct eg token but new sale from opto');
                    providerResponse = await chooseProvider(payment_provider, params);
                } else {
                    payment_provider = 'CARDSTREAM';
                    logger.info(logMetadata, 'Both Gateway are OFF in direct eg token');
                    providerResponse = await chooseProvider(payment_provider, params, false);
                }
            } else if (decryptedPayload.token.split('_')[0] === 'mxtoken') {
                logger.info(logMetadata, 'Received MX token');
                var masterTokenInfo = await MasterToken.findOne({
                    attributes: ['token'],
                    where: {
                        master_token: decryptedPayload.token,
                        customer_id: decryptedPayload.customer_id,
                        provider: payment_provider
                    }
                });

                logger.info(logMetadata, 'Master Token Info', masterTokenInfo);

                if (!masterTokenInfo) {
                    logger.info(logMetadata, 'Master Token not found');

                    var otherProvider = payment_provider == 'CARDSTREAM' ? 'OPTOMANY' : 'CARDSTREAM';

                    var other_provider_active = providerMarkDObj[otherProvider];

                    if (other_provider_active == 'ON') {
                        var masterTokenInfoOtherP = await MasterToken.findOne({
                            attributes: ['token'],
                            where: {
                                master_token: decryptedPayload.token,
                                customer_id: decryptedPayload.customer_id,
                                provider: otherProvider
                            }
                        });
                        if (masterTokenInfoOtherP) {
                            params.decryptedPayload['token'] = masterTokenInfoOtherP.token;
                            providerResponse = await chooseProvider(otherProvider, params, false);
                        } else {
                            //new sale
                            providerResponse = await chooseProvider(payment_provider, params);
                        }
                    } else {
                        //new sale
                        providerResponse = await chooseProvider(payment_provider, params);
                    }
                } else {
                    logger.info(logMetadata, 'Master Token found for', payment_provider);
                    params.decryptedPayload['token'] = masterTokenInfo.token;
                    providerResponse = await chooseProvider(payment_provider, params, false);
                }
            } else {
                if (providerMarkDObj['OPTOMANY'] == 'ON') {
                    //doesnt matter to what provider mid is pointing to since they have provided opto direct token and opto is UP payment provder must be OPTOMANY
                    payment_provider = 'OPTOMANY';
                    logger.info(logMetadata, 'Inside OPTO gateway direct opto token saved card sale');
                    providerResponse = await chooseProvider(payment_provider, params, false);
                } else if (providerMarkDObj['CARDSTREAM'] == 'ON') {
                    //new sale
                    logger.info(logMetadata, 'Inside OPTO gateway direct opto token but new sale from eg');
                    providerResponse = await chooseProvider('CARDSTREAM', params);
                } else {
                    payment_provider = 'OPTOMANY';
                    logger.info(logMetadata, 'Both Gateway are OFF in direct opto token');
                    providerResponse = await chooseProvider(payment_provider, params, false);
                }
            }
        } else {
            logger.info(logMetadata, 'New Sale for', payment_provider);
            providerResponse = await chooseProvider(payment_provider, params);
        }

        logger.info(logMetadata, 'providerResponse', providerResponse);

        if (providerResponse.status) {
            await sequelize.close();
            return response(null, 302, {
                Location: providerResponse.message
            });
        }

        await sequelize.close();
        return response(providerResponse.message, 500);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();

        return response(errorResponse, 500);
    }
};

const chooseProvider = async (paymentProvider, params, newSale = true) => {
    try {
        if (newSale) {
            params.decryptedPayload['token'] = '';
            params.decryptedPayload['TokenAvs'] = '';
            params.decryptedPayload['last4Digits'] = '';
        }
        if (paymentProvider == 'CARDSTREAM') {
            return { status: true, message: await cardStreamNewCard(params) };
        } else if (paymentProvider == 'OPTOMANY') {
            return { status: true, message: await optomanyNewCard(params) };
        } else if (paymentProvider == 'STRIPE') {
            return { status: true, message: await stripeNewCard(params) };
        } else if (paymentProvider == 'BARCLAYS-IRELAND') {
            return { status: true, message: await barclaysNewCard(params) };
        } else {
            return { status: false, message: 'This payment provider is not supported' };
        }
    } catch (error) {
        return { status: false, message: error };
    }
};

const optomanyNewCard = async (payload) => {
    try {
        logger.info(logMetadata, 'New OPTO Sale function');
        var { common_payload, decryptedPayload, Payment } = payload;

        const paymentInfo = await Payment.findOne({
            attributes: ['order_id', 'payment_status'],
            where: {
                order_id: decryptedPayload.order_id,
                payment_status: 'OK'
            }
        });

        let optomany_payload = {
            ...common_payload,
            name: decryptedPayload.firstname
                ? decryptedPayload.firstname
                : '' + ' ' + decryptedPayload.last_name
                ? decryptedPayload.last_name
                : '',
            Amount: decryptedPayload.Amount,
            AvsHouseNumber: decryptedPayload.AvsHouseNumber,
            AvsPostcode: decryptedPayload.AvsPostcode,
            RedirectUrl: decryptedPayload.RedirectUrl
                ? decryptedPayload.RedirectUrl
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'success'
                  )
        };

        if (paymentInfo) return optomany_payload.RedirectUrl;

        if (decryptedPayload.TokenAvs) {
            optomany_payload['TokenAvs'] = decryptedPayload.TokenAvs;
        }
        if (decryptedPayload.token) {
            optomany_payload['token'] = decryptedPayload.token;
        }
        if (decryptedPayload.last4Digits) {
            optomany_payload['last4Digits'] = decryptedPayload.last4Digits;
        }

        let optomany_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(optomany_payload),
            process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY
        );
        logger.info(logMetadata, 'optomany_payload', optomany_payload);
        logger.info(logMetadata, 'optomany_encrypted_payload', optomany_encrypted_payload);
        logger.info(
            logMetadata,
            'Optomany endpoint',
            `${process.env.OPTOMANY_ENDPOINT}/card.php?data=${optomany_encrypted_payload}&e=dDJzLTAx`
        );
        return `${process.env.OPTOMANY_ENDPOINT}/card.php?data=${optomany_encrypted_payload}&e=dDJzLTAx`; //dDJzLTAx is base64 encrypted key which is eqal to t2s-01
    } catch (error) {
        logger.error(logMetadata, 'error', error);
        return error;
    }
};

const cardStreamNewCard = async (payload) => {
    try {
        logger.info(logMetadata, 'New CS Sale function');
        var { common_payload, decryptedPayload, Country, Customer, Payment } = payload;

        //check order already paid with card_payment table
        let PaymentRecords = await Payment.findOne({
            attributes: ['order_id', 'payment_status'],
            where: {
                order_id: `${decryptedPayload.order_id}`,
                customer_id: decryptedPayload.merchant_id,
                payment_status: 'OK'
            }
        });

        let cardstream_payload = {
            ...common_payload,
            total: decryptedPayload.Amount,
            first_name: decryptedPayload.firstname ? decryptedPayload.firstname : '',
            last_name: decryptedPayload.lastname ? decryptedPayload.lastname : '',
            house_number: decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : '',
            flat: decryptedPayload.flat ? decryptedPayload.flat : '',
            address_line1: decryptedPayload.address1 ? decryptedPayload.address1 : '',
            address_line2: decryptedPayload.address2 ? decryptedPayload.address2 : '',
            postcode: decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : '',
            email: decryptedPayload.email ? decryptedPayload.email : '',
            redirect_url: decryptedPayload.RedirectUrl
                ? decryptedPayload.RedirectUrl
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'success'
                  ),
            cancel_url: decryptedPayload.CancelUrl
                ? decryptedPayload.CancelUrl
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'cancel'
                  ),
            db_total:
                decryptedPayload.DbTotal && (decryptedPayload.DbTotal == 'true' || decryptedPayload.DbTotal == true)
                    ? true
                    : false,
            reference: decryptedPayload.Reference ? decryptedPayload.Reference : '',
            webhook_url: decryptedPayload.WebhookUrl ? decryptedPayload.WebhookUrl : ''
        };

        logger.info(logMetadata, 'PaymentRecords', PaymentRecords);
        if (PaymentRecords) return cardstream_payload.redirect_url;

        var address = '';
        address += decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber + ' ' : '';
        address += decryptedPayload.flat ? decryptedPayload.flat + ' ' : '';
        address += decryptedPayload.address1 ? decryptedPayload.address1 + ' ' : '';
        address += decryptedPayload.address2 ? decryptedPayload.address2 : '';

        cardstream_payload['address'] = address ? address : '';

        let token = [];
        if (decryptedPayload.token) {
            var last_four_digits = (cardstream_payload['last_four_digits'] = decryptedPayload.last4Digits);
            //var card_scheme = (cardstream_payload['card_scheme'] = 'unknown'); //we can query the t2s table to get the scheme

            var cc_token = decryptedPayload.token;
            if (`${decryptedPayload.token}`.startsWith(EG_TOKEN_PREFIX)) {
                cc_token = `${decryptedPayload.token}`.replace(EG_TOKEN_PREFIX, '');
            }
            cardstream_payload['cc_token'] = cc_token;
            token = [
                {
                    token: cc_token,
                    last_four_digits
                    //card_scheme
                }
            ];
        }

        if(decryptedPayload?.SplitFee){
            cardstream_payload['split_fee'] = decryptedPayload?.SplitFee;
        }
        let cardstream_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(cardstream_payload),
            process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
        );
        logger.info(logMetadata, 'cardstream_payload', cardstream_payload);
        logger.info(logMetadata, 'cardstream_encrypted_payload', cardstream_encrypted_payload);

        const country_info = await Country.findOne({
            attributes: ['id', 'currency_sign'],
            include: [
                {
                    attributes: ['id'],
                    model: Customer,
                    where: {
                        id: decryptedPayload.merchant_id
                    }
                }
            ],
            raw: true
        });

        var base64Data = JSON.stringify({
            currency_sign: country_info.currency_sign,
            token,
            total: cardstream_payload.total,
            cancel_url: cardstream_payload.cancel_url,
            redirect_url: cardstream_payload.redirect_url
        });

        // Create buffer object, specifying utf8 as encoding
        let bufferObj = Buffer.from(base64Data, 'utf8');

        // Encode the Buffer as a base64 string
        let base64String = bufferObj.toString('base64');

        logger.info(
            logMetadata,
            'Cardstream endpoint',
            `${process.env.EARTH_ENDPOINT}/?data=${cardstream_encrypted_payload}&response=${base64String}`
        );
        return `${process.env.EARTH_ENDPOINT}/?data=${cardstream_encrypted_payload}&response=${base64String}`;
    } catch (error) {
        logger.error(logMetadata, 'error', error);
        return error;
    }
};

const stripeNewCard = async (payload) => {
    try {
        logger.info(logMetadata, 'New Stripe Sale function');
        var { common_payload, decryptedPayload, Payment } = payload;

        const paymentInfo = await Payment.findOne({
            attributes: ['order_id', 'payment_status'],
            where: {
                order_id: `${decryptedPayload.order_id}`,
                payment_status: 'OK',
                customer_id: decryptedPayload.merchant_id,
                month: parseInt(moment().tz('europe/london').month()) + 1
            }
        });

        let stripe_payload = {
            ...common_payload,
            merchant_name: decryptedPayload.merchant_name,
            total: decryptedPayload.Amount,
            first_name: decryptedPayload.firstname,
            last_name: decryptedPayload.lastname,
            house_number: decryptedPayload.AvsHouseNumber,
            flat: decryptedPayload.flat ? decryptedPayload.flat : decryptedPayload.AvsHouseNumber,
            address_line1: decryptedPayload.address1,
            address_line2: decryptedPayload.address2,
            postcode: decryptedPayload.AvsPostcode,
            email: decryptedPayload.email,
            success_url: decryptedPayload.SuccessUrl,
            reference: decryptedPayload.Reference
        };
        var address = '';
        address += decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber + ' ' : '';
        address += decryptedPayload.flat ? decryptedPayload.flat + ' ' : '';
        address += decryptedPayload.address1 ? decryptedPayload.address1 + ' ' : '';
        address += decryptedPayload.address2 ? decryptedPayload.address2 : '';

        if (address) {
            stripe_payload['address'] = address;
        }
        if (decryptedPayload.RedirectUrl) {
            stripe_payload['redirect_url'] = decryptedPayload.RedirectUrl;
        }
        if (decryptedPayload.CancelUrl) {
            stripe_payload['cancel_url'] = decryptedPayload.CancelUrl;
        }
        if (decryptedPayload.WebhookUrl) {
            stripe_payload['webhook_url'] = decryptedPayload.WebhookUrl;
        }
        let stripe_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(stripe_payload),
            process.env.STRIPE_PAYLOAD_ENCRYPTION_KEY
        ); // stripe sandbox uses a different key, this needs to be changed to the common sandbox key while deploying stripe test environment
        logger.info(logMetadata, 'stripe_payload', stripe_payload);
        logger.info(logMetadata, 'stripe_encrypted_payload', stripe_encrypted_payload);
        if (paymentInfo) return `${process.env.STRIPE_ENDPOINT}/sp-datman-redirect?data=${stripe_encrypted_payload}`;
        logger.info(
            logMetadata,
            'Stripe endpoint',
            `${process.env.STRIPE_ENDPOINT}/stripe-pay?data=${stripe_encrypted_payload}`
        );
        return `${process.env.STRIPE_ENDPOINT}/stripe-pay?data=${stripe_encrypted_payload}`;
    } catch (error) {
        logger.error(logMetadata, 'error', error);
        return error;
    }
};

const barclaysNewCard = async (payload) => {
    try {
        logger.info(logMetadata, 'New Barclays Sale function');
        var { common_payload, decryptedPayload, Payment } = payload;

        const paymentInfo = await Payment.findOne({
            attributes: ['order_id', 'payment_status'],
            where: {
                order_id: decryptedPayload.order_id,
                payment_status: 'OK'
            }
        });

        let barclays_payload = {
            ...common_payload,
            email: decryptedPayload.email ? decryptedPayload.email : '',
            phoneNumber: decryptedPayload.phoneNumber ? decryptedPayload.phoneNumber : '',
            name: decryptedPayload.name ? decryptedPayload.name : '',
            Amount: decryptedPayload.Amount ? decryptedPayload.Amount : '',
            AvsHouseNumber: decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : '',
            AvsPostcode: decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : '',
            MerchantReference: decryptedPayload.MerchantReference ? decryptedPayload.MerchantReference : '',
            customer_joining_date: decryptedPayload.customer_joining_date ? decryptedPayload.customer_joining_date : '',
            firstname: decryptedPayload.firstname ? decryptedPayload.firstname : '',
            lastname: decryptedPayload.lastname ? decryptedPayload.lastname : '',
            flat: decryptedPayload.flat ? decryptedPayload.flat : '',
            address1: decryptedPayload.address1 ? decryptedPayload.address1 : '',
            address2: decryptedPayload.address2 ? decryptedPayload.address2 : '',
            CancelUrl: decryptedPayload.CancelUrl
                ? decryptedPayload.CancelUrl
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'cancel'
                  ),
            WebhookUrl: decryptedPayload.WebhookUrl ? decryptedPayload.WebhookUrl : '',
            RedirectUrl: decryptedPayload.RedirectUrl
                ? decryptedPayload.RedirectUrl
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'success'
                  ),
            DbTotal:
                decryptedPayload.DbTotal && (decryptedPayload.DbTotal == 'true' || decryptedPayload.DbTotal == true)
                    ? true
                    : false
        };

        if (paymentInfo) return barclays_payload.RedirectUrl;

        let barclays_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(barclays_payload),
            process.env.BARCLAYS_PAYLOAD_ENCRYPTION_KEY
        );

        logger.info(logMetadata, 'barclays_payload', barclays_payload);
        logger.info(logMetadata, 'barclays_encrypted_payload', barclays_encrypted_payload);
        logger.info(
            logMetadata,
            'Barclays endpoint',
            `${process.env.BARCLAYS_ENDPOINT}/barclays-irl/onlinePaymentV4.php?data=${barclays_encrypted_payload}&e=dDJzLTAx`
        );
        return `${process.env.BARCLAYS_ENDPOINT}/barclays-irl/onlinePaymentV4.php?data=${barclays_encrypted_payload}&e=dDJzLTAx`; //dDJzLTAx is base64 encrypted key which is eqal to t2s-01
    } catch (error) {
        logger.error(logMetadata, 'error', error);
        return error;
    }
};
