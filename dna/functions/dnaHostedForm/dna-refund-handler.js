const { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const { init } = require('../helpers/init');
const { getDBInstance } = require('../helpers/db');
const { dnaRefundSchema } = require('../validators/hosted-form-request-validator');
const { verifyPaymentsRecord } = require('../helpers/verify-payments-record');
const { getTransactionStatus } = require('../helpers/get-transaction-status');
const { dnaSessionCreation } = require('../helpers/dna-session-creation');
const { dnaRefund } = require('../helpers/dna-refund');

let logger = logHelpers.logger;

export const dnaRefundHandler = async (event, context) => {
    //initial setups
    let { requestId } = await init(context, { fileName: 'dna-refund-handler' });

    let logMetadata = {
        location: 'dna ~ dnaRefundHandler',
        awsRequestId: context.awsRequestId
    };

    // get the db instance
    let db = await getDBInstance();
    try {
        logger.info(logMetadata, 'headers', event.headers);
        let AuthToken = event.headers.api_token;
        await TokenAuthorize(AuthToken, JSON.parse(process.env.DNA_HOSTED_FORM).apiAuthToken);

        let payload = JSON.parse(event.body);
        logger.info(logMetadata, 'RequestPayload', payload);
        payload = await dnaRefundSchema.validateAsync(payload);
        logger.info(logMetadata, 'ValidatedPayload', payload);

        // verify payments record inside Payments table
        const paymentStatus = await verifyPaymentsRecord(db, payload);

        // Initiate checkout session creation
        const dnaToken = await dnaSessionCreation({ type: 'refund' });

        const isSettled = await getTransactionStatus(db, payload);

        // call checkout refund api
        let refundResponse = await dnaRefund(dnaToken, payload, paymentStatus, isSettled);

        const api_response = {
            request_id: requestId,
            data: refundResponse
        };
        logger.info(logMetadata, 'api_response', api_response);

        await db.sequelize.close();
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                status: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        await db.sequelize.close();
        return response(errorResponse, 500);
    }
};
