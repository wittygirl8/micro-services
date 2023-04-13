const assert = require('assert');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
var { response } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');

exports.autoWithdrawalValidation = async function (event, context) {
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize } = db;

    let logMetadata = {
        location: 'MessagingService ~ autoWithdrawalValidation',
        awsRequestId: context.awsRequestId
    };

    var count = 0;
    var total_Withdrawals_count = 0;
    var sum = 0;
    var total_Withdrawals_Sum = 0;
    var mid_arrayList = [];
    var flagged_List = [];
    var less_than_hundred = [];
    var double_payment = [];
    var invalid_country = [];
    var invaild_verification_status = [];
    var invaild_progress_status = [];
    var unprocessed_withdrwals = [];
    var duplicate_cardpayment = [];
    var negativeBalance = [];
    var difference_amounts = [];
    var cardPaymentTotalSum = 0;
    var totalCustomersMarkedForAW = 0;

    await sequelize
        .query(
            'SELECT id, balance, business_name, country_id, account_verification_status, progress_status from customers WHERE auto_withdraw = 1',
            {
                type: sequelize.QueryTypes.SELECT
            }
        )
        .then(async function () {
            let resp = await sequelize.query(
                'SELECT id, balance, business_name, country_id, account_verification_status, progress_status from customers WHERE auto_withdraw = 1',
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            var result = resp;
            var arraylength = result.length;

            for (var i = 0; i < arraylength; i++) {
                try {
                    mid_arrayList.push(result[i].id);
                    if (result[i].country_id !== 1) {
                        console.log(logMetadata, 'result[i].country_id: ' + result[i].country_id);
                        invalid_country.push(result[i].id);
                        assert(result[i].country_id == 1, 'Country doesnt belong to UK for Mid: ' + result[i].id);
                    } else if (result[i].account_verification_status !== 'VERIFIED') {
                        invaild_verification_status.push(result[i].id);
                        assert(
                            result[i].account_verification_status == 'VERIFIED',
                            'Account_verification_status is invalid for ' + result[i].id
                        );
                    } else if (result[i].progress_status !== 2) {
                        invaild_progress_status.push(result[i].id);
                        assert(result[i].progress_status == 2, 'Progress status is invalid for ' + result[i].id);
                    } else {
                        let resp_withdrawals_log_resp = await sequelize.query(
                            `SELECT amount FROM auto_withdraw_log WHERE merchant_id = '${result[i].id}' and DATE_FORMAT(created_at, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')ORDER by 1 DESC`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        var resp_log = resp_withdrawals_log_resp;

                        if (resp_log[0].amount < 100) {
                            less_than_hundred.push(result[i].id);
                            assert(false, 'Withdrawls Amount processed is less than 100 for:' + result[i].id);
                        }

                        if (resp_log[1] != null) {
                            if (resp_log[0].amount == resp_log[1].amount) {
                                double_payment.push(result[i].id);
                                assert(false, 'withdrawals has processed twice for ');
                            }
                        }

                        let isProcessed = await sequelize.query(
                            `SELECT count(1) count FROM auto_withdraw_log WHERE merchant_id = '${result[i].id}' and DATE_FORMAT(created_at, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d') and status = 0`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        if (isProcessed[0].count > 0) {
                            unprocessed_withdrwals.push(result[i].id);
                            assert(
                                false,
                                'Status of the auto withdrawal record indicates it is unprocessed:' + result[i].id
                            );
                        }

                        let cp_Log_resp = await sequelize.query(
                            `select total, payed from card_payment where customer_id = '${result[i].id}' and method = 'AutoWithdraw' and DATE_FORMAT(time, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')ORDER by 1 DESC`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        let isDuplicatePayment = await sequelize.query(
                            `select count(1) count from card_payment where customer_id = '${result[i].id}' and method = 'AutoWithdraw' and DATE_FORMAT(time, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        var resp_cp = cp_Log_resp;

                        if (isDuplicatePayment[0].count > 1) {
                            duplicate_cardpayment.push(result[i].id);
                            assert(false, 'Two payment records in card payment table');
                        } else if (resp_cp[0] && resp_cp[0].total !== resp_cp[0].payed) {
                            difference_amounts.push(result[i].id);
                            assert(false, 'total and payed amount Not are equal');
                        } else {
                            count++;
                            console.log(logMetadata, 'count: ' + count);
                            assert(true, 'total and payed amount are equal');
                        }

                        let balance_resp = await sequelize.query(
                            `SELECT balance from customers WHERE id = '${result[i].id}'`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        var account_Balance = parseFloat(balance_resp[0].balance);
                        if (account_Balance < 0) {
                            negativeBalance.push(result[i].id);
                            assert(false, 'Account having Negative balance ' + result[i].id);
                        }

                        let withdrawals_Amount_resp = await sequelize.query(
                            `SELECT amount FROM auto_withdraw_log WHERE merchant_id = '${result[i].id}' and DATE_FORMAT(created_at, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')ORDER by 1 DESC`,
                            {
                                type: sequelize.QueryTypes.SELECT
                            }
                        );

                        if (withdrawals_Amount_resp[0].amount >= 100) {
                            sum += withdrawals_Amount_resp[0].amount;
                        }

                        console.log(logMetadata, 'result amount:->>>' + sum);
                    }
                } catch (err) {
                    console.error(logMetadata, 'Error at Withdrawals validation--->' + err);
                }
            }

            let withdrawals_count_resp = await sequelize.query(
                ` SELECT count(1) as count FROM auto_withdraw_log WHERE DATE_FORMAT(created_at, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')`,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            total_Withdrawals_count = withdrawals_count_resp[0].count;

            let total_withdrawals_resp = await sequelize.query(
                `SELECT sum(amount) as sum FROM auto_withdraw_log WHERE DATE_FORMAT(created_at, '%y-%m-%d')= DATE_FORMAT(CURRENT_DATE, '%y-%m-%d')`,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            let cardPaymentTotalSumResp = await sequelize.query(
                `select sum(payed) sum from card_payment where method = 'AutoWithdraw' and day = DATE_FORMAT(CURRENT_DATE, '%d') and month = DATE_FORMAT(CURRENT_DATE, '%m') and year = DATE_FORMAT(CURRENT_DATE, '%Y')`,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            let autowithdrawalMarkedCustomers = await sequelize.query(
                `select count(1) count from customers where auto_withdraw = 1`,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            cardPaymentTotalSum = cardPaymentTotalSumResp[0].sum;
            total_Withdrawals_Sum = total_withdrawals_resp[0].sum;
            totalCustomersMarkedForAW = autowithdrawalMarkedCustomers[0].count;
        });

    sequelize.close && (await sequelize.close());

    flagged_List = [
        ...less_than_hundred,
        ...double_payment,
        ...invalid_country,
        ...invaild_verification_status,
        ...invaild_progress_status,
        ...unprocessed_withdrwals,
        ...duplicate_cardpayment,
        ...negativeBalance,
        ...difference_amounts
    ];

    console.log(logMetadata, 'Total Withdrawals Count:>> ' + total_Withdrawals_count);
    console.log(logMetadata, 'Successfull Withdrawals Count:>> ' + count);
    console.log(
        logMetadata,
        'Merchants marked as Auto withdrawal in Customers table Count:>> ' + totalCustomersMarkedForAW
    );
    console.log(logMetadata, 'Invalid Withdrawals Count:>> ' + (total_Withdrawals_count - count));
    console.log(logMetadata, 'Total amount including negative amount :>> ' + sum);
    console.log(logMetadata, 'Total withdrawal amount Processed :>> ' + total_Withdrawals_Sum);
    console.log(logMetadata, 'Total amount processed in Card Payment amount Processed :>> ' + cardPaymentTotalSum);
    console.log(logMetadata, 'Less than 100 amount :>> ' + less_than_hundred);
    console.log(logMetadata, 'Double Payment found in autowithdrawal log :>> ' + double_payment);
    console.log(logMetadata, 'Flagged for invalid country code :>> ' + invalid_country);
    console.log(logMetadata, 'Not verified clients :>> ' + invaild_verification_status);
    console.log(logMetadata, 'Not an active client(Progress status) :>> ' + invaild_progress_status);
    console.log(logMetadata, 'Unprocessed status in auto withdrwal log(status 0) :>> ' + unprocessed_withdrwals);
    console.log(logMetadata, 'Duplicate payment in card payment table :>> ' + duplicate_cardpayment);
    console.log(logMetadata, 'Negative balance in customers table :>> ' + negativeBalance);
    console.log(logMetadata, 'Amount mismatch between in cardpayment with total and payed :>> ' + difference_amounts);
    console.log(logMetadata, 'Flagged Customer_Id List:>> ' + flagged_List);
    console.log(
        logMetadata,
        'Flagged Customer_Id Count(Count of invalid autowithdrawal marked merchants):>> ' + flagged_List.length
    );

    return response({
        statusCode: 200,
        body: { status: 'SUCCESS', message: 'Processed Successfully' }
    });
};
