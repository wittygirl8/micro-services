const crypto = require('crypto');

export const webhookAuth = async (event, documentXray) => {
    let metadata = JSON.parse(event.body).data.metadata;
    console.log('webhookRequest', event);
    console.log('order_id', metadata.order_id);

    var hmac = crypto.createHmac('sha256', JSON.parse(process.env.CHECKOUT).webhook_secret);
    hmac.update(event.body);
    var signature = hmac.digest('hex');
    console.log('signature to compare', signature);
    console.log('signature from request', event.headers['Cko-Signature']);
    if (signature === (event.headers['cko-signature']|| event.headers['Cko-Signature'])) {
        console.log('Request successfully verified by sha256');
    } else {
        console.log('Unauthorized Request');
        throw new Error('Unauthorized Request, unable to validate from cko-signature ');
    }
    return true;
};
