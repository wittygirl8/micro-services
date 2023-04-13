jest.mock('dotenv');
require('dotenv').config();
const {
    PaymentMock,
    CustomerMock,
    SequelizeMock,
    OptomanyRefundMock,
    RefundRequestLogMock,
    OptomanyPaymentMock,
    StripeSettingsMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            Customer: CustomerMock.CustomerMockModel,
            RefundRequestLog: RefundRequestLogMock.RefundRequestMockModel,
            OptomanyPayment: OptomanyPaymentMock.OptomanyPaymentMockModel,
            OptomanyRefund: OptomanyRefundMock.OptomanyRefundMockModel,
            StripeSettings: StripeSettingsMock.StripeSettingsMockModel,

            // TransactionWallet: TransactionWalletMock.TransactionWalletModel,
            // Wallet: WalletMock.WalletMockModel,
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

test('[refund] refund service - Cardstream Refund Success', async () => {
    const axios = require('axios');
    jest.mock('axios');
    const { RefundService } = require('../consumer/refund-sale.service');
    const refundService = new RefundService();

    const event = {
        Records: [
            {
                body: JSON.stringify({
                    payload: {
                        order_id: '543687755',
                        amount: '47.23',
                        host: 'dev-1-uk.t2scdn.com',
                        merchant_id: 63189382,
                        reason: 'Bad service',
                        provider: 'FH'
                    },
                    transactionDetails: {
                        id: 31196034,
                        customer_id: 63189382,
                        refund: '',
                        total: '47.23',
                        payment_provider: 'CARDSTREAM',
                        CrossReference: 'O543687755M63189382T31196034',
                        VendorTxCode: '8177/10282/19072021143922000',
                        time: '2021-07-19T14:39:18.000Z',
                        firstname: 'Marjorie',
                        lastname: 'Feil',
                        fees: '1.81',
                        payed: '45.42418',
                        payment_status: 'OK',
                        address: '743 27, North America Macejkovic Centers. 294638157',
                        provider: 'T2S'
                    }
                })
            }
        ]
    };
    axios.post.mockResolvedValue();
    const result = await refundService.refund(event);
    expect(result.success).toBe(true);
});

// test('[refund] refund service - Stripe Refund', async () => {
//     StripeSettings.setStripeSettingsOptions({ findOneEntityExists: true })
//     const axios = require('axios');
//     jest.mock('axios');
//     const { RefundService } = require('../consumer/refund-sale.service');
//     const refundService = new RefundService();
//
//     const event = {
//         Records: [
//             {
//
//                 body: JSON.stringify({
//                     "payload": {
//                         "order_id": "543687755",
//                         "amount": "47.23",
//                         "host": "dev-1-uk.t2scdn.com",
//                         "merchant_id": 63189382,
//                         "reason": "Bad service",
//                         "provider": "FH"
//                     },
//                     "transactionDetails": {
//                         "id": 31196034,
//                         "customer_id": 63189382,
//                         "refund": "",
//                         "total": "47.23",
//                         "payment_provider": "STRIPE",
//                         "CrossReference": "O543687755M63189382T31196034",
//                         "VendorTxCode": "8177/10282/19072021143922000",
//                         "time": "2021-07-19T14:39:18.000Z",
//                         "firstname": "Marjorie",
//                         "lastname": "Feil",
//                         "fees": "1.81",
//                         "payed": "45.42418",
//                         "payment_status": "OK",
//                         "address": "743 27, North America Macejkovic Centers. 294638157",
//                         "provider": "T2S"
//                     }
//                 })
//             }
//
//         ]
//     };
//     axios.post.mockResolvedValue();
//     const result = await refundService.refund(event);
//     console.log('result', result);
//
//     expect(result.success).toBe(true);
// });

// test('[refund] refund service - optomany Refund', async () => {
//     // const axios = require('axios');
//
//     // jest.mock('axios');
//     OptomanyRefund.setOptomanyRefundOptions({ findOneEntityExists: true });
//
//
//     jest.doMock('../../../layers/helper_lib/src/optomany_helpers', () => {
//         return {
//             requestConfig: () => {
//                 return {
//                     //some response
//                 };
//             }
//         };
//     });
//     const event = {
//         Records: [
//             {
//
//                 body: JSON.stringify({
//                     "payload": {
//                         "order_id": "543687755",
//                         "amount": "47.23",
//                         "host": "dev-1-uk.t2scdn.com",
//                         "merchant_id": 63189382,
//                         "reason": "Bad service",
//                         "provider": "FH"
//                     },
//                     "transactionDetails": {
//                         "id": 31196034,
//                         "customer_id": 63189382,
//                         "refund": "",
//                         "total": "47.23",
//                         "payment_provider": "OPTOMANY",
//                         "CrossReference": "O543687755M63189382T31196034",
//                         "VendorTxCode": "8177/10282/19072021143922000",
//                         "time": "2021-07-19T14:39:18.000Z",
//                         "firstname": "Marjorie",
//                         "lastname": "Feil",
//                         "fees": "1.81",
//                         "payed": "45.42418",
//                         "payment_status": "OK",
//                         "address": "743 27, North America Macejkovic Centers. 294638157",
//                         "provider": "FH"
//                     }
//                 })
//             }
//
//         ]
//     };
//     // axios.post.mockResolvedValue();
//     const { RefundService } = require('../consumer/refund-sale.service');
//     const refundService = new RefundService();
//     const result = await refundService.refund(event);
//     console.log('result', result);
//
//     expect(result.success).toBe(true);
// });

afterEach(() => {
    // OptomanyRefund.resetOptomanyRefundOptions();
    // StripeSettings.resetStripeSettingsOptions();
});
