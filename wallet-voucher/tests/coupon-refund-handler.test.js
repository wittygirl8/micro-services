jest.mock('dotenv');
require('dotenv').config();

const { SequelizeMock, PaymentMock, FhCouponLogMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            FhCouponLog: FhCouponLogMock.FhCouponLogModel,
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

test('[CouponRefundHandler] missing authentication keys -> error is returned', async () => {
    const { CouponRefund } = require('../functions/coupon-refund-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await CouponRefund({ body: payload, headers: { api_token: '' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Token is empty or Invalid token');
});

test('[CouponRefundHandler] missing payload -> error is returned', async () => {
    const { CouponRefund } = require('../functions/coupon-refund-handler');
    //Act
    const context = { awsRequestId: '1' };
    const result = await CouponRefund({ headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Payload missing');
});

test('[CouponRefundHandler] Order id does not exists in the system -> No errors - Already created id will be returned', async () => {
    const { CouponRefund } = require('../functions/coupon-refund-handler');
    //Act
    const payload = JSON.stringify({
        order_id: 3456781
    });
    const context = { awsRequestId: '1' };
    const result = await CouponRefund(
        {
            body: payload,
            headers: {
                api_token: 'lakjdflajldskfjlaksdjflajsdf'
            }
        },
        context
    );

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('No record found for the given order_id');
});

test('[CouponRefundHandler] Refund already processed', async () => {
    const { CouponRefund } = require('../functions/coupon-refund-handler');
    //Act
    const payload = JSON.stringify({
        order_id: 34568
    });
    const context = { awsRequestId: '1' };
    const result = await CouponRefund(
        {
            body: payload,
            headers: {
                api_token: 'lakjdflajldskfjlaksdjflajsdf'
            }
        },
        context
    );

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('success');
    expect(result.body.message).toBe('Coupon value was reverted');
});

test('[CouponRefundHandler] Successful refund', async () => {
    const { CouponRefund } = require('../functions/coupon-refund-handler');
    //Act
    const payload = JSON.stringify({
        order_id: 34567
    });
    const context = { awsRequestId: '1' };
    const result = await CouponRefund(
        {
            body: payload,
            headers: {
                api_token: 'lakjdflajldskfjlaksdjflajsdf'
            }
        },
        context
    );

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('success');
    expect(result.body.message).toBe('Coupon value was reverted');
});
