/*
 * @step# : 2
 * @Description: This processes the messages published through pin-payment-publisher
 * Calculates the withdrawable amounts
 * Validates and creates batches
 * @Test: No input required, messages will be automatically consumed from the messaging queue PinPayoutsQueue
 */

const { PinPaymentPayout } = require('../pinpayment/pin-payout.service');

const pinPayoutService = new PinPaymentPayout();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await pinPayoutService.init(event, context);
    return {};
};
