var { response, flakeGenerateDecimal, schema, cryptFunctions, helpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
// (host, database, username, password, offline)
const db = connectDB(
    process.env.DB_HOST,
    process.env.DB_DATABASE,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    process.env.IS_OFFLINE
);
console.log('all environment', process.env);

let logger = logHelpers.logger;

export const decrypt = async (event, context) => {
    const { sequelize, CardstreamRequestLog, Payment, Customer } = db;
    const transaction = await sequelize.transaction();
    const requestId = 'reqid_' + flakeGenerateDecimal();

    let logMetadata = {
        location: 'SwitchService ~ decrypt',
        awsRequestId: context.awsRequestId
    };

    try {
        //read the encrypted payload and validate it
        let encryptedPayload = JSON.parse(event.body);
        logger.info(logMetadata, encryptedPayload);
        encryptedPayload = await schema.encryptedDataSchema.validateAsync(encryptedPayload);

        //logging request
        var RequestLogId = await CardstreamRequestLog.create({
            payload: JSON.stringify(encryptedPayload),
            encrypted_payload: event.body,
            handler: 'switch.decryptT2SData'
        });

        //decrypt the payload and validate the payload
        logger.info(logMetadata, 'encryptedPayload.data', encryptedPayload.data);
        let decryptedPayload = cryptFunctions.decryptPayload(
            encryptedPayload.data,
            process.env.SWITCH_PAYLOD_ENCRYPTION_KEY
        );
        decryptedPayload = JSON.parse(decryptedPayload);
        decryptedPayload = await schema.t2sPayloadSchema.validateAsync(decryptedPayload);
        logger.info(logMetadata, 'decryptedPayload', decryptedPayload);

        let { order_id, merchant_id } = decryptedPayload;

        logMetadata.orderId = order_id;

        let message = '';
        let redirect_url = '';
        let api_response = {};
        //check order already paid with card_payment table

        console.log(`${order_id}`, merchant_id, 'Inputs');
        let PaymentRecords = await Payment.findAll({
            where: {
                order_id: `${order_id}`,
                customer_id: merchant_id
            }
        });
        console.log(PaymentRecords, 'Payments Records');
        let paidStatus = false;
        PaymentRecords.map((record) => {
            let payment_status = record.transaction_status_id ? record.transaction_status_id : record.payment_status;
            let validateStatusArr = [1, 'OK'];
            if (validateStatusArr.includes(payment_status)) {
                paidStatus = true;
            }
        });

        //if order found payed already, Redirect to the merchant redirect/success url
        if (paidStatus) {
            message = 'Redirecting to merchant';
            redirect_url = decryptedPayload.redirect_url
                ? decryptedPayload.redirect_url
                : helpers.getT2sLegacyUrl(
                      {
                          provider: decryptedPayload.provider,
                          order_id: decryptedPayload.order_id,
                          host: decryptedPayload.host
                      },
                      'success'
                  );
            api_response = {
                request_id: requestId,
                message: message,
                data: {
                    redirect_url: redirect_url
                }
            };
            await CardstreamRequestLog.update(
                {
                    payload: JSON.stringify(decryptedPayload),
                    response: JSON.stringify(api_response)
                },
                { where: { id: RequestLogId.id } }
            );
            return response(api_response);
        }

        //get merchant info
        let merchantInfo = await Customer.findOne({
            where: { id: merchant_id }
        });

        //if merchant seems to be does not exists/invalid, throw error
        if (!merchantInfo || merchantInfo.progress_status != '2') {
            throw { message: 'Invalid merchant' };
        }

        //if merchant id found, check the gatewa provider and redirect to the respective link
        message = 'Redirecting to gateway';
        let common_payload = {
            host: decryptedPayload.host,
            order_id: decryptedPayload.order_id,
            provider: decryptedPayload.provider,
            customer_id: decryptedPayload.customer_id,
            merchant_id: decryptedPayload.merchant_id
        };
        //for optomany
        if (merchantInfo.payment_provider === 'OPTOMANY') {
            let optomany_payload = {
                ...common_payload,
                name: decryptedPayload.merchant_name,
                Amount: decryptedPayload.amount,
                AvsHouseNumber: decryptedPayload.house_number,
                AvsPostcode: decryptedPayload.postcode,
                RedirectUrl: decryptedPayload.redirect_url
                    ? decryptedPayload.redirect_url
                    : helpers.getT2sLegacyUrl(
                          {
                              provider: decryptedPayload.provider,
                              order_id: decryptedPayload.order_id,
                              host: decryptedPayload.host
                          },
                          'success'
                      )
            };
            if (decryptedPayload.token_avs) {
                optomany_payload['TokenAvs'] = decryptedPayload.token_avs;
            }
            if (decryptedPayload.token) {
                optomany_payload['token'] = decryptedPayload.token;
            }
            if (decryptedPayload.last_4_digits) {
                optomany_payload['last4Digits'] = decryptedPayload.last_4_digits;
            }
            let optomany_encrypted_payload = cryptFunctions.encryptPayload(
                JSON.stringify(optomany_payload),
                process.env.OPTOMANY_PAYLOAD_ENCRYPTION_KEY
            );
            logger.info(logMetadata, 'optomany_payload', optomany_payload);
            logger.info(logMetadata, 'optomany_encrypted_payload', optomany_encrypted_payload);
            redirect_url = `${process.env.OPTOMANY_ENDPOINT}/card.php?data=${optomany_encrypted_payload}`;
        }

        //for stripe
        if (merchantInfo.payment_provider === 'STRIPE') {
            let stripe_payload = {
                ...common_payload,
                total: decryptedPayload.amount,
                first_name: decryptedPayload.first_name,
                last_name: decryptedPayload.last_name,
                house_number: decryptedPayload.house_number,
                flat: decryptedPayload.flat ? decryptedPayload.flat : decryptedPayload.house_number,
                address_line1: decryptedPayload.address_line1,
                address_line2: decryptedPayload.address_line2,
                postcode: decryptedPayload.postcode,
                email: decryptedPayload.email,
                address: `${decryptedPayload.address_line1},${decryptedPayload.address_line2}`
            };
            if (decryptedPayload.token) {
                stripe_payload['token'] = decryptedPayload.token;
            }
            if (decryptedPayload.last_4_digits) {
                stripe_payload['last_4_digits'] = decryptedPayload.last_4_digits;
            }
            if (decryptedPayload.redirect_url) {
                stripe_payload['redirect_url'] = decryptedPayload.redirect_url;
            }
            if (decryptedPayload.cancel_url) {
                stripe_payload['cancel_url'] = decryptedPayload.cancel_url;
            }
            if (decryptedPayload.webhook_url) {
                stripe_payload['webhook_url'] = decryptedPayload.webhook_url;
            }
            let stripe_encrypted_payload = cryptFunctions.encryptPayload(
                JSON.stringify(stripe_payload),
                process.env.STRIPE_PAYLOAD_ENCRYPTION_KEY
            ); // stripe sandbox uses a different key, this needs to be changed to the common sandbox key while deploying stripe test environment
            logger.info(logMetadata, 'stripe_payload', stripe_payload);
            logger.info(logMetadata, 'stripe_encrypted_payload', stripe_encrypted_payload);
            redirect_url = `${process.env.STRIPE_ENDPOINT}/stripe-pay?data=${stripe_encrypted_payload}`;
        }

        //for cardstream/EarthGateway
        if (merchantInfo.payment_provider === 'CARDSTREAM') {
            let cardstream_payload = {
                ...common_payload,
                total: decryptedPayload.amount,
                first_name: decryptedPayload.first_name,
                last_name: decryptedPayload.last_name,
                house_number: decryptedPayload.house_number,
                flat: decryptedPayload.flat ? decryptedPayload.flat : decryptedPayload.house_number,
                address_line1: decryptedPayload.address_line1,
                address_line2: decryptedPayload.address_line2,
                postcode: decryptedPayload.postcode,
                email: decryptedPayload.email,
                address: `${decryptedPayload.address_line1},${decryptedPayload.address_line2}`,
                redirect_url: decryptedPayload.redirect_url
                    ? decryptedPayload.redirect_url
                    : helpers.getT2sLegacyUrl(
                          {
                              provider: decryptedPayload.provider,
                              order_id: decryptedPayload.order_id,
                              host: decryptedPayload.host
                          },
                          'success'
                      ),
                cancel_url: decryptedPayload.cancel_url
                    ? decryptedPayload.cancel_url
                    : helpers.getT2sLegacyUrl(
                          {
                              provider: decryptedPayload.provider,
                              order_id: decryptedPayload.order_id,
                              host: decryptedPayload.host
                          },
                          'cancel'
                      )
            };
            if (decryptedPayload.webhook_url) {
                cardstream_payload['webhook_url'] = decryptedPayload.webhook_url;
            }
            let cardstream_encrypted_payload = cryptFunctions.encryptPayload(
                JSON.stringify(cardstream_payload),
                process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
            );
            logger.info(logMetadata, 'cardstream_payload', cardstream_payload);
            logger.info(logMetadata, 'cardstream_encrypted_payload', cardstream_encrypted_payload);
            redirect_url = `${process.env.EARTH_ENDPOINT}/?data=${cardstream_encrypted_payload}`;
        }

        //somehow, if redirect_url seems to be empty, most probably the provider given is invalid, if so, throw error message
        if (!redirect_url) {
            logger.info(logMetadata, `No provider defined for the merchant id ${merchant_id}`);
            throw { message: 'Payment failed! (90001)' };
        }

        api_response = {
            request_id: requestId,
            message: message,
            data: {
                redirect_url: redirect_url
            }
        };
        await CardstreamRequestLog.update(
            {
                payload: JSON.stringify(decryptedPayload),
                response: JSON.stringify(api_response)
            },
            { where: { id: RequestLogId.id } }
        );

        await transaction.commit();
        return response(api_response);
    } catch (e) {
        logger.error(logMetadata, e);
        const errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message
            }
        };
        //logging request with error response
        RequestLogId
            ? await CardstreamRequestLog.update(
                  {
                      response: JSON.stringify(errorResponse)
                  },
                  { where: { id: RequestLogId.id } }
              )
            : null;
        await transaction.rollback();
        return response(errorResponse, 500);
    }
};
