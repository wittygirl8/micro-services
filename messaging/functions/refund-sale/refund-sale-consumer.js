const { RefundService } = require('../../consumer/refund-sale.service');

const refundService = new RefundService();

export const main = async (event) => {
    await refundService.refund(event);
    // return any succes message and let unhandled errors to throws
    return {};
};
