var { response, schema, cryptFunctions, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');

export const switchPhonePGateway = async (event) => {
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    var { sequelize, GatewayRequestLog, Payment, Payments, Customer, Country, Sequelize } = db;

    // const requestId = 'reqid_' + flakeGenerateDecimal();
    try {
        console.log('switch is deployed');
        //read the encrypted payload and validate it
        let encryptedPayload = event.queryStringParameters;
        encryptedPayload = await schema.encryptedDataSchema.validateAsync(encryptedPayload);

        let decryptedPayload = cryptFunctions.decryptPayload(
            encryptedPayload.data,
            process.env.SWITCH_PAYLOD_ENCRYPTION_KEY
        );
        decryptedPayload = await schema.phonePaymentSchema.validateAsync(JSON.parse(decryptedPayload)); //sanitization

        let { order_id, merchant_id } = decryptedPayload;

        //logging the api request
        await GatewayRequestLog.create({
            order_id: parseInt(order_id),
            merchant_id: parseInt(merchant_id),
            gateway: 'PHONE-PAYMENT-SWITCH-GATEWAY',
            request_data: JSON.stringify({
                decrypted_data: JSON.stringify(decryptedPayload),
                encrypted_data: JSON.stringify(encryptedPayload)
            }),
            path_script: 'switch/phone-payment-switch-gateway-handler.js'
        });

        let common_payload = {
            host: decryptedPayload.host,
            order_id: decryptedPayload.order_id,
            provider: decryptedPayload.provider,
            customer_id: decryptedPayload.customer_id,
            merchant_id: decryptedPayload.merchant_id
        };

        //payload to be passed in every helper function
        var params = {
            common_payload,
            decryptedPayload,
            Country,
            Customer,
            Payment,
            Payments,
            encryptedPayload,
            Sequelize
        };

        // get payment provider from customer table for the merchant
        const MerchantInfo = await db.Customer.findOne({
            attributes: ['id', 'payment_provider'],
            where: { id: decryptedPayload.merchant_id },
            raw: true
        });

        if (!MerchantInfo) {
            throw { message: 'Issue while getting MerchantInfo' };
        }

        const payment_provider = MerchantInfo.payment_provider;
        console.log('payment_provider', payment_provider);

        let responseProvider = await chooseProvider(payment_provider, params);
        await sequelize.close();
        console.log(responseProvider, 'responseProvider');
        if (responseProvider.success) {
            return {
                statusCode: 302,
                headers: {
                    Location: responseProvider.message
                }
            };
        } else {
            return {
                headers: {
                    'content-type': 'text/html'
                },
                body: responseProvider.message
            };
        }
    } catch (e) {
        console.log(e, 'Erorr');
        const errorResponse = e.message;
        await sequelize.close();
        return response(errorResponse, 500);
    }
};

const chooseProvider = async (paymentProvider, params) => {
    try {
        if (paymentProvider == 'CARDSTREAM') {
            return await cardStreamNewCard(params);
        } else if (paymentProvider == 'DNA') {
            return await dnaNewCard(params);
        } else {
            throw { message: 'Invalid payment provider' };
        }
    } catch (error) {
        console.log('chooseProvider catch Error', error.message);
        throw { message: 'Payment could not be processed!' };
    }
};

const cardStreamNewCard = async (payload) => {
    try {
        console.log('New CS Sale function');
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

        console.log('PaymentRecords: ', PaymentRecords);
        if (PaymentRecords)
            return {
                success: false,
                message: `<html><p style="text-align: center; margin-top: 3rem!important;font-size: 1.25rem;font-weight: 200;font-family: sans-serif">Your payment is successful</p></html>`
            };

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
            cash_payment_url: decryptedPayload.CashPaymentUrl,
            reference: decryptedPayload.MerchantReference ? decryptedPayload.MerchantReference : ``,
            webhook_url: decryptedPayload.WebhookUrl ? decryptedPayload.WebhookUrl : '',
            mode: 'phone_payment'
        };

        var address = '';
        address += decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber + ' ' : '';
        address += decryptedPayload.flat ? decryptedPayload.flat + ' ' : '';
        address += decryptedPayload.address1 ? decryptedPayload.address1 + ' ' : '';
        address += decryptedPayload.address2 ? decryptedPayload.address2 : '';

        cardstream_payload['address'] = address ? address : '';
        if(decryptedPayload?.SplitFee){
            cardstream_payload['split_fee'] = decryptedPayload?.SplitFee;
        }
        let cardstream_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(cardstream_payload),
            process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
        );
        console.log('cardstream_payload', cardstream_payload);
        console.log('cardstream_encrypted_payload', cardstream_encrypted_payload);

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

        var base64Data = {
            currency_sign: country_info.currency_sign,
            token: [],
            total: cardstream_payload.total,
            cancel_url: cardstream_payload.cancel_url,
            redirect_url: cardstream_payload.redirect_url,
            cash_payment_url: cardstream_payload.cash_payment_url,
            phone_payment: true,
            switchGateway: true,
            avs: {
                house: decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : '',
                postcode: decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : ''
            }
        };

        base64Data = JSON.stringify(base64Data);

        // Create buffer object, specifying utf8 as encoding
        let bufferObj = Buffer.from(base64Data, 'utf8');

        // Encode the Buffer as a base64 string
        let base64String = bufferObj.toString('base64');

        console.log(`${process.env.EARTH_ENDPOINT}/?data=${cardstream_encrypted_payload}&response=${base64String}`);
        return {
            success: true,
            message: `${process.env.EARTH_ENDPOINT}/?data=${cardstream_encrypted_payload}&response=${base64String}`
        };
    } catch (error) {
        console.log('cardStreamNewCard catch Error', error.message);
        throw { message: error.message };
    }
};

const dnaNewCard = async (payload) => {
    try {
        console.log('New DNA Sale function');
        var { common_payload, decryptedPayload, Country, Customer, Payments, Sequelize } = payload;

        //check order already paid with payments table
        let PaymentRecords = await Payments.findOne({
            attributes: ['id'],
            where: {
                order_ref: `${decryptedPayload.order_id}`,
                transaction_status_id: {
                    [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
                }
            },
            raw: true
        });

        console.log('PaymentRecords: ', PaymentRecords);
        if (PaymentRecords)
            return {
                success: false,
                message: `<html><p style="text-align: center; margin-top: 3rem!important;font-size: 1.25rem;font-weight: 200;font-family: sans-serif">Your payment is successful</p></html>`
            };

        let dna_payload = {
            ...common_payload,
            total: decryptedPayload.Amount,
            first_name: decryptedPayload.firstname ? decryptedPayload.firstname : ' ',
            last_name: decryptedPayload.lastname ? decryptedPayload.lastname : ' ',
            house_number: decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : ' ',
            flat: decryptedPayload.flat ? decryptedPayload.flat : '',
            address_line1: decryptedPayload.address1 ? decryptedPayload.address1 : '',
            address_line2: decryptedPayload.address2 ? decryptedPayload.address2 : '',
            postcode: decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : ' ',
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
            cash_payment_url: decryptedPayload.CashPaymentUrl,
            reference: decryptedPayload.MerchantReference ? decryptedPayload.MerchantReference : ``,
            webhook_url: decryptedPayload.WebhookUrl ? decryptedPayload.WebhookUrl : '',
            mode: 'phone_payment'
        };

        var address = '';
        address += decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber + ' ' : '';
        address += decryptedPayload.flat ? decryptedPayload.flat + ' ' : '';
        address += decryptedPayload.address1 ? decryptedPayload.address1 + ' ' : '';
        address += decryptedPayload.address2 ? decryptedPayload.address2 : '';

        dna_payload['address'] = address ? address : '';
        decryptedPayload?.SplitFee && (dna_payload['split_fee'] = decryptedPayload?.SplitFee);

        let dna_encrypted_payload = cryptFunctions.encryptPayload(
            JSON.stringify(dna_payload),
            JSON.parse(process.env.DNA_HOSTED_FORM).encriptionKey
        );
        console.log('dna_payload', dna_payload);
        console.log('dna_encrypted_payload', dna_encrypted_payload);

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

        var base64Data = {
            currency_sign: country_info.currency_sign,
            token: [],
            total: dna_payload.total,
            cancel_url: dna_payload.cancel_url,
            redirect_url: dna_payload.redirect_url,
            cash_payment_url: dna_payload.cash_payment_url,
            phone_payment: true,
            switchGateway: true,
            avs: {
                house: decryptedPayload.AvsHouseNumber ? decryptedPayload.AvsHouseNumber : '',
                postcode: decryptedPayload.AvsPostcode ? decryptedPayload.AvsPostcode : ''
            }
        };

        base64Data = JSON.stringify(base64Data);

        // Create buffer object, specifying utf8 as encoding
        let bufferObj = Buffer.from(base64Data, 'utf8');

        // Encode the Buffer as a base64 string
        let base64String = bufferObj.toString('base64');

        let dnaBaseUrl = process.env.EARTH_ENDPOINT.replace('earth', 'dna');
        let redirectUrl = `${dnaBaseUrl}/?data=${dna_encrypted_payload}&response=${base64String}`;

        console.log('redirectUrl: ', redirectUrl);
        return {
            success: true,
            message: redirectUrl
        };
    } catch (error) {
        console.error('dnaNewCard catch Error', error.message);
        throw { message: error.message };
    }
};
