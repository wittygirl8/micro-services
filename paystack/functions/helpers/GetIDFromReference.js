export const GetIDFromReference = (reference, id_type = 'order_id') => {
    try{
        let OMT_PATTERN = /^[O]\d+[M]\d+[T]\d+$/g
        if(!OMT_PATTERN.test(reference)){
            throw {message: 'Txn Reference not OMT'}
        }

        if(id_type === 'order_id'){
            var tmpStr  = reference.match("O(.*)M");
        }
        if(id_type === 'merchant_id'){
            var tmpStr  = reference.match("M(.*)T");
        }
        if(id_type === 'txn_id'){
            var tmpStr  = reference.match("T(.*)");
        }
        return tmpStr[1];
    }catch(e){
        console.log('GetIDFromReference', e.message)
        throw { message: e.message }
    }
}