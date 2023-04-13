const AWSXRay = require('aws-xray-sdk');
var { logHelpers } = process.env.IS_OFFLINE ? require('../../../../layers/helper_lib/src') : require('datman-helpers');
var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

export const BalanceReportGeneratorConsumer = async (event, context) => {
    const logMetadata = {
        location: 'CronService ~ BalanceReportGeneratorConsumer',
        awsRequestId: context.awsRequestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, Sequelize } = db;

    try {
        logger.info(logMetadata, 'Event', event);
        AWSXRay.capturePromise();
        if (process.env.IS_OFFLINE) {
            AWSXRay.setContextMissingStrategy(() => {}); //do nothing
        }
        var Records = new Array();
        if (event.Records && Array.isArray(event.Records)) {
            Records = event.Records;
        } else {
            Records = [event];
        }
        let payload = {};
        const promises = Records.map((message) => {
            payload = JSON.parse(message.body);
            return processBalanceReport(payload, { Sequelize, sequelize }, logMetadata);
        });
        await Promise.all(promises);
        // var result = await this.postProcessMessage(executions);

        sequelize.close && (await sequelize.close());
        return { event, success: true };
    } catch (error) {
        sequelize.close && (await sequelize.close());
        return { event, success: false };
    }
};

let processBalanceReport = async (params, modals, logMetadata) => {
    //1. getting reports upto last month
    let statement = await getStatement(
        {
            merchant_id: params.merchant_id,
            length: 'DAY',
            month: params.month,
            year: params.year,
            day: params.day
        },
        modals
    );

    //2. getting reports for the current month
    let FullStatement = await getStatement(
        {
            merchant_id: params.merchant_id,
            length: 'FULL',
            month: params.lastMonth,
            year: params.lastMonthYear,
            day: 0 //day doesnt require for FULL, hence passing empty
        },
        modals,
        logMetadata
    );
    logger.info(logMetadata, 'FullStatement', FullStatement);

    //3. profilt/commission calculation starts
    statement.base = FullStatement.totalEndingBalance;
    let profitCalculationStatement = {
        base: statement.base,
        account_balance: statement.base + statement.totalEndingBalance,
        deposit: Math.abs(statement.totalBeforeFees),
        withdrawn: Math.abs(statement.totalWithdrawn),
        internal_transfer_received: Math.abs(statement.totalInternalTransferReceived),
        internal_transfer_sent: Math.abs(statement.totalInternalTransferSent),
        fees: Math.abs(statement.totalFees),
        rent: Math.abs(statement.totalRent),
        charge_backs: Math.abs(statement.totalChargeBack),
        refunds: Math.abs(statement.totalRefund),
        setup_fee: Math.abs(statement.totalSetupFee),
        other_deductions: Math.abs(statement.totalOtherDeductions),
        company_profit: 0.0
    };

    profitCalculationStatement = await calculateProfit(profitCalculationStatement, logMetadata);
    statement.totalEndingProfit = profitCalculationStatement.company_profit;
    logger.info(logMetadata, 'profitCalculationStatement', profitCalculationStatement);
    logger.info(logMetadata, 'statement', statement);

    //4. populating balance table
    let insert_query = `INSERT into ${params.balance_table}
    SET
      customer_id                       = '${params.merchant_id}',
      base                              = '${statement.base}',
      base_calculation_type             = 'FULL',
      total_before_fees                 = '${statement.totalBeforeFees}',
      total_fees                        = '${statement.totalFees}',
      total_fees_percentage             = '${statement.totalFeesPercentage}',
      total_fees_fixed                  = '${statement.totalFeesFixed}',
      total_after_fees                  = '${statement.totalAfterFees}',
      total_rent                        = '${statement.totalRent}',
      total_charge_backs                = '${statement.totalChargeBack}',
      total_withdrawn                   = '${statement.totalWithdrawn}',
      total_setup_fee                   = '${statement.totalSetupFee}',
      total_other_deductions            = '${statement.totalOtherDeductions}',
      total_voucher                     = '${statement.totalVoucher}',
      total_refund                      = '${statement.totalRefund}',
      total_internal_transfer_sent      = '${statement.totalInternalTransferSent}',
      total_internal_transfer_received  = '${statement.totalInternalTransferReceived}',
      total_balance                     = '${statement.totalBalance}',
      total_monthly_profit              = '${statement.totalEndingProfit}',
      day                               = '${params.day}',
      month                             = '${params.month}',
      year                              = '${params.year}',
      entry_date                        = '${moment.tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}'`;
    let insertStatus = await modals.sequelize.query(insert_query, {
        type: modals.sequelize.QueryTypes.INSERT // The query type affects how results are formatted before they are passed back.
    });
    logger.info(logMetadata, 'insertStatus', insertStatus);
    return { params, success: true };
};

let calculateProfit = async (statement, logMetadata) => {
    let base_balance = statement.base;
    let current_balance = statement.account_balance;
    let current_month_merchant_charges =
        statement.fees + statement.rent + statement.setup_fee + statement.other_deductions;
    let current_month_earned =
        statement.deposit +
        statement.internal_transfer_received -
        (statement.withdrawn + statement.internal_transfer_sent + statement.charge_backs + statement.refunds);
    logger.info(logMetadata, 'base_balance', base_balance);
    logger.info(logMetadata, 'current_balance', current_balance);
    logger.info(logMetadata, 'current_month_merchant_charges', current_month_merchant_charges);
    logger.info(logMetadata, 'current_month_earned', current_month_earned);

    //profit is defined as the money owed to datman , that does not need to pay to the client to their bank/account balance
    //if profit is in negative , ignore the profit as its due money owed to datman
    if (current_balance >= 0) {
        //profit earned will be the current month merchant charges + negative balance recovered
        statement.company_profit = current_month_merchant_charges + (base_balance < 0 ? Math.abs(base_balance) : 0);
    }

    if (current_balance < 0) {
        let net_merchant_charges_earned = current_month_merchant_charges + current_balance; //ignore the negative part from the profit as its due money
        statement.company_profit = net_merchant_charges_earned > 0 ? net_merchant_charges_earned : 0.0;

        if (current_balance > base_balance) {
            //in this case we have recovered a few negative balance aswell
            statement.company_profit += current_balance - base_balance;
        }
    }
    return ObjectValuesPrecisionTwoDecimals(statement);
};

let getStatement = async (params, modals) => {
    let statement = {
        totalBeforeFees: 0.0,
        totalFees: 0.0,
        totalAfterFees: 0.0,
        totalFeesFixed: 0.0,
        totalFeesPercentage: 0.0,
        totalSetupFee: 0.0,
        totalRent: 0.0,
        totalWithdrawn: 0.0,
        totalChargeBack: 0.0,
        totalChargeBackPaid: 0.0,
        totalOtherDeductions: 0.0,
        totalVoucher: 0.0,
        totalRefund: 0.0,
        totalInternalTransferSent: 0.0,
        totalInternalTransferReceived: 0.0,
        totalInternalTransferRefunded: 0.0,
        totalInternalTransferRefundReceived: 0.0,
        totalEndingBalance: 0.0,
        totalRefundPaid: 0.0,
        totalBalance: 0.0
    };

    //1. card_payment based balance calculation
    let sql_query = `SELECT
      id,customer_id,payed,fees,total,firstname,withdraw_status,payment_provider
      FROM card_payment FORCE INDEX (customer_id)
      WHERE customer_id = ${params.merchant_id}
        AND (payment_status = 'OK' OR withdraw_status > 0) 
        AND delete_status!=1
        AND ${await getDateFilterString({
            length: params.length,
            day: params.day,
            month: params.month,
            year: params.year
        })}`;
    let resultSet = await getDbResultSetFromRawQuery(sql_query, modals.sequelize, true);
    await getStatementCalculations(resultSet, statement);

    //2. Internal transfers sent
    sql_query = `SELECT ROUND(sum(it.amount),2) 'total_sent' 
                    FROM internal_transfer_transaction it 
                    WHERE it.customer_id= ${params.merchant_id} 
                      AND it.status!='CANCELED'
                      AND ${await getDateFilterString(
                          {
                              length: params.length,
                              day: params.day,
                              month: params.month,
                              year: params.year
                          },
                          'internal_transfer_transaction'
                      )}`;

    let ItSentresultSet = await getDbResultSetFromRawQuery(sql_query, modals.sequelize);
    if (ItSentresultSet.total_sent) {
        statement.totalInternalTransferSent = parseFloat(ItSentresultSet.total_sent);
    }

    //3. Internal transfers received
    sql_query = `SELECT ROUND(sum(itt.amount)) 'total_recieved' 
                FROM internal_transfer_transaction itt join internal_transfer_audit ita on itt.ref = ita.internal_transfer_ref 
                WHERE itt.recipient_id = ${params.merchant_id} 
                AND ita.attribute_changed = 'STATUS' 
                AND ita.attribute_new_value = 'COMPLETE' 
                AND ${await getDateFilterString(
                    {
                        length: params.length,
                        day: params.day,
                        month: params.month,
                        year: params.year
                    },
                    'internal_transfer_transaction',
                    'it_received'
                )}`;

    let ItRecievedResultSet = await getDbResultSetFromRawQuery(sql_query, modals.sequelize);
    if (ItRecievedResultSet.total_recieved) {
        statement.totalInternalTransferReceived = parseFloat(ItRecievedResultSet.total_recieved);
    }

    //4. Internal transfers refund sent
    sql_query = `SELECT ROUND(sum(itr.amount),2) 'total_refunded' 
                FROM internal_transfer_transaction it join internal_transfer_refund itr on it.ref = itr.internal_transfer_transaction_ref 
                WHERE it.recipient_id= ${params.merchant_id} 
                  AND it.status IN ('REFUNDED') 
                  AND ${await getDateFilterString(
                      {
                          length: params.length,
                          day: params.day,
                          month: params.month,
                          year: params.year
                      },
                      'internal_transfer_refund'
                  )}`;

    let ItRefundSentResultSet = await getDbResultSetFromRawQuery(sql_query, modals.sequelize);
    if (ItRefundSentResultSet.total_refunded) {
        statement.totalInternalTransferRefunded = parseFloat(ItRefundSentResultSet.total_refunded);
    }

    //5. Internal transfers refund received
    sql_query = `SELECT ROUND(sum(itr.amount),2) 'total_refunded' 
                FROM internal_transfer_transaction it join internal_transfer_refund itr on it.ref = itr.internal_transfer_transaction_ref 
                WHERE it.customer_id= ${params.merchant_id} 
                AND it.status IN ('REFUNDED') 
                AND ${await getDateFilterString(
                    {
                        length: params.length,
                        day: params.day,
                        month: params.month,
                        year: params.year
                    },
                    'internal_transfer_refund'
                )}`;

    let ItRefundReceivedResultSet = await getDbResultSetFromRawQuery(sql_query, modals.sequelize);
    if (ItRefundReceivedResultSet.total_refunded) {
        statement.totalInternalTransferRefundReceived = parseFloat(ItRefundReceivedResultSet.total_refunded);
    }

    statement.totalInternalTransferSent -= statement.totalInternalTransferRefundReceived;
    statement.totalInternalTransferReceived -= statement.totalInternalTransferRefunded;

    //calculationg total End Balance
    statement.totalEndingBalance = statement.totalBalance;
    //subtract totalInternalTransferSent amount
    statement.totalEndingBalance -= Math.abs(statement.totalInternalTransferSent);
    //add totalInternalTransferReceived
    statement.totalEndingBalance += Math.abs(statement.totalInternalTransferReceived);
    return ObjectValuesPrecisionTwoDecimals(statement);
};

let getDbResultSetFromRawQuery = async (raw_query, sequelize, sendArrayBack = false) => {
    let resultSet = await sequelize
        .query(raw_query, {
            plain: false, //to return all resultset associated with query
            type: sequelize.QueryTypes.SELECT // The query type affects how results are formatted before they are passed back.
        })
        .then(function (resultSetArray) {
            if (sendArrayBack) {
                return resultSetArray;
            }
            //if function call expects only one record, return the response in Object
            let resultSetObject = {};
            resultSetArray.forEach((resultSetItem) => {
                resultSetObject = resultSetItem;
            });
            return resultSetObject;
        });
    return resultSet;
};
let getStatementCalculations = async (resultSet, statement) => {
    let transactionsCount = 0;
    resultSet.forEach(function (row) {
        row.total = parseFloat(row.total && !isNaN(row.total) ? row.total : 0.0);
        row.fees = parseFloat(row.fees && !isNaN(row.fees) ? row.total : 0.0);
        row.payed = parseFloat(row.payed && !isNaN(row.payed) ? row.payed : 0.0);
        if (row.total > 0 && row.payment_provider === 'VOUCHER') {
            statement.totalVoucher += row.payed;
        } else if (row.total > 0) {
            statement.totalBeforeFees += row.total;
            statement.totalFees += row.fees;
            statement.totalAfterFees += row.payed;
            transactionsCount++;
        } else {
            let transactionType = getTransactionType(row.firstname);
            switch (transactionType) {
                case 'setup_fee':
                    statement.totalSetupFee += row.payed;
                    break;
                case 'rental':
                    statement.totalRent += row.payed;
                    break;
                case 'withdrawal':
                    statement.totalWithdrawn += row.payed;
                    break;
                case 'charge_back':
                    statement.totalChargeBack += row.total;
                    statement.totalChargeBackPaid += row.payed;
                    break;
                case 'refund':
                    statement.totalRefund += row.total;
                    statement.totalRefundPaid += row.payed;
                    break;
                default:
                    statement.totalOtherDeductions += row.payed;
                    break;
            }
        }
        //calculationg total balance
        statement.totalBalance += row.payed;
        statement.totalFeesFixed = transactionsCount * 0.2;
        statement.totalFeesPercentage = statement.totalFees - statement.totalFeesFixed;
    });
};

var ObjectValuesPrecisionTwoDecimals = function (object) {
    Object.keys(object).forEach(function (key) {
        object[key] = parseFloat(object[key].toFixed(2));
    });
    return object;
};

let getTransactionType = (description) => {
    let keywords = {
        setup_fee: ['Setup Fee', 'Set up', 'setup'],
        rental: ['merchant service', 'merchant ser', 'merchant charges', 'weekly rentals', 'rent', 'weekly charges'],
        withdrawal: ['withdraw'],
        charge_back: ['Charge Back'],
        refund: ['Refund']
    };
    var type = '';
    Object.keys(keywords).forEach(function (key) {
        keywords[key].forEach((word) => {
            var regex = new RegExp(word, 'i');
            if (regex.test(description)) {
                type = key;
            }
        });
    });
    return type;
};
let getDateFilterString = async (params, table_name = 'card_payment', feature_name = '') => {
    let query_string = '';
    let time_limit = moment
        .tz(`${params.year}-${params.month}-${params.day} 23:59:59`, 'YYYY-MM-DD HH:mm:ss', TIMEZONE)
        .format('YYYY-MM-DD HH:mm:ss');
    let maxDay = moment.tz(`${params.year}-${params.month}`, 'YYYY-MM', TIMEZONE).daysInMonth(); //getting total days of month
    let full_time_limit = moment
        .tz(`${params.year}-${params.month}-${maxDay} 23:59:59`, 'YYYY-MM-DD HH:mm:ss', TIMEZONE)
        .format('YYYY-MM-DD HH:mm:ss');
    if (table_name === 'card_payment') {
        if (params.length === 'DAY') {
            query_string = `day <= ${params.day} AND month = ${params.month} AND year = ${params.year} AND time <= '${time_limit}'`;
        } else if (params.length === 'MONTH') {
            query_string = `month = ${params.month} AND year = ${params.year}`;
        } else if (params.length === 'FULL') {
            query_string = `time <= '${full_time_limit}'`;
        }
    } else if (table_name === 'internal_transfer_transaction' && feature_name === 'it_received') {
        if (params.length === 'DAY') {
            query_string = ` day(ita.occured_at) <= ${params.day} AND month(ita.occured_at) = ${params.month} AND year(ita.occured_at) = ${params.year} AND  ita.occured_at <= '${time_limit}' `;
        } else if (params.length === 'MONTH') {
            query_string = ` month(ita.occured_at) = ${params.month} AND year(ita.occured_at) = ${params.year} `;
        } else if (params.length === 'FULL') {
            query_string = ` ita.occured_at <= '${full_time_limit}' `;
        }
    } else if (table_name === 'internal_transfer_transaction') {
        if (params.length === 'DAY') {
            query_string = ` day <= ${params.day} AND month = ${params.month} AND year = ${params.year} AND it.created_at <= '${time_limit}' `;
        } else if (params.length === 'MONTH') {
            query_string = ` month = ${params.month} AND year = ${params.year} `;
        } else if (params.length === 'FULL') {
            query_string = ` it.created_at <= '${full_time_limit}' `;
        }
    } else if (table_name === 'internal_transfer_refund') {
        if (params.length === 'DAY') {
            query_string = ` day(itr.created_at) <= ${params.day} AND month(itr.created_at) = ${params.day} AND year(itr.created_at) = ${params.year} AND  itr.created_at <= '${time_limit}' `;
        } else if (params.length === 'MONTH') {
            query_string = ` month(itr.created_at) = ${params.day} AND year(itr.created_at) = ${params.year} `;
        } else if (params.length === 'FULL') {
            query_string = ` itr.created_at <= '${full_time_limit}' `;
        }
    }
    return query_string;
};
