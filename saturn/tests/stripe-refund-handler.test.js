jest.mock('dotenv');
require('dotenv').config();

const { SequelizeMock, StripeRefundMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            StripeRefund: StripeRefundMock.StripeRefundMockModel,
            sequelize: SequelizeMock.sequelize
        })
    };
});

beforeEach(() => {
    jest.resetModules();
});
afterEach(() => {
    StripeRefundMock.resetRefundOptions();
});

test('[stripeRefund]  body is passed api is missing/unauthorized -> 401 is returned', async () => {
    const { stripeRefund } = require('../functions/stripe-refund-handler');
    //Act
    const payload = JSON.stringify({
        txnId: 31178737,
        refund_amount: 12,
        reason: 'I want my money back',
        vendorTxnCode: 'pi_1Ho26dByLOFWMsUNC4mtO1aF',
        vpsTxnId: 'acct_1FCikEAS5mTVweby'
    });

    const headers = {};
    const result = await stripeRefund({ body: payload, headers }, { awsRequestId: 1 });
    //Assert

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('Unauthorised');
    expect(result.statusCode).toBe(401);
});

test('[stripeRefund] transaction id is empty  -> 400 is returned with message: Please provide a transaction id to process the refund.', async () => {
    const { stripeRefund } = require('../functions/stripe-refund-handler');
    //Act
    const payload = JSON.stringify({
        txnId: '',
        refund_amount: 12,
        reason: 'I want my money back',
        vendorTxnCode: 'pi_1Ho26dByLOFWMsUNC4mtO1aF',
        vpsTxnId: 'acct_1FCikEAS5mTVweby'
    });

    const headers = {
        api_key: 'xyz'
    };
    const result = await stripeRefund({ body: payload, headers }, { awsRequestId: 1 });
    //Assert
    const parsedResult = JSON.parse(result.body);
    console.log(parsedResult, '***************************');
    expect(parsedResult.message).toBe('Please provide a transaction id to process the refund.');
    expect(result.statusCode).toBe(400);
});

test('[stripeRefund] vendorTxnCode is empty  -> 400 is returned with message: No payment intent provided.', async () => {
    const { stripeRefund } = require('../functions/stripe-refund-handler');
    //Act
    const payload = JSON.stringify({
        txnId: 31178737,
        refund_amount: 12,
        reason: 'I want my money back',
        vendorTxnCode: '',
        vpsTxnId: 'acct_1FCikEAS5mTVweby'
    });

    const headers = {
        api_key: 'xyz'
    };
    const result = await stripeRefund({ body: payload, headers }, { awsRequestId: 1 });
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('No payment intent provided.');
    expect(result.statusCode).toBe(400);
});

test('[stripeRefund]  Fail  -> 400 is returned, with message refund requested more than AVAILABLE RUFUND AMOUNT.', async () => {
    const { stripeRefund } = require('../functions/stripe-refund-handler');
    const axios = require('axios');

    jest.mock('axios');

    //Act
    const payload = JSON.stringify({
        txnId: 31178737,
        refund_amount: 5,
        reason: 'I want my money back',
        vendorTxnCode: 'pi_1Ho26dByLOFWMsUNC4mtO1aF',
        vpsTxnId: 'acct_1FCikEAS5mTVweby'
    });

    const headers = {
        api_key: 'xyz'
    };

    axios
        .mockImplementationOnce(() =>
            Promise.resolve({
                charges: {
                    data: [
                        {
                            id: 1,
                            amount: 15,
                            amount_refunded: 12
                        }
                    ]
                }
            })
        )
        .mockImplementationOnce(() =>
            Promise.resolve({
                data: 1
            })
        );

    const result = await stripeRefund({ body: payload, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(400);
});

test('[stripeRefund]  success  -> 200 is returned with message: Refund of 12 successfully processed.', async () => {
    const { stripeRefund } = require('../functions/stripe-refund-handler');
    const axios = require('axios');

    jest.mock('axios');

    //Act
    const payload = JSON.stringify({
        txnId: 31178737,
        refund_amount: 1,
        reason: 'I want my money back',
        paymentIntent: 'pi_1Ho26dByLOFWMsUNC4mtO1aF',
        clientReferenceId: 'O67898056M63169829C1234'
    });

    const headers = {
        api_key: 'xyz'
    };

    axios
        .mockImplementationOnce(() =>
            Promise.resolve({
                data: {
                    charges: {
                        data: [
                            {
                                id: 1,
                                amount: 15,
                                amount_refunded: 12
                            }
                        ]
                    }
                }
            })
        )
        .mockImplementationOnce(() =>
            Promise.resolve({
                data: 1
            })
        );

    const result = await stripeRefund({ body: payload, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(200);
});
