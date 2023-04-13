/*
 * @step# : 2
 * @Description: Publisher cron picks configuration from settlement config and pushes to queue for processing the pin payout
 * @SampleMessage:
 */

import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
var { helpers, getPinPayoutNotifyEmailTemplate } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
var currencyFormatter = require('currency-formatter');
let currentCodeEnv = helpers.getCodeEnvironment();
const moment = require('moment-timezone');
const TIMEZONE = 'Europe/London';

export class PinPaymentPayout {
    async init(event) {
        let LoopingArray = event?.Records;
        if (process.env.IS_OFFLINE) {
            LoopingArray = [
                //use this for local testing by overwriting the 'body' field with below object
                {
                    body:
                        '{ "merchant_id" : 63155140, "delay_payout" : 1, "last_executed_at" : "2022-06-13 12:00:00","payout_provider":"TIPALTI"}'
                }
            ]; //for local testing
        }

        const promises = LoopingArray.map((message) => {
            console.log('PinPayout published messaged', message);
            return this.processWithdrawal(message);
        });
        const executions = await Promise.all(promises);

        var result = await this.postProcessMessage(executions);
        return result;
    }

    async processWithdrawal(message) {
        console.log('Messaging :: Consumer: batchingPinPayout: body - ', message.body);
        let email_queue_url = process.env.EMAIL_QUEUE_URL;
        let sms_queue_url = process.env.SMS_QUEUE_URL;
        const { merchant_id, delay_payout, payout_provider } = JSON.parse(message.body);

        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );

        const {
            sequelize,
            Sequelize,
            Payments,
            Customer,
            OtherCustomerDetails,
            PayoutBatch,
            PayoutBatchItem,
            SettlementConfig,
            PayoutLog
        } = db;

        try {
            let batch_id;

            let isValidConfig = await this.validateSettlmentConfig(Sequelize, SettlementConfig, merchant_id);

            if (!isValidConfig) {
                await this.updateSettlementConfig(
                    SettlementConfig,
                    PayoutLog,
                    batch_id,
                    'Already Processed',
                    merchant_id
                );

                sequelize.close && (await sequelize.close());
                return { message, success: true };
            }

            let validMerchant = await Customer.findOne({
                attributes: ['id', 'customers_mobile', 'customers_email', 'currency', 'country_id'],
                where: {
                    [Sequelize.Op.and]: [
                        {
                            id: merchant_id,
                            progress_status: 2,
                            account_verification_status: 'VERIFIED',
                            bank_verification_status: 'VERIFIED'
                        },
                        { status: { [Sequelize.Op.ne]: 12 } },
                        { payment_provider: { [Sequelize.Op.in]: ['CARDSTREAM-CH', 'DNA'] } },
                        { country_id: { [Sequelize.Op.in]: [3, 7, 1] } }
                    ]
                },
                raw: true
            });

            if (!validMerchant) {
                await this.updateSettlementConfig(
                    SettlementConfig,
                    PayoutLog,
                    batch_id,
                    'Not a valid merchant',
                    merchant_id
                );

                sequelize.close && (await sequelize.close());
                return { message, success: true };
            }

            let inBatch = await PayoutBatch.findOne({
                attributes: ['batch_id'],
                where: {
                    customer_id: merchant_id,
                    date_pending: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    status: 'PENDING'
                },
                raw: true
            });

            if (inBatch) {
                batch_id = inBatch.batch_id;

                await this.updateSettlementConfig(
                    SettlementConfig,
                    PayoutLog,
                    batch_id,
                    `Already in batch:${inBatch.batch_id}`,
                    merchant_id
                );

                sequelize.close && (await sequelize.close());

                return { message, success: true };
            }

            let tranaction_ids = await Payments.findAll({
                attributes: ['id', 'net'],
                where: {
                    [Sequelize.Op.and]: [
                        {
                            withdrawn_status: 0,
                            delete_status: 0,
                            merchant_id: merchant_id
                        },
                        { payment_provider_id: { [Sequelize.Op.in]: [3, 7] } },
                        { transaction_status_id: { [Sequelize.Op.in]: [1, 2] } },
                        {
                            transaction_time: {
                                [Sequelize.Op.lte]: this.getCountryWisePayoutDate(
                                    delay_payout,
                                    validMerchant.country_id,
                                    `${moment().tz(TIMEZONE).format('YYYY-MM-DD')} 23:59:59`
                                )
                            }
                        }
                    ]
                },
                raw: true
            });

            let cardpaymentIds = [];
            let cardPaymentSum = 0;
            tranaction_ids.forEach((element) => {
                cardpaymentIds.push(element.id);
                cardPaymentSum = cardPaymentSum + element.net;
            });

            console.log(`tranaction_ids & sum: ${JSON.stringify(tranaction_ids)},${cardPaymentSum}`);

            let avaliablebBalance = cardPaymentSum / 100;

            let balance = helpers.formatCurrency(avaliablebBalance);

            console.log('Avaliable Balance for the merchant id: ', merchant_id, ' balance is: ', balance);

            console.log(
                'withdrawalAmount balance for the merchant id: ',
                merchant_id,
                ' amount is: ',
                avaliablebBalance
            );

            let withdrawalMinimumBalance = 1; // This is for limiting merchant withdrawal with keeping some balance for refunds, 0 means no restriction, 1 means 1 dollar is the limit for now
            if (avaliablebBalance < withdrawalMinimumBalance) {
                // Keeping this check limiting to 0, in future accordingly with requirement can be changed
                console.log(
                    `Since the amount is less than ${withdrawalMinimumBalance} we dont need to do the withdrawals for the merchant id: 
                    ${merchant_id}`
                );

                await this.updateSettlementConfig(
                    SettlementConfig,
                    PayoutLog,
                    batch_id,
                    `Amount is less than ${withdrawalMinimumBalance}`,
                    merchant_id
                );
                sequelize.close && (await sequelize.close());

                return { message, success: true };
            }

            let updated_balance = balance - avaliablebBalance;
            updated_balance = parseFloat(updated_balance).toFixed(2);

            console.log(`cardpaymentIds: ${JSON.stringify(cardpaymentIds)}`);

            const paymentIds = await PayoutBatchItem.findAll({
                attributes: ['card_payment_id'],
                where: {
                    customer_id: merchant_id,
                    card_payment_id: cardpaymentIds
                },
                raw: true
            });

            console.log(`paymentIds:${paymentIds}`);

            let exists = [];
            let non_existing_payment_ids = [];
            let non_existing_payments = [];
            paymentIds.forEach((element) => {
                exists.push(element.card_payment_id);
            });

            console.log(`Payment IDs already existing:${exists}`);

            tranaction_ids.map((item) => {
                console.log(item.id, !exists.includes(item.id));
                if (!exists.includes(item.id)) {
                    non_existing_payments.push({
                        batch_id: batch_id,
                        card_payment_id: item.id,
                        total: item.net,
                        customer_id: merchant_id,
                        date_issued: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                    });

                    non_existing_payment_ids.push(item.id);
                }

                return non_existing_payment_ids, non_existing_payments;
            });

            console.log(`non_existing_payment_ids: ${non_existing_payment_ids}`);

            // update the balance
            console.log('Updating customer balance for merchant id: ', merchant_id);
            await Customer.update(
                {
                    balance: updated_balance,
                    balance_updated: Sequelize.fn('NOW')
                },
                { where: { id: merchant_id } }
            );

            // update the status which was introduced to ommit the race condition
            console.log('Updating status of withdrawal progress to Finished for merchant id: ', merchant_id);

            //notify the client via email

            var nextWithdrawalDay = await this.nextWithdrawalDate();

            var otherCustomerInfo = await OtherCustomerDetails.findOne({
                attributes: ['accountnumber', 'sortcode', 'bankname', 'accountholder', 'pp_token'],
                where: {
                    customers_id: merchant_id
                }
            });

            console.log(`otherCustomerInfo:${otherCustomerInfo},${cardPaymentSum}`);
            var batchDetails;
            if (cardPaymentSum > 0) {
                batchDetails = await PayoutBatch.create({
                    customer_id: merchant_id,
                    total: cardPaymentSum,
                    date_pending: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                    week_no: moment().tz(TIMEZONE).format('W'),
                    account_number: `${otherCustomerInfo.accountnumber.substr(0, 4)}${'*'.repeat(
                        otherCustomerInfo.accountnumber.length - 4
                    )}`,
                    sort_code: otherCustomerInfo.sortcode,
                    bank_name: otherCustomerInfo.bankname,
                    account_holder: otherCustomerInfo.accountholder,
                    pp_token: otherCustomerInfo.pp_token,
                    payout_provider,
                    currency: validMerchant.currency.toUpperCase()
                });

                non_existing_payments.forEach((element) => {
                    element.batch_id = batchDetails.batch_id;
                    element.updated_at = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
                });

                const batch_items = await PayoutBatchItem.bulkCreate(non_existing_payments);
                console.log('Bulk Create Response:', batch_items);

                let PaymentsData = await Payments.update(
                    {
                        withdrawn_status: 1,
                        transaction_status_id: 3
                    },
                    {
                        where: { id: { [Sequelize.Op.in]: cardpaymentIds } }
                    }
                );

                console.log(`PaymentsData:`, PaymentsData);
            }

            let batchId = batchDetails ? batchDetails.batch_id : '';

            await this.updateSettlementConfig(
                SettlementConfig,
                PayoutLog,
                batchId,
                `Processed Successfully~Amount~${cardPaymentSum}`,
                merchant_id
            );

            if (cardPaymentSum > 0) {
                avaliablebBalance = currencyFormatter.format(avaliablebBalance, {
                    code: validMerchant.currency.toUpperCase()
                });

                console.log(`avaliablebBalance:${avaliablebBalance}`);

                var notification_message = `Amount of ${avaliablebBalance} has been sent to your account and will be credited to you by ${nextWithdrawalDay}.`;

                if (otherCustomerInfo) {
                    var account_number = `${otherCustomerInfo.accountnumber.substr(0, 4)}${'*'.repeat(
                        otherCustomerInfo.accountnumber.length - 4
                    )}`;
                    notification_message = `Amount of ${avaliablebBalance} has been sent to your account number ${account_number} and will be credited to you by ${nextWithdrawalDay}.`;
                }

                const sqs = new AWS.SQS({});

                var emailHtml = await getPinPayoutNotifyEmailTemplate({ notification_message });
                var recipient_email_address =
                    currentCodeEnv === 'production' ? validMerchant.customers_email : process.env.SIMULATOR_SUCCESS;
                var payload = {
                    type: 'Basic', //as we are sending mail to single user
                    subject: 'Automated withdrawal',
                    html_body: emailHtml,
                    cc_address: [],
                    to_address: [recipient_email_address],
                    source_email: 'info@datman.je',
                    reply_to_address: []
                };

                const email_objectStringified = JSON.stringify({
                    payload
                });

                console.log(
                    'Messaging :: Messaging service Send Email Pin Payout:: Payload :: ',
                    email_objectStringified
                );
                const email_params = {
                    MessageGroupId: uuidv4(),
                    MessageBody: email_objectStringified,
                    QueueUrl: email_queue_url
                };

                await sqs.sendMessage(email_params).promise();

                //notify user via sms
                payload = {
                    phone_number: validMerchant.customers_mobile,
                    message_text: `Dear valued client,\n\n${notification_message}`
                };
                const sms_objectStringified = JSON.stringify({
                    payload
                });

                console.log('Messaging :: Messaging service Send SMS:: Payload :: ', sms_objectStringified);
                const sms_params = {
                    MessageGroupId: uuidv4(),
                    MessageBody: sms_objectStringified,
                    QueueUrl: sms_queue_url
                };

                await sqs.sendMessage(sms_params).promise();

                console.log('Process completed for merchant id: ', merchant_id);
            }

            console.log(`Returning success here with sum ${cardPaymentSum}`);
            sequelize.close && (await sequelize.close());
            return { message, success: true };
        } catch (error) {
            console.error('Pin Payout error: ', error);
            console.log('Error processing for merchant id: ', merchant_id, ' Error:', error);
            sequelize.close && (await sequelize.close());
            console.log(`Connection close 6`);
            return { message, success: false };
        }
    }

    async postProcessMessage(executions) {
        console.log(`InsidePostProcessMessage:${executions}`);

        console.log('Executions result:', executions);
        console.log(`hasAtleastOneErrorBlock`);
        let options = {};

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2012-11-05',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
        }
        const sqs = new AWS.SQS(options);

        const processSuccesItems = executions.filter((result) => result.success === true);

        console.log(`processSuccesItems:`, JSON.stringify(processSuccesItems));

        for (let successMsg of processSuccesItems) {
            const params = {
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: successMsg.message.receiptHandle
            };

            console.log(params, 'successMsg');
            try {
                console.log(`Deleting the message ...${JSON.stringify(successMsg)}`);
                let deletionResponse = await sqs.deleteMessage(params).promise();
                console.log(`deletionResponse:`, deletionResponse);
            } catch (error) {
                // Do nothing, need to make the code idempotent in such case
            }
        }

        // For errors, lambda instance will not be available till visisibility timeout expires
        const processErrorItemsMsgIds = executions
            .filter((result) => result.success === false)
            .map((result) => result.message.messageId);
        throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
    }

    async nextWithdrawalDate() {
        let d = `${moment().tz(TIMEZONE).add(1, 'days').format('DD-MMM-YYYY')}`;
        return d;
    }

    getCountryWisePayoutDate(delay_payout = 0, country_id, date = '') {
        date = `${this.getCurrentDayMoment(date).subtract(delay_payout, 'days').format('YYYY-MM-DD')} 23:59:59`;

        console.log(`After delay payout deduction:' ${date}, ${delay_payout}`);
        if (country_id == 3) {
            date = moment(date).subtract(9, 'hours').format('YYYY-MM-DD HH:mm:ss');
        }

        if (country_id == 7) {
            date = moment(date).add(5, 'hours').format('YYYY-MM-DD HH:mm:ss');
        }

        console.log('result_date:', date, country_id);
        return date;
    }

    // getDelayPayoutExcludingWeekends(delay_payout = 0, date = '') {
    //     let weekDays = {
    //         Monday: 1,
    //         Tuesday: 2,
    //         Wednesday: 3,
    //         Thursday: 4,
    //         Friday: 5,
    //         Saturday: 6,
    //         Sunday: 7
    //     };
    //     let isoWeekday;

    //     console.log({ date });
    //     console.log({ delay_payout });
    //     delay_payout++; //incrementing the value here so that the very previous
    //     console.log('Incrementing delay_payout', delay_payout);

    //     for (let i = delay_payout; i > 0; i--) {
    //         let delay_payout_step = 0;
    //         isoWeekday = this.getCurrentDayMoment(date).isoWeekday();

    //         delay_payout_step = 1;
    //         if (isoWeekday === weekDays.Sunday) delay_payout_step = 2;
    //         if (isoWeekday === weekDays.Monday) delay_payout_step = 3;

    //         date = `${this.getCurrentDayMoment(date)
    //             .subtract(delay_payout_step, 'days')
    //             .format('YYYY-MM-DD')} 23:59:59`;
    //     }

    //     console.log('result_date', date);
    //     return date;
    // }

    getCurrentDayMoment(date) {
        let momentFunction;
        if (date) {
            console.log('Inside date');
            momentFunction = moment.tz(date, 'YYYY-MM-DD HH:mm:ss', TIMEZONE);
        }
        console.log('moment current date => ', momentFunction.format('YYYY-MM-DD HH:mm:ss'));
        console.log('moment isoWeekday => ', momentFunction.isoWeekday());
        return momentFunction;
    }

    async updateSettlementConfig(SettlementConfig, PayoutLog, batch_id, remarks, merchant_id) {
        console.log(`remarks:${remarks}`);
        let updateData = await SettlementConfig.update(
            {
                last_executed_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
            },
            {
                where: {
                    customer_id: merchant_id
                }
            }
        );

        console.log(`updateSettlementConfig~batchid:${batch_id}`);

        if (batch_id && batch_id != '') {
            await PayoutLog.create({
                batch_id: batch_id,
                updated_at: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
                remarks: remarks
            });
        }

        console.log(updateData);

        return updateData;
    }

    async validateSettlmentConfig(Sequelize, SettlementConfig, merchant_id) {
        let SettlementConfigData = await SettlementConfig.findOne({
            where: {
                last_executed_at: {
                    [Sequelize.Op.lt]: moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                },
                status: { [Sequelize.Op.eq]: 1 },
                customer_id: merchant_id
            },
            attributes: ['id'],
            raw: true
        });

        console.log(`SettlementConfig:${SettlementConfig}`);

        return SettlementConfigData;
    }
}
