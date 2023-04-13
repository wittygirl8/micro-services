export const decryptPayload = async (params) => {
    const { schema, rawData } = params;
    return schema.RefferralWalletBonusSchema.validateAsync(JSON.parse(rawData));
};
