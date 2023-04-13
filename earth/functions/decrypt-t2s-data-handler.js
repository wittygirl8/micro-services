var { response, schema, cryptFunctions, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const EG_TOKEN_PREFIX = 'egtoken_';

export const decryptT2SData = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ decryptT2SData',
        orderId: '',
        awsRequestId: context.awsRequestId
    };

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    const t2sDb = connectDB(
        process.env.T2S_DB_HOST,
        process.env.T2S_DB_DATABASE,
        process.env.T2S_DB_USERNAME,
        process.env.T2S_DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    const { sequelize, CardstreamRequestLog, Payment, Payments, Customer, Country } = db;
    var t2s_sequelize = t2sDb.sequelize;
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        const encryptedPayload = JSON.parse(event.body);

        var RequestLogId = await CardstreamRequestLog.create({
            payload: JSON.stringify(encryptedPayload),
            encrypted_payload: event.body,
            handler: 'earth.decryptT2SData'
        });

        const decryptDataRes = cryptFunctions.decryptPayload(
            encryptedPayload.data,
            process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
        );
        //checking for corrupt data
        if (JSON.parse(JSON.stringify(decryptDataRes)).hasOwnProperty('error')) {
            throw { message: 'Invalid request', type: '' };
        }

        let decryptedPayload = JSON.parse(decryptDataRes);
        if (decryptedPayload.mode === 'phone_payment') {
            decryptedPayload = await schema.egPhonePaymentPayloadSchema.validateAsync(decryptedPayload);
        } else {
            decryptedPayload = await schema.egPayloadSchema.validateAsync(decryptedPayload);
        }
        //let decryptedPayload =JSON.parse(decryptRequest(encryptedPayload.data));

        //check order already paid with card_payment table

        logMetadata.orderId = decryptedPayload.order_id;

        let requestObj = {
            order_id: `${decryptedPayload.order_id}`,
            merchant_id: decryptedPayload.merchant_id
        };
        console.log(requestObj, 'Inputs');
        let PaymentRecords = await EarthBusinessLogic.getPaymentRecords(requestObj, Customer, Payment, Payments);
        console.log(PaymentRecords, 'Payments Records');
        let paidStatus = false;
        PaymentRecords.map((record) => {
            let payment_status = record.transaction_status_id ? record.transaction_status_id : record.payment_status;
            let validateStatusArr = [1, 'OK'];
            if (validateStatusArr.includes(payment_status)) {
                paidStatus = true;
            }
        });

        //if true, throw error message
        if (paidStatus) {
            await CardstreamRequestLog.update(
                {
                    order_id: decryptedPayload.order_id,
                    payload: JSON.stringify(decryptedPayload)
                },
                {
                    where: {
                        id: RequestLogId.id
                    }
                }
            );
            throw {
                message: 'Payment already done',
                redirect_url: decryptedPayload.redirect_url
            };
        }

        const country_info = await Country.findOne({
            attributes: [
                'id',
                'country_name',
                'iso',
                'currency_name',
                'currency_sign',
                'iso_country_code',
                'iso_currency_code'
            ],
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

        let payload_total = decryptedPayload.total;
        let order_info_total;
        if (decryptedPayload.db_total) {
            //if total to be read from T2S db, retreive the details
            let [t2s_order_info] = await t2s_sequelize.query(
                `SELECT * FROM order_info WHERE id=${decryptedPayload.order_id} LIMIT 1`
            );

            t2s_order_info = t2s_order_info[0];
            if (typeof t2s_order_info !== 'undefined') {
                order_info_total = parseFloat(t2s_order_info.total);
                if (payload_total !== order_info_total) {
                    logger.info(
                        logMetadata,
                        `Order amount mismatch between payload and order_info ${t2s_order_info.id} => ${payload_total} != ${order_info_total}`
                    );
                }
            } else {
                logger.info(logMetadata, `Order id could not be found  - ${decryptedPayload.order_id}`);
            }
        }

        decryptedPayload['total'] = decryptedPayload.db_total
            ? order_info_total
                ? order_info_total
                : payload_total
            : payload_total;
        let token = [];
        if (decryptedPayload.cc_token) {
            let cc_token, last_four_digits, card_scheme;
            cc_token = decryptedPayload.cc_token;
            last_four_digits = decryptedPayload.last_four_digits;
            card_scheme = 'unknown'; //we can query the t2s table to get the scheme
            if (`${decryptedPayload.cc_token}`.startsWith(EG_TOKEN_PREFIX)) {
                cc_token = `${decryptedPayload.cc_token}`.replace(EG_TOKEN_PREFIX, '');
            }
            token = [
                {
                    token: cc_token,
                    last_four_digits,
                    card_scheme
                }
            ];
        }

        let api_response = {
            request_id: requestId,
            message: 'Decrypted Data',
            data: {
                ...decryptedPayload,
                token,
                country_info
            }
        };
        await CardstreamRequestLog.update(
            {
                order_id: decryptedPayload.order_id,
                payload: JSON.stringify(decryptedPayload),
                response: JSON.stringify(api_response)
            },
            {
                where: {
                    id: RequestLogId.id
                }
            }
        );
        logger.info(logMetadata, 'api_response', api_response);
        await sequelize.close();
        await t2s_sequelize.close();

        return response(api_response);
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'Error',
                message: e.message,
                redirect_url: e.redirect_url
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
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();
        await t2s_sequelize.close();

        return response(errorResponse, 500);
    }
};
