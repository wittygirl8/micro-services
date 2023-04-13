/*
 * @step# : 5
 * @Description: Pin payment has got provision to subscribe to the webhook, upon processing the payout, it will publish a message to the configured webhook url, this api acts as webhook api url
 * Validates the payout and updates the status to FAILED/COMPLETED
 * @Test: No input required, running the lambda will do the processing
 * @SampleRequest: {"token":"evt_AA3_VImdePzWUu9-646uPg","data":{"token":"tfer_OIKR0PwfyqMW3CV8zAga3Q","status":"succeeded","currency":"AUD","description":"6","amount":3,"paid_at":"2022-04-19T07:35:58Z","bank_account":{"token":"ba_lBbJWFb6a97pfFzWdaczLA","name":"Mr Roland Robot","bsb":"123456","number":"XXXXXX321","bank_name":"Roland Bank Corporation Limited (The), Australian Branch","branch":"ROLAND BANK AU"},"recipient":"rp_xFf1uh5hkhYrvdr-MkaLBg"},"request_token":"whr_frQo9QoQVaG8M0ZMjq3D4A","test":true}
 */

const AWSXRay = require('aws-xray-sdk');
var { logHelpers, schema, response } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;
let logMetadata = {
    location: 'PinPayout~Webhook',
    awsRequestId: ''
};
var moment = require('moment-timezone');
var TIMEZONE = 'europe/london';

export const main = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }

    logMetadata.awsRequestId = context.awsRequestId;
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;
    try {
        var db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        var { sequelize, PayoutBatch, PayoutLog, PayoutApiLog, Payments, PayoutBatchItem } = db;

        let payload = JSON.parse(event.body);
        payload = await schema.PinPayoutWebhook.validateAsync(payload);

        let message = `Processed payout request`;
        let api_response = {
            request_id: requestId,
            message,
            payload
        };

        logger.info(`payload.data~${JSON.stringify(payload.data)}`);

        let isvalidBatch = await PayoutBatch.findOne({
            where: {
                batch_id: payload.data.description,
                status: 'SENT'
            },
            attributes: ['status', 'transfer_token'],
            raw: true
        });

        if (!isvalidBatch) {
            await PayoutLog.create({
                batch_id: payload.data.description,
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                remarks: `Batch Details not found for the given webhook payload`
            });

            await sequelize.close();
            throw { message: `Batch Details not found for the given webhook payload`, payload: payload };
        }

        if (payload.data.token != isvalidBatch.transfer_token) {
            throw {
                message: `For the given Batch transfer token is not matching ${isvalidBatch.transfer_token}`,
                payload: payload
            };
        }

        if (payload.data.status != 'succeeded') {
            await PayoutBatch.update(
                {
                    status: 'FAILED',
                    transfer_token: payload.data.token,
                    date_complete: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                },
                {
                    where: { batch_id: payload.data.description, status: 'SENT' }
                }
            );

            await PayoutApiLog.create({
                batch_id: payload.data.description,
                action_type: 'PPWEBHOOKFAILED',
                data: JSON.stringify(payload.data),
                created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
            });

            let transaction_ids_response = await PayoutBatchItem.findAll({
                where: {
                    batch_id: payload.data.description
                },
                attributes: ['card_payment_id'],
                raw: true
            });

            let transaction_ids = [];
            transaction_ids_response.forEach((item) => {
                transaction_ids.push(item.card_payment_id);
            });

            logger.info('TransactionIds', transaction_ids);

            await Payments.update(
                {
                    transaction_status_id: 6,
                    withdrawn_status: 3
                },
                {
                    where: {
                        id: transaction_ids
                    }
                }
            );

            await PayoutLog.create({
                batch_id: payload.data.description,
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                remarks: `Failed`
            });

            await sequelize.close();
            throw { message: `Payout processing unsuccessful`, payload: payload };
        } else {
            await PayoutBatch.update(
                {
                    status: 'COMPLETE',
                    transfer_token: payload.data.token,
                    date_complete: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                },
                {
                    where: { batch_id: payload.data.description, status: 'SENT' }
                }
            );

            let transaction_ids_response = await PayoutBatchItem.findAll({
                where: {
                    batch_id: payload.data.description
                },
                attributes: ['card_payment_id'],
                raw: true
            });

            let transaction_ids = [];
            transaction_ids_response.forEach((item) => {
                transaction_ids.push(item.card_payment_id);
            });

            logger.info('TransactionIdsSuccess', transaction_ids);

            await Payments.update(
                {
                    transaction_status_id: 5,
                    withdrawn_status: 2
                },
                {
                    where: {
                        id: transaction_ids
                    }
                }
            );

            await PayoutApiLog.create({
                batch_id: payload.data.description,
                action_type: 'PPWEBHOOKSUCCESS',
                data: JSON.stringify(payload.data),
                created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
            });

            await PayoutLog.create({
                batch_id: payload.data.description,
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                remarks: `Successfully Completed Payout`
            });

            await sequelize.close();
            logger.info(api_response);
            return response(api_response);
        }
    } catch (e) {
        //In case of error data should not be printed as it will have sensitive details
        logger.info(e);
        logger.error(logMetadata, 'ErrorResponse', e);

        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };

        logger.error(logMetadata, 'errorResponse', errorResponse);

        await sequelize.close();

        return response({ errorResponse }, 500);
    }
};
