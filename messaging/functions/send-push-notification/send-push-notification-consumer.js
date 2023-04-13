const { PushNotificationService } = require('../../consumer/push-notification.service');

const pushNotificationService = new PushNotificationService();

export const main = async (event, context) => {
    console.log('Start processing Notification event', event);
    await pushNotificationService.sendPushNotification(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
