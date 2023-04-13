const { InvoiceGeneratorService } = require('../../consumer/invoice-generator.service');

const invoiceGeneratorService = new InvoiceGeneratorService();

export const main = async (event) => {
    await invoiceGeneratorService.invoiceGenerator(event);

    // return any succes message and let unhandled errors to throws
    return {};
};
