const { response, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');

const { getDBInstance } = require('./helpers/db');
const { VerifyPaystackTransaction } = require('./helpers/VerifyPaystackTransaction');
const { GetIDFromReference } = require('./helpers/GetIDFromReference');
const { errorPage } = require('./helpers/errorPage');
const { SanitizeUrlFromPaystack } = require('./utils/SanitizeUrlFromPaystack');

export const main = async (event, context) => {

    try {
        
        let api_response;
        var paystack_txn_reference = event?.queryStringParameters?.reference;
        var order_id = GetIDFromReference(paystack_txn_reference);
        console.log({order_id})
        console.log({paystack_txn_reference})

        let VerificationResponse = await VerifyPaystackTransaction({
            paystack_txn_reference
        })
        
        var db = await getDBInstance();
        
        if(VerificationResponse.status !== 'success'){
            throw {message: 'Transaction not successful #3001'}
        }

        console.log({VerificationResponse})
        await db.sequelize.close();
        let redirect_url = SanitizeUrlFromPaystack(VerificationResponse?.metadata?.redirect_url);
        console.log({redirect_url})
        //Redirecting to the success url passed on by FH
        return response(api_response, 301, { 
            Location: redirect_url 
        });
    } catch (e) {
        console.log('Exception',e.message)
        await db.sequelize.close();
        return {
            body: await errorPage({ 
                error_code: '#RVH', 
                order_id
             }),
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            }
        };
    }
};