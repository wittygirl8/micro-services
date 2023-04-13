var { MerchantResponse, schema, logHelpers, Wallet, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

export const WalletBalance = async (event, context) => {
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
    let { sequelize } = db;

    try {
        //authorize
        let AuthToken = event.headers.api_token;
        logger.info(logMetadata, event.headers);
        await TokenAuthorize(AuthToken);
        if (!event.body) {
            throw { message: 'Payload missing' };
        }
        let payload = JSON.parse(event.body);
        payload = await schema.WalletBalanceSchema.validateAsync(payload); //sanitization

        const wallet = await new Wallet({
            shopper_id: payload.shopper_id,
            dbConnection: db
        });
        let WalletBalance = await wallet.ballance();
        let SuccessResponse = {
            balance: WalletBalance
        };
        return MerchantResponse(SuccessResponse);
    } catch (e) {
        let ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'errorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
