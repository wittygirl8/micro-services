const axios = require('axios');

export const RefundPaystack = async (params) => {
    try{    
        let { payload } = params
        console.log('RefundPaystack payload', payload)
        
        //if required, refund status can be logged here to db
        var data = {
            transaction: payload.transaction_reference,
            amount : payload.amount,
            merchant_note: payload.refund_reason
        }
        var config = {
            method: 'POST',
            url: `${process.env.PAYSTACK_API_DOMAIN}/refund`,
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
                return {statusCode: 500,data: error.message}
            }
          );
          console.log('api_response',JSON.stringify(api_response))
        
        if(api_response.statusCode !== 200){
            throw {code : api_response.statusCode, message: api_response.data}
        }
        return api_response?.data?.data

    }catch(e){
        console.log('RefundPaystack Exception => ', e.message);
        throw {code: e.code || 500, message: e.message}
    }
    
}