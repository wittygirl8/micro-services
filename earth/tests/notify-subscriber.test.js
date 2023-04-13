beforeEach(() => {
    jest.resetModules();
});

test('[notifySubscriber] queue error', async () => {
    //Arrange
    var AWSMock = require('aws-sdk-mock');

    AWSMock.mock('SQS', 'sendMessage', () => Promise.reject(new Error('SQS Error')));

    const { EarthService } = require('../earth.service');
    const earthService = new EarthService();

    const payload = {};
    const t2sPayload = {};
    const card_payment_id = -1;
    let awsRequestId = 'same-random-id';

    try {
        //Act
        await earthService.notifyT2SSubscriber(payload, t2sPayload, card_payment_id, awsRequestId);
    } catch (error) {
        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('message', 'SQS Error');
    }
});

test('[notifySubscriber] success', async () => {
    //Arrange
    var AWSMock = require('aws-sdk-mock');

    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));

    const { EarthService } = require('../earth.service');
    const earthService = new EarthService();

    const payload = {};
    const t2sPayload = {};
    const card_payment_id = -1;

    //Act
    await earthService.notifyT2SSubscriber(payload, t2sPayload, card_payment_id);
    //Assert
});
