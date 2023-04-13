const crypto = require('crypto');
export const webhookAuth = async (event) => {
    var signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                .update(event.body)
                .digest('hex');
    var webhook_signature = event?.headers['X-Paystack-Signature']
    console.log({webhook_signature})
    console.log(process.env.PAYSTACK_SECRET_KEY)
    console.log('signature',signature)
    if (signature !== webhook_signature) {
        throw new Error('Invalid signature');  
    } 
    return true;
};
