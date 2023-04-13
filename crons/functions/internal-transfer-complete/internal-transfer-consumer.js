const { InternalTransferService } = require('../../consumer/internal_transfer.service');

const internalTransferService = new InternalTransferService();

export const main = async (event) => {
    await internalTransferService.internalTransfer(event);

    // return any succes message and let unhandled errors to throws
    return {};
};
