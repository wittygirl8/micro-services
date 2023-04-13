/*
 * @step# : 4
 * @Description: This consumer picks the message published by ProcessPinPayoutPublisher from BatchProcessPinPayoutsQueue and initiates for payout by invoking the pinpayment/tipalti service
 * @Test: No input required, running the lambda will do the processing
 */

import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { logHelpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
var TipaltiHelpers = require('../logic/tipalti-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;
var axios = require('axios');
var qs = require('qs');

export class BatchProcessPinPaymentPayout {
    async init(event, context) {
        let logMetadata = {
            location: 'PinPayout~ProcessPayment',
            awsRequestId: `reqid_${context.awsRequestId}` || 'no_aws_reference'
        };

        logger.info(logMetadata, `Payout Processing Started`, event);
        let LoopingArray = event?.Records;
        if (process.env.IS_OFFLINE) {
            LoopingArray = [
                //use this for local testing by overwriting the 'body' field with below object
                {
                    body: '{"payout_provider":"TIPALTI","batch_ids":"[111114,111115,111116,111117]"}'
                }
            ]; //for local testing
        }
        logger.info(logMetadata, { LoopingArray });
        const promises = LoopingArray.map((message) => {
            let payload = JSON.parse(message.body);
            console.log({ payload });

            if (payload.payout_provider === 'TIPALTI') {
                return this.TipaltiPayoutProcessing(message, logMetadata);
            } else if (payload.payout_provider === 'PIN_PAYMENT') {
                logger.info(logMetadata, 'PinPayout published messages', message);
                return this.PinPaymentPayoutProcessing(message, logMetadata);
            }

            return;
        });

        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async TipaltiPayoutProcessing(message, logMetaData) {
        let payload = JSON.parse(message.body);
        let batch_ids = JSON.parse(payload.batch_ids);
        logger.info(logMetaData, 'TipaltiPayoutProcessing', { payload });

        // Tipalti message will be sent from publisher as a set of batch_ids, max limit upto 250.
        // Loop through the ids and prepare the final/single/large payload for Tipalti API request
        var db = await TipaltiHelpers.getDbConnection();
        const payoutBatches = await db.PayoutBatch.findAll({
            where: {
                batch_id: {
                    [db.Sequelize.Op.in]: batch_ids
                },
                status: 'PENDING',
                payout_provider: 'TIPALTI'
            },
            raw: true
        });
        console.log(`Found ${payoutBatches.length} records for payoutBatches`);

        //loop through the payoutBatches and form the Tipalti request payload
        let TipaltiPayloadArray = [];
        payoutBatches.forEach((item) => {
            var payload = {
                merchant_id: item.customer_id,
                amount: item.total,
                ref_code: TipaltiHelpers.ConvertBatchIDToRefCode(item.batch_id),
                currency: item.currency
            };
            TipaltiPayloadArray.push(payload);
        });
        console.log({ TipaltiPayloadArray });

        //now pass it to the Tipalti api call function
        var TipaltiApiResponse = await TipaltiHelpers.ProcessTipaltiPayouts(TipaltiPayloadArray);
        console.log('TipaltiApiResponse', JSON.stringify(TipaltiApiResponse));

        //perform the associated post api db actions based on the api results
        let updatePayoutResultsActionInfo = await TipaltiHelpers.updatePayoutResultsAction({
            logMetaData,
            TipaltiApiResponse,
            batch_ids,
            db
        });
        console.log('updatePayoutResultsActionInfo', JSON.stringify(updatePayoutResultsActionInfo));

        return { message, receiptHandle: message.receiptHandle, success: true };
    }

    async PinPaymentPayoutProcessing(requestObj, logMetadata) {
        try {
            logger.info(logMetadata, `Processing messages`, requestObj);
            AWSXRay.capturePromise();
            if (process.env.IS_OFFLINE) {
                AWSXRay.setContextMissingStrategy(() => {}); //do nothing
            }

            var db = connectDB(
                process.env.DB_HOST,
                process.env.DB_DATABASE,
                process.env.DB_USERNAME,
                process.env.DB_PASSWORD,
                process.env.IS_OFFLINE
            );

            var {
                sequelize,
                PayoutBatch,
                SettlementConfig,
                PayoutLog,
                Customer,
                Payments,
                PayoutApiLog,
                PayoutBatchItem
            } = db;

            var savepoint = await sequelize.transaction();

            const { merchant_id, batch_id } = JSON.parse(requestObj.body);
            const { receiptHandle } = requestObj;

            let isValidMerchant = await SettlementConfig.findOne({
                where: {
                    customer_id: merchant_id
                },
                attributes: ['status'],
                raw: true
            });

            let message = `Processed payout request`;
            let api_response = {
                request_id: logMetadata.requestId,
                message
            };

            if (!isValidMerchant) {
                return { message: `Merchant details not found`, receiptHandle, success: false };
            } else if (!isValidMerchant.status === 1) {
                return { message: `Merchant payout not enabled`, receiptHandle, success: false };
            }

            let payoutBatchDetails = await PayoutBatch.findOne({
                where: {
                    customer_id: merchant_id,
                    status: 'PENDING',
                    batch_id: batch_id
                },
                raw: true
            });

            if (!payoutBatchDetails) {
                return { message: `No pending payouts for processing`, receiptHandle, success: false };
            }

            let currencyData = await Customer.findOne({
                where: {
                    id: merchant_id
                },
                attributes: ['currency'],
                raw: true
            });
            let currency = currencyData.currency ? currencyData.currency : 'AUD';
            currency = currency.toUpperCase();

            var data = qs.stringify({
                amount: payoutBatchDetails.total,
                currency: currency,
                description: `${payoutBatchDetails.batch_id}`,
                recipient: payoutBatchDetails.pp_token
            });

            await PayoutLog.create({
                batch_id: payoutBatchDetails.batch_id,
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                remarks: `Payout Requested`
            });

            await PayoutApiLog.create({
                batch_id: payoutBatchDetails.batch_id,
                action_type: 'PPAPIREQUEST',
                data: data,
                created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
            });

            logger.info(`Request Body~${data},webhook url: ${process.env.PP_END_POINT_URL}`);

            var config = {
                method: 'post',
                url: process.env.PP_END_POINT_URL,
                headers: {
                    Authorization: `Basic ${process.env.PP_API_KEY}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: data
            };

            await axios(config)
                .then(async function (response) {
                    logger.info('data~', JSON.stringify(response.data));

                    await PayoutBatch.update(
                        {
                            status: 'SENT',
                            transfer_token: response.data.response.token,
                            date_sent: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                            updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                        },
                        {
                            where: { batch_id: payoutBatchDetails.batch_id, status: 'PENDING' }
                        }
                    );

                    let transaction_ids_response = await PayoutBatchItem.findAll({
                        where: {
                            batch_id: payoutBatchDetails.batch_id
                        },
                        attributes: ['card_payment_id'],
                        raw: true
                    });

                    let transaction_ids = [];
                    transaction_ids_response.forEach((payoutBatchDetails) => {
                        transaction_ids.push(payoutBatchDetails.card_payment_id);
                    });

                    console.log(transaction_ids);

                    await Payments.update(
                        {
                            transaction_status_id: 4
                        },
                        {
                            where: {
                                id: transaction_ids
                            }
                        }
                    );

                    await PayoutLog.create({
                        batch_id: payoutBatchDetails.batch_id,
                        updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                        remarks: `Payout Request Sent`
                    });

                    await PayoutApiLog.create({
                        batch_id: payoutBatchDetails.batch_id,
                        action_type: 'PPAPIRESPONSE',
                        data: JSON.stringify(response.data),
                        created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                    });

                    await sequelize.close();
                    console.log(response.data);
                })
                .catch(async function (error) {
                    logger.error(`Error Processing:${error}`);

                    await PayoutApiLog.create({
                        batch_id: payoutBatchDetails.batch_id,
                        action_type: 'PPAPIERROR',
                        data: JSON.stringify(error),
                        created_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                    });

                    await PayoutBatch.update(
                        {
                            status: 'FAILED',
                            date_sent: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                            updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                        },
                        {
                            where: { batch_id: payoutBatchDetails.batch_id, status: 'PENDING' }
                        }
                    );

                    await PayoutLog.create({
                        batch_id: payoutBatchDetails.batch_id,
                        updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                        remarks: `Payout Request Failed`
                    });

                    await sequelize.close();
                });

            logger.info(logMetadata, 'api_response', api_response);
            return { message: `Merchant payout request successful`, receiptHandle, success: true };
        } catch (err) {
            logger.error(`Processing error ${err}`);
            await savepoint.rollback();
            return { message: `Error Processing`, success: false };
        }
    }

    async postProcessMessage(executions) {
        console.log('Executions result:', executions);
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

        const processSuccesItems = executions.filter((result) => result?.success === true);

        for (let successMsg of processSuccesItems) {
            console.log('successMsg:', successMsg);
            const params = {
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: successMsg.receiptHandle
            };

            console.log(params, 'successMsg');
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
    }
}
