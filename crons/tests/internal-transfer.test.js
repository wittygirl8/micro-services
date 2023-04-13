const {
    SequelizeMock,
    WebhookMock,
    CronMock,
    InternalTAuditMock,
    InternalTransactionMock
} = require('../../../libs/test-helpers/__mocks__');

beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../layers/models_lib/src', () => {
        return {
            connectDB: () => ({
                WebhookLog: WebhookMock.WebhookModel,
                Crons: CronMock.CronMockModel,
                InternalTransferAudit: InternalTAuditMock.InternalTAuditMockModel,
                InternalTransferTransaction: InternalTransactionMock.InternalTransactionMockModel,
                sequelize: SequelizeMock.sequelize,
                Sequelize: { Op: {} }
            })
        };
    });
});

test('[internalTransfer] all data valid', async () => {
    const { InternalTransferService } = require('../consumer/internal_transfer.service');
    const internalTransService = new InternalTransferService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    cron_record_id: 23,
                    ref: '12',
                    startTime: Date.now(),
                    is_last: true
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const result = await internalTransService.internalTransfer(event, { awsRequestId: 1 });
    expect(result.success).toBe(true);
});

test('[internalTransfer] all data valid', async () => {
    const { InternalTransferService } = require('../consumer/internal_transfer.service');
    const internalTransService = new InternalTransferService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: {
                    cron_record_id: 23,
                    ref: '12',
                    startTime: Date.now(),
                    is_last: true
                },
                awsRegion: 'eu-west-1'
            },
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    cron_record_id: 23,
                    ref: '12',
                    startTime: Date.now(),
                    is_last: true
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    expect(async () => await internalTransService.internalTransfer(event, { awsRequestId: 1 })).rejects.toThrow(
        'Following messag(es) was failing . Check specific error above.'
    );
});

test('[internalTransfer] error with internal transfer', async () => {
    const { InternalTransferService } = require('../consumer/internal_transfer.service');
    const internalTransService = new InternalTransferService();

    InternalTransactionMock.setInternalTransactionOptions({ updateError: true });

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    cron_record_id: 23,
                    ref: '12',
                    startTime: Date.now(),
                    is_last: true
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    expect(async () => await internalTransService.internalTransfer(event, { awsRequestId: 1 })).rejects.toThrow(
        'Following messag(es) was failing . Check specific error above.'
    );
});
