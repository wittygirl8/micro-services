export const GetSplitFeeInfo = async (params) => {
    let { db, payload, MerchantInfo } = params;
    if(!payload?.split_fee?.length){
        return false
    }
    let fee = MerchantInfo.fee
    let net = MerchantInfo.net
    let total = payload?.total
    let SplitFeeObject = [];
    let split_fee_payload = payload?.split_fee;
    let total_split_fee_amount = 0;
    //validate every partner merchant id from the payload
    split_fee_payload = await Promise.all(split_fee_payload.map( async split_fee_item => {
        let PartnerMerchantInfo = await db.Customer.findOne({
            attributes: ['id'],
            where: { id: split_fee_item.partner_merchant_id },
            raw: true
        });
    
        if(!PartnerMerchantInfo){
            throw { code: 400, message: `Parter not found (${split_fee_item.partner_merchant_id})` };
        }

        return split_fee_item;
    }))
    console.log('split_fee_payload new',split_fee_payload)
    split_fee_payload.forEach((split_fee_item) => {
        // console.log({split_fee_item})
        let split_fee_amount = parseInt(split_fee_item.value * 100);
        if(split_fee_item.value_type === 'percentage'){
            split_fee_amount = total * (split_fee_item.value / 100);
        }
        total_split_fee_amount += split_fee_amount;
        if(total_split_fee_amount >=total){
            throw { code: 400, message: `Total split cannot be greater than order value (${total_split_fee_amount/100} / ${total/100} )` };
        }
        fee = fee + split_fee_amount;
        net = total - fee;
        SplitFeeObject.push({
            partner_merchant_id: split_fee_item.partner_merchant_id,
            amount : split_fee_amount,
            commission_type_id: split_fee_item.type_id,
            commission_value_type: split_fee_item.value_type,
            commission_value: split_fee_item.value
        })
    });

    //update MerchantFeeInfo with latest fee and net value
    MerchantInfo.fee = fee;
    MerchantInfo.net = net;

    return {
        MerchantInfo, SplitFeeObject
    }
}