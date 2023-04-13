var { response, flakeGenerateDecimal, mypayHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const ENUM_TYPE = {
    MERCHANT_INFO: 'MERCHANT_INFO',
    OMNIPAY: 'OMNIPAY',
    DNA_PAYMENT: 'DNA_PAYMENT',
    MERCHANT_INFO_PAYMENT_QRV3: 'MERCHANT_INFO_PAYMENT_QRV3'
};
let logger = logHelpers.logger;
var axios = require('axios');
var FormData = require('form-data');
const moment = require('moment-timezone');

let dnaAuth = async (obj) => {
    var data = new FormData();
    data.append('scope', obj.scope);
    data.append('grant_type', 'client_credentials');
    data.append('invoiceId', obj.invoiceIdDna);
    data.append('amount', obj.amount);
    data.append('currency', 'GBP');
    data.append('description', obj.description);
    // below will be fetched env
    data.append('client_secret', obj.clientSecret);
    // data.append('terminal', 'eb4528f5-4304-474b-be8a-99997d9036d5');
    data.append('terminal', obj.terminalId);
    data.append('client_id', obj.clientId);
    // data.append(
    //   "client_secret",
    //   "=7aGwhVJjtlZdmg6_wQOolaEe612wWxtA_qNQ*cnP8a4NedJNgxG--BxIDw0Urj4"
    // );
    // data.append("terminal", "24b25f01-5182-4e4b-ac55-16ab30a6bed5");
    // data.append("client_id", "foodhub");

    var config = {
        method: 'post',
        url: obj.authUrl,
        headers: {
            ...data.getHeaders()
        },
        data: data
    };
    let responseDnaAuth = await axios(config);
    logger.info('responseDnaAuth : ', responseDnaAuth);
    return responseDnaAuth.data;
};

let dnahostedFormContent = async (dnaAuthResponse, dnaAuthObject) => {
    return `<html>
    <head>
      <title>DNA Test</title>
      <script src="${dnaAuthObject.sdkUrl}"></script>
    </head>
    <body>
      <div id="dna-embedded-widget-container"></div>
      <div class="customClassName"></div>
    </body>
    <script>
      let ACCESS_TOKEN = "${dnaAuthResponse.access_token}";
      let TERMINAL_ID = "${dnaAuthObject.terminalId}";
      let INVOICE_ID = "${dnaAuthObject.invoiceIdDna}";
      let DESCRIPTION = "${dnaAuthObject.description}";
      let WEBHOOK = "${dnaAuthObject.webhookUrl}";
      let RETURN_URL = "${dnaAuthObject.returnUrl}";
      let IS_TEST_MODE = ${dnaAuthObject.isTestMode};
  
      window.DNAPayments.configure({
        isTestMode: IS_TEST_MODE,
        isEnableDonation: true,
        paymentMethods: [
          {
            name: window.DNAPayments.paymentMethods.BankCard,
          },
          {
            name: window.DNAPayments.paymentMethods.PayPal,
            message: "NO FEE",
          },
        ],
        events: {
          opened: () => {
            console.log("Checkout opened");
          },
          cancelled: () => {
            console.log("Transaction cancelled");
          },
          paid: () => {
            window.DNAPayments.closePaymentWidget();
            console.log("Transaction successful");
          },
          declined: () => {
            console.log("Transaction declined");
            window.DNAPayments.closePaymentWidget();
          },
        },
      });
  
      window.DNAPayments.openPaymentPage({
        invoiceId: INVOICE_ID,
        currency: "GBP",
        description: DESCRIPTION,
        paymentSettings: {
          terminalId: TERMINAL_ID,
          returnUrl: RETURN_URL,
          failureReturnUrl: RETURN_URL,
          callbackUrl:WEBHOOK,
          failureCallbackUrl: WEBHOOK,
        },
        customerDetails: {
          // accountDetails: {
          //   accountId: "uuid000001",
          //   accountPurchaseCount: 4,
          //   paymentAccountAgeIndicator: "05",
          //   suspiciousAccountActivity: "01",
          // },
          deliveryDetails: {
            deliveryAddressUsageIndicator: "04",
            deliveryIndicator: "01",
            // deliveryAddress: {
            //   firstName: "John",
            //   lastName: "Doe",
            //   streetAddress1: "12 FulhamRd",
            //   streetAddress2: "Fulham",
            //   postalCode: "SW61HS",
            //   city: "London",
            //   phone: "0475662834",
            //   region: "HMF",
            //   country: "GB",
            // },
          },
          // email: "demo@dnapayments.com",
          // mobilePhone: "44-07123456789",
          // firstName: "John",
          // lastName: "Doe",
        },
        // orderLines: [
        //   // {
        //   //   name: "Runningshoe",
        //   //   quantity: 1,
        //   //   unitPrice: 120,
        //   //   taxRate: 20,
        //   //   totalAmount: 120,
        //   //   totalTaxAmount: 20,
        //   //   imageUrl: "https: //www.exampleobjects.com/logo.png",
        //   //   productUrl: "https: //.../AD6654412.html",
        //   // },
        //   // {
        //   //   name: "Tracksuit",
        //   //   quantity: 2,
        //   //   unitPrice: 30,
        //   //   taxRate: 20,
        //   //   totalAmount: 60,
        //   //   totalTaxAmount: 10,
        //   //   imageUrl: "https: //www.exampleobjects.com/logo2.png",
        //   //   productUrl: "https: //.../AD6654125.html",
        //   // },
        // ],
        amount: ${dnaAuthObject.amount},
        // amountBreakdown: {
        //   shipping: {
        //     totalAmount: 2,
        //   },
        //   discount: {
        //     totalAmount: 2,
        //   },
        // },
        //   entryMode: 'mail-order',
        //   attachment: '{\"customer_account_info\":[{\"unique_account_identifier\":\"test@gmail.com\",\"account_registration_date\":\"2017-02-13T10:49:20Z\",\"account_last_modified\":\"2019-03-13T11:45:27Z\"}]}',
        auth: {
          access_token: ACCESS_TOKEN,
          expires_in: 7200,
          scope: "${dnaAuthObject.clientId}",
          token_type: "Bearer"
        },
      });
    </script>
  </html>`;
};

export const validateSession = async (event, context, callback) => {
    if (Object.prototype.hasOwnProperty.call(event, 'keep-warm')) {
        console.log('Warming validateSession');
        return callback(null, {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Required for CORS support to work
                'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
            },
            body: { message: 'warm is done' }
        });
    }

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, MypayTempTransaction, MypayShopper, Customer, PaymentTransaction } = db;
    const requestId = 'reqid_' + flakeGenerateDecimal();
    let payload = JSON.parse(event.body);

    logger.info({ payload });

    async function generateOrderId() {
        const hexString = Array(8)
            .fill()
            .map(() => Math.round(Math.random() * 0xf).toString(8))
            .join('');
        let randomBigInt = BigInt(`0x${hexString}`).toString().replace('n', '').substring(0, 11);
        logger.info('RandomBigInt : ', randomBigInt);

        let isOrderIdAvailable = await PaymentTransaction.findOne({
            where: {
                order_id: randomBigInt
            },
            raw: true
        });
        logger.info('isOrderIdAvailable : ', isOrderIdAvailable);
        if (isOrderIdAvailable) {
            generateOrderId();
        }
        return randomBigInt;
    }

    try {
        payload = {
            ...payload,
            customer_type: ENUM_TYPE.OMNIPAY
        };
        if (payload.hasOwnProperty('action') && payload.action === ENUM_TYPE.MERCHANT_INFO) {
            const apiData = {
                url: `${process.env.BIFROST_ENDPOINTS}/api/v1/bifrost/get-merchant-info-for-dna/${payload.merchant_qr_id}`,
                method: 'get',
                headers: {
                    api_token: process.env.BIFROST_API_TOKEN
                }
            };
            let bifrost_response = await axios(apiData);

            logger.info('Bifrost : ', bifrost_response);

            bifrost_response = bifrost_response.data;

            let merchantInfo = {
                id: bifrost_response.id,
                business_name: bifrost_response.business_name,
                clients_fname: bifrost_response.clients_fname,
                clients_sname: bifrost_response.clients_sname,
                customer_type: 'OMNIPAY',
                gateway: bifrost_response.gateway,
                isReceiptEnabled: bifrost_response.isReceiptEnabled
            };

            let api_response = {
                request_id: requestId,
                message: 'success',
                data: { merchantInfo }
            };

            await sequelize.close();
            return response(api_response);

            /**
             * Previous code to fetch merchant Info
            let merchantInfo = await mypayHelpers.getMerchantInfo(payload, { Customer });
            if (!merchantInfo) {
                throw new Error(`Merchant doesn't exist`);
            }

            let api_response = {
                request_id: requestId,
                message: 'success',
                data: { merchantInfo }
            };
            await sequelize.close();
            return response(api_response);
             */
        }
        if (payload.hasOwnProperty('action') && payload.action === ENUM_TYPE.MERCHANT_INFO_PAYMENT_QRV3) {
            const apiData = {
                url: `${process.env.BIFROST_ENDPOINTS}/api/v1/bifrost/get-merchant-info-for-qrV3/${payload.merchant_qr_id}`,
                method: 'get',
                headers: {
                    api_token: process.env.BIFROST_API_TOKEN
                }
            };
            let bifrost_response = await axios(apiData);

            logger.info('Bifrost : ', bifrost_response);

            bifrost_response = bifrost_response.data;

            let merchantInfo = {
                id: bifrost_response.id,
                business_name: bifrost_response.business_name,
                clients_fname: bifrost_response.clients_fname,
                clients_sname: bifrost_response.clients_sname,
                customer_type: 'OMNIPAY',
                gateway: bifrost_response.gateway,
                isReceiptEnabled: bifrost_response.isReceiptEnabled,
                amount: bifrost_response.amount,
                expiryDate: bifrost_response.expiryDate,
                status: bifrost_response.status
            };

            if (
                bifrost_response.status === 'Closed' ||
                (bifrost_response.expiryDate &&
                    moment(moment().tz('Europe/London')).isSameOrAfter(
                        moment(bifrost_response.expiryDate).tz('Europe/London')
                    ))
            ) {
                let errorResponse = {
                    error: {
                        request_id: requestId,
                        message: 'QR Code is expired!',
                        type: mypayHelpers.constants.ref_name.ERROR_TYPE,
                        statusCode: 410
                    }
                };
                return response(errorResponse, 500);
            }

            let api_response = {
                request_id: requestId,
                message: 'success',
                data: { merchantInfo }
            };

            await sequelize.close();
            return response(api_response);
        }

        if (payload.hasOwnProperty('action') && payload.action === ENUM_TYPE.DNA_PAYMENT) {
            logger.info('payload ', payload);

            if (!payload.hasOwnProperty('merchantId') || !payload.hasOwnProperty('saleData')) {
                return response({ message: 'error' }, 500);
            }

            //email and phoneNumber for sending receipt
            const {
                merchantId,
                saleData: { amount, description, email, phoneNumber },
                url
            } = payload;

            logger.info('URL ', url);

            //sample SaleData
            // saleData = {
            //     amount,
            //     description: '',
            //     email,
            //     phoneNumber
            // }

            //Generate hosted form here
            let merchant_id = merchantId;
            let saleParams = {
                amount,
                description,
                currency_code: '826'
            };

            let autoAssignedOrderRef = await generateOrderId();
            logger.info('Order Id / Invoice Id ', autoAssignedOrderRef);

            const transactionData = await PaymentTransaction.create({
                email: email,
                total: saleParams.amount,
                fees: 0,
                payed: saleParams.amount,
                payment_provider: 'DNA',
                origin: 'HOSTED-FORM',
                order_id: autoAssignedOrderRef,
                payment_status: 'PENDING',
                merchant_id
            });

            const transactionId = transactionData.id;

            let invoiceIdDna = 'T' + transactionId + 'O' + autoAssignedOrderRef + 'M' + merchant_id;

            logger.info('invoiceIdDna ', invoiceIdDna);

            // webhookUrl: `${process.env.DNA_WEBHOOK_URL}/portal/dna-webhook`,

            const apiData = {
                url: `${process.env.BIFROST_ENDPOINTS}/api/v1/bifrost/get-dna-merchant-metadata/${merchant_id}`,
                method: 'get',
                headers: {
                    api_token: process.env.BIFROST_API_TOKEN
                }
            };
            let bifrost_response = await axios(apiData);
            logger.info('Bifrost : ', bifrost_response);
            let dnaTerminalData = bifrost_response.data;

            let dnaAuthObject = {
                amount: saleParams.amount,
                description: saleParams.description,
                invoiceIdDna: invoiceIdDna,
                webhookUrl: `${process.env.DNA_WEBHOOK_URL}`,
                returnUrl: url,
                terminalId: dnaTerminalData.terminalId,
                clientSecret: process.env.DNA_CLIENT_SECRET,
                scope: process.env.DNA_SCOPE,
                clientId: process.env.DNA_CLIENT_ID,
                authUrl: `${process.env.DNA_BASE_URL}/oauth2/token`,
                sdkUrl: process.env.DNA_SDK_URL,
                isTestMode: process.env.DNA_IS_TEST_MODE
            };

            // Auth DNA
            let dnaAuthResponse = await dnaAuth(dnaAuthObject);

            logger.info('dnaAuthResponse ', dnaAuthResponse);

            if (!dnaAuthResponse) throw 'dnaAuthResponse is undefined';

            let dnaForm = await dnahostedFormContent(dnaAuthResponse, dnaAuthObject);

            logger.info('dnaForm', dnaForm);

            await sequelize.close();

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'successful',
                    dna_html: dnaForm
                })
            };
        }

        let sessionInfo = await mypayHelpers.validateSession(
            {
                session_id: payload.session_id,
                action: payload.action
            },
            {
                MypayTempTransaction
            }
        );

        let params = {
            customer_id: sessionInfo.customer_id
        };
        let merchantInfo = await mypayHelpers.getMerchantInfo(params, { Customer });

        let shopperInformation = await MypayShopper.findOne({
            where: {
                id: sessionInfo.shopper_id
            }
        });

        let api_response = {
            request_id: requestId,
            message: 'success',
            data: {
                ...sessionInfo,
                email: shopperInformation.email,
                recipients_email: shopperInformation.recipients_email,
                merchantInfo,
                merchant_name: merchantInfo.business_name
            }
        };
        await sequelize.close();
        return response(api_response);
    } catch (e) {
        await sequelize.close();
        let errorResponse = {
            error: {
                request_id: requestId,
                message: e.message,
                type: mypayHelpers.constants.ref_name.ERROR_TYPE
            }
        };
        return response(errorResponse, 500);
    }
};
