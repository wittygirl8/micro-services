jest.mock('dotenv');
require('dotenv').config();

const { SequelizeMock, PaymentMock, CustomerMock, RefundRequestLogMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            Customer: CustomerMock.CustomerMockModel,
            RefundRequestLog: RefundRequestLogMock.RefundRequestMockModel,
            sequelize: SequelizeMock.sequelize
        })
    };
});

beforeEach(() => {
    jest.resetModules();
});

test('[refundSale] No body passed ', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    //Act
    const context = { awsRequestId: '1' };
    const event = {
        body: '',
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };
    const result = await refundSale(event, context);

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('failed');
    expect(parsedResult.message).toContain('Payload missing');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] No Transaction found -> 200 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    //Act
    const context = { awsRequestId: '1' };

    const payload = JSON.stringify({
        order_id: '25141082',
        amount: '5.01',
        host: 'technical.sy2.com',
        merchant_id: 63189382,
        provider: 'T2S',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });
    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };
    const result = await refundSale(event, context);

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('failed');
    expect(parsedResult.message).toContain('No transaction found');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Transaction Already Refunded -> 200 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');
    PaymentMock.setPaymentOptions({ findOneEntityExists: true });
    //Act
    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({
        order_id: '25141082',
        amount: '5.01',
        host: 'technical.sy2.com',
        merchant_id: 63189382,
        provider: 'T2S',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });

    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };

    const result = await refundSale(event, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('failed');
    expect(parsedResult.message).toContain('Transaction already refunded');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Invalid Amount ->  200 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');

    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({
        order_id: '294482156',
        amount: '101.00',
        host: 'technical.sy2.com',
        merchant_id: 222222,
        provider: 'T2S',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });

    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };

    const result = await refundSale(event, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('failed');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Amount exceed max limit -> 200 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');

    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({
        order_id: '294482157',
        amount: '161.00',
        host: 'technical.sy2.com',
        merchant_id: 63189382,
        provider: 'T2S',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });

    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };

    const result = await refundSale(event, context);
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.outcome).toContain('failed');
    expect(parsedResult.message).toContain('Amount exceeds max limit');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Shopper id is missing for wallet refund -> 200 returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');

    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({
        order_id: '294482157',
        amount: '10.00',
        host: 'technical.sy2.com',
        merchant_id: 63189382,
        provider: 'WALLET',
        destination: 'CARD',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });

    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        }
    };
    const result = await refundSale(event, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('failed');
    expect(parsedResult.message).toContain('The request cannot proceed. shopper_id parm missing');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Valid data is passed -> 200 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');

    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({
        order_id: '294482156',
        amount: '10.00',
        host: 'technical.sy2.com',
        merchant_id: 222222,
        provider: 'T2S',
        reason:
            'We regret to inform that some of the items are out of stock. We suggest you check out other special dishes. In case of any queries, please ring on .'
    });
    const event = {
        body: payload,
        headers: {
            api_token: '720AAEA92F57487A6C13FE50812D107F001'
        },
        requestContext: {
            identity: {
                sourceIp: '127.0.0.1'
            }
        }
    };

    const result = await refundSale(event, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.outcome).toContain('success');
    expect(result.statusCode).toBe(200);
});

afterEach(() => {
    PaymentMock.resetPaymentOptions();
});
