export const CheckCardTokenizeStatus = async (params) => {
    let {payload} = params;
    let tokenize_eligible = false;
    if(
        payload?.data?.authorization?.authorization_code
        &&
        payload?.data?.authorization?.reusable === true
        ){
        tokenize_eligible = true;
    }
    return tokenize_eligible;
}