const { logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const logger = logHelpers.logger;
const axios = require('axios');
const { encryptCardDetails } = require('./encrypt-card-details');

export const dnaExpressSale = async (dbInstance, params, awsRequestId) => {
    const logMetadata = {
        location: 'dna ~ dnaExpressPay ~ dnaExpressSale',
        awsRequestId
    };

    const dnaHostedForm = JSON.parse(process.env.DNA_HOSTED_FORM);

    const cardData = {
        cardTokenId: params.payload.card_token
    };

    // get card details as encrypted string
    const encryptedData = await encryptCardDetails(cardData, params.dnaToken.access_token);
    logger.info(logMetadata, 'encryptedData: ', encryptedData);

    const data = JSON.stringify({
        invoiceId: params.payload.omt,
        amount: params.amountItems.total / 100,
        currency: params.amountItems.country_code_3letters,
        paymentSettings: {
            allowNonThreeDS: true,
            terminalId: dnaHostedForm.terminalId,
            callbackUrl: `${dnaHostedForm.dnaApiEndpoint}/hosted-form/webhook`
        },
        cardDetails: {
            encryptedData
        },
        auth: params.dnaToken
    });

    const config = {
        method: 'post',
        url: `${dnaHostedForm.baseUrl}/v2/payments`,
        headers: {
            Authorization: `Bearer ${params.dnaToken.access_token}`,
            'Content-Type': 'application/json'
        },
        data: data
    };

    let express_sale_result = await axios(config)
        .then((response) => response)
        .catch((error) => {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                return {
                    status: error.response.status,
                    data: error.response.data?.message
                };
            }
            return { status: 500, data: error.message };
        });

    console.log('express_sale_result', JSON.stringify(express_sale_result?.data));

    if (express_sale_result.status >= 400) {
        throw { code: express_sale_result.status, message: express_sale_result.data };
    }
    return express_sale_result;
};
