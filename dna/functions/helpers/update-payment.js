const { logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const logger = logHelpers.logger;

export const updatePayments = async (dbInstance, obj, awsRequestId) => {
    const logMetadata = {
        location: 'dna ~ dnaNotificationWebhook ~ updatePayments',
        awsRequestId
    };

    const { id, invoiceId, cardPanStarred, threeDS, authCode } = obj.notificationObject;

    const isNewSale = true;

    const paymentsRecords = await dbInstance.Payments.findOne(
        isNewSale
            ? {
                  attributes: ['email_address', 'order_ref'],
                  where: {
                      order_ref: obj.order_id
                  },
                  raw: true
              }
            : {
                  where: {
                      order_ref: obj.order_id,
                      transaction_status_id: {
                          [dbInstance.Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
                      }
                  },
                  raw: true
              }
    );

    logger.info(logMetadata, 'paymentsRecords: ', paymentsRecords);

    //if record not found, return error back
    if (!paymentsRecords) {
        //error, this should not happen
        throw { message: 'Card payment does not exists' };
    }

    const last_4_digits = cardPanStarred.substr(cardPanStarred.length - 4);
    // const isNewCard = !!obj.notificationObject?.cardSchemeId;
    // logger.info(logMetadata, 'isNewCard sale', isNewCard);

    await dbInstance.Payments.update(
        {
            transaction_status_id: 1,
            psp_reference: id,
            internal_reference: invoiceId,
            last_4_digits: last_4_digits,
            transaction_mode_id: threeDS?.version,
            TxAuthNo: authCode
        },
        {
            where: { order_ref: obj.order_id, id: obj.transactionId }
        }
    );

    logger.info('Successfully updated Payments table');
};
