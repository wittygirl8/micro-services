const { MasterTokenV2Service } = require('../../consumer/master-token-v2.service');

const masterTokenV2Service = new MasterTokenV2Service();

export const main = async (event) => {
    await masterTokenV2Service.masterToken(event);

    // return any succes message and let unhandled errors to throws
    return {};
};
