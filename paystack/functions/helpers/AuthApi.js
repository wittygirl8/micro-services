export const AuthApi = async (event) => {
    const { api_key } = event.headers;
    console.log('key received', api_key)
    console.log('key on file', process.env.PAYSTACK_REFUND_API_KEY)
    if (!api_key || api_key !== process.env.PAYSTACK_REFUND_API_KEY) {
        throw {message: 'UNAUTHORIZED - Api key did not match'};
    }
    return true;
};
