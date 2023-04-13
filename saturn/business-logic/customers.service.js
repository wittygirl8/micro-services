const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const { stripeAccountMap } = require('../helpers/stripeAccountMap');

export const getCustomerDetails = async (customerId, Customer) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    var data = await Customer.findOne({
        where: { id: customerId }
    });
    return data;
};

export const updateStripeAccountId = async (customerId, payload, Customer) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    let {
        stripe_user_id
        // stripe_publishable_key,
        // refresh_token,
        // access_token,
    } = payload;

    var data = await Customer.update(
        {
            stripe_acc_id: stripe_user_id
            // stripe_pk: stripe_publishable_key,
            // stripe_sk: access_token,
            // stripe_payload: JSON.stringify(payload)
        },
        {
            where: { id: customerId }
        }
    );
    return data;
};

export const getStripeCeredentialsDetails = async (customerId, Customer) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    try {
        var data = await Customer.findOne({
            where: { id: customerId }
        });
        var key = stripeAccountMap[data.stripe_acc_type];
        var stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
        return {
            STRIPE_SK: stripe_cred[key].sk,
            STRIPE_PK: stripe_cred[key].pk,
            STRIPE_WH: stripe_cred[key].wh
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};
