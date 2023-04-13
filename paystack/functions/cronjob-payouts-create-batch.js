const { response, helpers } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const moment = require('moment-timezone');
// Custom Helpers
const { getDBInstance } = require('./helpers/db');
const { GetPaystackRecipientGenerateStatus } = require('./helpers/GetPaystackRecipientGenerateStatus');
const { CreatePaystackRecipientToken } = require('./helpers/CreatePaystackRecipientToken');
const TIMEZONE = 'europe/london';
export const main = async (event, context) => {

    try {
        /*if lambda invoked from aws->lambda->test, the even look like below
        //Default one, 
        {
            "key1": "value1",
            "key2": "value2",
            "key3": "value3"
        }
        */
        //Customized one,
        // event = {
        //     merchant_id: "63184004",
        // }

        
        console.log('event', JSON.stringify(event));
        var requestId = `reqid_${context?.awsRequestId}`;
        console.log({requestId})
        var db = await getDBInstance();

        //get the list of all merchants of paystack (Only Nigeria as of 3rd October 2022)
        let merchant_search_query_object = { 
            progress_status             : event?.progress_status || '2',
            account_verification_status  : event?.account_verification_status || 'VERIFIED',
            bank_verification_status     : event?.bank_verification_status ||'VERIFIED',
            payment_provider            : event?.payment_provider || 'PAYSTACK-HF',
            status                      : { [db.Sequelize.Op.ne]: (event?.status || 12 )},
            country_id                  : { [db.Sequelize.Op.in]: (event?.country_id?.split(',') || [11]) }
        }

        //overwrite the merchant search query object if merchant_id is passed from lambda parameters
        if(event?.merchant_id){
            let list_merchant_ids = event.merchant_id.split(',');
            if(list_merchant_ids.length){
                merchant_search_query_object['id'] = { [db.Sequelize.Op.in]: list_merchant_ids }
            }
        }
        console.log({merchant_search_query_object})
        //getting the list of merchants
        let MerchantList = await db.Customer.findAll({
            attributes: ['id','country_id'],
            where: merchant_search_query_object,
            raw: true
        });
        console.log({MerchantList})
        if(!MerchantList.length){
            return {
                status: `FAILED`,
                reason: `No Merchants found!`
            }
        }
        //loop through them and check the available balance from payment table
        //if available balance is greater than 0, then create a batch for that merchant
        let CreateBatchStatus = await Promise.all(MerchantList.map( async MerchantInfo => {
            
            //get all the non-settled txns for the MID
            let PaymentInfo = await db.Payments.findAll({
                attributes: ['id', 'net'],
                where: {
                    [db.Sequelize.Op.and]: [
                        {
                            withdrawn_status: 0,
                            delete_status: 0,
                            merchant_id: MerchantInfo.id,
                            payment_provider_id: 8 //paystack-hf
                        },
                        { transaction_status_id: { [db.Sequelize.Op.in]: [1, 2] } },
                    ]
                },
                raw: true
            })
            if (!PaymentInfo.length) {
                return {
                    merchant_id: MerchantInfo.id,
                    status: `FAILED`,
                    reason: `No transactions found for settlement`
                }
            }
            //calculate balance
            let balance = 0;
            let payment_ids = []
            PaymentInfo.forEach((element) => {
                payment_ids.push(element.id)
                balance = balance + element.net;
            });
            console.log({balance})

            //if balance is greater than 0, populate payout_batch_item & payout_batch table
            if(balance <= 0){
                return {
                    merchant_id: MerchantInfo.id,
                    status: `FAILED`,
                    reason: `Balance is equal/less than 0`
                }
            }
            //get the current updated bank details
            let OtherCustomerInfo = await db.OtherCustomerDetails.findOne({
                attributes: ['customers_id','accountnumber', 'sortcode', 'bankname', 'accountholder', 'pp_token'],
                where: {
                    customers_id: MerchantInfo.id
                },
                raw: true
            });
            //some currency details
            let CountryInfo = await db.Country.findOne({
                attributes: ['currency_name'],
                where: {
                    id: MerchantInfo.country_id
                },
                raw: true
            });
            
            let recipient_token = OtherCustomerInfo.pp_token
            let payout_batch_status = 'PENDING'
            //create paystack transfer recipient at this point
            //if already created, then will ignore
            let RecipientTokenGenerateStatus = await GetPaystackRecipientGenerateStatus({
                db,
                MerchantBankInfo: OtherCustomerInfo,
                CountryInfo
            });
            console.log({RecipientTokenGenerateStatus})
            if(RecipientTokenGenerateStatus){
                let CreateRecipientTokenResponse = await CreatePaystackRecipientToken({
                    db,
                    MerchantBankInfo: OtherCustomerInfo,
                    CountryInfo
                });
                console.log({CreateRecipientTokenResponse})
                if(!CreateRecipientTokenResponse.status){
                    // payout_batch_status = 'FAILED'
                    console.log(`Paystack Recipient token generation failed! - ${MerchantInfo.id} - ${JSON.stringify(CreateRecipientTokenResponse)}`)
                    // return {
                    //     status: `FAILED`,
                    //     reason: `Paystack Recipient token generation failed! - ${MerchantInfo.id}`
                    // }
                }
                recipient_token = CreateRecipientTokenResponse.recipient_token;
            }
            console.log({recipient_token})
            console.log({payout_batch_status})

            //now, populate payout_batch table first
            var PayoutBatchInfo = await db.PayoutBatch.create({
                customer_id: MerchantInfo.id,
                total: balance,
                status: payout_batch_status,
                date_pending: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                week_no: moment().tz(TIMEZONE).format('W'),
                account_number: OtherCustomerInfo.accountnumber,
                sort_code: OtherCustomerInfo.sortcode,
                bank_name: OtherCustomerInfo.bankname,
                account_holder: OtherCustomerInfo.accountholder,
                pp_token: recipient_token,
                payout_provider: 'PAYSTACK-HF',
                currency: CountryInfo.currency_name,
            });
            console.log('PayoutBatchInfo',JSON.stringify(PayoutBatchInfo.dataValues))

            //populate payout_batch_item table next
            let payout_batch_item_params = PaymentInfo.map((Payment) => {
                return {
                    batch_id: PayoutBatchInfo?.batch_id,
                    card_payment_id: Payment.id,
                    total: Payment.net,
                    customer_id: MerchantInfo.id,
                    date_issued: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                }
            })
            await db.PayoutBatchItem.bulkCreate(payout_batch_item_params);
            // console.log({PayoutBatchItemInfo})

            //its very important to update the payments as withdrawn_status = 1, so that next payout cron wont pick the batched ones
            let PaymentUpdateInfo = await db.Payments.update(
                {
                    withdrawn_status: 1,
                    transaction_status_id: 3
                },
                {
                    where: { id: { [db.Sequelize.Op.in]: payment_ids } }
                }
            );
            console.log({PaymentUpdateInfo})
            return {
                merchant_id: MerchantInfo.id,
                status: `SUCCESS`,
                payout_batch_status,
                batch_id: PayoutBatchInfo?.batch_id,
                payout_amount: balance
            }

        }))
        console.log({CreateBatchStatus})

        let api_response = {'status': 'success'};
        
        await db.sequelize.close();
        return response(api_response);
    } catch (e) {
        console.log('Main Exception',e?.message)
        let errorResponse ={}
        await db.sequelize.close();
        return response(errorResponse, e?.code || 400);
    }
};