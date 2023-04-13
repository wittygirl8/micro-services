const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const customerObj = require('../business-logic/customers.service');

let logger = logHelpers.logger;

module.exports.createCustomerAccount = (event, context) => {
    let logMetadata = {
        location: 'SaturnService ~ createCustomerAccount',
        awsRequestId: context.awsRequestId
    };
    try {
        let reqHeaders = event.headers;
        let customerId = event.queryStringParameters.id;

        let { country, email, business_name } = JSON.parse(event.body);
        // let country = 'GB';
        // let email= 'pythi@g.co';
        // let business_name = 'pthon';
        // let currency = 'gbp';

        logger.info(logMetadata, 'event', event);

        // //test start

        // let stripe_user_id = 'acct_abcdefghij'

        // LambdaHttpResponse('200', {
        //     stripe_user_id,
        //     redirect_url: `https://dashboard.stripe.com/connect/accounts/${stripe_user_id}`
        // }, callback)
        // return

        // //test end
        const stripe = require('stripe')(process.env.STRIPE_SK);
        stripe.accounts.create(
            {
                type: 'custom',
                country,
                email,
                requested_capabilities: ['card_payments', 'transfers'],
                business_profile: {
                    name: business_name
                },
                // default_currency: currency,
                tos_acceptance: {
                    date: Math.floor(Date.now() / 1000),
                    ip: reqHeaders['CF-Connecting-IP'] || '0.0.0.0' // Assumes you're not using a proxy
                }
            },
            async function (err, account) {
                if (err) {
                    logger.error(logMetadata, err, account);
                    return response(err, 400);
                }
                let stripe_user_id = account.id;
                logger.info(logMetadata, account);
                await customerObj.updateStripeAccountId(customerId, {
                    stripe_user_id
                });
                // let test_url = `https://dashboard.stripe.com/test/connect/accounts/${stripe_user_id}`
                let live_url = `https://dashboard.stripe.com/connect/accounts/${stripe_user_id}`;
                // return callback(null, {
                //     statusCode: 301,
                //     headers: {
                //         location: live_url
                //     },
                //     body: null
                // })
                return response(
                    {
                        stripe_user_id,
                        redirect_url: live_url
                    },
                    200
                );
            }
        );
    } catch (error) {
        logger.error(logMetadata, error);
        return response(error, 400);
    }
};
