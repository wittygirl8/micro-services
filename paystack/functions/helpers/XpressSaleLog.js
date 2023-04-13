export const SeedXpressSaleLog = async (params) => {
    let { payload,db } = params;
    let response =  await db.PaystackXpressSaleLog.create({
        payment_id: payload.payment_id,
        amount: payload.amount,
        request_payload: JSON.stringify(payload)
    });
    return response.dataValues;
}

export const UpdateXpressSaleLog = async (params) => {
    let { UpdateObject, WhereConditionObject,  db } = params;
    return await db.PaystackXpressSaleLog.update(
        UpdateObject,
        { where: WhereConditionObject}
    );
}