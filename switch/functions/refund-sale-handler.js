const { TokenAuthorize, schema, logHelpers, MerchantResponse } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');

const { SwitchService } = require('../switch.service');
//const { RefundService } = require('../../messaging/consumer/refund-sale.service')

let logger = logHelpers.logger;
const switchService = new SwitchService();
//const refundService = new RefundService();
const REFUND_LIMIT = 160;
export const refundSale = async (event, context) => {
    let logMetadata = {
        location: 'SwitchService ~ refundSale',
        awsRequestId: context.awsRequestId
    };
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );

    const { sequelize, Payment } = db;

    const requestId = `reqid_${context.awsRequestId}`;
    logMetadata.requestId = requestId;
    try {
        //authorize
        let AuthToken = event.headers.api_token;
        logger.info(logMetadata, event.headers);
        await TokenAuthorize(AuthToken);

        if (!event.body) {
            throw { message: 'Payload missing' };
        }

        let payload = JSON.parse(event.body);
        await schema.switchRefundSchema.validateAsync(payload);

        if (!payload.hasOwnProperty('silent')) {
            payload.silent = 0;
        }

        // payment table lookup
        let transactionDetails = await Payment.findOne({
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
                order_id: payload.order_id,
                customer_id: payload.merchant_id,
                payment_status: 'OK'
            },
            order: [['id', 'DESC']]
        });
        logMetadata = {
            ...payload
        };
        logger.info(logMetadata, 'transactionDetails', transactionDetails);
        //throw error, if transaction could not be found
        if (!transactionDetails) {
            return MerchantResponse({ message: 'No transaction found' }, 'failed');
        }

        //throw error, if refund been already intiated
        if (transactionDetails.refund !== '') {
            return MerchantResponse({ message: `Transaction already refunded ${transactionDetails.refund}` }, 'failed');
        }

        //throw error, if refund been already intiated
        if (payload.amount > transactionDetails.total) {
            return MerchantResponse(
                {
                    message: `Refund amount (${payload.amount}) cannot be greater than the original transaction amount (${transactionDetails.total})`
                },
                'failed'
            );
        }

        if (payload.amount <= 0) {
            return MerchantResponse(
                { message: `'Refund amount (${payload.amount}) cannot be negative/zero.` },
                'failed'
            );
        }

        if (transactionDetails.payment_provider === 'OPTOMANY' && payload.amount >= REFUND_LIMIT) {
            return MerchantResponse({ message: `Amount exceeds max limit ${payload.amount}` }, 'failed');
        }
        if (
            (transactionDetails.payment_provider === 'WALLET' && !payload.shopper_id) ||
            (payload.destination === 'CARD' && !payload.shopper_id) ||
            (payload.destination === 'WALLET' && !payload.shopper_id)
        ) {
            return MerchantResponse({ message: 'The request cannot proceed. shopper_id parm missing' }, 'failed');
        }
        payload = {
            ...payload,
            ip_address: event.requestContext.identity.sourceIp
        };

        await switchService.initiateRefundSale(payload, transactionDetails);

        //invoke the refund service functions directly for testing
        //const res = await refundService.processRefund({ body: JSON.stringify({ payload, transactionDetails }) })
        // console.log('result here is', res);

        await sequelize.close();
        return MerchantResponse();
    } catch (e) {
        console.log('error is', e);
        const ErrorResponse = { message: e.message };
        logger.error(logMetadata, 'refundSale ~ ErrorResponse', ErrorResponse);
        await sequelize.close();
        return MerchantResponse(ErrorResponse, 'failed');
    }
};
