jest.mock('dotenv');
require('dotenv').config();

const { SequelizeMock, PaymentMock, TransactionWalletMock, WalletMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            TransactionWallet: TransactionWalletMock.TransactionWalletModel,
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

test('[WalletBalanceHandler] missing authentication keys -> error is returned', async () => {
    const { WalletBalance } = require('../functions/wallet-balance-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await WalletBalance({ body: payload, headers: { api_token: '' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Token is empty or Invalid token');
});

test('[WalletBalanceHandler] missing payload -> error is returned', async () => {
    const { WalletBalance } = require('../functions/wallet-balance-handler');
    //Act
    const context = { awsRequestId: '1' };
    const result = await WalletBalance({ headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Payload missing');
});

test('[WalletBalanceHandler] Successful request -> Current balance is returned', async () => {
    const { WalletBalance } = require('../functions/wallet-balance-handler');
    //Act
    const payload = JSON.stringify({ shopper_id: 3456789 });
    const context = { awsRequestId: '1' };
    const result = await WalletBalance(
        { body: payload, headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } },
        context
    );

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('success');
});
