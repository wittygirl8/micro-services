import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

export const main = async (event) => {
    console.log('Send data', event.body);

    let options = {};

    if (process.env.IS_OFFLINE) {
        options = {
            apiVersion: '2012-11-05',
            region: 'localhost',
            endpoint: 'http://0.0.0.0:9324',
            sslEnabled: false
        };
    }

    const sqs = new AWS.SQS(options);

    const params = {
        MessageGroupId: 'testGroup',
        MessageBody: 'tralivali' + uuidv4(),
        QueueUrl: process.env.QUEUE_URL
    };

    await sqs.sendMessage(params).promise();

    return {};
};
