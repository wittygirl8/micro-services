export const apiKeyAuth = async (event) => {
    console.log(event.headers);
    const { api_key } = event.headers;
    if (!api_key || api_key !== JSON.parse(process.env.CHECKOUT).datmanRefundKey) {
        throw new Error('UNAUTHORIZED - Api key did not match');
    }

    // all good
    return true;
};
