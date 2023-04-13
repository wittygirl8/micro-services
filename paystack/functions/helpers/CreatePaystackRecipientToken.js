const axios = require('axios');

export const CreatePaystackRecipientToken = async (params) => {
    /*

        This function will create paystack transfer token for a merchant
        The method to validate/create transfer token based on bank details is different for different countries of Africa
            https://paystack.com/docs/transfers/single-transfers/#verify-the-account-number
        This function will call the appropriate function based on the country of the merchant

        Token create process contains below process
            1. Validate bank details
            2. Create transfer token
            3. Save transfer token in database
                3a. PaystackTransferRecipientLog new record
                3b. OtherCustomerDetails table update with new pp_token (recipient_code)

    */

    try {
        let { db, MerchantBankInfo,CountryInfo } = params;
        
        //some validations first
        if(
            !MerchantBankInfo.accountnumber || 
            !MerchantBankInfo.sortcode || 
            !MerchantBankInfo.accountholder ||
            !CountryInfo.currency_name
        ){
            console.log(MerchantBankInfo)
            console.log(CountryInfo)
            throw { message: 'Invalid bank details!' }
        }

        if(CountryInfo?.currency_name != 'NGN'){
            throw { message: `Token generation is not supported for this currency ${CountryInfo?.currency_name}!` }
        }

        //validate the bank details first
        let ValidateResponse = await ValidateBankDetails({
            account_number: MerchantBankInfo.accountnumber,
            bank_code: MerchantBankInfo.sortcode
        })
        console.log({ValidateResponse})
        
        if(!ValidateResponse.status){
            throw {message: ValidateResponse.error_message}
        }

        //create transfer token
        let CreateResponse = await CreateRecipientToken({
            account_holder_name: MerchantBankInfo.accountholder,
            account_number: MerchantBankInfo.accountnumber,
            bank_code: MerchantBankInfo.sortcode,
            currency: CountryInfo.currency_name
        })
        console.log({CreateResponse})
        
        //populate paystack_transfer_recipient_log table for reference
        let CreateRecipientLogInfo = await db.PaystackTransferRecipientLog.create({
            merchant_id: MerchantBankInfo.customers_id,
            account_number: MerchantBankInfo.accountnumber,
            bank_code: MerchantBankInfo.sortcode,
            bank_name: MerchantBankInfo.bank_name,
            account_holder_name: MerchantBankInfo.accountholder,
            recipient_code: CreateResponse?.data?.recipient_code,
        },{
            raw: true
        })
        console.log(`CreateRecipientLogInfo, ${JSON.stringify(CreateRecipientLogInfo.dataValues)}`)

        //update OtherCustomerDetails table with new paystack transfer token
        let OtherCustomerDetailsUpdateInfo = await db.OtherCustomerDetails.update({
            pp_token: CreateResponse?.data?.recipient_code
        },{
            where: {
                customers_id: MerchantBankInfo.customers_id
            }
        })
        console.log({OtherCustomerDetailsUpdateInfo})
        return {
            status: true,
            recipient_token: CreateResponse?.data?.recipient_code
        }

    } catch (e) {
        console.log('CreatePaystackRecipientToken Exception', e.message);
        return {
            status: false, 
            error_message: e.message
        };
    }
    
};

let CreateRecipientToken = async (params) => {
    try {
        let { account_holder_name, account_number, bank_code, currency } = params;

        var data = {
            "type": "nuban",
            "name": account_holder_name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": currency
        }
        var config = {
            method: 'post',
            url: `${process.env.PAYSTACK_API_DOMAIN}/transferrecipient`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            data
        };
        console.log('CreateRecipientToken API config', JSON.stringify(config));
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
        return {
            status: true, 
            data: response?.data?.data
        };

    } catch (e) {
        console.log('CreateRecipientToken Exception', e.message);
        throw {code: (e.code || 400), message: e.message};
    }
}

let ValidateBankDetails = async (params) => {
    try {

        let { account_number, bank_code } = params;

        var query_parameters = `account_number=${account_number}&bank_code=${bank_code}`
        var data = {
            account_number, bank_code
        }
        var config = {
            method: 'get',
            url: `${process.env.PAYSTACK_API_DOMAIN}/bank/resolve?${query_parameters}`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        console.log('ValidateBankDetails API config', JSON.stringify(config));
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
        return {
            status: true, 
            data: response?.data?.data
        };
        
    } catch (e) {
        console.log('ValidateBankDetails Exception', e.message);
        throw {code: (e.code || 400), message: e.message};
    }
}