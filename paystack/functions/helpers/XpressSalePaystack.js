const axios = require('axios');

export const XpressSalePaystack = async (params) => {
    try{    
        let { db, payload, MerchantInfo } = params
        console.log('XpressSalePaystack payload', payload)
        
        //if required, refund status can be logged here to db
        var data = {
            authorization_code: payload.card_token,
            amount : payload.amount,
            email: payload.email,
            reference: payload.txn_reference,
            transaction_charge: MerchantInfo.fee,
            // subaccount: MerchantInfo.paystack_subaccount_id,
            currency: MerchantInfo.currency_code,
            metadata: JSON.stringify({
                 "sale_mode":"xpress-sale"
            })
        }
        var config = {
            method: 'POST',
            url: `${process.env.PAYSTACK_API_DOMAIN}/transaction/charge_authorization`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            data
        };
        let api_response = await axios(config)
            .then(function (response) {
              return {statusCode : 200,data: response.data}
            })
            .catch(function (error) {
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    return {
                        statusCode: error.response.status,
                        data: error.response.data.message
                    }
                }
                return {stastatusCodetus: 500,data: error.message}
            }
          );
        console.log('api_response',JSON.stringify(api_response))
        
        if(api_response.statusCode !== 200){
            throw {code : api_response.statusCode, message: api_response.data}
        }
        return api_response?.data?.data

    }catch(e){
        console.log('XpressSalePaystack Exception => ', e.message);
        throw {code: e.code || 500, message: e.message}
    }
    
}