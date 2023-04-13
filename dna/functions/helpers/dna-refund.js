const axios = require('axios');

export const dnaRefund = async (dnaToken, obj, paymentStatus, isSettled) => {
    const data = isSettled
        ? {
              id: paymentStatus.psp_reference,
              amount: obj.amount / 100,
              reason: obj.reason
          }
        : {
              id: paymentStatus.psp_reference
          };

    console.log('refundReqPayload', data);
    const url =
        JSON.parse(process.env.DNA_HOSTED_FORM).baseUrl + `/transaction/operation/${isSettled ? 'refund' : 'cancel'}`;
    let response = await axios
        .post(
            url,
            { ...data },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: 'Bearer ' + dnaToken.access_token
                }
            }
        )
        .then((response) => response.data)
        .catch((error) => {
            console.log('error:', error);
            return error.response.data;
        });
    console.log('adyenRefundResponse', response);
    return response;
};
