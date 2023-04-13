export const SeedRefundLog = async (params) => {
    let { payload,db } = params;
    let response =  await db.PaystackRefundLog.create({
        payment_id: payload.payment_id,
        amount: payload.amount,
        request_payload: JSON.stringify(payload)
    });
    return response.dataValues;
}

export const UpdateRefundLog = async (params) => {
    let { UpdateObject, WhereConditionObject,  db } = params;
    return await db.PaystackRefundLog.update(
        UpdateObject,
        { where: WhereConditionObject}
    );
}