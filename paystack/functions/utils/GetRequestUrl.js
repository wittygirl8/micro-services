export const GetRequestUrl = (event) => {
    console.log(event)
    var ssl = event?.headers['X-Forwarded-Proto'];
    var host = event?.headers?.Host;
    var path = event?.requestContext?.resourcePath;
    var queryStringParameters = event?.queryStringParameters?.data;
    var url = `${ssl}://${host}${path}?data=${queryStringParameters}`;
    console.log({url})
    return url;
}