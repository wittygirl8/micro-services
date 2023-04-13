
// process.env.T2S_API_AUTHORIZE_TOKEN
export const apiKeyAuth = async (event) => {
    console.log(event.headers);
    const { api_key } = event.headers;
    if (!api_key || api_key !== process.env.T2S_API_AUTHORIZE_TOKEN) {
        throw new Error('UNAUTHORIZED - Api key did not match');
    }

    // all good
    return true;
};
