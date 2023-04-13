export const seedExpressSaleLog = async (params) => {
    let { payload, db } = params;
    let response = await db.CheckoutExpressSaleLog.create({
        payment_id: payload.payment_id,
        amount: payload.amount,
        request_payload: JSON.stringify(payload)
    });
    return response.dataValues;
};

export const updateExpressSaleLog = async (params) => {
    let { updateObject, whereConditionObject, db } = params;
    return await db.CheckoutExpressSaleLog.update(updateObject, { where: whereConditionObject });
};
