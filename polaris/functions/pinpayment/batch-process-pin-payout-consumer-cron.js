/*
 * @step# : 4
 * @Description: This consumer picks the message published by ProcessPinPayoutPublisher from BatchProcessPinPayoutsQueue and initiates for payout by invoking the pinpayment/tipalti service
 * @Test: No input required, running the lambda will do the processing
 */

const { BatchProcessPinPaymentPayout } = require('./batch-process-pin-payout.service');

const batchProcessPinPayoutService = new BatchProcessPinPaymentPayout();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await batchProcessPinPayoutService.init(event, context);
    return {};
};
