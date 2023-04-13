export const getTransactionStatus = async (dbInstance, obj) => {
    const webhookResponse = await dbInstance.DnaResponse.findOne({
        where: {
            order_id: obj.order_id
        }
    });

    //throw error, if transaction could not be found
    if (!webhookResponse) {
        throw { message: 'No DNA response log found' };
    }

    let isSettled = JSON.parse(webhookResponse.dna_response).settled;
    console.log('isSettled', isSettled);

    return isSettled;
};
