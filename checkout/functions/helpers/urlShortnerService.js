const axios = require('axios');

export const urlShortnerService = async (obj) => {
    try {
        var data = JSON.stringify({
            url: obj.cancel_url
        });

        var config = {
            method: 'post',
            url: process.env.URL_SHORTNER_API_BASEURL + '/api/v1/shorturl',
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };

        let response = await axios(config);

        var cancel_url;
        if (process.env.IS_OFFLINE) {
            cancel_url = process.env.NGROK_URL + `/dev/api/v1/shorturl/redirect/${response.data.shortId}`;
        } else {
            cancel_url = process.env.URL_SHORTNER_API_BASEURL + `/api/v1/shorturl/redirect/${response.data.shortId}`;
        }

        return {
            // in qa
            // cancel_url: `https://8iog93vmca.execute-api.eu-west-1.amazonaws.com/hotfix/api/v1/shorturl/redirect/${response.data.shortId}`

            // in dev
            // cancel_url: `https://7c73-203-81-242-32.in.ngrok.io/dev/api/v1/shorturl/redirect/${response.data.shortId}`

            cancel_url
        };
    } catch (e) {
        console.log('api error', JSON.stringify(e.response.data));
        throw new Error(JSON.stringify(e.response.data));
    }
};
