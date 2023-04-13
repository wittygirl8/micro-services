// const { logHelpers } = process.env.IS_OFFLINE
//     ? require('../../../../layers/helper_lib/src')
//     : require('datman-helpers');

// const AWSXRay = require('aws-xray-sdk');

export const init = async (event, context, obj) => {
    // AWSXRay.captureHTTPsGlobal(require('https'));
    // AWSXRay.capturePromise();
    // if (process.env.IS_OFFLINE) {
    //     AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    // }
    // var documentXray = AWSXRay.getSegment().addNewSubsegment(obj.fileName);
    const requestId = `reqid_${context.awsRequestId}`;
    var payload = JSON.parse(event.body);
    return { requestId, payload };
};
