export const fetchPdqTransactions = async (dbInstance, payload, merchantInfo, logger, logMetadata) => {
    const startDate = payload.from;
    const endDate = payload.to ? payload.to : new Date();
    const limit = payload.limit ? parseInt(payload.limit) : 50;
    const pageNumber = payload.page ? parseInt(payload.page) : 1;
    const orderBy = payload.order_by === 'asc' ? 'ASC' : 'DESC';

    const pdqTransactionRecords = await dbInstance.PdqTransaction.findAll({
        where:
            payload.transaction_type === 'both'
                ? {
                      merchant_id: merchantInfo.merchant_id,
                      date_time: {
                          [dbInstance.Sequelize.Op.between]: [startDate, endDate]
                      }
                  }
                : {
                      merchant_id: merchantInfo.merchant_id,
                      date_time: {
                          [dbInstance.Sequelize.Op.between]: [startDate, endDate]
                      },
                      refund_status: payload.transaction_type === 'refund' ? 1 : 0
                  },
        limit: limit,
        order: [['id', orderBy]],
        offset: limit * (pageNumber - 1),
        raw: true
    });
    logger.info(logMetadata, 'PDQ Transaction Record', pdqTransactionRecords);

    const count = await dbInstance.PdqTransaction.count({
        where:
            payload.transaction_type === 'both'
                ? {
                      merchant_id: merchantInfo.merchant_id,
                      date_time: {
                          [dbInstance.Sequelize.Op.between]: [startDate, endDate]
                      }
                  }
                : {
                      merchant_id: merchantInfo.merchant_id,
                      date_time: {
                          [dbInstance.Sequelize.Op.between]: [startDate, endDate]
                      },
                      refund_status: payload.transaction_type === 'refund' ? 1 : 0
                  },
        raw: true
    });

    const totalPages = Math.ceil(count / limit);

    logger.info(logMetadata, 'Total record count', count);
    logger.info(logMetadata, 'Total number of pages', totalPages);

    if (!pdqTransactionRecords) {
        throw { message: 'Issue in fetching PDQ transaction records from DB' };
    }

    return { pdqTransactionRecords, totalPages };
};
