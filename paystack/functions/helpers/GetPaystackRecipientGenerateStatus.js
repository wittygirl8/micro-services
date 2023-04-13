export const GetPaystackRecipientGenerateStatus = async (params) => {
    /*
    
    This function will check if recipient token should be created or not
        Token to be created if 
            1. Token does not exist
            2. Token exists but bank account details changed
        Returns true, if token should be created

    */
    try {
        let { db, MerchantBankInfo } = params;
        
        //if paystack_transfer_recipient_log table does not have entry, create one as its never been created
        //if paystack_transfer_recipient_log table has entry, check if bank details changed, if yes, create new one

        //#1
        let PaystackTransferRecipientInfo = await db.PaystackTransferRecipientLog.findOne({
            where: {
                merchant_id: MerchantBankInfo.customers_id
            },
            order: [["id", "DESC"]],
            raw: true
        })
        console.log({PaystackTransferRecipientInfo})
        if(!PaystackTransferRecipientInfo){
            return true
        }

        //#2check if bank details changed since the last token generation
        let bank_details_changed = false; //prod_checklist - this to be set as false in production
        if(
            MerchantBankInfo.accountnumber != PaystackTransferRecipientInfo.account_number 
            || 
            MerchantBankInfo.sortcode != PaystackTransferRecipientInfo.bank_code)
        {
            bank_details_changed = true;
        }
        console.log({bank_details_changed})
        
        //if bank details changed, create new paystack transfer token
        if(bank_details_changed){
            return true
        }

        return false

    } catch (e) {
        console.log('GetPaystackTransferGenerateStatus Exception ~ ', e.message);
        return false;
        // throw {code: (e.code || 400), message: e.message};
    }
}
