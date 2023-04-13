var { MerchantResponse, schema, logHelpers, helpers, Wallet, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
const CODE_WALLET_INSUFFICENT_BALANCE = 2001;

export const WalletSale = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    let logMetadata = {
        location: 'SwitchService ~ WalletSale',
        awsRequestId: context.awsRequestId
    };

    let db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    let { sequelize, Payment, Customer, Tier } = db;
    try {
        //authorize
        let AuthToken = event.headers.api_token;
        logger.info(logMetadata, event.headers);
        await TokenAuthorize(AuthToken);

        if (!event.body) {
            throw { message: 'Payload missing' };
        }
        let payload = JSON.parse(event.body);
        payload = await schema.WalletSaleSchema.validateAsync(payload); //sanitization
        let addressObect = payload.address;
        let address =
            (addressObect.house_number ? `${addressObect.house_number}` : '') +
            (addressObect.flat ? `,${addressObect.flat}` : '') +
            (addressObect.address1 ? `,${addressObect.address1}` : '') +
            (addressObect.address2 ? `,${addressObect.address2}` : '') +
            (addressObect.postcode ? `,${addressObect.postcode}` : '');
        //to log the api here to some db table if required

        const wallet = await new Wallet({
            shopper_id: payload.shopper_id,
            dbConnection: db
        });
        //wallet balance calculation
        let WalletBalance = await wallet.ballance();
        let Difference = parseFloat(WalletBalance - payload.amount);
        //checkif is wallet has sufficient fund, if not throw error
        if (Difference < 0) {
            return MerchantResponse(
                {
                    message: 'Insufficent Balance',
                    data: {
                        available_balance: WalletBalance,
                        order_value: payload.amount.toFixed(2),
                        required_amount: Math.abs(Difference).toFixed(2)
                    },
                    code: CODE_WALLET_INSUFFICENT_BALANCE
                },
                'failed'
            );
        }

        //getting feeInfo based on tier
        let FeeInfo = await helpers.getFeeInfo(
            {
                total_amount: payload.amount,
                merchant_id: payload.merchant_id
            },
            { Customer, Tier }
        );
        //seed card_payment
        let PaymentRef = await Payment.create({
            order_id: payload.order_id,
            customer_id: payload.merchant_id,
            shopper_id: payload.shopper_id,
            total: FeeInfo.total,
            fees: FeeInfo.fee,
            payed: FeeInfo.net,
            firstname: payload.first_name,
            lastname: payload.last_name,
            email: payload.email ? payload.email : '',
            address: address,
            week_no: moment().tz(TIMEZONE).format('W'),
            payment_provider: 'WALLET',
            payment_status: 'UNTRIED',
            provider: 'FH',
            origin: 'API'
        });

        //do wallet payment
        await wallet.payment({
            amount: payload.amount,
            order_id: payload.order_id,
            payment_id: PaymentRef.id
        });

        //update card_payment table to success
        await Payment.update(
            {
                payment_status: 'OK'
            },
            { where: { id: PaymentRef.id } }
        );
        //update card_payment table as success
        let SuccessResponse = {
            payment_id: PaymentRef.id
        };
        return MerchantResponse(SuccessResponse);
    } catch (e) {
        let ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'errorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
