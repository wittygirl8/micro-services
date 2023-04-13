var { cryptFunctions, response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const { paymentsController } = require('../business-logic');

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
let logger = logHelpers.logger;

export const redirect = async (event) => {
    try {
        AWSXRay.capturePromise();
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {}); //do nothing
        }

        let urlData = event.queryStringParameters.data;
        let encryptedData = Buffer.from(urlData, 'base64').toString('ascii');
        var reqBody = await paymentsController.decryptRequest(
            encryptedData,
            cryptFunctions,
            process.env.STRIPE_PAYLOAD_ENCRYPTION_KEY
        );

        reqBody = JSON.parse(reqBody);

        return response(null, 301, {
            location:
                reqBody.provider === 'FH'
                    ? `https://order.foodhub.co.uk/payment.php?simple=1&bSuccess&id=${reqBody.order_id}`
                    : `https://${reqBody.host}/payment.php?simple=1&bSuccess&id=${reqBody.order_id}`
        });
    } catch (error) {
        logger.error(`~ redirect ~ errorResponse`, error);
        return response({ message: 'fail' }, 200);
    }
};
