const axios = require('axios');
export const CreatePaystackSession = async (params) => {
    
    /*
    Initially teh development has been done assuming subaccounts will be created for every merchants and the share of merchant will go to subaccount directly
    Also the split commission api will be used to split the commission between the reseller subaccounts

    Later we have decided to keep all the money in main account and not to handled through subaccounts as there is an issue with KYC as per Aymen
    so we have decided to go with the way how foodgital.com handles the payments
    Hence removed the subaccounts and split commission

    #REMOVED_SUBACCOUNTS_AND_SPLIT
    */
    
    
    let { db, payload, seedPaymentResults, MerchantInfo, SplitFeeObject } = params;
    try {
        var data = {
            email: payload.email,
            amount: payload.total,
            // transaction_charge: MerchantInfo.paystack_fee, #REMOVED_SUBACCOUNTS_AND_SPLIT
            callback_url: `${process.env.PAYSTACK_BACKEND_ENDPOINT}/sale/verify`,
            currency: MerchantInfo.currency_code,
            reference: seedPaymentResults.UniqueReference,
            channels: ["card"],
            metadata: {
                cancel_action: payload.cancel_url,
                redirect_url: payload.redirect_url,
                webhook_url: payload.webhook_url,
                customer_id: payload.customer_id,
                reference: payload.reference,
                SplitFeeObjectLength: SplitFeeObject?.length
            }
        };
        
        //#REMOVED_SUBACCOUNTS_AND_SPLIT
        /*data['split'] = {
            type: "flat",
            bearer_type: "account", //main account to bear the paystack charge //https://paystack.com/docs/payments/multi-split-payments#dynamic-splits
            subaccounts: await GetSplitSubAccountShares({
                MerchantInfo, SplitFeeObject, db
            })
        }
        */
        var config = {
            method: 'post',
            url: `${process.env.PAYSTACK_API_DOMAIN}/transaction/initialize`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            data
        };
        console.log('API config', JSON.stringify(config));
        let response = await axios(config).then(function (response) {
            return {statusCode : 200,data: response.data}
          })
          .catch(function (error) {
              if (error.response) {
                  return {
                      statusCode: error.response.status,
                      data: error.response.data.message
                  }
              }
              return {statusCode: 500,data: error.message}
          }
        );
        console.log('response',JSON.stringify(response))
      
        if(response.statusCode !== 200){
            throw {code : response.statusCode, message: response.data}
        }
        return response?.data?.data;
    } catch (e) {
        console.log('CreatePaystackSession Exception', e.message);
        throw {code: (e.code || 500), message: e.message};
    }
};

//#REMOVED_SUBACCOUNTS_AND_SPLIT
/*
let GetSplitSubAccountShares = async (params) => {
    let { db, MerchantInfo, SplitFeeObject } = params
    
    let subaccount_split_shares = [];
    subaccount_split_shares.push ({
        subaccount: MerchantInfo.paystack_subaccount_id, //ensure MerchantInfo populates this field from customers table
        share: MerchantInfo.net
    })
    if(SplitFeeObject?.length > 0){
            
        let unresolved_promises = SplitFeeObject.map(async (split_fee_item) => {
            console.log({split_fee_item})
            let partner_merchant_info = await db.Customer.findOne({
                attributes: ['paystack_subaccount_id'],
                where: { id: split_fee_item.partner_merchant_id },
                raw: true
            });
            return {
                subaccount: partner_merchant_info.paystack_subaccount_id,
                share: split_fee_item.amount
            }
        })
        // return subaccount_split_shares;
        let new_subaccount_split_shares = await Promise.all(unresolved_promises)
        subaccount_split_shares = subaccount_split_shares.concat(new_subaccount_split_shares);

        console.log({new_subaccount_split_shares})
        console.log({subaccount_split_shares})

        return subaccount_split_shares;

    }else{
        return subaccount_split_shares
    }
    
}
*/