export const MasterTokenizeCard = async (params) => {
    let {db, payload, tokenize_eligible, master_token } = params;
    let MasterTokenInfo = await db.MasterToken.findOne({
        where: {
            master_token,
            customer_id: payload?.data?.metadata?.customer_id,
            provider: 'PAYSTACK-HF'
        }
    });
    console.log('MasterTokenInfo',JSON.stringify(MasterTokenInfo))
    if(tokenize_eligible && !MasterTokenInfo){
        let master_token_status =  await db.MasterToken.create({
            master_token, 
            provider: 'PAYSTACK-HF',
            token: `paystack_${payload?.data?.authorization?.authorization_code}`,
            last_4_digit: payload?.data?.authorization?.last4,
            customer_id: payload?.data?.metadata?.customer_id,
            avs_token: JSON.stringify({
                email: payload?.data?.customer?.email
            })
        })
        return master_token_status.dataValues
    }
    return false;
}