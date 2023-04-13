export const createRequestLog = async (dbInstance, payload, logger, logMetadata) => {
    const pdqTransactionRequestLogInfo = await dbInstance.PdqTransactionRequestLog.create({
        transaction_id: payload.transaction_id,
        payload: JSON.stringify(payload),
        device_name: 'A920'
    });

    logger.info(logMetadata, 'pdqTransactionRequestLogInfo', pdqTransactionRequestLogInfo);

    if (!pdqTransactionRequestLogInfo) {
        throw { message: 'Issue in inserting record in DB' };
    }

    return pdqTransactionRequestLogInfo.id;
};

export const updateRequestLog = async (dbInstance, status, requestLogId, logger, logMetadata) => {
    const updateResult = await dbInstance.PdqTransactionRequestLog.update(
        {
            status: status
        },
        { where: { id: requestLogId } }
    );

    logger.info(logMetadata, 'Updated row count', updateResult[0]);
};
