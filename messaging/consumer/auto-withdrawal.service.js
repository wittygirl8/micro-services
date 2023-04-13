import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
var { helpers, getAutoWithdrawlNotifyEmailTemplate } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
// const dbq = require('./auto-withdrawal/dbq')
var moment = require('moment');
var currencyFormatter = require('currency-formatter');
let currentCodeEnv = helpers.getCodeEnvironment();

export class AutoWithdrawalService {
    async init(event) {
        console.log(event);
        const promises = event.Records.map((message) => {
            console.log('AutoWithdrawal published messaged', message);
            return this.processWithdrawal(message);
        });
        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async processWithdrawal(message) {
        console.log('Messaging :: Consumer: processT2SNotification: body - ', message.body);
        const {
            merchant_id,
            reference,
            customers_email,
            customers_mobile,
            email_queue_url,
            sms_queue_url
        } = JSON.parse(message.body);

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
            Payment,
            WithdrawalProgressStatus,
            InternalTransferTransaction,
            Customer,
            AutoWithdrawLog,
            OtherCustomerDetails
        } = db;
        try {
            // Verify for this client if the auto withdraw is already done

            console.log('Processing started for merchant id: ', merchant_id, ' for the reference: ', reference);

            let dupAwRequest = await AutoWithdrawLog.findOne({
                attributes: ['id'],
                where: {
                    [Sequelize.Op.and]: [
                        {
                            reference: reference,
                            status: 1
                        }
                    ]
                },
                raw: true
            });

            if (dupAwRequest) {
                console.log(
                    'Request already processed for merchant id: ',
                    merchant_id,
                    ' for the reference: ',
                    reference
                );

                await AutoWithdrawLog.update(
                    {
                        status: 1
                    },
                    {
                        where: {
                            merchant_id,
                            reference
                        }
                    }
                );

                // return { message, success: true };
                sequelize.close && (await sequelize.close());
                return { message, success: true };
                //return Promise.resolve({ message, success: true });
            }

            //check the withdrawal progress status if already one exists
            const WITHDRAWAL_PROGRESS_CUTOFF_SECONDS = 30;
            let wps = await WithdrawalProgressStatus.findOne({
                attributes: ['id'],
                where: {
                    [Sequelize.Op.and]: [
                        {
                            customer_id: merchant_id,
                            status: 'IN_PROGRESS'
                        },
                        Sequelize.where(
                            Sequelize.fn(
                                'TIME_TO_SEC',
                                sequelize.fn('TIMEDIFF', Sequelize.fn('NOW'), Sequelize.col('updated_at'))
                            ),
                            {
                                [Sequelize.Op.lte]: WITHDRAWAL_PROGRESS_CUTOFF_SECONDS
                            }
                        )
                    ]
                },
                raw: true
            });

            if (wps) {
                console.log(
                    'Need to requeue the message since the withdrawal is already in progress for merchant id: ',
                    merchant_id,
                    ' for the reference: ',
                    reference
                );
                // return { message, success: true };
                sequelize.close && (await sequelize.close());
                return { message, success: true };
                //return Promise.resolve({ message, success: true });
            }

            //to prevent race condition, add withdrawal progress status
            console.log('Updating progress for merchant id: ', merchant_id, ' for the reference: ', reference);
            WithdrawalProgressStatus.upsert(
                {
                    status: 'IN_PROGRESS',
                    customer_id: merchant_id
                },
                { where: { customer_id: merchant_id } }
            );

            // calculate the current account balance for this mid
            // 1. total cardpayment
            let cardPaymentSum = await Payment.sum('payed', {
                where: {
                    [Sequelize.Op.and]: [
                        { [Sequelize.Op.or]: { payment_status: 'OK', withdraw_status: { [Sequelize.Op.gt]: 0 } } },
                        { delete_status: { [Sequelize.Op.ne]: 1 } },
                        { customer_id: merchant_id }
                    ]
                },
                indexHints: [{ type: 'FORCE', values: ['balance'] }]
            });

            // 2. total amount of internal transfer the client has done
            let itDoneByClient = await InternalTransferTransaction.sum('amount', {
                where: {
                    [Sequelize.Op.and]: [{ status: { [Sequelize.Op.ne]: 'CANCELED' } }, { customer_id: merchant_id }]
                }
            });

            // 3. total amount of internal transfer the client has received
            let itRecievedByClient = await InternalTransferTransaction.sum('amount', {
                where: {
                    [Sequelize.Op.and]: [
                        { status: { [Sequelize.Op.in]: ['COMPLETE', 'REFUNDED', 'DISPUTING'] } },
                        { recipient_id: merchant_id }
                    ]
                }
            });

            // 4. total refund the client has received from suppliers
            let rawItClientRecievedFromSuppliers = await sequelize.query(
                `SELECT ROUND(sum(internal_transfer_refund.amount), 2) AS total FROM internal_transfer_refund LEFT JOIN internal_transfer_transaction ON internal_transfer_transaction_ref = ref WHERE internal_transfer_transaction.customer_id=${merchant_id}`
            );
            let itClientRecievedFromSuppliers = rawItClientRecievedFromSuppliers[0][0]['total'];
            if (!itClientRecievedFromSuppliers) {
                itClientRecievedFromSuppliers = 0;
            }

            // 5. toal refund the client has given to suppliers
            let rawRefundGivenToSuppliers = await sequelize.query(
                `SELECT ROUND(sum(internal_transfer_refund.amount), 2) AS total FROM internal_transfer_refund LEFT JOIN internal_transfer_transaction ON internal_transfer_transaction_ref = ref WHERE recipient_id=${merchant_id}`
            );
            let refundGivenToSuppliers = rawRefundGivenToSuppliers[0][0]['total'];
            if (!refundGivenToSuppliers) {
                refundGivenToSuppliers = 0;
            }

            console.log(
                'Updating auto withdrawal log table to done status for merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference,
                ' cardPaymentSum: ',
                cardPaymentSum,
                ' itDoneByClient: ',
                itDoneByClient,
                ' itRecievedByClient: ',
                itRecievedByClient,
                ' itClientRecievedFromSuppliers: ',
                itClientRecievedFromSuppliers,
                ' refundGivenToSuppliers: ',
                refundGivenToSuppliers
            );

            // balance = 1 - 2 + 3 + 4 - 5
            let avaliablebBalance =
                cardPaymentSum -
                itDoneByClient +
                itRecievedByClient +
                itClientRecievedFromSuppliers -
                refundGivenToSuppliers;

            // Round Down
            let balance = helpers.formatCurrency(avaliablebBalance);

            console.log(
                'Avaliable Balance for the merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference,
                ' balance is: ',
                balance
            );

            // convert the balance for multiple of 10
            let auto_withdraw_amount = parseInt(balance) - (parseInt(balance) % 10);
            console.log(
                'Auto_withdraw_amount balance for the merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference,
                ' amount is: ',
                auto_withdraw_amount
            );

            if (auto_withdraw_amount < 100) {
                // update the status=1 to the auto_withdraw_log table
                // delete the message from the queue
                console.log(
                    'since the amount is less than 100 we dont need to the auto withdrawals for the merchant id: ',
                    merchant_id,
                    ' reference: ',
                    reference
                );
                WithdrawalProgressStatus.upsert(
                    {
                        status: 'FINISHED',
                        customer_id: merchant_id
                    },
                    { where: { customer_id: merchant_id } }
                );

                await AutoWithdrawLog.update(
                    {
                        amount: 0,
                        status: 1
                    },
                    {
                        where: {
                            merchant_id,
                            reference
                        }
                    }
                );

                sequelize.close && (await sequelize.close());
                return { message, success: true, skip: true };
                //return Promise.resolve({ message, success: true });
            }

            let updated_balance = balance - auto_withdraw_amount;
            updated_balance = parseFloat(updated_balance).toFixed(2);

            // create a withdrawal request
            console.log(
                'Populating card_payment table for merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference
            );
            await Payment.create({
                customer_id: merchant_id,
                ip: '0.0.0.0',
                firstname: 'withdraw',
                total: Math.abs(auto_withdraw_amount) * -1,
                payed: Math.abs(auto_withdraw_amount) * -1,
                delete_status: '0',
                withdraw_status: '1',
                year: new Date().getFullYear(),
                month: new Date().getMonth(),
                address: 'Status: <i>Request Sent</i>.',
                method: 'AutoWithdraw'
            });

            // update the balance
            console.log('Updating customer balance for merchant id: ', merchant_id, ' for the reference: ', reference);
            await Customer.update(
                {
                    balance: updated_balance,
                    balance_updated: Sequelize.fn('NOW')
                },
                { where: { id: merchant_id } }
            );

            // update the status which was introduced to ommit the race condition
            console.log(
                'Updating status of withdrawal progress to Finished for merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference
            );
            await WithdrawalProgressStatus.upsert(
                {
                    status: 'FINISHED',
                    customer_id: merchant_id
                },
                { where: { customer_id: merchant_id } }
            );

            // update the logs
            console.log(
                'Updating auto withdrawal log table to done status for merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference
            );
            await AutoWithdrawLog.update(
                {
                    amount: auto_withdraw_amount,
                    status: 1
                },
                {
                    where: {
                        merchant_id,
                        reference
                    }
                }
            );

            //notify the client via email

            var next_tuesday = await this.nextWithdrawalDate();

            var otherCustomerInfo = await OtherCustomerDetails.findOne({
                attributes: ['accountnumber'],
                where: {
                    customers_id: merchant_id
                }
            });

            sequelize.close && (await sequelize.close());

            auto_withdraw_amount = currencyFormatter.format(auto_withdraw_amount, { code: 'GBP' }); //for uk clients GBP

            var notification_message = `Amount of ${auto_withdraw_amount} has been sent to your account and will be credited to you by ${next_tuesday}.`;

            if (otherCustomerInfo) {
                var account_number = `${otherCustomerInfo.accountnumber.substr(0, 4)}${'*'.repeat(
                    otherCustomerInfo.accountnumber.length - 4
                )}`;
                notification_message = `Amount of ${auto_withdraw_amount} has been sent to your account number ${account_number} and will be credited to you by ${next_tuesday}.`;
            }

            console.log('Notification Message: ', notification_message);
            const sqs = new AWS.SQS({});

            var emailHtml = await getAutoWithdrawlNotifyEmailTemplate({ notification_message });

            var recipient_email_address =
                currentCodeEnv === 'production' ? customers_email : process.env.SIMULATOR_SUCCESS;
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

            console.log('Send message: ', email_queue_url, email_objectStringified);
            console.log(
                'Messaging :: Messaging service Send Email Auto-Widrawal:: Payload :: ',
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
                phone_number: customers_mobile,
                message_text: `Dear valued client,\n\n${notification_message}`
            };
            const sms_objectStringified = JSON.stringify({
                payload
            });

            console.log('Send message: ', sms_queue_url, sms_objectStringified);
            console.log('Messaging :: Messaging service Send SMS:: Payload :: ', sms_objectStringified);
            const sms_params = {
                MessageGroupId: uuidv4(),
                MessageBody: sms_objectStringified,
                QueueUrl: sms_queue_url
            };

            await sqs.sendMessage(sms_params).promise();

            console.log('Process completed for merchant id: ', merchant_id, ' for the reference: ', reference);

            sequelize.close && (await sequelize.close());

            return { message, success: true };
            //return Promise.resolve({ message, success: true });
        } catch (error) {
            console.error('Auto-withdrawals error: ', message.messageId, error);
            console.log(
                'Error processing for merchant id: ',
                merchant_id,
                ' for the reference: ',
                reference,
                ' Error:',
                error
            );
            sequelize.close && (await sequelize.close());
            return { message, success: false };
            //return Promise.resolve({ message, success: true });
        }
    }

    async postProcessMessage(executions) {
        const hasAtLeastOneError = executions.some((result) => result.success === false);

        console.log('Executions result:', executions);
        if (hasAtLeastOneError) {
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

            for (let successMsg of processSuccesItems) {
                const params = {
                    QueueUrl: process.env.QUEUE_URL,
                    ReceiptHandle: successMsg.event.receiptHandle
                };

                console.log(params, 'successMsg');
                try {
                    await sqs.deleteMessage(params).promise();
                } catch (error) {
                    // Do nothing, need to make the code idempotent in such case
                }
            }

            // For errors, lambda instance will not be available till visisibility timeout expires
            const processErrorItemsMsgIds = executions
                .filter((result) => result.success === false)
                .map((result) => result.event.messageId);
            throw new Error(`Following messag(es) was failing ${processErrorItemsMsgIds}. Check specific error above.`);
        } else {
            return { success: true };
        }
    }

    async nextWithdrawalDate() {
        let d = null;
        let day = moment().day();
        let hour = moment().hour();
        let minute = moment().minute();
        let day_number = {
            this_tuesday: 2,
            this_thursday: 4,
            next_tuesday: 9
        };

        if (day < 1 || (day === 1 && (hour < 9 || (hour === 9 && minute <= 30)))) {
            //if sundays, or monday(< 09:30), this tuesday 5PM
            d = `${moment().day(day_number.this_tuesday).format('dddd')} 5pm, ${moment()
                .day(day_number.this_tuesday)
                .format('DD-MMM-YYYY')}`; //this tuesday
        } else {
            d = `${moment().day(day_number.next_tuesday).format('dddd')} 5pm, ${moment()
                .day(day_number.next_tuesday)
                .format('DD-MMM-YYYY')}`; //this thursday
        }
        return d;
    }
}
