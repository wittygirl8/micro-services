import AWS, { SQS } from 'aws-sdk';

export class QueueError extends Error {
    constructor(message) {
        super(message);
    }
}

export class SQSService {
    constructor(queueUrl, region) {
        AWS.config.update({ region });
        this.sqsClient = new SQS({
            apiVersion: '2020-11-05'
        });

        this.queueUrl = queueUrl;
    }

    requireInitialised(taskDescription) {
        if (this.isInitialised) return;

        const error = new QueueError(`Must ininitalise SQS connector before using functions: ${taskDescription}`);
        throw error;
    }

    listQueues() {
        return new Promise((resolve, reject) => {
            this.sqsClient.listQueues((error, queueList) => {
                if (error) {
                    const throwError = new QueueError(
                        'Could not connect to SQS when trying to list queues',
                        {
                            queue: this.queueUrl
                        },
                        error
                    );
                    console.error(throwError);
                    return reject(throwError);
                }
                return resolve(queueList.QueueUrls ? Array.from(queueList.QueueUrls) : []);
            });
        });
    }

    _sendMessage(message, attributes) {
        return new Promise((resolve, reject) => {
            const params = {
                QueueUrl: this.queueUrl,
                MessageBody: message,
                MessageAttributes: attributes
            };

            this.sqsClient.sendMessage(params, (error, data) => {
                if (error) {
                    const throwError = new QueueError(
                        'Could not execute sendMessage against queue',
                        {
                            queue: this.queueUrl
                        },
                        error
                    );
                    console.error(throwError);

                    return reject(throwError);
                }

                return resolve(data);
            });
        });
    }

    _receiveMessage(maxMessages = 1) {
        return new Promise((resolve, reject) => {
            const params = {
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: maxMessages
            };

            this.sqsClient.receiveMessage(params, (error, data) => {
                if (error) {
                    const throwError = new QueueError(
                        'Could not execute receiveMessage against queue',
                        {
                            queue: this.queueUrl
                        },
                        error
                    );
                    console.error(throwError);

                    return reject(throwError);
                }

                return resolve(data.Messages);
            });
        });
    }

    _deleteMessage(receiptHandle) {
        return new Promise((resolve, reject) => {
            const params = {
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle
            };

            this.sqsClient.deleteMessage(params, (error, data) => {
                if (error) {
                    const throwError = new QueueError(
                        'Could not execute deleteMessage against queue',
                        {
                            queue: this.queueUrl
                        },
                        error
                    );
                    console.error(throwError);

                    return reject(throwError);
                }

                return resolve(data.Messages);
            });
        });
    }

    _checkClientInitialised() {
        if (!this.sqsClient) {
            const error = new Error('SQS Queue was not initialised.');
            console.error(error);

            throw error;
        }
    }

    async _checkQueueExists() {
        const existingQueues = await this.listQueues();
        if (!existingQueues.includes(this.queueUrl)) {
            const error = new Error('SQS Queue URL in config does not exist in AWS SQS');
            console.error(error);

            throw error;
        }
    }

    async initialise() {
        this._checkClientInitialised();
        await this._checkQueueExists();

        this.isInitialised = true;

        return true;
    }

    async sendMessage(message, attributes) {
        this.requireInitialised('Send Message');
        try {
            return await this._sendMessage(message, attributes);
        } catch (error) {
            const throwError = new QueueError('Could not send message to queue', null, error);
            console.error(throwError);

            throw throwError;
        }
    }

    async pickMessage() {
        this.requireInitialised('Pick Message');
        let pickedMessage;
        try {
            const pickedMessages = await this._receiveMessage(1);
            if (pickedMessages) pickedMessage = pickedMessages[0];
        } catch (error) {
            const throwError = new QueueError('Could not pick message from queue', null, error);
            console.error(throwError);

            throw throwError;
        }

        return pickedMessage;
    }

    async deleteMessage(handle) {
        this.requireInitialised('Delete message');
        let deletedMessages;
        try {
            deletedMessages = await this._deleteMessage(handle);
        } catch (error) {
            const throwError = new QueueError('Could not delete message from queue', null, error);
            console.error(throwError);

            throw throwError;
        }

        return deletedMessages;
    }
}
