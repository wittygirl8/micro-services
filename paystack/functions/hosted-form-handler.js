const { response, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

// Custom Validators
const { hostedFormRequestSchema } = require('./validators/hosted-form-request-validator');

// Custom Helpers
const { GetRequestUrl } = require('./utils/GetRequestUrl');
const { getDBInstance } = require('./helpers/db');
const { CheckAlreadyPaid } = require('./helpers/CheckAlreadyPaid');
const { GetMerchantInfo } = require('./helpers/GetMerchantInfo');
const { SeedPayment } = require('./helpers/SeedPayment');
const { CreatePaystackSession } = require('./helpers/CreatePaystackSession');
const { errorPage } = require('./helpers/errorPage');
const { DecryptPayload } = require('./helpers/DecryptPayload');
const { GetSplitFeeInfo } = require('./helpers/GetSplitFeeInfo');

export const main = async (event, context) => {

    try {
        var try_again_url = GetRequestUrl(event);
        console.log({try_again_url})

        var db = await getDBInstance();
        let api_response;
        
        var payload = await DecryptPayload(event.queryStringParameters.data);
        console.log('payload',JSON.stringify(payload))
        var requestId = `reqid_${context.awsRequestId}`;
        
        payload = await hostedFormRequestSchema.validateAsync(payload);
        console.log('payload post validation',JSON.stringify(payload))
        //php will send the total amount in decimals
        //converting decimal to integer(cents)
        payload.total = parseInt(payload?.total * 100);
        
        //check if order_id is already a paid one
        let alreadyPaid = await CheckAlreadyPaid({ 
            db,
            order_id: payload.order_id 
        });
        console.log({alreadyPaid})

        if (alreadyPaid) {
            api_response = {
                request_id: requestId,
                message: `The order id #${payload.order_id} is already been paid`,
            };
            console.log('api_response', JSON.stringify(api_response));
            return response(api_response, 301, { Location: payload.redirect_url });
        }

        // Get some merchant releated info like fees, country/currency codes
        let MerchantInfo = await GetMerchantInfo({
            db, payload,
            total: payload.total,
            merchantId: payload.merchant_id
        });
        console.log({MerchantInfo})

        let SplitFeeObject;
        if(payload?.split_fee){
            let SplitFeeInfo = await GetSplitFeeInfo({
                db, payload, MerchantInfo
            })
            console.log({SplitFeeInfo})
            MerchantInfo = SplitFeeInfo.MerchantInfo
            console.log('Latest MerchantInfo', JSON.stringify(MerchantInfo))
            SplitFeeObject = SplitFeeInfo.SplitFeeObject
        }
        console.log('SplitFeeObject', JSON.stringify(SplitFeeObject));

        // seeding the attempt into the txn table (payments)
        let seedPaymentResults = await SeedPayment({
            db, payload, MerchantInfo, SplitFeeObject, event
        });
        console.log({seedPaymentResults});

        //creating a sale session link with paystack 
        let PaystackSessionInfo = await CreatePaystackSession({
            db, payload, seedPaymentResults, MerchantInfo, SplitFeeObject
        });
        
        let paystack_session_url = PaystackSessionInfo?.authorization_url
        console.log({paystack_session_url})

        await db.sequelize.close();
        //redirect to the new paystack hosted form url generated for the user to enter card details
        api_response = PaystackSessionInfo
        return response(api_response, 301, { Location: paystack_session_url });
    } catch (e) {
        console.log('Main Exception',e.message)
        await db.sequelize.close();
        return {
            body: await errorPage({ 
                error_code: `#HFH${e.message}`, 
                order_id: payload?.order_id,
                try_again_url: try_again_url ? try_again_url : '#',
            }),
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            }
        };
    }
};
