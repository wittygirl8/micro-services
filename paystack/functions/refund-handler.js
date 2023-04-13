const { response } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
    
const { AuthApi } = require('./helpers/AuthApi');
const { RefundPaystack } = require('./helpers/RefundPaystack');
const { getDBInstance } = require('./helpers/db');
const { RefundRequestSchema } = require('./validators/refund-request-validator');
const { SeedRefundLog, UpdateRefundLog } = require('./helpers/RefundLog');

export const main = async (event, context) => {
    try {
        var db = await getDBInstance();
        var requestId = `reqid_${context?.awsRequestId}`;

        var payload = JSON.parse(event.body);
        payload = await RefundRequestSchema.validateAsync(payload);
        console.log({payload});

        //auth
        await AuthApi(event);

        //seed paystack_refund_log table
        var RefundLogResponse = await SeedRefundLog({
            payload,db
        });
        console.log({RefundLogResponse})
        
        let RefundResponse = await RefundPaystack({
            payload,db
        });
        console.log({RefundResponse})

        let api_response = {
            request_id: requestId,
            message: 'Refund processed',
            data: {
                payment_id: payload.payment_id,
                order_id: payload.order_id,
                transaction_reference: payload.transaction_reference,
                amount: payload.amount,
                refund_reference : RefundResponse?.id
            }
        }

        console.log({api_response})
        let UpdateRefundLogResponse = await UpdateRefundLog({
            db,
            UpdateObject: {
                initial_request_status: '1',
                response: JSON.stringify(api_response),
                webhook_status: 'PENDING'
            },
            WhereConditionObject : {id: RefundLogResponse.id}
        })
        console.log({UpdateRefundLogResponse})

        await db.sequelize.close();
        return response(api_response);
    } catch (e) {
        console.log('Exception', e.message)
        let errorResponse = {
                request_id: requestId,
                message: e.message
        };
        console.log({errorResponse})
        RefundLogResponse?.id && await UpdateRefundLog({
            db,
            UpdateObject: {
                initial_request_status: '0',
                response: JSON.stringify(errorResponse)
            },
            WhereConditionObject : {id: RefundLogResponse.id}
        })
        await db.sequelize.close();
        console.log('Db Connection Closed!')
        return response(errorResponse, e.code || 500);
    }
};
