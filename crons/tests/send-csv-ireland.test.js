beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../layers/models_lib/src', () => {
        const { SequelizeMock, WebhookMock, CronMock, BatchMock } = require('../../../libs/test-helpers/__mocks__');
        return {
            connectDB: () => ({
                WebhookLog: WebhookMock.WebhookModel,
                Crons: CronMock.CronMockModel,
                Batch: BatchMock.BatchMockModel,
                sequelize: SequelizeMock.sequelize,
                Sequelize: { Op: {} }
            })
        };
    });
});

test('[sendCSIreland] all data valid', async () => {
    const { CsvIrelandService } = require('../consumer/send-csv-ireland.service');
    const csvirelandService = new CsvIrelandService();

    jest.mock('aws-sdk', () => {
        const mS3Instance = {
            upload: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };

        const mSQSInstance = {
            sendMessage: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        return {
            S3: jest.fn(() => mS3Instance),
            SQS: jest.fn(() => mSQSInstance)
        };
    });

    const { helpers } = require('../../../layers/helper_lib/src');
    jest.spyOn(helpers, 's3Upload').mockReturnValue('hello');
    jest.spyOn(helpers, 'getFromS3Bucket').mockReturnValue('hello');
    jest.spyOn(helpers, 'generateZipFile').mockReturnValue('hello');

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    record: JSON.stringify([
                        {
                            accountholder: 'Yun Kong',
                            customer_id: '1234',
                            batch_id: '23',
                            total: '-25',
                            customers_number: '123',
                            customers_street: 'ABD',
                            customers_city: 'Ireland',
                            bank_address_1: 'Stock',
                            bank_address_2: 'Lawn',
                            bankname: 'HDFC'
                        }
                    ]),
                    cron_record_id: 23,
                    is_last: true,
                    startTime: Date.now(),
                    record_no: 5,
                    total_count: 5,
                    EMAIL_QUEUE_URL: 'https://sqs',
                    requestId: 'EFT12DG',
                    total_value: 20,
                    record_ids: ['1', '2', '3', '4']
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const result = await csvirelandService.init(event, { awsRequestId: 1 });
    expect(result.success).toBe(true);
});

test('[sendCSVIreland] invalid data', async () => {
    const { CsvIrelandService } = require('../consumer/send-csv-ireland.service');
    const csvirelandService = new CsvIrelandService();

    jest.mock('aws-sdk', () => {
        const mS3Instance = {
            upload: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };

        const mSQSInstance = {
            sendMessage: jest.fn().mockReturnThis(),
            promise: jest.fn()
        };
        return {
            S3: jest.fn(() => mS3Instance),
            SQS: jest.fn(() => mSQSInstance)
        };
    });

    const { helpers } = require('../../../layers/helper_lib/src');
    jest.spyOn(helpers, 's3Upload').mockReturnValue('hello');
    jest.spyOn(helpers, 'getFromS3Bucket').mockReturnValue('hello');
    jest.spyOn(helpers, 'generateZipFile').mockReturnValue('hello');

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    record: JSON.stringify(''),
                    cron_record_id: 23,
                    is_last: false,
                    startTime: Date.now(),
                    record_no: 5,
                    total_count: 5,
                    EMAIL_QUEUE_URL: 'https://sqs',
                    requestId: 'EFT12DG',
                    total_value: 20,
                    record_ids: ['1', '2', '3', '4']
                }),
                awsRegion: 'eu-west-1'
            },
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body: JSON.stringify({
                    record: JSON.stringify([
                        {
                            accountholder: 'Yun Kong',
                            customer_id: '1234',
                            batch_id: '23',
                            customers_number: '123',
                            customers_street: 'ABD',
                            customers_city: 'Ireland',
                            bank_address_1: 'Stock',
                            bank_address_2: 'Lawn',
                            bankname: 'HDFC'
                        }
                    ]),
                    cron_record_id: 23,
                    is_last: true,
                    startTime: Date.now(),
                    record_no: 5,
                    total_count: 5,
                    EMAIL_QUEUE_URL: 'https://sqs',
                    requestId: 'EFT12DG',
                    total_value: 20,
                    record_ids: ['1', '2', '3', '4']
                }),
                awsRegion: 'eu-west-1'
            }
        ]
    };

    expect(async () => await csvirelandService.init(event, { awsRequestId: 1 })).rejects.toThrow(
        'Following messag(es) was failing . Check specific error above.'
    );
});
