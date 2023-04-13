const { response } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
    
const { AuthApi } = require('./helpers/AuthApi');
const { getDBInstance } = require('./helpers/db');
const { XpressSaleSchema } = require('./validators/xpress-sale-handler');
const { XpressSalePaystack } = require('./helpers/XpressSalePaystack');
const { GetMerchantInfo } = require('./helpers/GetMerchantInfo');
const { GetIDFromReference } = require('./helpers/GetIDFromReference');
const { CheckAlreadyPaid } = require('./helpers/CheckAlreadyPaid');
const { SeedXpressSaleLog, UpdateXpressSaleLog } = require('./helpers/XpressSaleLog');

export const main = async (event, context) => {
    try {
        var db = await getDBInstance();
        var requestId = `reqid_${context?.awsRequestId}`;

        var payload = JSON.parse(event.body);
        payload = await XpressSaleSchema.validateAsync(payload);
        console.log({payload});

        //auth
        await AuthApi(event);

        //seed paystack_xpress_sale_log table
        var XpressLogResponse = await SeedXpressSaleLog({
            payload,db
        });

        let alreadyPaid = await CheckAlreadyPaid({ 
            db,
            order_id: GetIDFromReference(payload.txn_reference,'order_id')
        });
        console.log({alreadyPaid})
        
        let MerchantInfo = await GetMerchantInfo({
            db,
            total: payload.amount,
            merchantId: GetIDFromReference(payload.txn_reference,'merchant_id')
        });
        console.log({MerchantInfo})

        var SaleResponse = await XpressSalePaystack({
            db, payload, MerchantInfo
        });
        console.log({SaleResponse})
        if(SaleResponse.status !== 'success'){
            throw {message : `Sale not success`}
        }


        let api_response = {
            request_id: requestId,
            message: 'Sale processed successfully',
            data: {
                sale_reference: SaleResponse.reference,
                amount: payload.amount,
                TxAuthNo: SaleResponse.authorization.authorization_code,
                last_4_digits: SaleResponse.authorization.last4,
                psp_reference: SaleResponse.id,
                internal_reference: SaleResponse.reference,
            }
        }
        console.log({api_response})

        let UpdateXpressLogResponse = await UpdateXpressSaleLog({
            db,
            UpdateObject: {
                initial_sale_status: SaleResponse.status,
                response: JSON.stringify(api_response),
                webhook_status: 'PENDING'
            },
            WhereConditionObject : {id: XpressLogResponse.id}
        })
        console.log({UpdateXpressLogResponse})
        
        await db.sequelize.close();
        return response(api_response);
    } catch (e) {
        console.log('Exception', e.message)
        let errorResponse = {
                request_id: requestId,
                message: e.message
        };
        console.log({errorResponse});
        XpressLogResponse?.id && await UpdateXpressSaleLog({
            db,
            UpdateObject: {
                initial_sale_status: SaleResponse?.status || '0',
                response: SaleResponse? JSON.stringify(SaleResponse) : JSON.stringify(errorResponse)
            },
            WhereConditionObject : {id: XpressLogResponse?.id}
        })
        await db.sequelize.close();
        return response(errorResponse, e.code || 500);
    }
};
