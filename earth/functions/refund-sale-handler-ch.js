var { response, schema, cryptFunctions, saleHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
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
        location: 'EarthService ~ refundSale ~ checkout.com',
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
    var { sequelize, CardstreamSettings, Payments, Customer, Sequelize } = db;
    // var transaction = await sequelize.transaction();
    // const requestId = 'reqid_' + flakeGenerateDecimal();
    const requestId = `reqid_${context.awsRequestId}`;

    try {
        let encrptedPayload = JSON.parse(event.body);
        let payload = cryptFunctions.decryptPayload(encrptedPayload.data, process.env.EARTH_PAYLOAD_ENCRYPTION_KEY);
        payload = JSON.parse(payload);

        logger.info(logMetadata, `payload: ${payload}`);
        //sanity check
        payload = await schema.refundSchema.validateAsync(payload);
        payload.amount = payload.amount.toFixed(2); //changing the amount with two digit precision
        let payload_amount_cents = Math.round(Number(payload.amount) * 100); //multiplying by 100& Math.rounding it as new 'payments' table value is in cents

        logMetadata.orderId = payload.order_id;
        logMetadata.amount = payload.amount;
        logMetadata.payload_amount_cents = payload_amount_cents;

        //check if a successful transaction exists with db
        let paymentStatus = await Payments.findOne({
            where: {
                [Sequelize.Op.and] : 
                [{order_ref: `${payload.order_id}`},
                {merchant_id: payload.merchant_id},
                {transaction_status_id: { [Sequelize.Op.in]: [1,3,4,5,6] }}]
            }
        });

        logger.info(logMetadata, `paymentStatus: ${paymentStatus}`);
        //throw error, if transaction could not be found
        if (!paymentStatus) {
            throw { message: 'No transaction found' };
        }

        if (Number(payload_amount_cents) > Number(paymentStatus.gross) || Number(payload_amount_cents) <= 0) {
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

        logger.info(logMetadata, `cardstream_id: ${cardstream_id}`);

        var refundCsPayload = {};
        await sequelize.close();
        //query sate of transaction
        let transaction_state = await saleHelpers.processCardStreamPayment(
            {
                action: 'QUERY',
                merchantID: cardstream_id,
                xref: paymentStatus.psp_reference
            },
            csSettings.api_key
        );

        logger.info(logMetadata, `transaction_state: ${JSON.stringify(transaction_state)}`);

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
                    xref: paymentStatus.psp_reference,
                    amount: payload_amount_cents
                };
            } else if (
                transaction_state.state == 'received' ||
                transaction_state.state == 'approved' ||
                transaction_state.state == 'captured'
            ) {
                //check if its full/partial refund
                if (Number(payload_amount_cents) < Number(paymentStatus.gross)) {
                    //for non-settled transactions, we either 'cancel'/'capture' the sale based on full/partial refund
                    //1.when refunding for the first time, transaction_state.amountReceived will be equal to sale amount
                    //2.when refunding for the second time onwards,  transaction_state.amountReceived will be based on last partial refund done
                    //2a.in this case, we need to re-calculate the capture amount re-capture the sale again
                    //3.when full amount being refunded, 'cancel' the sale instead of 'capture'
                    let capture_amount;
                    //#1
                    if (Number(paymentStatus.gross) === Number(transaction_state.amountReceived)) {
                        capture_amount = Number(paymentStatus.gross) - Number(payload_amount_cents);
                        logMetadata.capture_amount = capture_amount;

                        refundCsPayload = {
                            action: 'CAPTURE',
                            merchantID: cardstream_id,
                            xref: paymentStatus.psp_reference,
                            amount: capture_amount // in cents
                        };
                    } else {
                        //#2 and #2a
                        let prevRefundedAmount = Number(paymentStatus.gross) - Number(transaction_state.amountReceived);
                        capture_amount = Math.round(
                            (Number(paymentStatus.gross) - (prevRefundedAmount + Number(payload_amount_cents)))
                        );

                        logMetadata.amountReceived = transaction_state.amountReceived;
                        logMetadata.prevRefundedAmount = prevRefundedAmount;
                        logMetadata.capture_amount = capture_amount;
                        //#3
                        refundCsPayload = {
                            action: capture_amount === 0 ? 'CANCEL' : 'CAPTURE',
                            merchantID: cardstream_id,
                            xref: paymentStatus.psp_reference
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
                        xref: paymentStatus.psp_reference
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
                amount: payload.amount,
                xref: cs_response.xref
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
