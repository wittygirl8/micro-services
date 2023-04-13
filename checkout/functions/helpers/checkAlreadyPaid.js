export const checkAlreadyPaid = async (dbInstance, documentXray, obj) => {
    let paymentRecords = await dbInstance.Payments.findAll({
        where: {
            order_ref: obj.orderId,
            transaction_status_id: {
                [dbInstance.Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
            }
        },
        raw: true
    });
    const orderPaid = paymentRecords.length > 0 ? true : false;

    console.log('order paid status', orderPaid);
    documentXray.addMetadata('orderPaid', orderPaid);
    return orderPaid;
};
