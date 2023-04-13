var { response, flakeGenerateDecimal, mypayHelpers, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');

export const main = async (event, context, callback) => {
    if (Object.prototype.hasOwnProperty.call(event, 'keep-warm')) {
        console.log('Warming SaleNotification Handler');
        return callback(null, {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Required for CORS support to work
                'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
            },
            body: { message: 'warm is done' }
        });
    }

    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const {
        sequelize,
        MypaySecurityCredentials,
        MypaySaleNotificationLog,
        MypayTempTransaction
    } = db;
    const requestId = 'reqid_' + flakeGenerateDecimal();
    

    try {
        
        let Authorization = event?.headers?.Authorization
        let payload = JSON.parse(event?.body);

        console.log('payload', payload);
        console.log('event.headers.Authorization', Authorization);

        //check authentication
        let customer_id = await mypayHelpers.hmacAuthentication(
            {
                authorization: Authorization,
                payload
            },
            {
                MypaySecurityCredentials
            }
        );
        
        //Auth Successful
        console.log('customer_id', customer_id);

        //save all authenticated notification log
        let MypaySaleNotificationLogInfo = await MypaySaleNotificationLog.create({
            merchant_id: customer_id,
            temp_transaction_ref: payload?.session_id,
            wp_payment_complete_status: payload?.wp_payment_complete_status,
            data: JSON.stringify(payload)
        });

        //update temp_transaction table with id
        await MypayTempTransaction.update(
            {
                sale_notification_id: MypaySaleNotificationLogInfo?.id
            },
            {
                where: { ref: payload?.session_id }
            }
        );

        let api_response = {
            request_id: requestId,
            message: 'success',
            ack_id: MypaySaleNotificationLogInfo?.id   
        };
        console.log({api_response})
        await sequelize.close();
        return response(api_response);
    } catch (e) {
        await sequelize.close();
        let errorResponse = {
            error: {
                request_id: requestId,
                message: e.message
            }
        };
        console.log('Exception: errorResponse', errorResponse);
        return response(errorResponse, 500);
    }
};
