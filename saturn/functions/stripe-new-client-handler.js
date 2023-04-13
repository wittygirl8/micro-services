const { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const customerObj = require('../business-logic/customers.service');

let logger = logHelpers.logger;

module.exports.newClientSignedUp = (event, context) => {
    let logMetadata = {
        location: 'SaturnService ~ newClientSignedUp',
        awsRequestId: context.awsRequestId
    };

    try {
        let err;
        if (event.hasOwnProperty('keep-warm')) {
            logger.info(logMetadata, 'Call is just to warm the lamda function');
            return response(
                {
                    message: 'warm is done'
                },
                200
            );
        }
        let { code, state: customerId } = event.queryStringParameters || {};
        let body = JSON.parse(event.body);
        logger.info(logMetadata, 'customerId:', customerId);
        logger.info(logMetadata, 'code:', code);
        logger.info(logMetadata, 'body', body);
        // logger.info(logMetadata,'event', event)

        var options = {
            method: 'POST',
            url: 'https://connect.stripe.com/oauth/token',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            form: {
                client_secret: process.env.STRIPE_SK,
                code,
                // code: 'ac_Ft06rIevoLrEnIXA6f31YaBcgQOiMnkK',
                grant_type: 'authorization_code'
            }
        };
        // eslint-disable-next-line  -- request is not defined
        request(options, async function (error, response, b) {
            if (error)
                return response(
                    {
                        message: 'stripe api failed',
                        error
                    },
                    400
                );
            b = JSON.parse(b);
            logger.info(logMetadata, 'api body', b.error);
            if (response.statusCode == '200') {
                logger.info(logMetadata, 'success api res', b);

                let { stripe_user_id, stripe_publishable_key, refresh_token, access_token } = b;

                var resData = await customerObj.updateStripeAccountId(customerId, {
                    stripe_user_id,
                    stripe_publishable_key,
                    refresh_token,
                    access_token
                });
                if (resData) {
                    return response(
                        {
                            status: 'ok'
                        },
                        200
                    );
                } else {
                    return response(
                        {
                            message: 'unable to update the db',
                            err
                        },
                        400
                    );
                }
            } else {
                return response(
                    {
                        message: b,
                        err
                    },
                    400
                );
            }
        });
    } catch (error) {
        logger.error(logMetadata, error);
        return response(error, 400);
    }
};
