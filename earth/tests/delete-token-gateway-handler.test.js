const { CardstreamRequestLogMock, SequelizeMock, CardstreamTokenLogMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamRequestLog: CardstreamRequestLogMock.CardstreamRequestLogMockModel,
            CardstreamTokenLog: CardstreamTokenLogMock.CardstreamTokenLogMockModel,
            sequelize: SequelizeMock.sequelize,
            Sequelize: { Op: {} },
            ReferralData: {
                findOne: () => null,
                build: () => ({
                    save: () => {}
                })
            }
        })
    };
});

beforeEach(() => {
    jest.resetModules();
});

test('[deleteTokenGateway] no path parameter and body is passed -> 500 is returned', async () => {
    const { deleteTokenGateway } = require('../functions/delete-token-gateway-handler');
    const context = { awsRequestId: '1' };
    //Act
    const result = await deleteTokenGateway(
        {
            pathParameters: {
                token: ''
            }
        },
        context
    );

    //Assert
    expect(result.statusCode).toBe(500);
});

test('[deleteTokenGateway] pathParameter available and encrypted data missing in body  -> 500 is returned', async () => {
    // Assert

    const { deleteTokenGateway } = require('../functions/delete-token-gateway-handler');

    //Act
    const payload = JSON.stringify({
        data: ''
    });
    const context = { awsRequestId: '1' };
    const result = await deleteTokenGateway(
        {
            body: payload,
            pathParameters: {
                token: '20071712ZN56VK42KN62XHD'
            }
        },
        context
    );
    //Assert

    expect(result.statusCode).toBe(500);
});

test('[deleteTokenGateway] valid data is passed -> 200 is returned', async () => {
    // Assert
    const { deleteTokenGateway } = require('../functions/delete-token-gateway-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOFo4OW1kOGJaZnZCakFpbjcwTEdTUFFmM00rdVd2NDlyS01rNjdtTHFnR25naks3UEh0MzFMUGE4OWhaM3ZsWU5FQnF1MWNaVTJQVnljNEQvalJEdlRVK3kxYXFRYkw4YUtkcjZOMUJjaHd0eWlMakR4SEJFK3k2djlZTnJVbG5GditoeXBwb1FYMEJROE41L0ZLSW5mK1RqNHdncndPdnRmMWdsQ0tpUXZkTXVRVTBIOFdLTW9JNEZ4alZxWG5seUFIWnF0NjNGaXRiY1p4MGtZYkRiVlpLQmx1QUJ6L3U4QmtpV0VJYnY0S0FJWllLNFlzaVRDSlJHU0FhRkh4UWhWYk9BOGI5UGRaS0xmdU5hVWdaRnBER29CcS9nMFg2SEJLY0RxU0dsbUpvWkljQTMwckJmdFRjbGh6bkhyZDZWV2NuVXpKTmxMZ253dlNEbUIyMkdsUDJFcUhpZ1NKVkVDMGZXSThMV3FSWUVIVkFsL0JSWWloRTFNOE4vVExjSFA3S2pyVFNoc2t2cGlVbjN4WEZsNVBIZ2hUN04wWVBlYTFIRkFxcUVOaGg5ODk4UmxmZ1lBSnNJKy9uUHlBRmxhTVYySTNXSUFmZjFZQlhRR2tvUGdyampVQ2dmcUZiOWo0SmwzWWh3REF0QjJtVVFhWkJBN254cXphMmFRc2FiZ0hxbURwZVp4RCsyeGtGVHZ4NkZOaUQ3d2pJeDliaVB4aUZxZGl2VFdac25kNyswbzB6UHM4MTJCNXRIZ3pwSnFkcjhVbVFOeE9yaFhSWXhUY0hhL2ZCZXVTdGpGM0NlM1c3VUxBNEp4MnlMZVVYdnM5MkhIaXQyTWpBTWJRVFMreDQzdWhrRlp5RE0rTlJEWlE3M0xRPT0='
    });
    const context = { awsRequestId: '1' };
    const result = await deleteTokenGateway(
        {
            body: payload,
            pathParameters: {
                token: '20071712ZN56VK42KN62XHD'
            }
        },
        context
    );

    const parsedResult = JSON.parse(result.body);
    //Assert
    console.log('Result is', parsedResult);
    expect(parsedResult.data).toMatchObject({});
    expect(parsedResult.message).toBe('Token deleted');
    expect(result.statusCode).toBe(200);
});

afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
});
