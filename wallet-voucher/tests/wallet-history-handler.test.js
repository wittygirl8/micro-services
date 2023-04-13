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

test('[WalletHistoryHandler] missing authentication keys -> error is returned', async () => {
    const { WalletHistory } = require('../functions/wallet-history-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await WalletHistory({ body: payload, headers: { api_token: '' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Token is empty or Invalid token');
});

test('[WalletHistoryHandler] missing payload -> error is returned', async () => {
    const { WalletHistory } = require('../functions/wallet-history-handler');
    //Act
    const context = { awsRequestId: '1' };
    const result = await WalletHistory({ headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } }, context);

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('failed');
    expect(result.body.message).toBe('Payload missing');
});

test('[WalletHistoryHandler] Successful request -> history of transactions returned', async () => {
    const { WalletHistory } = require('../functions/wallet-history-handler');
    //Act
    const payload = JSON.stringify({
        shopper_id: 3456789,
        page: 1
    });
    const context = { awsRequestId: '1' };
    const result = await WalletHistory(
        { body: payload, headers: { api_token: 'lakjdflajldskfjlaksdjflajsdf' } },
        context
    );

    result.body = JSON.parse(result.body);
    //Assert
    expect(result.statusCode).toBe(200);
    expect(result.body.outcome).toBe('success');
});
