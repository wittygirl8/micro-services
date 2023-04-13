const { SNSService } = require('../../consumer/sns-sms.service');

const snsService = new SNSService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await snsService.sendSMS(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
