const { MasterTokenService } = require('../../consumer/master_token.service');

const masterTokenService = new MasterTokenService();

export const main = async (event) => {
    await masterTokenService.mastertoken(event);

    // return any succes message and let unhandled errors to throws
    return {};
};
