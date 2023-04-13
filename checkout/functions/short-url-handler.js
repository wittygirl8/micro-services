const { response } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');
const { init } = require('./helpers/init');
const { CreateShortUrl, GetLongUrl } = require('./helpers/ShortUlrs');
const { getDBInstance } = require('./helpers/db');

export const handler = async (event, context) => {
    // initial setups
    var { requestId } = await init(event, context, { fileName: 'shorturl-handler' });

    // get the db instance
    var db = await getDBInstance();

    let payload = JSON.parse(event.body);
    console.log(payload);

    // All the get request here
    if (event.httpMethod === 'GET') {
        var { longurl, short_id } = await GetLongUrl(db, { shortId: event.pathParameters?.short_id });
        console.log(longurl, short_id);
        // In case of redirect
        if (event.path.includes('redirect')) {
            console.log('here is the url', longurl);
            const response = {
                statusCode: 301,
                headers: {
                    Location: longurl
                }
            };
            return response;
        } else {
            // Just handling not expecting this to run in prod
            return response({
                requestId,
                longurl
            });
        }

        //add a new record
    } else if (event.httpMethod === 'POST') {
        let shortId = await CreateShortUrl(db, payload);
        return response({
            requestId,
            shortId
        });
    } else {
        // Just handling not expecting this to run in prod
        console.log('invalid httpMethod ');
        return response({
            request_id: requestId,
            message: 'invalid httpMethod ',
            data: event
        });
    }
};
