/*
 * @step# : 4
 * @Description: This consumer picks the message published by ProcessDNAPublisher from BatchProcessDnaQueue and initiates for payout by invoking the dna service
 * @Test: No input required, running the lambda will do the processing
 */

const { BatchProcessDnaPayoutService } = require('./batch-process-dna-payout.service');

const batchProcessDnaPayoutService = new BatchProcessDnaPayoutService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await batchProcessDnaPayoutService.init(event, context);
    return {};
};
