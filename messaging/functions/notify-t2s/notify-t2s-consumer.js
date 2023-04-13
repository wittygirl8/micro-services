const { MessagingService } = require('../../consumer/messaging.service');

const messagingService = new MessagingService();

export const main = async (event, context) => {
    await messagingService.notifyT2s(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
