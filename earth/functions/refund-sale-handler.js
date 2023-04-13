var { response, schema, cryptFunctions, saleHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const EarthBusinessLogic = require('./logic/earthBusinessLogic');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
export const refundSale = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }

    let logMetadata = {
        location: 'EarthService ~ refundSale',
        orderId: '',
        awsRequestId: context.awsRequestId
    };

    var db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    var { sequelize, CardstreamSettings, Payment, Payments, Customer } = db;
    // var transaction = await sequelize.transaction();
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;

    try {
        let encrptedPayload = JSON.parse(event.body);
        let payload = cryptFunctions.decryptPayload(encrptedPayload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        payload = JSON.parse(payload);

        //sanity check
        payload = await schema.refundSchema.validateAsync(payload);
        payload.amount = payload.amount.toFixed(2); //changing the amount with two digit precision
        console.log({ payload });
        logMetadata.orderId = payload.order_id;
        logMetadata.amount = payload.amount;

        //check if a successful transaction exists with db

        let requestObj = {
            order_id: `${payload.order_id}`,
            customer_id: payload.merchant_id,
            payment_status: 'OK'
        };

        let paymentStatus = await EarthBusinessLogic.getPaymentRecordForRefund(requestObj, Customer, Payment, Payments);

        //throw error, if transaction could not be found
        if (!paymentStatus) {
            throw { message: 'No transaction found' };
        }
        /*
        //throw error, if refund been already intiated
        if (paymentStatus.refund !== '') {
            throw { message: 'Transaction already refunded' + paymentStatus.refund };
        }
        */
        //throw error, if refund been already intiated
        if (Number(payload.amount) > Number(paymentStatus.total) || Number(payload.amount) <= 0) {
            throw { message: 'Invalid amount' };
        }

        let csSettings = await CardstreamSettings.findAll({
            attributes: ['name', 'value']
        }).then(function (resultSet) {
            let settings = {};
            resultSet.forEach((resultSetItem) => {
                settings[resultSetItem.name] = resultSetItem.value;
            });
            return settings;
        });

        var { cardstream_id } = await Customer.findOne({
            where: { id: payload.merchant_id }
        });

        var refundCsPayload = {};
        await sequelize.close();

        //for normal CS txns, the xref is found with card_payment->CrossReference table itself
        //But with wallet transaction, the associated partial card txn to be refunded
        //The reference for such will be passed in the payload from the php gateway
        console.log({ paymentStatus });
        let CsXreference = paymentStatus.CrossReference;
        if (paymentStatus.payment_provider === 'WALLET') {
            CsXreference = payload.CrossReference;
        }

        if (!CsXreference) {
            throw { message: 'Refund cannot be processed!' };
        }
        //query sate of transaction
        let transaction_state = await saleHelpers.processCardStreamPayment(
            {
                action: 'QUERY',
                merchantID: cardstream_id,
                xref: CsXreference
            },
            csSettings.api_key
        );

        logger.info(logMetadata, 'transaction_state', transaction_state);
        if (transaction_state.responseCode === 0) {
            //if the state of transaction is accepted which mean it has been settled, then we need to use refund_sale action
            if (
                transaction_state.state == 'accepted' ||
                transaction_state.state == 'tendered' ||
                transaction_state.state == 'deferred'
            ) {
                refundCsPayload = {
                    action: 'REFUND_SALE',
                    merchantID: cardstream_id,
                    xref: CsXreference,
                    amount: Math.round(Number(payload.amount) * 100) // multiplying by 100 to change amount in cents
                };
            } else if (
                transaction_state.state == 'received' ||
                transaction_state.state == 'approved' ||
                transaction_state.state == 'captured'
            ) {
                //check if its full/partial refund
                if (Number(payload.amount) < Number(paymentStatus.total)) {
                    //for non-settled transactions, we either 'cancel'/'capture' the sale based on full/partial refund
                    //1.when refunding for the first time, transaction_state.amountReceived will be equal to sale amount
                    //2.when refunding for the second time onwards,  transaction_state.amountReceived will be based on last partial refund done
                    //2a.in this case, we need to re-calculate the capture amount re-capture the sale again
                    //3.when full amount being refunded, 'cancel' the sale instead of 'capture'
                    let capture_amount;
                    //#1
                    if (Number(paymentStatus.total) * 100 === transaction_state.amountReceived) {
                        capture_amount = Math.round((Number(paymentStatus.total) - Number(payload.amount)) * 100);

                        logMetadata.capture_amount = capture_amount;

                        refundCsPayload = {
                            action: 'CAPTURE',
                            merchantID: cardstream_id,
                            xref: CsXreference,
                            amount: capture_amount // in cents
                        };
                    } else {
                        //#2 and #2a
                        let amountReceived = transaction_state.amountReceived / 100;
                        let prevRefundedAmount = Number(paymentStatus.total) - amountReceived;
                        capture_amount = Math.round(
                            (Number(paymentStatus.total) - (prevRefundedAmount + Number(payload.amount))) * 100
                        );

                        logMetadata.amountReceived = amountReceived;
                        logMetadata.prevRefundedAmount = prevRefundedAmount;
                        logMetadata.capture_amount = capture_amount;
                        //#3
                        refundCsPayload = {
                            action: capture_amount === 0 ? 'CANCEL' : 'CAPTURE',
                            merchantID: cardstream_id,
                            xref: CsXreference
                        };
                        if (refundCsPayload.action === 'CAPTURE') {
                            refundCsPayload['amount'] = capture_amount;
                        }
                    }
                } else {
                    //cancelling the sale as its full refund
                    refundCsPayload = {
                        action: 'CANCEL',
                        merchantID: cardstream_id,
                        xref: CsXreference
                    };
                }
            } else {
                throw {
                    message: `Can not refund amount. Transaction current state: ${transaction_state.state}`
                };
            }
        } else {
            throw {
                message: `${transaction_state.responseMessage}`
            };
        }

        logger.info(logMetadata, 'refundCsPayload', refundCsPayload);

        //do refund with cardstream by cancelling the sale
        let cs_response = await saleHelpers.processCardStreamPayment(refundCsPayload, csSettings.api_key);

        logger.info(logMetadata, 'cs_response', cs_response);
        db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        // eslint-disable-next-line
        var { sequelize, CardstreamRefundLog } = db;

        //populate cardstream refund log
        await CardstreamRefundLog.create({
            card_payment_id: paymentStatus.id,
            xref: cs_response.xref,
            amount: payload.amount,
            outcome: cs_response.responseCode === 0 ? '1' : '0'
        });

        if (cs_response.responseCode !== 0) {
            throw {
                message: `${cs_response.responseMessage} - ${cs_response.xref} - ${cs_response.state}`
            };
        } else {
            //console logging it for some data investigation
            logger.info(logMetadata, `${cs_response.responseMessage} - ${cs_response.xref} - ${cs_response.state}`);
        }

        let api_response = {
            request_id: requestId,
            message: 'Refund has been processed successfully',
            data: {
                order_id: payload.order_id,
                amount: payload.amount
            }
        };
        logger.info(logMetadata, 'api_response', api_response);
        await sequelize.close();

        // sends the http response with status 200
        return response(api_response);
    } catch (e) {
        let errorResponse = {
            error: {
                request_id: requestId,
                type: 'error',
                message: e.message
            }
        };
        logger.error(logMetadata, 'errorResponse', errorResponse);
        await sequelize.close();
        return response(errorResponse, 500);
    }
};
