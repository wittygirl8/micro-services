const { init } = require('./helpers/init');
const { apiKeyAuth } = require('./helpers/apiKeyAuth');
const { checkoutRefund } = require('./helpers/checkoutRefund');

const { response } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

/**
 * Expected payload from the php:
 * {
    "amount": "xxx",
    "transaction_id": "xxxx",
    "checkout_payment_id": "pay_xxxxxxx"
}
 */
export const handler = async (event, context) => {
    try {
        //initial setups
        var { requestId, documentXray } = await init(event, context, { fileName: 'refund-form-handler' });

        var payload = JSON.parse(event.body);
        console.log(payload);
        documentXray.addAnnotation('transaction_id', payload.transaction_id);

        //auth
        await apiKeyAuth(event);

        // get the db instance
        // let db = await getDBInstance();

        // call checkout refund api
        let checkoutResponse = await checkoutRefund(documentXray, { ...payload });

        // db.sequelize.close();

        documentXray.close();

        return response({
            request_id: requestId,
            message: 'Refund has been processed successfully',
            data: {
                order_id: payload.transaction_id,
                amount: payload.amount,
                metaData: checkoutResponse
            }
        });
    } catch (e) {
        return {
            body: JSON.stringify({ message: e?.message || e }),
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};
