export const CheckAlreadyPaid = async (params) => {
    let { db } = params;
    let alreadyPaid = await db.Payments.findOne({
        attributes: ['id'],
        where: {
            order_ref: params.order_id,
            transaction_status_id: {
                [db.Sequelize.Op.between]: [1,6]
            }
        },
        raw: true
    });
    console.log('alreadyPaid', alreadyPaid);
    return alreadyPaid;
};
