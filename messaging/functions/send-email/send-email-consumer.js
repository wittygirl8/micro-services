const { SESService } = require('../../consumer/ses-email.service');

const sesService = new SESService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await sesService.sendBulkEmail(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
