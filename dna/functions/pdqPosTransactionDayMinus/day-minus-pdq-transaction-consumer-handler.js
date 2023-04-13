import AWS from 'aws-sdk';
const axios = require('axios');
const { logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));
const { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
let logger = logHelpers.logger;

export class PdqTransactions {
    async init(event, context) {
        let logMetadata = {
            location: 'DNAService ~ getTransactions',
            awsRequestId: context.awsRequestId
        };

        const promises = event.Records.map((message) => {
            console.log(logMetadata, 'Messages:', message);
            return this.processPdqTransactions(message, logMetadata);
        });
        const executions = await Promise.all(promises);
        var result = await this.postProcessMessage(executions);
        return result;
    }

    async processPdqTransactions(message, logMetadata) {
        var bulk_transactions = new Array();
        try {
            logger.info(logMetadata, 'Messaging :: Consumer: ProcessPdqTransactions: body - ', message);
            const { token, fromDate, toDate, partner_merchant_id } = JSON.parse(message.body);

            const transactionResponse = await this.getTransactionsForMerchant(
                token.access_token,
                fromDate,
                toDate,
                partner_merchant_id,
                logMetadata
            );

            logger.info(logMetadata, 'Transaction Response - ', transactionResponse);

            if (!transactionResponse) {
                logger.info(logMetadata, 'No transactions found');
                return { message, success: true };
            }

            logger.info(logMetadata, 'transactionResponse.data', transactionResponse?.data);

            var db = connectDB(
                process.env.DB_HOST,
                process.env.DB_DATABASE,
                process.env.DB_USERNAME,
                process.env.DB_PASSWORD,
                process.env.IS_OFFLINE
            );

            var { sequelize, PdqTransaction, PartnerMerchant } = db;

            logger.info(logMetadata, 'transactionResponse.data~prepare', transactionResponse.data);

            let response_array = transactionResponse.data;
            let result = response_array.map(({ transactionId }) => transactionId);

            logger.info(logMetadata, `resulted array ${result}`);

            const response = await PdqTransaction.findAll({
                attributes: ['transaction_id'],
                where: {
                    merchant_id: JSON.parse(message.body).merchant_id,
                    transaction_id: result
                },
                raw: true
            });

            let exists = [];
            response.forEach((element) => {
                exists.push(element.transaction_id);
            });

            response_array.map((item) => {
                logger.info(logMetadata, item.transactionId, !exists.includes(item.transactionId));
                if (!exists.includes(item.transactionId)) {
                    bulk_transactions.push({
                        merchant_id: JSON.parse(message.body).merchant_id,
                        transaction_id: item.transactionId,
                        total: item.amount,
                        date_time: item.transactionDate,
                        transaction_status_id: item.status == 'success' ? 1 : 0,
                        refund_status: item.transactionType == 'credit' ? 1 : 0
                    });
                }

                return bulk_transactions;
            });

            logger.info(logMetadata, `bulk_transactions:${JSON.stringify(bulk_transactions)}`);

            if (bulk_transactions && bulk_transactions.length > 0) {
                logger.info(logMetadata, 'Total_number_of_records:', bulk_transactions.length);
                await PdqTransaction.bulkCreate(bulk_transactions).then(async () => {});
                logger.info(logMetadata, bulk_transactions);
            }

            var { merchant_id } = JSON.parse(message.body);
            await PartnerMerchant.update(
                {
                    day_minus_job_executed_at: toDate
                },
                {
                    where: {
                        merchant_id
                    }
                }
            );

            sequelize.close && (await sequelize.close());

            return { message, success: true };
        } catch (err) {
            logger.error(logMetadata, 'Error fetching dna transactions:', err);
            return { success: false };
        }
    }

    async getTransactionsForMerchant(accessToken, from, to, merchantId, logMetadata) {
        try {
            const url = `${process.env.DNA_API_URL}/v1/partners/pos/transactions?from=${from}&to=${to}&size=5000&merchantId=${merchantId}`;
            logger.info(logMetadata, `Requesting Transactions as: ${url}`);
            const responsedata = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(logMetadata, `responsedata.data:${JSON.stringify(responsedata?.data)}`);
            return responsedata?.data;
        } catch (err) {
            logger.error(logMetadata, `Error processing message`, err.message);
            return;
        }
    }

    async postProcessMessage(executions) {
        console.log('Executions result:', executions);

        let options = {};

        if (process.env.IS_OFFLINE) {
            options = {
                apiVersion: '2022-09-19',
                region: 'localhost',
                endpoint: 'http://0.0.0.0:9324',
                sslEnabled: false
            };
        }

        const sqs = new AWS.SQS(options);

        const processSuccesItems = executions.filter((result) => result.success === true);

        for (let successMsg of processSuccesItems) {
            console.log(
                'Printing successMsg for day minus',
                successMsg,
                successMsg.message,
                successMsg.message.receiptHandle
            );

            const params = {
                QueueUrl: process.env.PDQ_TRANSACTION_QUEUE_URL,
                ReceiptHandle: successMsg.message.receiptHandle
            };

            console.log(params, 'successMsg');
            try {
                await sqs.deleteMessage(params).promise();
            } catch (error) {
                // Do nothing, need to make the code idempotent in such case
            }
        }
    }
}
