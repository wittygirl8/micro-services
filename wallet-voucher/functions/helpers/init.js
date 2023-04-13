const { logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

const AWSXRay = require('aws-xray-sdk');

export const init = async (event, context, obj) => {
    AWSXRay.captureHTTPsGlobal(require('https'));
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    let logger = logHelpers.logger;
    let logMetadata = {
        location: obj.fileName,
        requestId: `reqid_${context.awsRequestId}`
    };

    return { logger, logMetadata };
};
