jest.mock('dotenv');
require('dotenv').config();

const {
    CardstreamRequestLogMock,
    WebhookLogMock,
    SequelizeMock,
    CardstreamSettingsMock,
    CardstreamRefundLogMock,
    PaymentMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamRequestLog: CardstreamRequestLogMock.CardstreamRequestLogMockModel,
            WebhookLog: WebhookLogMock.WebhookLogModel,
            CardstreamSettings: CardstreamSettingsMock.CardstreamSettingsModel,
            CardstreamRefundLog: CardstreamRefundLogMock.CardstreamRefundLogModel,
            Payment: PaymentMock.PaymentMockModel,
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

test('[refundSale] empty body is passed -> 500 is returned', async () => {
    const { refundSale } = require('../functions/refund-sale-handler');
    //Act
    const payload = JSON.stringify({ data: '' });
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[refundSale] wrong data/parameter missed  -> 500 is returned', async () => {
    // Assert

    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'TArT0dTQWF4S21GWTczallYWkRRQ1cxK1JVR1FPSUV6QVQ0ZE1JTjFmQ2tPV0E2bXlraWVKc0V2RnVmQyt6cjJaR3VveEQ4OWp6WlRoVjZ0RmJKdE9TRXJOTHp6STE4V3BpL1lRM215aFliNzlVWDdxalNGT2d2bERWWlpqS212MXRGRlZmOFdIQ0RxaG9yMU5mNjNBPT0='
    });
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    //Assert

    expect(result.statusCode).toBe(500);
});
/*
test('[refundSale] Transaction already refunded -> 500 is returned', async () => {
    // Assert
    PaymentMock.setPaymentOptions({ findOneEntityExists: true }); // first entity is already refunded
    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'OEZHRVZwZzBGR0tyK1JGR004bjFSS1JKbnQ5OHluQ09QRnVJall0bklpQ204ZTUybXl5T0p5L1QvbEgzeWNZSXFBMWdxMWdLVVk3dHdVN0hrbnNMU0M5TTl3VE9TWXBjQVZVQmVFWUl3ZjZOSi9UWWtNdEk3a1d3azRXTlp5TlY2Z1JURGF3NzMvUVVWdmx2WDV0Y0p3PT0='
    });
    //PaymentMock.setPaymentOptions({findOneEntityExists: true});
    //Assert
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.error.message).toContain('Transaction already refunded');
    expect(result.statusCode).toBe(500);
});
*/
test('[refundSale] Invalid Amount given -> 500 is returned', async () => {
    // Assert

    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'OEZHRVZwZzBGR0tyK1JGR004bjFSTXdDOUdzcGI4OEYrMDJaVVcwM2tnSGtrUWw1QTNXOUhxNVMvQjltNDJJQmp1U2htU216RXBQd1QzdWNCajZQRmlCa1NwemZ6dG13dzE4QlYxZWNkUTFPb3NKRm8rdTdjclcwMWo4UWhuaEFVVTdVS0JxZEgvRGJwb3I4dXNHMjZnPT0='
    });
    //Assert
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.error.message).toBe('Invalid amount');
    expect(result.statusCode).toBe(500);
});

test('[refundSale] Refund Success, opt for REFUND_SALE -> 200 is returned', async () => {
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0, // responseCode 0  for success from cardstream
                    state: 'accepted'
                };
            }
        };
    });
    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'OEZHRVZwZzBGR0tyK1JGR004bjFSTXdDOUdzcGI4OEYrMDJaVVcwM2tnRlhZd29EVVlnNjdiVXNhdnpqdlg2Q09UT2VqbGpGWXlCLzBaOGg5Y1FXVTNhbm5KNDYxRERVTXRvOTRhSlFtYVdlUmZaV0JaTW1aMHVMS3F4UkNKWUM4ay8xUGhweFBBT213Znp5MVdpaDBBPT0='
    });
    //Assert
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    console.log('Result', result);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('Refund has been processed successfully');
    expect(parsedResult).toHaveProperty('data');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] Refund Success, opt for CANCEL -> 200 is returned', async () => {
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0, // responseCode 0  for success from cardstream
                    state: 'received'
                };
            }
        };
    });
    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'OEZHRVZwZzBGR0tyK1JGR004bjFSTXdDOUdzcGI4OEYrMDJaVVcwM2tnRlhZd29EVVlnNjdiVXNhdnpqdlg2Q09UT2VqbGpGWXlCLzBaOGg5Y1FXVTNhbm5KNDYxRERVTXRvOTRhSlFtYVdlUmZaV0JaTW1aMHVMS3F4UkNKWUM4ay8xUGhweFBBT213Znp5MVdpaDBBPT0='
    });
    //Assert
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    console.log('Result', result);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('Refund has been processed successfully');
    expect(parsedResult).toHaveProperty('data');
    expect(result.statusCode).toBe(200);
});

test('[refundSale] No Transaction Found  -> 200 is returned', async () => {
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'cXIwWVgwd0hIM3lhNEVidVRXeTM2UG11dXFqWSs3Z3JXUDh6UkM1bnJQNXRLTzZtajFoREJoWG5TSC94aWlOa0FyV1IwUzIxRWVxM1FrRjlGK1RHTXJJSzRkM0RsV21EODlxcktXV3R1MDFZWGNTd25wZDMzeEh5MlN1TjVGMzUzWFN1S2hXVFBWemdkMXN3MXR3L2R3PT0='
    });
    const context = { awsRequestId: '1' };
    const result = await refundSale({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult.error.message).toBe('No transaction found');
    expect(result.statusCode).toBe(500);
});
test('[refundSale] Refund Failed -> 500 is returned', async () => {
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 56767, // responseCode 56767  for failure from cardstream
                    responseMessage: 'failure',
                    xref: 'xyz',
                    state: 'pending'
                };
            }
        };
    });
    const { refundSale } = require('../functions/refund-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'OEZHRVZwZzBGR0tyK1JGR004bjFSTXdDOUdzcGI4OEYrMDJaVVcwM2tnRlhZd29EVVlnNjdiVXNhdnpqdlg2Q09UT2VqbGpGWXlCLzBaOGg5Y1FXVTNhbm5KNDYxRERVTXRvOTRhSlFtYVdlUmZaV0JaTW1aMHVMS3F4UkNKWUM4ay8xUGhweFBBT213Znp5MVdpaDBBPT0='
    });
    const context = { awsRequestId: '1' };

    const result = await refundSale({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult).toHaveProperty('error');
    expect(result.statusCode).toBe(500);
});

afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
    WebhookLogMock.resetWebhookOptions();
    PaymentMock.resetPaymentOptions();
    CardstreamRefundLogMock.resetCardstreamRefundLogOptions();
    CardstreamSettingsMock.resetCardstreamSettingsOptions();
});
