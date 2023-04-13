const messagingBussinessLogic = require('./logic/messagingBussinessLogic');
import AWS from 'aws-sdk';
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const {
    cryptFunctions,
    logHelpers,
    optomanyHelpers,
    judopayHelpers,
    barclaysHelpers,
    sagepayHelpers,
    Wallet,
    emailHelpers
} = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');
const axios = require('axios');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';
const { serialize } = require('php-serialize');

const logger = logHelpers.logger;

const PAYMENT_PROVIDERS_TYPES = {
    CARDSTREAM: 'CARDSTREAM',
    CARDSTREAM_CH: 'CARDSTREAM-CH',
    OPTOMANY: 'OPTOMANY',
    JUDOPAY: 'JUDOPAY',
    BARCLAYS: 'BARCLAYS',
    STRIPE: 'STRIPE',
    WALLET: 'WALLET', // its not a provider
    SAGEPAY: 'SAGEPAY'
};

export class RefundService {
    async refund(event) {
        let logMetadata = {
            location: 'RefundService ~ refund '
        };
        logger.info(logMetadata, 'event', event);
        const promises = event.Records.map((message) => {
            return this.processRefund(message);
        });

        const executions = await Promise.all(promises);
        const result = await this.postProcessMessage(executions);
        return result;
    }

    async postProcessMessage(executions) {
        const hasAtLeastOneError = executions.some((result) => result.success === false);

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
                    QueueUrl: process.env.REFUND_SALE_SQS_QUEUE_URL,
                    ReceiptHandle: successMsg.event.receiptHandle
                };

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

    async processRefund(event) {
        let logMetadata = {
            location: 'RefundService ~ processRefund '
        };
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, Sequelize, Payment, Payments, Customer, RefundRequestLog } = db;
        try {
            let { payload, transactionDetails } = JSON.parse(event.body);
            logger.info(logMetadata, 'processRefund ~ payload', payload);
            logger.info(logMetadata, ' processRefund ~ tranactionDetails', transactionDetails);
            let skipCardRefund = false;
            let resp;
            if (
                payload.destination === PAYMENT_PROVIDERS_TYPES.WALLET &&
                transactionDetails.payment_provider !== PAYMENT_PROVIDERS_TYPES.WALLET &&
                transactionDetails.payment_provider !== ''
            ) {
                // Consider this a card payment being refunded to wallet
                skipCardRefund = true;
                resp = await this.walletRefund(payload, transactionDetails);
                if (!resp.success) {
                    throw new Error('Failed wallet refund');
                }
            }
            if (!skipCardRefund) {
                switch (transactionDetails.payment_provider) {
                    case PAYMENT_PROVIDERS_TYPES.CARDSTREAM:
                        resp = await this.cardStreamRefund(payload);
                        if (!resp.success) {
                            throw new Error('Failed cardstream refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.CARDSTREAM_CH:
                        resp = await this.cardStreamRefund(payload);
                        if (!resp.success) {
                            throw new Error('Failed cardstream refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.OPTOMANY:
                        resp = await this.optomanyRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed optomany refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.JUDOPAY:
                        resp = await this.judopayRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed judopay refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.BARCLAYS:
                        resp = await this.barclaysRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed barclays refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.SAGEPAY:
                        resp = await this.sagepayRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed sagpaye refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.STRIPE:
                        resp = await this.stripeRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed stirpe refund');
                        }
                        break;
                    case PAYMENT_PROVIDERS_TYPES.WALLET: // 'WALLET' == 'payment_provider' || '' == 'payment_provider' is same as this condition
                    case '': //Wallet currently isn't added to the table
                        resp = await this.walletRefund(payload, transactionDetails);
                        if (!resp.success) {
                            throw new Error('Failed wallet refund');
                        }
                        break;

                    default:
                        logger.info(logMetadata, 'Unknown provider', transactionDetails.payment_provider);
                        throw new Error(`Unknown provider ${transactionDetails.payment_provider}`);
                }
            }

            let params;
            if (!payload.silent) {
                //1. adding negative entry for Refunds instead of resetting the transaction amount to zero
                // $refund_text_negative_entry = "\n<hr>\n Refunded &pound;".$request->input->amount." because ".$request->input->reason." \n <hr> \nTxn dated ".date("Y-M-d H:i:s",strtotime($payment['time']))." (#".$payment['id'].")";

                params = {
                    customer_id: transactionDetails.customer_id,
                    order_id: transactionDetails.order_id,
                    firstname: 'Refund',
                    lastname: `${transactionDetails.firstname} ${transactionDetails.lastname}`,
                    address: transactionDetails.address,
                    total: `${-Number(transactionDetails.total).toFixed(2)}`,
                    fees: `${-Number(transactionDetails.fees).toFixed(2)}`,
                    payed: `${-Number(transactionDetails.payed).toFixed(2)}`,
                    CrossReference: transactionDetails.CrossReference,
                    payment_provider: transactionDetails.payment_provider,
                    payment_status: 'OK',
                    refund: `\n<hr>\n Refunded &pound; ${payload.amount} because ${
                        payload.reason
                    }\n <hr> \n ${moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')} (#${cardPaymentRefund.id}).`
                };

                logger.info(logMetadata, 'processRefund ~ params', params);
                const cardPaymentRefund = await messagingBussinessLogic.createUpdateRefundEntry(
                    transactionDetails.customer_id,
                    params,
                    Customer,
                    Payment,
                    Payments,
                    Sequelize
                );
                //2.flagging existing transaction record with refund status
                //$refund_text_positive_entry = "\n<hr>\n Refunded &pound;".$request->input->amount." because ".$request->input->reason."\n <hr> \n@".date("Y-M-d H:i:s")." (#".$card_payment_refund_record_id.")";

                // Now have to lookup the merchant customer information and fire email
                let client = await Customer.findOne({
                    attributes: ['business_email', 'customers_email'],
                    where: { id: transactionDetails.customer_id }
                });
                //fire an email 😃
                if (client) {
                    logger.info(logMetadata, 'processRefund ~ client', client);
                    await emailHelpers.sendRefundEmail({
                        host: payload.host,
                        reference: transactionDetails.CrossReference,
                        customer_email: transactionDetails.email,
                        takeaway_business_email: client.business_email,
                        takeaway_personal_email: client.customers_email,
                        silent: payload.silent
                    });
                }
            }
            //log all the successful refund request details for stats purpose🚀
            await RefundRequestLog.create({
                silent_mode: payload.silent,
                refund_amount: payload.amount,
                order_id: payload.order_id,
                card_payment_id: transactionDetails.id,
                requested_from: payload.ip_address || '',
                json_payload: serialize({ payload })
            });
            await sequelize.close();
            return { event, success: true };
        } catch (e) {
            console.error('processRefund ~ e', e);
            logger.info(logMetadata, 'processRefund ~ Error', e);
            return { event, success: false };
        }
    }

    async cardStreamRefund(payload) {
        let logMetadata = {
            location: 'SwitchService ~ cardStreamRefund'
        };
        try {
            let params = {
                order_id: payload.order_id,
                merchant_id: payload.merchant_id,
                amount: payload.amount,
                reason: payload.reason,
                host: payload.host
            };

            const encryptRefundPayload = cryptFunctions.encryptPayload(
                JSON.stringify(params),
                process.env.EARTH_PAYLOAD_ENCRYPTION_KEY
            );

            const data = JSON.stringify({
                data: encryptRefundPayload
            });
            //'https://2h0gmrzlbe.execute-api.eu-west-1.amazonaws.com/hotfix/api/v1/sale/refund'
            const EARTH_REFUND_URL = `${process.env.EARTH_API_ENDPOINT}/sale/refund`;
            const config = {
                method: 'POST',
                url: EARTH_REFUND_URL,
                headers: {
                    'Content-Type': 'application/json'
                },
                data
            };

            await axios(config);

            return { payload, success: true };
        } catch (error) {
            console.log('cardStreamRefund error', error);
            logger.error(logMetadata, 'cardStreamRefund ~ Error', error);
            return {
                payload,
                success: false
            };
        }
    }

    async optomanyRefund(payload, transactionDetails) {
        let logMetadata = {
            location: 'SwitchService ~ optomanyRefund'
        };
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, OptomanyRefund, OptomanyPayment } = db;
        try {
            let params = {
                reference: transactionDetails.CrossReference
            };

            //check the refund is not already processed yet
            let getRefund = await OptomanyRefund.findOne({
                attributes: ['id'],
                where: { reference: params.reference }
            });

            if (getRefund && getRefund.outcome === 1) {
                throw new Error(`Transaction already refunded <optomany>: ${transactionDetails.refund}`);
            }

            params = {
                ...params,
                cardPaymentId: '0',
                amount: payload.amount
            };
            //seed optomany refund
            let optomanyRefundRecord = await OptomanyRefund.create({
                card_payment_id: params.cardPaymentId,
                reference: params.reference,
                amount: params.amount
            });

            //create refund reference
            let refundReference = `${transactionDetails.CrossReference}R${optomanyRefundRecord.id}`;

            params = { cardPaymentId: transactionDetails.id };

            //fetch optomany merchant token
            let optomanyPaymentDetails = await OptomanyPayment.findOne({
                attributes: ['MerchantTokenId'],
                where: { card_payment_id: params.cardPaymentId }
            });

            //request config
            let config = await optomanyHelpers.requestConfig(transactionDetails.provider);

            logger.info(logMetadata, 'optomanyRefund ~ config', config);

            let authorizeReq = {
                Reference: refundReference,
                AuthenticationDetails: 'placeholder',
                SendAttempt: 1,
                Amounts: {
                    Amount: payload.amount,
                    CurrencyId: 826
                },
                AuthorizationType: 'Refund',
                CaptureModeType: 'AccountOnFile',
                CardholderEngagementMethodType: 'MailOrder',
                CountryId: 826,
                MerchantDepartmentId: config.MerchantDepartmentId,
                TokenDetails: {
                    MerchantTokenId: optomanyPaymentDetails.MerchantTokenId
                }
            };

            logger.info(logMetadata, 'optomanyRefund ~ authorizeReqDetails', authorizeReq);
            //start async
            let authorizeResp = await optomanyHelpers.Authorize(authorizeReq, config);

            if (authorizeResp.ErrorCode) {
                throw authorizeResp;
            }
            logger.info(logMetadata, 'optomanyRefund ~ authorize response', authorizeResp);

            const settleResp = await optomanyHelpers.Settle(authorizeReq, authorizeResp, config);
            if (settleResp.ErrorCode) {
                throw settleResp;
            }
            logger.info(logMetadata, 'optomanyRefund ~ settleResp ', settleResp);

            await OptomanyRefund.update(
                {
                    outcome: 1,
                    reason: payload.reason,
                    card_payment_id: transactionDetails.id
                },
                {
                    where: { id: optomanyRefundRecord.id }
                }
            );
            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: true
            };
        } catch (error) {
            logger.error(logMetadata, 'optomanyRefund ~ Error', error);
            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: false
            };
        }
    }

    async judopayRefund(payload, transactionDetails) {
        let logMetadata = {
            location: 'SwitchService ~ judopayRefund'
        };
        try {
            let params = {
                receiptId: transactionDetails.CrossReference,
                amount: payload.amount,
                yourPaymentReference: `REF${transactionDetails.CrossReference}`
            };
            logger.info(logMetadata, 'judopayRefund ~ params', params);
            await judopayHelpers.refund(params);
            return {
                payload,
                success: true
            };
        } catch (error) {
            console.log('judo pay error', error);
            logger.info(logMetadata, 'judopayRefund ~ error', error.message);
            return {
                payload,
                success: false
            };
        }
    }

    async barclaysRefund(payload, transactionDetails) {
        let logMetadata = {
            location: 'SwitchService ~ barclaysRefund'
        };
        try {
            let params = {
                total: payload.amount,
                CrossReference: transactionDetails.CrossReference
            };
            logger.info(logMetadata, 'barclaysRefund ~ params', params);

            const result = await barclaysHelpers.refund(params, transactionDetails);

            logger.info(logMetadata, 'barclaysRefund ~ result', result);
            if (result.refundResult.response !== '[refund-received]') {
                return {
                    payload,
                    success: false
                };
            }

            return {
                payload,
                success: true
            };
        } catch (error) {
            console.log('error in barclays', error);
            logger.error(logMetadata, ' barclaysRefund ~ error', error);
            return {
                payload,
                success: false
            };
        }
    }

    async sagepayRefund(payload, transactionDetails) {
        try {
            let params = {
                ...transactionDetails,
                amount: payload.amount,
                reason: payload.reason
            };
            const res = await sagepayHelpers.refund(params);

            if (res.Status === 'ERROR') {
                return {
                    payload,
                    success: false
                };
            }

            return {
                payload,
                success: true
            };
        } catch (error) {
            console.log('sagePayRefund error', error);
            return {
                payload,
                success: false
            };
        }
    }

    async stripeRefund(payload, transactionDetails) {
        let logMetadata = {
            location: 'SwitchService ~ stripeRefund'
        };
        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { sequelize, StripeSettings } = db;
        try {
            //https://w8hqv96x41.execute-api.eu-west-1.amazonaws.com/hotfix/api/v1/saturn/stripe-refund

            let stripeSettings = await StripeSettings.findAll({
                attributes: ['name', 'value']
            }).then(function (resultSet) {
                let settings = {};
                resultSet.forEach((resultSetItem) => {
                    settings[resultSetItem.name] = resultSetItem.value;
                });
                return settings;
            });

            if (!stripeSettings) {
                throw new Error('"Refund could not be processed #1"');
            }

            if (!stripeSettings.api_url || !stripeSettings.api_key) {
                throw new Error('"Refund could not be processed #2"');
            }

            const data = JSON.stringify({
                txnId: transactionDetails.id,
                reason: payload.reason,
                refundAmount: transactionDetails.amount,
                paymentIntent: transactionDetails.VendorTxCode,
                clientReferenceId: transactionDetails.CrossReference
            });
            logger.info(logMetadata, 'stripeRefund ~ data', data);
            const config = {
                method: 'post',
                url: stripeSettings.api_url,
                headers: {
                    api_key: stripeSettings.api_key,
                    'Content-Type': 'application/json'
                },
                data: data
            };

            await axios(config);
            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: true
            };
        } catch (error) {
            console.log('error in stripe', error);
            logger.info(logMetadata, 'stripeRefund ~ error', error);
            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: false
            };
        }
    }

    async walletRefund(payload, transactionDetails) {
        let logMetadata = {
            location: 'RefundService ~ walletRefund '
        };

        const db = connectDB(
            process.env.DB_HOST,
            process.env.DB_DATABASE,
            process.env.DB_USERNAME,
            process.env.DB_PASSWORD,
            process.env.IS_OFFLINE
        );
        const { TransactionWallet, Payment, sequelize, Sequelize } = db;
        try {
            logger.info(logMetadata, 'walletRefund ~ payload', payload);

            if (payload.destination === PAYMENT_PROVIDERS_TYPES.WALLET) {
                logger.info(logMetadata, ' walletRefund ~ destination', payload.destination);
                //do wallet refund;
                const wallet = await new Wallet({
                    shopper_id: payload.shopper_id,
                    dbConnection: db
                });
                const walletRefundDetails = await wallet.refund(
                    payload.amount,
                    transactionDetails.id,
                    transactionDetails.order_id
                );

                logger.info(logMetadata, 'walletRefund ~ walletRefundDetails', walletRefundDetails);
            } else {
                let cardTotal = 0;
                // Refund any wallet recharges to the order to card
                // Check if there was any recharges against that order_id
                const walletRecharges = await TransactionWallet.findAll({
                    attributes: ['id', 'wallet_id', 'shopper_id', 'transaction_type_id', 'amount', 'card_payment_id'],
                    where: {
                        order_id: payload.order_id,
                        shopper_id: payload.shopper_id,
                        transaction_type_id: 1
                    }
                });
                logger.info(logMetadata, ' walletRefund ~ walletRecharges', walletRecharges);
                //refund each

                for (let recharge of walletRecharges) {
                    // payment table lookup
                    const paymentAO = await Payment.findOne({
                        attributes: [
                            'id',
                            'customer_id',
                            'refund',
                            'total',
                            'order_id',
                            'payment_provider',
                            'CrossReference',
                            'VendorTxCode',
                            'VPSTxId',
                            'VendorTxCode',
                            'SecurityKey',
                            'TxAuthNo',
                            'time',
                            'firstname',
                            'lastname',
                            'fees',
                            'payed',
                            'payment_status',
                            'address',
                            'provider',
                            'email',
                            'more_info'
                        ],
                        where: {
                            id: recharge.card_payment_id,
                            payment_status: 'OK',
                            total: {
                                [Sequelize.Op.gte]: 0
                            }
                        },
                        limit: 1
                    });
                    logger.info(logMetadata, 'walletRefund ~ paymentAO', paymentAO);

                    cardTotal += Math.abs(paymentAO.total);
                    logger.info(logMetadata, 'walletRefund ~ cardTotal', cardTotal);
                    if (paymentAO.payment_provider === PAYMENT_PROVIDERS_TYPES.OPTOMANY) {
                        await this.optomanyRefund(
                            {
                                amount: paymentAO.total,
                                reason: payload.reason
                            },
                            paymentAO
                        );
                    } else if (paymentAO.payment_provider === PAYMENT_PROVIDERS_TYPES.CARDSTREAM) {
                        await this.cardStreamRefund({
                            order_id: paymentAO.order_id,
                            merchant_id: paymentAO.customer_id,
                            amount: paymentAO.total,
                            reason: payload.reason,
                            host: payload.host
                        });
                    }
                }

                // Refund any wallet payments directly to the wallet ( card total - amount )
                let amount = payload.amount - cardTotal;
                logger.info(logMetadata, 'walletReufund ~ amount  left', amount);
                // Init wallet instance
                const wallet = await new Wallet({
                    shopper_id: payload.shopper_id,
                    dbConnection: db
                });
                const walletRefundDetails = await wallet.refund(
                    amount,
                    transactionDetails.id,
                    transactionDetails.order_id
                );
                logger.info(logMetadata, ' walletRefund ~ walletRefundDetails', walletRefundDetails);
            }

            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: true
            };
        } catch (error) {
            console.log('wallet error', error);
            logger.error(logMetadata, ' walletRefund ~ error', error);
            sequelize.close && (await sequelize.close());
            return {
                payload,
                success: false
            };
        }
    }
}
