const { PdqTransactions } = require('./pdq-transaction-consumer-handler');

const pdqTransactions = new PdqTransactions();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await pdqTransactions.init(event, context);
    return {};
};
