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

test('[CouponSaleHandler] missing authentication keys -> error is returned', async () => {
    const { CouponSale } = require('../functions/coupon-sale-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await CouponSale({ body: payload, headers: { api_token: '' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Token is empty or Invalid token');
});

test('[CouponSaleHandler] missing payload -> error is returned', async () => {
    const { CouponSale } = require('../functions/coupon-sale-handler');
    //Act
    const context = { awsRequestId: '1' };
    const result = await CouponSale({ headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Payload missing');
});

test('[CouponSaleHandler] Order id already exists payload -> No errors - Already created id will be returned', async () => {
    const { CouponSale } = require('../functions/coupon-sale-handler');
    //Act
    const payload = JSON.stringify({
        order_id: 34567,
        merchant_id: 45678,
        coupon_id: 242342,
        value: 23.4,
        shopper: {
            email: 'test@test.je',
            firstname: 'Testing',
            lastname: 'Testing',
            address: ' '
        }
    });
    const context = { awsRequestId: '1' };
    const result = await CouponSale(
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
    expect(result.body.payment_id).toBe(56789);
});

test('[CouponSaleHandler] Succesful sale -> New id created will be returned', async () => {
    const { CouponSale } = require('../functions/coupon-sale-handler');
    //Act
    const payload = JSON.stringify({
        order_id: 345678,
        merchant_id: 456789,
        coupon_id: 242342,
        value: 23.4,
        shopper: {
            email: 'test@test.je',
            firstname: 'Testing',
            lastname: 'Testing',
            address: ' '
        }
    });
    const context = { awsRequestId: '1' };
    const result = await CouponSale(
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
});
