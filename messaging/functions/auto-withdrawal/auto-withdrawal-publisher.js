import AWS from 'aws-sdk';
const AWSXRay = require('aws-xray-sdk');
var { response } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const ni = require('nanoid');
export const autoWithdrawalPublisher = async (event) => {
    console.log('Event:', event);
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    const { sequelize, Sequelize, Customer, AutoWithdrawLog } = db;
    const mids = await Customer.findAll({
        where: {
            [Sequelize.Op.and]: [
                { country_id: { [Sequelize.Op.in]: [1] } },
                {
                    auto_withdraw: 1,
                    progress_status: 2,
                    account_verification_status: 'VERIFIED',
                    bank_verification_status: 'VERIFIED'
                }
            ]
        },
        attributes: ['id', 'customers_mobile', 'customers_email'],
        raw: true
    });

    console.log('here the list of mids', mids);

    let merchant_info = new Array();
    let bulk_mids = new Array();

    mids.forEach((v) => {
        var payloadMid = {
            merchant_id: v.id,
            reference: ni.nanoid(32),
            customers_email: v.customers_email,
            customers_mobile: v.customers_mobile,
            email_queue_url: process.env.EMAIL_QUEUE_URL,
            sms_queue_url: process.env.SMS_QUEUE_URL
        };
        merchant_info.push(payloadMid);
        bulk_mids.push({ merchant_id: payloadMid.merchant_id, reference: payloadMid.reference });
    });

    console.log('Bulk mids:', bulk_mids);

    const res = await AutoWithdrawLog.bulkCreate(bulk_mids);
    console.log('Bulk Create Response:', res);

    sequelize.close && (await sequelize.close());
    // let message = JSON.stringify({ merchant_id: 63155140, reference: ni.nanoid(32) });
    // autoWithdrawalService.processWithdrawal({ body: message });

    //Below line has to be uncommented

    // await autoWithdrawalService.init(bulk_mids)

    // then pass this to the qeuee

    let queueUrl = process.env.QUEUE_URL;
    let options = {};
    if (process.env.IS_OFFLINE) {
        options = {
            apiVersion: '2012-11-05',
            region: 'localhost',
            endpoint: 'http://0.0.0.0:9324',
            sslEnabled: false
        };
        queueUrl = process.env.LOCAL_QUEUE_URL;
    }
    console.log('the bulk mids are', bulk_mids);
    let sendMessagePromises = merchant_info.map(async (v) => {
        const params = {
            MessageBody: JSON.stringify(v),
            QueueUrl: queueUrl
        };
        console.log('params that are pushed to the sqs', params);
        const sqs = AWSXRay.captureAWSClient(new AWS.SQS(options));
        return sqs.sendMessage(params).promise();
    });
    let promiseExecutionResponse = await Promise.all(sendMessagePromises);
    console.log('Executed successfully', promiseExecutionResponse);
    sequelize.close && (await sequelize.close());
    return response({ isSuccessful: true });
};
