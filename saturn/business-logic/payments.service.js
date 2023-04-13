const moment = require('moment-timezone');

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

export const getPaymentStatus = async (info, Payment) => {
    console.log('getpayment status started');
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    let { order_id, merchant_id } = info;
    const payment = await Payment.findOne({
        attributes: ['order_id', 'payment_status'],
        where: {
            order_id: `${order_id}`,
            payment_status: 'OK',
            customer_id: merchant_id,
            month: parseInt(moment().tz('europe/london').month()) + 1
        }
    });

    if (payment) return true;

    return false;
};

export const addPaymentRecord = async (info, Payment) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }

    var address = '';
    address += info.address1 ? info.address1 + ' ' : '';
    address += info.address2 ? info.address2 : '';

    var data = await Payment.create({
        customer_id: info.merchant_id,
        firstname: info.firstname,
        lastname: info.lastname,
        address: address,
        email: info.email,
        total: parseFloat(info.Amount).toFixed(2),
        payed: info.payed,
        provider: info.provider,
        payment_status: info.payment_status,
        CrossReference: info.CrossReference,
        payment_provider: info.payment_provider,
        order_id: info.order_id,
        week_no: info.week_no,
        fees: info.fees,
        SecurityKey: info.SecurityKey,
        VendorTxCode: info.VendorTxCode,
        VPSTxId: info.VPSTxId,
        ip: info.ip,
        withdraw_status: '0',
        delete_status: '0'
    });
    return data;
};

export const updatePaymentRecord = async (info) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    let { payment_status, transactionId, last4digits, paymentIntentId, Payment } = info;
    var data = await Payment.update(
        {
            payment_status,
            last_4_digits: last4digits,
            VendorTxCode: paymentIntentId
        },
        {
            where: { id: transactionId }
        }
    );
    return data;
};

export const decryptRequest = async (encryptedData, cryptFunctions, STRIPE_PAYLOAD_ENCRYPTION_KEY) => {
    console.log('DECRYPT FUNCTION START');
    let encryptionMethod = 'AES-256-CBC';
    let secret = STRIPE_PAYLOAD_ENCRYPTION_KEY;
    let iv = secret.substr(0, 16);
    // let encryptedData = info;
    let decryptData = await cryptFunctions.decrypt(encryptedData, encryptionMethod, secret, iv);
    return decryptData;
};

//export default [getPaymentStatus, decryptRequest, updatePaymentRecord, addPa
