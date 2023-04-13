export const checkAlreadyPaid = async (dbInstance, obj) => {
    let orderPaid = await dbInstance.Payments.findOne({
        attributes: ['id'],
        where: {
            order_ref: obj.orderId,
            transaction_status_id: {
                [dbInstance.Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
            }
        },
        raw: true
    });

    console.log('Order paid status', orderPaid);
    if (orderPaid) {
        throw { status: 202, message: `The order id #${obj.orderId} has been already paid` };
    }

    // documentXray.addMetadata('orderPaid', orderPaid);
    return orderPaid;
};
