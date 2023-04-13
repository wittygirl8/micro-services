import AWS from 'aws-sdk';

export const main = async (event) => {
    console.log('consume data fifo', event);

    let i = 0;
    const promises = event.Records.map((message) => {
        i++;
        return delayed(message, 2000, i % 2 !== 0);
    });

    const allResponse = await Promise.all(promises);

    const hasAtLeastOneError = allResponse.some((result) => result.succes === false);

    console.log('hasAtLeastOneError', hasAtLeastOneError, allResponse);

    if (hasAtLeastOneError) {
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

        const processSuccesItems = allResponse.filter((result) => result.succes === true);
        for (let successMsg of processSuccesItems) {
            const params = {
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: successMsg.receiptHandle
            };
            try {
                await sqs.deleteMessage(params).promise();
            } catch (error) {
                //DO nothing
            }
        }

        const processErrorItems = allResponse.filter((result) => result.succes === false).map((rs) => rs.message);
        for (let errorMsg of processErrorItems) {
            const params = {
                QueueUrl: process.env.QUEUE_URL,
                ReceiptHandle: errorMsg.receiptHandle,
                VisibilityTimeout: 0
            };
            try {
                await sqs.changeMessageVisibility(params).promise();
            } catch (error) {
                //Do nothing
            }
        }
        // throw Error('Batch failed for messages' + processErrorItems);
    }

    return {};
};

const delayed = async (message, ms, succes) => {
    if (succes) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ message, succes: true });
            }, ms);
        });
    } else {
        return new Promise((resolve) => {
            resolve({ message, succes: false });
        });
    }
};
