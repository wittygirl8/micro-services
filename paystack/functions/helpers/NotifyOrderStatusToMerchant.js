import AWS from 'aws-sdk';
const { GetIDFromReference } = require('./GetIDFromReference');
const { SanitizeUrlFromPaystack } = require('../utils/SanitizeUrlFromPaystack');
export const NotifyOrderStatusToMerchant = async (params) => {
    let { payload,tokenize_eligible, master_token } = params;
    
    //preparing required payload
    let sqs_payload = {
        webhook_url: SanitizeUrlFromPaystack(payload?.data?.metadata?.webhook_url)
    }
    console.log({sqs_payload})

    let payment_id = GetIDFromReference(payload?.data?.reference,'txn_id');
    let customer_id = payload?.data?.metadata?.customer_id;
    let last_4_digits = payload?.data?.authorization?.last4;
    let exp_month = payload?.data?.authorization?.exp_month;
    let exp_year = String(payload?.data?.authorization?.exp_year).slice(-2)
    let card_type = payload?.data?.authorization?.exp_month;
    let amount = (payload?.data?.amount) / 100;

    let t2s_payload = {
        transaction_id: payment_id,
        customer_id: customer_id,
        order_info_id: GetIDFromReference(payload?.data?.reference,'order_id'),
        amount: amount,
        reference: payload?.reference
    };
    
    //if the token eligible to be stored, then add card info to the notify payload
    if(tokenize_eligible){
        t2s_payload = {
            transaction_id: payment_id,
            customer_id: customer_id,
            provider: 'OPTOMANY', //sending provider as opto, as T2S iniates sale through php opto gateway
            token: master_token, 
            last_4_digits,
            expiry_date: `${exp_month}${exp_year}`,
            card_type: card_type,
            one_click: 'YES',
            is_primary: 'YES',
            order_info_id: GetIDFromReference(payload?.data?.reference,'order_id'),
            amount: amount,
            reference: payload?.reference
        };
    }
    

    

    let message_body = {
        payload: sqs_payload,
        t2sPayload: t2s_payload,
        card_payment_id: payment_id
    }
    console.log('message_body',JSON.stringify(message_body))

    const sql_params = {
        MessageBody: JSON.stringify(message_body),
        QueueUrl: process.env.NOTIFY_ORDER_STATUS_QUEUE_URL
    };
    
    if(process.env.IS_OFFLINE){
        sql_params.QueueUrl = process.env.NOTIFY_ORDER_STATUS_QUEUE_URL_LOCAL
    }

    //sending to sqs
    const sqs = new AWS.SQS({})    
    let response = await sqs.sendMessage(sql_params).promise();
    console.log('sqs.sendMessage response',JSON.stringify(response))
}