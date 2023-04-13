jest.mock('dotenv');

beforeEach(() => {
    jest.resetModules();
});

test('[kountChargebackGateway] no body is passed -> 500 is returned', async () => {
    const { kountChargebacks } = require('../functions/kount-chargeback-handler');
    const context = { awsRequestId: '1' };
    //Act
    const result = await kountChargebacks(
        {
            body: JSON.stringify({
                transaction_id: '',
                chargeback_code: ''
            })
        },
        context
    );

    //Assert
    expect(result.statusCode).toBe(500);
});

test('[kountChargebackGateway] providing body, mocking axios for error  -> 500 is returned', async () => {
    // Assert

    const { kountChargebacks } = require('../functions/kount-chargeback-handler');

    const axios = require('axios');
    jest.mock('axios');

    axios.mockImplementationOnce(() =>
        Promise.resolve({
            data: {
                status: 'failure'
            }
        })
    );

    let payload = JSON.stringify({
        transaction_id: '1234',
        chargeback_code: 37
    });
    const context = { awsRequestId: '1' };
    const result = await kountChargebacks(payload, context);
    //Assert

    expect(result.statusCode).toBe(500);
});

test('[kountChargebackGateway] providing body, mocking axios  -> 200 is returned', async () => {
    // Assert

    const { kountChargebacks } = require('../functions/kount-chargeback-handler');
    const axios = require('axios');
    jest.mock('axios');

    axios.mockImplementationOnce(() =>
        Promise.resolve({
            data: {
                status: 'ok'
            }
        })
    );

    const context = { awsRequestId: '1' };
    const result = await kountChargebacks(
        {
            body: JSON.stringify({
                transaction_id: '1234',
                chargeback_code: 37
            })
        },
        context
    );
    //Assert

    expect(result.statusCode).toBe(200);
});

test('[kountChargebackGateway] transaction_id/chargeback_code is invalid  -> 500 is returned', async () => {
    // Assert

    const { kountChargebacks } = require('../functions/kount-chargeback-handler');
    const axios = require('axios');
    jest.mock('axios');

    axios.mockImplementationOnce(() =>
        Promise.reject({
            data: {
                status: 'failed'
            }
        })
    );
    const context = { awsRequestId: '1' };
    const result = await kountChargebacks(
        {
            body: JSON.stringify({
                transaction_id: '1234dfdef',
                chargeback_code: 3745
            })
        },
        context
    );
    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult.errorResponse).toHaveProperty('error');
    expect(result.statusCode).toBe(500);
});
