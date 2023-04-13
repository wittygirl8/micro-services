const { CsvUKService } = require('../../consumer/send-csv-uk.service');

const csvService = new CsvUKService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await csvService.init(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
