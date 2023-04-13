var { MerchantResponse, schema, logHelpers, Wallet, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

export const WalletHistory = async (event, context) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {});
    }
    let logMetadata = {
        location: 'SwitchService ~ WalletHistory',
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
        payload = await schema.WalletHistorySchema.validateAsync(payload); //sanitization

        //to log the api here to some db table if required
        const wallet = await new Wallet({
            shopper_id: payload.shopper_id,
            dbConnection: db
        });
        let HistoryInfo = await wallet.history(payload.page);

        let SuccessResponse = {
            balance: HistoryInfo.balance,
            current_page: payload.page++,
            has_more: HistoryInfo.has_more,
            data: HistoryInfo.transactions
        };
        return MerchantResponse(SuccessResponse);
    } catch (e) {
        let ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'errorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
