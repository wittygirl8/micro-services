var { logHelpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');
const logger = logHelpers.logger;
export const main = async (event) => {
    let { payload } = JSON.parse(event.body);
    let logMetadata = {
        location: 'RefundSaleDLQ ~ main',
        order_id: payload.order_id,
        merchant_id: payload.merchant_id,
        amount: payload.amount,
        reason: payload.reason,
        host: payload.host,
        silent: payload.silent,
        destination: payload.destination
    };

    logger.info(logMetadata, 'main');

    return {};
};
