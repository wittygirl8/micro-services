const { AutoWithdrawalService } = require('../../consumer/auto-withdrawal.service');

const autoWithdrawalService = new AutoWithdrawalService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await autoWithdrawalService.init(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
