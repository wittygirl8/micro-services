const { response } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
// Custom Helpers
const { getDBInstance } = require('./helpers/db');
const { CreatePaystackRecipientToken } = require('./helpers/CreatePaystackRecipientToken');
const { PaystackProcessTransfer } = require('./helpers/PaystackProcessTransfer');
const { UpdatePaymentsPayoutStatus } = require('./helpers/UpdatePaymentsPayoutStatus');

export const main = async (event, context) => {

    try {

        /*if lambda invoked from aws->lambda->test, the event look like below
        //Default one, 
        {
            "key1": "value1",
            "key2": "value2",
            "key3": "value3"
        }
        //Customized one,*/
        // event = {
        //     batch_ids: "111153",
        // }
        // */
        
        console.log('event', JSON.stringify(event));
        var requestId = `reqid_${context?.awsRequestId}`;
        console.log({requestId})
        var db = await getDBInstance();
        
        //query for pending batches
        let batch_search_query_object = { 
            status                  : 'PENDING',
            payout_provider         : event?.payout_provider || 'PAYSTACK-HF',
            currency                : event?.currency ||'NGN'
        }
        //overwrite the batch search query object if batch_id(s) passed from lambda parameters
        if(event?.batch_ids){
            let list_batch_ids = event.batch_ids.split(',');
            if(list_batch_ids.length){
                batch_search_query_object['batch_id'] = { [db.Sequelize.Op.in]: list_batch_ids }
            }
        }
        console.log({batch_search_query_object})
        let BatchList = await db.PayoutBatch.findAll({
            where: batch_search_query_object,
            raw: true
        });
        console.log({BatchList})
        if(!BatchList.length){
            throw {message: `No Batches are pending to process! ${JSON.stringify(batch_search_query_object)}`}
        }

        //Below are the steps in short
        //1. Loop through available batch_ids 
        //2. Check for any bank details change for the merchant
        //3. create new paystack recipient token in case of bank details changed or recipient_token missing
        //4. Update the batch with new paystack transfer token
        //5. Call paystack payouts api to process the transfer
        //6. If all success, update the batch status to SENT
        //7. If any error, update the batch status to FAILED

        //#1
        let ProcessBatchStatus = await Promise.all(BatchList.map( async BatchInfo => {
            //getting merchant details
            console.log({BatchInfo})

            var PaystackTransferLogCreateInfo = await db.PaystackTransferLog.create({
                payout_batch_id: BatchInfo.batch_id,
                amount: BatchInfo.total
            })
            let MerchantInfo = await db.Customer.findOne({
                attributes: ['id','country_id'],
                where: {
                    id: BatchInfo.customer_id
                },
                raw: true
            });
            console.log({MerchantInfo})
            if(!MerchantInfo){
                return await UpdatePayoutBatchFailed({
                    db, 
                    batch_id: BatchInfo.batch_id,
                    PaystackTransferLogCreateInfo,
                    status: `FAILED`,
                    reason: `No Merchant found! - ${BatchInfo.customer_id} - ${BatchInfo.batch_id}`,
                })
            }
            //getting merchant BANK details
            let MerchantBankInfo = await db.OtherCustomerDetails.findOne({
                attributes: ['customers_id','accountnumber', 'sortcode', 'bankname', 'accountholder', 'pp_token'],
                where: {
                    customers_id: MerchantInfo.id
                },
                raw: true
            });
            console.log({MerchantBankInfo})
            if(!MerchantBankInfo){
                return await UpdatePayoutBatchFailed({
                    db, 
                    batch_id: BatchInfo.batch_id,
                    PaystackTransferLogCreateInfo,
                    status: `FAILED`,
                    reason: `Merchant Bank Details missing! - ${BatchInfo.customer_id} - ${BatchInfo.batch_id}`
                })
            }
            
            //getting merchant currency details
            let CountryInfo = await db.Country.findOne({
                attributes: ['country_name','currency_name'],
                where: {
                    id: MerchantInfo.country_id
                },
                raw: true
            });
            console.log({CountryInfo})
            if(!CountryInfo){
                return await UpdatePayoutBatchFailed({
                    db, 
                    batch_id: BatchInfo.batch_id,
                    PaystackTransferLogCreateInfo,
                    status: `FAILED`,
                    reason: `Invalid Merchant Country Details! - ${BatchInfo.customer_id} - ${BatchInfo.batch_id}`
                })
            }
            
            //#2check if bank details changed after batch generation
            let bank_details_changed = false; //prod_checklist this to be set as false in production
            if(
                MerchantBankInfo.accountnumber != BatchInfo.account_number 
                || 
                MerchantBankInfo.sortcode != BatchInfo.sort_code)
            {
                bank_details_changed = true;
            }
            console.log({bank_details_changed})
            
            //#3. if bank details changed, create new paystack recipient token
            let recipient_token = BatchInfo.pp_token;
            if(
                bank_details_changed
                ||
                !recipient_token
            ){
                let create_recipient_token_response = await CreatePaystackRecipientToken({
                    db, MerchantBankInfo,CountryInfo
                });
                console.log({create_recipient_token_response})
                if(!create_recipient_token_response.status){
                    return await UpdatePayoutBatchFailed({
                        db, 
                        batch_id: BatchInfo.batch_id,
                        PaystackTransferLogCreateInfo,
                        status: `FAILED`,
                        reason: `Paystack Recipient token generation failed! - ${BatchInfo.customer_id} - ${BatchInfo.batch_id}`
                    })
                }
                recipient_token = create_recipient_token_response.recipient_token;
            }
            //#4. update the batch with new paystack transfer token
            let UpdateBatchResponse = await db.PayoutBatch.update({
                pp_token: recipient_token,
                account_number: MerchantBankInfo.accountnumber,
                sort_code: MerchantBankInfo.sortcode,
                bank_name: MerchantBankInfo.bankname,
                account_holder: MerchantBankInfo.accountholder
            },{
                where: {
                    batch_id: BatchInfo.batch_id
                }
            });
            console.log({UpdateBatchResponse})
            //#5. call paystack payouts api to process the transfer
            /*
                NOTE: Even though we have bulk transfer api option with Paystack, going with single transfer api option per batch
                as it is more reliable and easy to handle the errors.
                Also, bulk transfer api option seems to be not giving the 'reference'(batch_id) in the response, so that we can update the payout_batch table correctly.
            */
            let ProcessTransferResponse = await PaystackProcessTransfer({
                db,
                recipient_token,
                transfer_amount: BatchInfo.total, 
                batch_id: BatchInfo.batch_id,
                PaystackTransferLogCreateInfo
            });

            if(!ProcessTransferResponse.status){
                return await UpdatePayoutBatchFailed({
                    db, 
                    batch_id: BatchInfo.batch_id,
                    PaystackTransferLogCreateInfo,
                    status: `FAILED`,
                    reason: `Processing transfer failed! - ${BatchInfo.customer_id} - ${BatchInfo.batch_id}`
                })
            }
            
            await UpdatePaymentsPayoutStatus({
                db,
                batch_id: BatchInfo.batch_id,
                transaction_status_id: 4, //SENT
            })
            //if all success, update the batch status to SENT
            let UpdateBatchResponseFinal = await db.PayoutBatch.update({
                status: 'SENT',
                transfer_token: ProcessTransferResponse.transfer_code,
                date_sent: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
            },{
                where: {
                    batch_id: BatchInfo.batch_id
                },
                raw: true
            })
            console.log({UpdateBatchResponseFinal})
            return {
                status: `SUCCESS`,
                merchant_id: BatchInfo.customer_id,
                batch_id: BatchInfo.batch_id
            }
        }))
        console.log({ProcessBatchStatus})
        let api_response = {
            status: 'success',
            ProcessBatchStatus
        };
        await db.sequelize.close();
        return response(api_response);
    } catch (e) {
        console.log('Main Exception ~ ',e.message)
        let errorResponse ={}
        await db.sequelize.close();
        return response(errorResponse, e.code || 400);
    }
};

let UpdatePayoutBatchFailed = async (params) => {
    let { db, batch_id, status, reason, PaystackTransferLogCreateInfo } = params;
    //update payout_batch table
    await db.PayoutBatch.update({
        status: 'FAILED',
    },{
        where: {
            batch_id
        },
        raw: true
    })

    //update payments table with payout status
    await UpdatePaymentsPayoutStatus({
        db,
        batch_id: batch_id,
        transaction_status_id: 6, //FAILED
    })

    //update payout transfer log
    PaystackTransferLogCreateInfo && await db.PaystackTransferLog.update({
        intial_status: 'failed',
        more_info: reason,
    },{
        where: {
            id: PaystackTransferLogCreateInfo?.dataValues?.id
        }
    })
    return {
        status, reason
    }
}