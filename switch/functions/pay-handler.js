var { response, flakeGenerateDecimal, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const db = connectDB(
    process.env.DB_RESOURCE_ARN,
    process.env.STAGE + '_database',
    '',
    process.env.SECRET_ARN,
    process.env.IS_OFFLINE
);

let logger = logHelpers.logger;

console.log('process.env.IS_OFFLINE', process.env.IS_OFFLINE);
export const pay = async (event, context) => {
    let logMetadata = {
        location: 'SwitchService ~ pay',
        awsRequestId: context.awsRequestId
    };
    const { sequelize, Customer } = db;
    const requestId = 'reqid_' + flakeGenerateDecimal();
    const transaction = await sequelize.transaction();

    try {
        const userSetting = await Customer.findOne({
            where: { id: 11111111 }
        });
        logger.info(logMetadata, 'userSetting', userSetting);
        return response({
            requestId,
            message: 'The request was processed successfully',
            data: {
                success: 'ok'
            }
        });
    } catch (err) {
        logger.error(logMetadata, 'here error');
        await transaction.rollback();
        return response(err.message, 500);
    }
};
