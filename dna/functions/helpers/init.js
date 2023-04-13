const AWSXRay = require('aws-xray-sdk');

export const init = async (context) => {
    AWSXRay.captureHTTPsGlobal(require('https'));
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }

    const requestId = `reqid_${context.awsRequestId}`;
    return { requestId };
};
