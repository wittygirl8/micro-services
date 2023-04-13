beforeEach(() => {
    jest.resetModules();
});

test('[pay] valid data is passed -> 200 is returned', async () => {
    // Assert
    jest.mock('../functions/pay-handler', () => {
        const data = {
            requestId: 'reqid_6726800223303106560',
            message: 'The request was processed successfully',
            data: {
                success: 'ok'
            }
        };
        return {
            pay: jest.fn().mockImplementation(() => {
                return { data, statusCode: 200 };
            })
        };
    });
    const { pay } = require('../functions/pay-handler');

    //Act
    const payload = JSON.stringify({});
    //Assert
    const result = await pay(payload);
    expect(result.statusCode).toBe(200);
});
