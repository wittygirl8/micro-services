export const createPdqTransaction = async (dbInstance, payload, merchantInfo, logger, logMetadata) => {
    const pdqTransactionRecord = await dbInstance.PdqTransaction.findOne({
        where: {
            merchant_id: merchantInfo.merchantId,
            transaction_id: payload.transaction_id
        },
        raw: true
    });
    logger.info(logMetadata, 'PDQ Transaction Record in DB', pdqTransactionRecord);

    let pdqTransactionInfo;

    if (!pdqTransactionRecord) {
        pdqTransactionInfo = await dbInstance.PdqTransaction.create({
            merchant_id: merchantInfo.merchantId,
            transaction_id: payload.transaction_id,
            total: payload.amount,
            date_time: payload.transaction_date,
            transaction_status_id: payload.msg_status === 'success' ? 1 : payload.msg_status === 'cancel' ? 2 : 0,
            refund_status: payload.transaction_type === 'refund' ? 1 : 0
        });
        logger.info(logMetadata, 'Created PDQ Transaction recored: ', pdqTransactionInfo);
    } else {
        pdqTransactionInfo = await dbInstance.PdqTransaction.update(
            {
                transaction_status_id: payload.msg_status === 'success' ? 1 : payload.msg_status === 'cancel' ? 2 : 0,
                refund_status: payload.transaction_type === 'refund' ? 1 : 0
            },
            {
                where: {
                    merchant_id: merchantInfo.merchantId,
                    transaction_id: payload.transaction_id
                }
            }
        );
        logger.info(logMetadata, 'Updated PdqTransaction record count: ', pdqTransactionInfo[0]);
    }

    if (!pdqTransactionInfo) {
        throw { message: 'Issue in inserting record in DB' };
    }
};
