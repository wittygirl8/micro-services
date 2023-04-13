export const UpdatePaymentsPayoutStatus = async (params) => {
    //update the payments records as payouts successfully sent
    //get the list of payment_ids
    let {db, batch_id, transaction_status_id} = params;

    let PaymentInfo = await db.PayoutBatchItem.findAll({
        attributes: ['card_payment_id'],
        where: {
            batch_id
        },
        raw: true
    })
    console.log({PaymentInfo})
    let payment_ids = []
    PaymentInfo.forEach((element) => {
        payment_ids.push(element.card_payment_id)
    });
    let PaymentUpdateInfo = await db.Payments.update(
        {
            transaction_status_id
        },
        {
            where: { id: { [db.Sequelize.Op.in]: payment_ids } }
        }
    );
    console.log({payment_ids})
    return payment_ids;
}