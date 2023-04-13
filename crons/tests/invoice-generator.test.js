beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../layers/models_lib/src', () => {
        const {
            SequelizeMock,
            WebhookMock,
            CronMock,
            InvoiceMock,
            PaymentMock
        } = require('../../../libs/test-helpers/__mocks__');
        return {
            connectDB: () => ({
                WebhookLog: WebhookMock.WebhookModel,
                Crons: CronMock.CronMockModel,
                Invoice: InvoiceMock.InvoiceMockModel,
                Payment: PaymentMock.PaymentMockModel,
                sequelize: SequelizeMock.sequelize,
                Sequelize: { Op: {} }
            })
        };
    });
});

test('[invoiceGenerator] contract rent is NaN', async () => {
    const { InvoiceGeneratorService } = require('../consumer/invoice-generator.service');
    const invoiceService = new InvoiceGeneratorService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"customer_id":"1234","contract_rent":"true","user_ip_address":"IP-1234","specialRentData":"[{}]","cron_record_id":"1","requestId":"","is_last":true}',
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const result = await invoiceService.invoiceGenerator(event, { awsRequestId: 1 });
    expect(result.success).toBe(true);
});

test('[invoiceGenerator] success', async () => {
    const { InvoiceGeneratorService } = require('../consumer/invoice-generator.service');
    const invoiceService = new InvoiceGeneratorService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"customer_id":"1234","contract_rent":12,"user_ip_address":"IP-1234","specialRentData":"[{}]","cron_record_id":"1","requestId":"","is_last":true}',
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const result = await invoiceService.invoiceGenerator(event, { awsRequestId: 1 });
    expect(result.success).toBe(true);
});

test('[invoiceGenerator] special rent not array', async () => {
    const { InvoiceGeneratorService } = require('../consumer/invoice-generator.service');
    const invoiceService = new InvoiceGeneratorService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"customer_id":"1234","contract_rent":12,"user_ip_address":"IP-1234","specialRentData":"","cron_record_id":"1","requestId":"","is_last":true}',
                awsRegion: 'eu-west-1'
            }
        ]
    };

    expect(async () => await invoiceService.invoiceGenerator(event, { awsRequestId: 1 })).rejects.toThrow(
        'Following messag(es) was failing . Check specific error above.'
    );
});
