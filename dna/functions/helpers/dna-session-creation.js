const axios = require('axios');

export const dnaSessionCreation = async (params) => {
    const dnaHostedForm = JSON.parse(process.env.DNA_HOSTED_FORM);
    const url = dnaHostedForm.authBaseUrl + '/oauth2/token';

    var FormData = require('form-data');
    var data = new FormData();
    if (params.type === 'sale') {
        data.append('scope', dnaHostedForm.scope);
        data.append('invoiceId', params.omt);
        data.append('amount', params.amountItems.total / 100);
        data.append('currency', params.amountItems.country_code_3letters);
        data.append('terminal', dnaHostedForm.terminalId);
    } else if (params.type === 'refund') {
        data.append('scope', 'webapi');
    }

    data.append('grant_type', 'client_credentials');
    data.append('client_id', dnaHostedForm.clientId);
    data.append('client_secret', dnaHostedForm.clientSecret);

    var config = {
        method: 'post',
        url,
        headers: {
            ...data.getHeaders()
        },
        data: data
    };

    const response = await axios(config)
        .then((response) => {
            // console.log(JSON.stringify(response.data));
            return response.data;
        })
        .catch((error) => {
            console.log(error);
        });

    return response;
};
