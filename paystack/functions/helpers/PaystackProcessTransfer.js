const axios = require('axios');
export const PaystackProcessTransfer = async (params) => {
    /*
        This function will initiate/process a new transfer to a paystack recipient
    */

    try {
        var { db, transfer_amount, recipient_token, batch_id, PaystackTransferLogCreateInfo } = params;
        
        //some validations first
        if(
            !transfer_amount || 
            !recipient_token || 
            !batch_id
        ){
            console.log(`${batch_id}-PaystackProcessTransfer params => `,params);
            throw { message: 'PaystackProcessTransfer Error - Transfer details missing !' }
        }

        console.log(`${batch_id}-PaystackTransferLogCreateInfo, ${JSON.stringify(PaystackTransferLogCreateInfo.dataValues)}`)
        //create/process transfer api
        let ProcessTransferResponse = await ProcessTransfer({
            transfer_amount, recipient_token, batch_id
        })
        console.log(`${batch_id}-ProcessTransferResponse, ${JSON.stringify(ProcessTransferResponse)}`)
        
        var PaystackTransferLogUpdateInfo;
        PaystackTransferLogUpdateInfo = await db.PaystackTransferLog.update({
            intial_status: ProcessTransferResponse?.data?.status,
            recipient_code: recipient_token,
            transfer_code: ProcessTransferResponse?.data?.transfer_code,
        },{
            where: {
                id: PaystackTransferLogCreateInfo?.dataValues?.id
            }
        })
        console.log(`${batch_id}-PaystackTransferLogUpdateInfo, ${JSON.stringify(PaystackTransferLogUpdateInfo)}`)

        return {
            status: true,
            transfer_code: ProcessTransferResponse?.data?.transfer_code
        }

    } catch (e) {
        console.log(`${batch_id}-PaystackProcessTransfer Exception`, e.message);
        return {
            status: false, 
            error_message: e.message
        };
    }
    
};

let ProcessTransfer = async (params) => {
    try {
        let { transfer_amount, recipient_token, batch_id } = params;

        var data = {
            "source": "balance",
            "amount": transfer_amount,
            "recipient": recipient_token,
            "reference": batch_id //prod_checklist - this one to be enabled/uncommented in production
        }
        var config = {
            method: 'post',
            url: `${process.env.PAYSTACK_API_DOMAIN}/transfer`,
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            data
        };
        console.log('ProcessTransfer API config', JSON.stringify(config));
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
        console.log('ProcessTransfer API response',JSON.stringify(response))
      
        if(response.statusCode !== 200){
            throw {code : response.statusCode, message: response.data}
        }
        return {
            status: true, 
            data: response?.data?.data
        };

    } catch (e) {
        console.log('ProcessTransfer Exception', e.message);
        throw {code: (e.code || 400), message: e.message};
    }
}