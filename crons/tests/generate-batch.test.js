beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../layers/models_lib/src', () => {
        const {
            SequelizeMock,
            WebhookMock,
            CronMock,
            PaymentMock,
            BatchMock,
            BatchItemMock
        } = require('../../../libs/test-helpers/__mocks__');
        return {
            connectDB: () => ({
                WebhookLog: WebhookMock.WebhookModel,
                Crons: CronMock.CronMockModel,
                Payment: PaymentMock.PaymentMockModel,
                Batch: BatchMock.BatchMockModel,
                BatchItem: BatchItemMock.BatchItemMockModel,
                sequelize: SequelizeMock.sequelize,
                Sequelize: { Op: {} }
            })
        };
    });
});

test('[generateBatch] all valid data passed', async () => {
    const { GenerateBatchService } = require('../consumer/generate-batch.service');
    const generateBatchService = new GenerateBatchService();

    jest.mock('aws-sdk', () => {
        const SQSMocked = {
            sendMessage: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        return {
            SQS: jest.fn(() => SQSMocked)
        };
    });

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    withdrawRecord: JSON.stringify([
                        {
                            id: 1,
                            customer_id: '20',
                            time: 2,
                            sortcode: '666666',
                            accountnumber: 'GFRT45FF1',
                            bankname: 'HDFC',
                            accountholder: 'Yun Kong'
                        }
                    ]),
                    cron_id: 1,
                    requestId: '123',
                    is_last: true,
                    starttime: Date.now()
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const result = await generateBatchService.generateBatch(event, { awsRequestId: 1 });
    expect(result.success).toBe(true);
});

test('[generateBatch]  in-valid data passed', async () => {
    const { GenerateBatchService } = require('../consumer/generate-batch.service');
    const generateBatchService = new GenerateBatchService();

    jest.mock('aws-sdk', () => {
        const SQSMocked = {
            sendMessage: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        return {
            SQS: jest.fn(() => SQSMocked)
        };
    });

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    withdrawRecord: '',
                    cron_id: 1,
                    requestId: '123',
                    is_last: true,
                    starttime: Date.now()
                }),
                awsRegion: 'eu-west-1'
            },
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    withdrawRecord: JSON.stringify([
                        {
                            id: 1,
                            customer_id: '20',
                            time: 2,
                            sortcode: '666666',
                            accountnumber: 'GFRT45FF1',
                            bankname: 'HDFC',
                            accountholder: 'Yun Kong'
                        }
                    ]),
                    cron_id: 1,
                    requestId: '123',
                    is_last: true,
                    starttime: Date.now()
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };
    expect(async () => await generateBatchService.generateBatch(event, { awsRequestId: 1 })).rejects.toThrow(
        'Following messag(es) was failing . Check specific error above.'
    );
});
