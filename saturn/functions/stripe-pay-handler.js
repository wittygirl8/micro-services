var { helpers, cryptFunctions, response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

let logger = logHelpers.logger;

var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

const db = connectDB(
    process.env.DB_HOST,
    process.env.DB_DATABASE,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    process.env.IS_OFFLINE
);

const {
    stripeController,
    paymentsController,
    customerController,
    stripeFeeAdjustmentsController
} = require('../business-logic');

const { Payment, Customer, StripeFeeAdjustments, StripePaymentInfo, DeliveryFee, Sequelize } = db;

let checkAlreadyPaid = async (info, { awsRequestId }) => {
    let logMetadata = {
        location: 'SaturnService ~ checkAlreadyPaid',
        awsRequestId
    };

    logger.info(logMetadata, 'checkAlreadyPaid started');
    try {
        var val = await paymentsController.getPaymentStatus(info, Payment);
        if (val) return true;
    } catch (error) {
        logger.error(logMetadata, `~ checkAlreadyPaid ~ errorCatch`, error);
    }
    //here we are resolving with false cz main functions just want to know weather this order is already paid or not, this is not an error,
    return false;
};

let submit = async (info, reqHeaders, customerInfo, { awsRequestId }, Sequelize) => {
    let logMetadata = {
        location: 'SaturnService ~ submit',
        awsRequestId
    };
    logger.info(logMetadata, `~ submit ~ info ~ submit function started`);
    // explaination -  object{info} this is the decrypted payload
    // explaination -   object{customerInfo} retired from the database
    // explaination - string{urlData} encryptrd string.

    logger.info(logMetadata, `~ submit ~ reqHeaders`, reqHeaders);
    let ip = reqHeaders['CF-Connecting-IP'] || '';

    logger.info(logMetadata, `~ submit ~ ip ~ ${ip}`);
    logger.info(logMetadata, `~ submit ~ customerInfo`, customerInfo);
    logger.info(logMetadata, `~ submit ~ customer type ~ ${customerInfo.stripe_acc_type}`);

    //according to ND-882 if customer is Eatappy users then below mentioned fees would be applicable
    if (customerInfo.stripe_acc_type == 'EAT-APPY') {
        //for orders greater than or equal to $15
        if (info.Amount >= 15) {
            customerInfo.stripe_fee_percent = 2.25;
            customerInfo.stripe_admin_fee = 0.3;
        } else {
            //for orders less than $15
            customerInfo.stripe_fee_percent = 3;
            customerInfo.stripe_admin_fee = 0.05;
        }
    }
    let customer_fee_percent = customerInfo.stripe_fee_percent;
    let customer_admin_fee = customerInfo.stripe_admin_fee;

    const customerSetupFee = customerInfo.setupFee;
    let remainingSetupFeeToRecover = 0.0;

    if (customerSetupFee >= 0.0) {
        const totalChargedSetupFeeAdjustment = await stripeFeeAdjustmentsController.getSetupFeeAdjustmentSum(
            {
                customerId: customerInfo.id
            },
            StripeFeeAdjustments,
            Sequelize
        );

        remainingSetupFeeToRecover = customerSetupFee - totalChargedSetupFeeAdjustment;
    }

    // amount, percentage, adminFee
    var segmentedStripeFeeMap = helpers.stripeFeeCalculation(
        info.Amount,
        customer_fee_percent,
        customer_admin_fee,
        remainingSetupFeeToRecover
    );

    logger.info(logMetadata, `~ submit ~ segmentedStripeFeeMap`, { segmentedStripeFeeMap });

    let fee = parseFloat(segmentedStripeFeeMap.fee).toFixed(2);

    info['payment_status'] = 'UNTRIED';
    info['CrossReference'] = `O${info.order_id}M${info.merchant_id}C${info.customer_id}`;
    info['payment_provider'] = 'STRIPE';
    info['VPSTxId'] = '';
    info['VendorTxCode'] = '';
    info['SecurityKey'] = '';

    info['ip'] = ip;
    info['fees'] = fee;

    info['payed'] = parseFloat(parseFloat(info.Amount).toFixed(2) - fee).toFixed(2);
    info['SecurityKey'] = '';
    info['week_no'] = moment().tz(TIMEZONE).format('W');

    // explaination - add the {info} to the card_payemnt table with payment_staus = UNTRIED
    var paymentRecordSuccess = await paymentsController.addPaymentRecord(info, Payment);
    if (Number(info.delivery_fee) !== 0) {
        const deliveryFeeParams = {
            order_id: info.order_id,
            card_payment_id: paymentRecordSuccess.id,
            delivery_fee: info.delivery_fee
        };
        await DeliveryFee.create(deliveryFeeParams);
    }
    if (paymentRecordSuccess && paymentRecordSuccess.dataValues && paymentRecordSuccess.dataValues.id) {
        if (segmentedStripeFeeMap.setupFeeAdjustment) {
            //Need setupFeeAdjustmentAmount book-keeping records to trace-back the setup fee related charges, setupFeeAdjustment can be negative as well
            await stripeFeeAdjustmentsController.addStripeFeeAdjustmentsRecord(
                {
                    customerId: customerInfo.id,
                    total: parseFloat(info.Amount).toFixed(2),
                    fees: info.fees,
                    payed: info.payed,
                    cardPaymentId: paymentRecordSuccess.dataValues.id,
                    paymentStatus: info.payment_status,
                    adjustmentAmount: segmentedStripeFeeMap.setupFeeAdjustment.toFixed(2)
                },
                StripeFeeAdjustments
            );
        }

        return paymentRecordSuccess.dataValues.id;
    } else {
        logger.error(logMetadata, `~ submit ~ errorCatch`, paymentRecordSuccess);
        throw new Error(paymentRecordSuccess);
    }
};

// explaination -  ideally this provides the stripe accout id by passing mervhant id
let getStripeDetails = async (info) => {
    logger.info(`~ getStripeDetails ~ info`, info);
    try {
        var customerInfo = await customerController.getCustomerDetails(info['merchant_id'], Customer);
        logger.info(`~ getStripeDetails ~ customerInfo`, customerInfo);

        if (!customerInfo.stripe_acc_id || !customerInfo.currency) {
            throw new Error('stripe keys are missing');
        }

        return customerInfo;
    } catch (error) {
        logger.error(`~ getStripeDetails ~ errorCatch`, error);
        throw new Error(error);
    }
};

let sessionCheckout = async (info, transactionId, customerInfo) => {
    logger.info(`~ sessionCheckout ~ info`, info);

    let logMetadata = {
        location: 'SaturnService ~ sessionCheckout'
    };
    logger.info(logMetadata, 'session checkout started', info);
    logger.info(logMetadata, 'Fees:', info.fees);
    logger.info(logMetadata, 'Delivery Fees:', info.delivery_fee);
    var customerCredInfo = await customerController.getStripeCeredentialsDetails(info['merchant_id'], Customer);
    console.log(parseInt(info.fees * 100), parseInt(info.delivery_fee * 100));
    let paymentReferences = {
        successUrl: info.RedirectUrl,
        cancelUrl: info.CancelUrl,
        clientReferenceId: `T${transactionId}O${info.order_id}M${info.merchant_id}C${info.customer_id}`,
        stripe_sk: customerCredInfo.STRIPE_SK,
        stripe_pk: customerCredInfo.STRIPE_PK,
        currency: customerInfo.currency,
        stripe_acc_id: customerInfo.stripe_acc_id,
        stripe_acc_type: customerInfo.stripe_acc_type,
        application_fee_amount: parseInt(info.fees * 100) + parseInt(info.delivery_fee * 100)
    };

    logger.info(`~ sessionCheckout ~ session checkout continues`, paymentReferences);
    let orderDetails = {
        name: info.firstname,
        email: info.email,
        total: info.Amount
    };
    //add payment status to UNTRIED

    var sessionId = await stripeController.stripeCreateCheckoutSession(orderDetails, paymentReferences, logMetadata);
    return {
        sessionId: sessionId,
        paymentReferences: paymentReferences
    };
};

export const stripePay = async (event, context) => {
    let logMetadata = {
        location: 'SaturnService ~ stripePay',
        awsRequestId: context.awsRequestId
    };

    try {
        AWSXRay.capturePromise();
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {}); //do nothing
        }
        logger.info(`~ stripePay ~ info ~ Stripe Payment Started`);

        let reqHeaders = event.headers;
        let urlData = event.queryStringParameters.data;
        logger.info(`~ stripePay ~ urlData ~ ${urlData}`);
        let encryptedData = Buffer.from(urlData, 'base64').toString('ascii');

        // explaination -  t2s send the data in encrypted way so we need to dcry before we process - the o/p should be json.

        var reqBody = await paymentsController.decryptRequest(
            encryptedData,
            cryptFunctions,
            process.env.STRIPE_PAYLOAD_ENCRYPTION_KEY
        );

        logger.info(reqBody, `Printingtherequestbody`);

        reqBody = JSON.parse(reqBody);

        //explaination -  definatly needed
        if (!reqBody.merchant_id || !reqBody.order_id || !reqBody.customer_id || !reqBody.provider || !reqBody.host) {
            logger.error(`~ stripePay ~ reqBody`, JSON.stringify(reqBody));
            return response(
                {
                    message: 'failed',
                    err: 'mandatory keys are missing merchant_id,order_id, customer_id, provider, host '
                },
                200
            );
        }
        if (reqBody.delivery_fee && Number(reqBody.delivery_fee) < 0) {
            logger.info(logMetadata, 'reqBody.delivery_fee', reqBody.delivery_fee);
            return response(
                {
                    message: 'failed',
                    err: 'delivery_fee cannot be negative'
                },
                200
            );
        }
        var isPaid = await checkAlreadyPaid(reqBody, logMetadata);
        if (isPaid) {
            return response(null, 301, {
                location: reqBody.RedirectUrl
            });
        }

        logger.info(`~ stripePay ~ reqBody ~ Order is not placed, lets move ahead`);

        try {
            // explaination -  ideally this provides the stripe accout id and some more extra info by passing mervhant id
            var getStripeDetailsResult = await getStripeDetails(reqBody, logMetadata);

            if (!reqBody.delivery_fee) {
                reqBody.delivery_fee = 0; // if no delivery fee is provided set it to zero
            }
            // explaination - just pus the data to cardpayemnt table
            var submitResult = await submit(reqBody, reqHeaders, getStripeDetailsResult, logMetadata, Sequelize);

            // explaination - session id for the payment from stripe.
            var sessionCheckoutResult = await sessionCheckout(
                reqBody,
                submitResult,
                getStripeDetailsResult,
                urlData,
                logMetadata
            );
            if (sessionCheckoutResult.sessionId && sessionCheckoutResult.paymentReferences) {
                await StripePaymentInfo.create({
                    webhook_url: reqBody.WebhookUrl,
                    card_payment_id: submitResult, //payment id
                    order_id: reqBody.order_id,
                    merchant_id: reqBody.merchant_id
                });

                logger.info(`~ stripePay ~ sessionID`, sessionCheckoutResult.sessionId);
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/html'
                    },
                    body: `
          <html>
          <script>
          if (top.location != location) {
              top.location.href = document.location.href ;
            }
          </script>
          <script src="https://js.stripe.com/v3/"> </script>
          <script>
             var stripe = Stripe('${sessionCheckoutResult.paymentReferences.stripe_pk}')
             stripe.redirectToCheckout({
                 sessionId: '${sessionCheckoutResult.sessionId}'
             }).then(function (result) {
                 logger.info(logMetadata,'result:', result)
             });
          </script>
       </html>
          `
                };
            }
        } catch (err) {
            let cErr;
            try {
                cErr = err.toString('ascii').replace('£', '&pound;');
            } catch (e) {
                cErr = 'unknown error';
            }
            return {
                statusCode: 400,
                headers: {
                    'content-type': 'text/html'
                },
                // '${err.replace('£', '&pound;')}'
                body: `
        <p>&nbsp;</p>
        <h1>2002 - Something went wrong</h1>
        <blockquote>
           Sorry we cannot the process payment at the moment.
           <p>&nbsp;</p>
           <table width="488">
              <tbody>
                 <tr>
                    <td><em><span style="color: #999999;" >
                       <font size="1">
                       '${cErr}'
                       </font>
                       </span></em>
                    </td>
                 </tr>
              </tbody>
           </table>
        </blockquote>
        `
            };
        }
    } catch (error) {
        logger.error(`~ stripePay ~ errorCatch`, error.stack);
        logger.error(`~ stripePay ~ errorCatch`, error);
        return response(error);
    }
};
