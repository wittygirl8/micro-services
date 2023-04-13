const { CsvIrelandService } = require('../../consumer/send-csv-ireland.service');

const csvService = new CsvIrelandService();

export const main = async (event, context) => {
    console.log('Start processing event', event);
    await csvService.init(event, context);

    // return any succes message and let unhandled errors to throws
    return {};
};
