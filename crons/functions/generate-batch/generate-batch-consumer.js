const { GenerateBatchService } = require('../../consumer/generate-batch.service');

const generateBatchService = new GenerateBatchService();

export const main = async (event) => {
    await generateBatchService.generateBatch(event);

    // return any succes message and let unhandled errors to throws
    return {};
};
