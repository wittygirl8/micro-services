jest.mock('dotenv');
require('dotenv').config();

const {
    SequelizeMock,
    PaymentMock,
    CustomerMock,
    TiersMock,
    TransactionWalletMock,
    WalletMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            TransactionWallet: TransactionWalletMock.TransactionWalletModel,
            Customer: CustomerMock.CustomerMockModel,
            Tier: TiersMock.TierMockModel,
            Wallet: WalletMock.WalletModel,
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

test('[WalletSaleHandler] missing authentication keys -> error is returned', async () => {
    const { WalletSale } = require('../functions/wallet-sale-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await WalletSale({ body: payload, headers: { api_token: '' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Token is empty or Invalid token');
});

test('[WalletSaleHandler] missing payload -> error is returned', async () => {
    const { WalletSale } = require('../functions/wallet-sale-handler');
    //Act
    const context = { awsRequestId: '1' };
    const result = await WalletSale({ headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Payload missing');
});

test('[WalletSaleHandler] Insufficient balance -> error returned', async () => {
    const { WalletSale } = require('../functions/wallet-sale-handler');
    //Act
    const payload = JSON.stringify({
        order_id: '43940934850',
        shopper_id: 3456789,
        amount: 100.0,
        host: 'kosheffieldonline.co.uk',
        merchant_id: 663161556,
        first_name: 'Firstname',
        last_name: 'Lastname',
        email: 'test@test.com',
        address: {
            house_number: '10',
            flat: 'test Flat',
            address1: 'Address 1',
            address2: 'Address 2',
            postcode: 'S9 2TW'
        },
        avs: {
            house_number: 'Make It Mobile, 10',
            postcode: 'S9 2TW'
        }
    });
    const context = { awsRequestId: '1' };
    const result = await WalletSale({ body: payload, headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    console.log(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Insufficent Balance');
});

test('[WalletSaleHandler] Successful sale -> Remaining balance returned', async () => {
    const { WalletSale } = require('../functions/wallet-sale-handler');
    //Act
    const payload = JSON.stringify({
        order_id: '43940934850',
        shopper_id: 3456789,
        amount: 1.0,
        host: 'kosheffieldonline.co.uk',
        merchant_id: 663161556,
        first_name: 'Firstname',
        last_name: 'Lastname',
        email: 'test@test.com',
        address: {
            house_number: '10',
            flat: 'test Flat',
            address1: 'Address 1',
            address2: 'Address 2',
            postcode: 'S9 2TW'
        },
        avs: {
            house_number: 'Make It Mobile, 10',
            postcode: 'S9 2TW'
        }
    });
    const context = { awsRequestId: '1' };
    const result = await WalletSale({ body: payload, headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('success');
});
