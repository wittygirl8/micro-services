jest.mock('dotenv');
require('dotenv').config();
const {
    PaymentMock,
    CustomerMock,
    SequelizeMock,
    DeliveryFeeMock,
    StripePaymentInfoMock
} = require('../../../test_helpers/_mock_');
beforeEach(() => {
    jest.resetModules();
});

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            Customer: CustomerMock.CustomerMockModel,
            StripePaymentInfo: StripePaymentInfoMock.StripePaymentInfoMockModel,
            DeliveryFee: DeliveryFeeMock.DeliveryFeeMockModel,
            sequelize: SequelizeMock.sequelize
        })
    };
});

afterEach(() => {
    PaymentMock.resetPaymentOptions();
    CustomerMock.resetCustomerOptions();
    DeliveryFeeMock.resetDeliveryFeeOptions();
});

test('[Stripe Pay]  empty query string params is passed -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    //Act
    const queryStringParameters = {
        data: ''
    };
    const result = await stripePay({ queryStringParameters }, { awsRequestId: 1 });
    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult).toHaveProperty('reason');
    expect(parsedResult.code).toBe('ERR_OSSL_EVP_WRONG_FINAL_BLOCK_LENGTH');
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay] no query string  is passed  -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    //Act
    const result = await stripePay(undefined, { awsRequestId: 1 });
    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult).toMatchObject({});
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay]  Payment already done -> 301 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    //Act
    PaymentMock.setPaymentOptions({ findOneEntityExists: true });
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSQ2k3UHl6WDhoWVBNZUppVEd1bDA1bzAwU0EzTzBFclB5UWxXZlRZandkdXR3dGR1NGRZQTg2Vllxa1htb0k4MnNjUE9YamJBVlR0djQ5eFdkWGhpeU0zUjRZb1JaTlpCdTJhOTZtc1ZlMy9ycVQ0N2VXTDBLbHNtbHA3TDdDTGhJdnJFcnVGc0tyUCtRTkNCYXBEeHcrY0xXVW9pWU1GUDF2c3ZxYi82R3AzM3B0b0R2N3ZFLzdSWVJ0azJSN0VoUXZYMko4aXF0UGhBcTE0NGZINzYzUUdpeW9waS84QVdNN0k3OEdDWUlJOEJRdDNPZXVoN3JiUmNSYlR3Sjg3N2xRUWZZdDVpK2VLclFvSndlY1hjS3pmZnBwYWtzZ2ZQMkowTVVFeXBTeFJGcC9WQjhkZnhiK2ZPOFE3SlZPS3JUWC9OUkY3M1VsVTloV1FOVGtNb3hCaFZKMUk3bVdnaHdTbXFaaTJ5UGJaY1ZLeWZwQVZ6SFhLNkE2S0pUSWZEM1lFM2NXZE5sYjNRVVpKMUVXNXdNdDl6Qy96YmZwNjRvajEyQnBWQkY1aXdFUTYyVnc1K3oxTkE1dU1EUTdiWFNNVGxUUHlLeUNENGdiRDBIenNSOTU2R2V0Z2QxY1lFK0JMM1RoWWx1cHl6aVlCLzJpSHRBejVZMk1tMTM1OUZqSWYvUVd6MnF6YmhMU0EzbDRmYUtLUE93MHVkZGE4emFkSHdmYzdwa2V5MHF2NUFLUitSU2Q2ckFxU0YvdVFNMmFWeTNsRUpPNytHRVU3aHFmdExrQlFJTndQS2I2K29lY3ZRL3FZTzJlQjMrQVZZRlVTOE9RWkxtWXk2dGY0Z21neXVJV0ZFN0JLTHRiV1BmU2ptc2ViWUs0RDdRVXNsUHhlVXFzbVpNdU9nWDZpS1hrbGVpNG5COEFJdXJLeklRTGM2L1hxWVA2MlJCSVZlNjFKalJ2ODFYSnZuTzhPRmkwK3RyMGxIeWtp'
    };
    const result = await stripePay({ queryStringParameters }, { awsRequestId: 1 });

    //Assert
    expect(result.body).toBe('null');
    expect(result.headers.location).toContain('https://example.com/success');
    expect(result.statusCode).toBe(301);
});

test('[Stripe Pay]  Payment not done -> 400 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSRHdDL2QvQ1hZUTFlRlZmSmwyWERMR1BsT21WblMrN2JjWFhDVDYveTh4eDREVzRCVkFvNjBWdC9sQWNPM1UwMUVQSW9HS0s1Zk9SWVNOeUNENXlMWHdLR1UvWDhlZHdocEZWNzVYNXR3V3lBSGVPRStJYVJ0amlObDlSeW5WWEwzNFNVelQzc2cyUEJMWFE4R3Y0UUtjZ3h2SFcrQVZWNElMQWZuZSs2eUVkVWtxWDcrYWRDZVpGdzFrQzR6dGpqYm1TamNIWnV6ZEVaczcvZit0SXdjYUdybVhSQ0NUcTJuUWcyc25aUm9vbW1HM2xxSkZMZk1ZMzFEbHNucy9haFIvek1pWm84eHl0T3EwOTZHbGpUSm1JODZDUVNPNU92aUUrbEVzZGN3V3IzNWV4STNaamM5dFpUNWpmc0didzdkYU1hN0VFNkVYVjJpUEZxNUZ1OGlBR1hhd0V6eVVCdnFPQU53Qlk4WGp0eXA2aEMzcC9QdEluZjRFU3lKYnFDYVNVSlJ2YmZKQk00REowTlhvaWtmM2JMYlB4VXNHcnZGM3RNSEw5bW1UWUNOdVFYeFpDT0dxMENUUEIzMk15M0xQK21MVTd2TnJhcjE2RkF6cnpMMHRXb3NOUkRacWczMjRBRkREWThWcVV2RXpiOGtJVkV0VmZKT2xWTGM0U2h5SmkrTnF4S0RuOTZTUTZ6bS9QdTNEUnJYcHlpb25JOEhNM3RaVVNKSmxsVDFyWVNLZUpwN1NFdG92TmtmcFZsNHB3N1dESUhuVWdyQkNxNGpFcmxYbCtCU05BZmxKbzFtenBycDR0L0VKMWZZeDc0K2V6VGZYMjlwam0wZkI0aGdxL25wMGRTcGFPZXdTdUJTc3JZS1hXZ1EwOVd3VXJOMkU5Y3FXcGY4Y0o='
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(400);
});

test('[Stripe Pay]  Payment done for Eatappy -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    const { customerController, paymentsController } = require('../business-logic');

    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    customerController.getCustomerDetails = jest.fn().mockReturnValue({
        id: 63155140,
        clients_fname: 'FirstnameO',
        clients_sname: 'Surname',
        customer_password: '4101bef8794fed986e95dfb54850c68b',
        customers_email: 'prakas@datman.je',
        business_email: 'test@test.com',
        customers_mobile: '07676767676',
        business_phone_number: '0777777777',
        business_name: 'Test takeaway',
        business_number: '46',
        business_street: 'My company street',
        business_city: 'Stoke on Trent 123',
        business_county: 'staffordshire',
        customers_number: '07867550641',
        customers_street: '55',
        customers_city: 'Stoke on Trent',
        customers_county: 'Staffordshire',
        customers_post_code: "ST6'@!$32234 1JQ",
        stripe_sk: 'sk_test_ph6p3YpBCAyQZOqCjaRntMKg008Piprs21',
        stripe_pk: 'pk_test_8L7ouUdD1yQ92FyXEoa1xEHn00WeyjTCoQ',
        stripe_whsec: 'whsec_AVV8m22JO88rgPQzC1mWfdEwFP7Em1P1',
        stripe_acc_id: 'acct_1IU7fX2fg9xCsQAj',
        business_post_code: 'xyz 123',
        currency: 'gbp',
        progress_status: 2,
        account_verification_status: 'VERIFIED',
        refresh_key: null,
        internal_transfer_status: 'ENABLED',
        payment_provider: null,
        customer_type: null,
        stripe_fee_percent: '2',
        stripe_admin_fee: '1',
        country_id: 1,
        fee_last_review_date: '2021-01-22',
        fee_next_review_date: '2021-04-22',
        fee_tier_id: 1,
        signup_link_from: null,
        stripe_acc_type: 'EAT-APPY',
        CountryId: 1
    });

    paymentsController.addPaymentRecord = jest.fn().mockReturnValue({
        dataValues: {
            id: 1
        }
    });
    var stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
    customerController.getStripeCeredentialsDetails = jest.fn().mockReturnValue({
        STRIPE_SK: stripe_cred['eatappy'].sk,
        STRIPE_PK: stripe_cred['eatappy'].pk,
        STRIPE_WH: stripe_cred['eatappy'].wh
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSQ2k3UHl6WDhoWVBNZUppVEd1bDA1bzAwU0EzTzBFclB5UWxXZlRZandkdXR3dGR1NGRZQTg2Vllxa1htb0k4MnNjUE9YamJBVlR0djQ5eFdkWGhpeU0zUjRZb1JaTlpCdTJhOTZtc1ZlMy9ycVQ0N2VXTDBLbHNtbHA3TDdDTGhJdnJFcnVGc0tyUCtRTkNCYXBEeHcrY0xXVW9pWU1GUDF2c3ZxYi82R3AzM3B0b0R2N3ZFLzdSWVJ0azJSN0VoUXZYMko4aXF0UGhBcTE0NGZINzYzUUdpeW9waS84QVdNN0k3OEdDWUlJOEJRdDNPZXVoN3JiUmNSYlR3Sjg3N2xRUWZZdDVpK2VLclFvSndlY1hjS3pmZnBwYWtzZ2ZQMkowTVVFeXBTeFJGcC9WQjhkZnhiK2ZPOFE3SlZPS3JUWC9OUkY3M1VsVTloV1FOVGtNb3hCaFZKMUk3bVdnaHdTbXFaaTJ5UGJaY1ZLeWZwQVZ6SFhLNkE2S0pUSWZEM1lFM2NXZE5sYjNRVVpKMUVXNXdNdDl6Qy96YmZwNjRvajEyQnBWQkY1aXdFUTYyVnc1K3oxTkE1dU1EUTdiWFNNVGxUUHlLeUNENGdiRDBIenNSOTU2R2V0Z2QxY1lFK0JMM1RoWWx1cHl6aVlCLzJpSHRBejVZMk1tMTM1OUZqSWYvUVd6MnF6YmhMU0EzbDRmYUtLUE93MHVkZGE4emFkSHdmYzdwa2V5MHF2NUFLUitSU2Q2ckFxU0YvdVFNMmFWeTNsRUpPNytHRVU3aHFmdExrQlFJTndQS2I2K29lY3ZRL3FZTzJlQjMrQVZZRlVTOE9RWkxtWXk2dGY0Z21neXVJV0ZFN0JLTHRiV1BmU2ptc2ViWUs0RDdRVXNsUHhlVXFzbVpNdU9nWDZpS1hrbGVpNG5COEFJdXJLeklRTGM2L1hxWVA2MlJCSVZlNjFKalJ2ODFYSnZuTzhPRmkwK3RyMGxIeWtp'
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay]  Payment done for non eatappy -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    const { customerController, paymentsController } = require('../business-logic');

    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    customerController.getCustomerDetails = jest.fn().mockReturnValue({
        id: 63155140,
        clients_fname: 'FirstnameO',
        clients_sname: 'Surname',
        customer_password: '4101bef8794fed986e95dfb54850c68b',
        customers_email: 'prakas@datman.je',
        business_email: 'test@test.com',
        customers_mobile: '07676767676',
        business_phone_number: '0777777777',
        business_name: 'Test takeaway',
        business_number: '46',
        business_street: 'My company street',
        business_city: 'Stoke on Trent 123',
        business_county: 'staffordshire',
        customers_number: '07867550641',
        customers_street: '55',
        customers_city: 'Stoke on Trent',
        customers_county: 'Staffordshire',
        customers_post_code: "ST6'@!$32234 1JQ",
        stripe_sk: 'sk_test_ph6p3YpBCAyQZOqCjaRntMKg008Piprs21',
        stripe_pk: 'pk_test_8L7ouUdD1yQ92FyXEoa1xEHn00WeyjTCoQ',
        stripe_whsec: 'whsec_AVV8m22JO88rgPQzC1mWfdEwFP7Em1P1',
        stripe_acc_id: 'acct_1Hj0oIDk9C6aczgq',
        business_post_code: 'xyz 123',
        currency: 'gbp',
        progress_status: 2,
        account_verification_status: 'VERIFIED',
        refresh_key: null,
        internal_transfer_status: 'ENABLED',
        payment_provider: null,
        customer_type: null,
        stripe_fee_percent: '2',
        stripe_admin_fee: '1',
        country_id: 1,
        fee_last_review_date: '2021-01-22',
        fee_next_review_date: '2021-04-22',
        fee_tier_id: 1,
        signup_link_from: null,
        stripe_acc_type: 'DATMAN',
        CountryId: 1
    });

    paymentsController.addPaymentRecord = jest.fn().mockReturnValue({
        dataValues: {
            id: 1
        }
    });
    var stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
    customerController.getStripeCeredentialsDetails = jest.fn().mockReturnValue({
        STRIPE_SK: stripe_cred['datman'].sk,
        STRIPE_PK: stripe_cred['datman'].pk,
        STRIPE_WH: stripe_cred['datman'].wh
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSQ2k3UHl6WDhoWVBNZUppVEd1bDA1bzAwU0EzTzBFclB5UWxXZlRZandkdXR3dGR1NGRZQTg2Vllxa1htb0k4MnNjUE9YamJBVlR0djQ5eFdkWGhpeU0zUjRZb1JaTlpCdTJhOTZtc1ZlMy9ycVQ0N2VXTDBLbHNtbHA3TDdDTGhJdnJFcnVGc0tyUCtRTkNCYXBEeHcrY0xXVW9pWU1GUDF2c3ZxYi82R3AzM3B0b0R2N3ZFLzdSWVJ0azJSN0VoUXZYMko4aXF0UGhBcTE0NGZINzYzUUdpeW9waS84QVdNN0k3OEdDWUlJOEJRdDNPZXVoN3JiUmNSYlR3Sjg3N2xRUWZZdDVpK2VLclFvSndlY1hjS3pmZnBwYWtzZ2ZQMkowTVVFeXBTeFJGcC9WQjhkZnhiK2ZPOFE3SlZPS3JUWC9OUkY3M1VsVTloV1FOVGtNb3hCaFZKMUk3bVdnaHdTbXFaaTJ5UGJaY1ZLeWZwQVZ6SFhLNkE2S0pUSWZEM1lFM2NXZE5sYjNRVVpKMUVXNXdNdDl6Qy96YmZwNjRvajEyQnBWQkY1aXdFUTYyVnc1K3oxTkE1dU1EUTdiWFNNVGxUUHlLeUNENGdiRDBIenNSOTU2R2V0Z2QxY1lFK0JMM1RoWWx1cHl6aVlCLzJpSHRBejVZMk1tMTM1OUZqSWYvUVd6MnF6YmhMU0EzbDRmYUtLUE93MHVkZGE4emFkSHdmYzdwa2V5MHF2NUFLUitSU2Q2ckFxU0YvdVFNMmFWeTNsRUpPNytHRVU3aHFmdExrQlFJTndQS2I2K29lY3ZRL3FZTzJlQjMrQVZZRlVTOE9RWkxtWXk2dGY0Z21neXVJV0ZFN0JLTHRiV1BmU2ptc2ViWUs0RDdRVXNsUHhlVXFzbVpNdU9nWDZpS1hrbGVpNG5COEFJdXJLeklRTGM2L1hxWVA2MlJCSVZlNjFKalJ2ODFYSnZuTzhPRmkwK3RyMGxIeWtp'
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay]  Delivery amount passed as negative for Eatappy Client -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');

    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSRHdDL2QvQ1hZUTFlRlZmSmwyWERMR1BsT21WblMrN2JjWFhDVDYveTh4eDREVzRCVkFvNjBWdC9sQWNPM1UwMUVQSW9HS0s1Zk9SWVNOeUNENXlMWHdLR1UvWDhlZHdocEZWNzVYNXR3V3lBSGVPRStJYVJ0amlObDlSeW5WWEwzNFNVelQzc2cyUEJMWFE4R3Y0UUtjZ3h2SFcrQVZWNElMQWZuZSs2eUVkVWtxWDcrYWRDZVpGdzFrQzR6dGpqZW9JUklKOHU3WUNodnR2SHV1bGVKa3FndjZzNmpORkVHYUNVNW54RlkxZnFWY3oxQ29seFZ4Y1V0ZjIxd2tJeW4vR2h1MGZRUURHbEpJbWlnUWs0TkwvY1lDSmtCODFNZUcwSlhjWWdINEd0Mit1YW53RDVRNkljbGlmVVExWWRSVkFnbGU3d2l4RGgzT05xZ0RMTCt1Z0JtYk9ZWHlCWHVLU29UYXlGS2EzVHduWFBzZWwyMk9vcFZDMS85cGRjTmhWYkYzNlR6KzhvU3c3VWd1SmpNaFVpN2publZGQWJvdm1DSmh3TWZlSytNNDJGWkJZNEhmSUMvN21CaXA5TXhiOW1CdVJIdEVoZENxbytkdXFVaThiL0ppUUEvOVhXRlpPNExld3hzb0pTNlZTUG5kY3k2eUwrUSs1NWNpWFZ2TG5aeUFoZzM0dHZYbmtLd3VqME5HT1lNelE2a2h1VHg0S1RiUWg3UDA1TlZLYkRuRUFvd1Z1ajhUY2VIV0xUNWRZQkc1OGNlMkZXczBZc1FiV08vZFdyZXhzTWd6RllWRnZ5Q3YrUjNSZ2o4QWVDY1NLRzhBZUEzVkZkK05IUTZ4TXZpUTkxU2t5aE1aOG12a1RUZnJ3WnJnalVZZ3Y1ZkFwVnZmL3h6b3MrWUtsODVpL3lmN3M1M25ERHQxdnBRPT=='
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('failed');
    expect(parsedResult.err).toBe('delivery_fee cannot be negative');
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay] Valid Delivery amount passed for Eatappy -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    const { customerController, paymentsController } = require('../business-logic');

    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    customerController.getCustomerDetails = jest.fn().mockReturnValue({
        id: 63155140,
        clients_fname: 'FirstnameO',
        clients_sname: 'Surname',
        customer_password: '4101bef8794fed986e95dfb54850c68b',
        customers_email: 'prakas@datman.je',
        business_email: 'test@test.com',
        customers_mobile: '07676767676',
        business_phone_number: '0777777777',
        business_name: 'Test takeaway',
        business_number: '46',
        business_street: 'My company street',
        business_city: 'Stoke on Trent 123',
        business_county: 'staffordshire',
        customers_number: '07867550641',
        customers_street: '55',
        customers_city: 'Stoke on Trent',
        customers_county: 'Staffordshire',
        customers_post_code: "ST6'@!$32234 1JQ",
        stripe_sk: 'sk_test_ph6p3YpBCAyQZOqCjaRntMKg008Piprs21',
        stripe_pk: 'pk_test_8L7ouUdD1yQ92FyXEoa1xEHn00WeyjTCoQ',
        stripe_whsec: 'whsec_AVV8m22JO88rgPQzC1mWfdEwFP7Em1P1',
        stripe_acc_id: 'acct_1IU7fX2fg9xCsQAj',
        business_post_code: 'xyz 123',
        currency: 'gbp',
        progress_status: 2,
        account_verification_status: 'VERIFIED',
        refresh_key: null,
        internal_transfer_status: 'ENABLED',
        payment_provider: null,
        customer_type: null,
        stripe_fee_percent: '2',
        stripe_admin_fee: '1',
        country_id: 1,
        fee_last_review_date: '2021-01-22',
        fee_next_review_date: '2021-04-22',
        fee_tier_id: 1,
        signup_link_from: null,
        stripe_acc_type: 'EAT-APPY',
        CountryId: 1
    });

    paymentsController.addPaymentRecord = jest.fn().mockReturnValue({
        dataValues: {
            id: 1
        }
    });
    const stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
    customerController.getStripeCeredentialsDetails = jest.fn().mockReturnValue({
        STRIPE_SK: stripe_cred['eatappy'].sk,
        STRIPE_PK: stripe_cred['eatappy'].pk,
        STRIPE_WH: stripe_cred['eatappy'].wh
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'UHBoQ3JmMFEwcnIwZjdrYnBaVmIzMUx3NUFNUExjNlN5by90S2hzQ2pIOFI0UnFxNWhESjZKRFh4MWVGMzJFKzM1V3R5N3pzQzhRT2Fzb0xEU1VDdmU0Uks2SGEySzRjUTBrUTFibytnc0k0S2xsQzQzSXExT3VkOFJGd1NYVi8wNjhCY3Y3OC9vczQ1Y3ZBK0F5UkNiRm03bVZhNDE5RjJlS3lqR25lTm1LcnRyb092VUFCWG9XU3BrSmNNeFYvMjdmS0d6SkJyczY2ZDB3eFFtdVpqRG5JMzRzdDVxdWpGQXdkQ1VTcXZzVjFXY3YybEJDaXRuQVZFRGtXNFRXVk1uVHAwc1YzakhUREI0NDYyeGNOdFJ4dlM3a3N3anVRVDVJdVhwcjNYYWJyRjdhYkp5TFpDc2hIMlhhMHYvSEo5cEkzeDh1Y3FNdzJ2WmovRmUrRWpkRmVmTjFDTnFJZ2VEb3ljMjNzVktYV0V5QXJLUnNYa1phT2lIU0hJT08yaEsycFFFaVY1NVZNMWZqUjZHZVFiVkZHL1V6SENwellLU3hPV25FSE5QNU0yWXRLNFRtMjVnMDFkZWkyWGFRZzJwLytGYXhBeUlhV1BYRnVnQmg3VzNWYThvNGpTUWovMkhvMnFyWVBpM3hSUjI2eGxrbnYxWmdqamVsRitpakZnRmFBcEgwNWcyVWV3RUxLTkdyTUNzOXNDck1ldDZHeDBVeCtNdndaTE0wN1N6ZUJEdkd0MHYyeFNRR2xvVUpjb3huL2xwZ1Q0dWNzMHZzRlJRRndSQmVGbzMwWEdpQS9IVHpGeTFlY3NUMVViSnRUcWtKYk9FU3BqTjhWQ0pzd1pvQ201eU5jcWpXNlk3MnQzK1FaKzIydlBkRmlPOEJxM3BwQ245YW1tNWswbjl6azFxZzZpK29kY0pTODQ2YWgybDBKbmVUaWNnRTlaLzhHYnFSamNVcEVBTjhjQXR3VERpZGpQMHJIMlpkQXNaVWwweXl6QXF2YVNZbmJKU0U5OWJuZ3YrekVFYlBLS2FGa2gycWt5MGpwdXpGaVJUcHQ2Z09vNFMzc0lPa2x3R1FzT1pOendHZnVVZWpxRzlHVw=='
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });

    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay]  Valid Delivery amount passed for non eatappy -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    const { customerController, paymentsController } = require('../business-logic');

    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    customerController.getCustomerDetails = jest.fn().mockReturnValue({
        id: 63155140,
        clients_fname: 'FirstnameO',
        clients_sname: 'Surname',
        customer_password: '4101bef8794fed986e95dfb54850c68b',
        customers_email: 'prakas@datman.je',
        business_email: 'test@test.com',
        customers_mobile: '07676767676',
        business_phone_number: '0777777777',
        business_name: 'Test takeaway',
        business_number: '46',
        business_street: 'My company street',
        business_city: 'Stoke on Trent 123',
        business_county: 'staffordshire',
        customers_number: '07867550641',
        customers_street: '55',
        customers_city: 'Stoke on Trent',
        customers_county: 'Staffordshire',
        customers_post_code: "ST6'@!$32234 1JQ",
        stripe_sk: 'sk_test_ph6p3YpBCAyQZOqCjaRntMKg008Piprs21',
        stripe_pk: 'pk_test_8L7ouUdD1yQ92FyXEoa1xEHn00WeyjTCoQ',
        stripe_whsec: 'whsec_AVV8m22JO88rgPQzC1mWfdEwFP7Em1P1',
        stripe_acc_id: 'acct_1Hj0oIDk9C6aczgq',
        business_post_code: 'xyz 123',
        currency: 'gbp',
        progress_status: 2,
        account_verification_status: 'VERIFIED',
        refresh_key: null,
        internal_transfer_status: 'ENABLED',
        payment_provider: null,
        customer_type: null,
        stripe_fee_percent: '2',
        stripe_admin_fee: '1',
        country_id: 1,
        fee_last_review_date: '2021-01-22',
        fee_next_review_date: '2021-04-22',
        fee_tier_id: 1,
        signup_link_from: null,
        stripe_acc_type: 'DATMAN',
        CountryId: 1
    });

    paymentsController.addPaymentRecord = jest.fn().mockReturnValue({
        dataValues: {
            id: 1
        }
    });
    var stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
    customerController.getStripeCeredentialsDetails = jest.fn().mockReturnValue({
        STRIPE_SK: stripe_cred['datman'].sk,
        STRIPE_PK: stripe_cred['datman'].pk,
        STRIPE_WH: stripe_cred['datman'].wh
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'UHBoQ3JmMFEwcnIwZjdrYnBaVmIzMUx3NUFNUExjNlN5by90S2hzQ2pIOFI0UnFxNWhESjZKRFh4MWVGMzJFKzM1V3R5N3pzQzhRT2Fzb0xEU1VDdmU0Uks2SGEySzRjUTBrUTFibytnc0k0S2xsQzQzSXExT3VkOFJGd1NYVi8wNjhCY3Y3OC9vczQ1Y3ZBK0F5UkNiRm03bVZhNDE5RjJlS3lqR25lTm1LcnRyb092VUFCWG9XU3BrSmNNeFYvMjdmS0d6SkJyczY2ZDB3eFFtdVpqRG5JMzRzdDVxdWpGQXdkQ1VTcXZzVjFXY3YybEJDaXRuQVZFRGtXNFRXVk1uVHAwc1YzakhUREI0NDYyeGNOdFJ4dlM3a3N3anVRVDVJdVhwcjNYYWJyRjdhYkp5TFpDc2hIMlhhMHYvSEo5cEkzeDh1Y3FNdzJ2WmovRmUrRWpkRmVmTjFDTnFJZ2VEb3ljMjNzVktYV0V5QXJLUnNYa1phT2lIU0hJT08yaEsycFFFaVY1NVZNMWZqUjZHZVFiVkZHL1V6SENwellLU3hPV25FSE5QNU0yWXRLNFRtMjVnMDFkZWkyWGFRZzJwLytGYXhBeUlhV1BYRnVnQmg3VzNWYThvNGpTUWovMkhvMnFyWVBpM3hSUjI2eGxrbnYxWmdqamVsRitpakZnRmFBcEgwNWcyVWV3RUxLTkdyTUNzOXNDck1ldDZHeDBVeCtNdndaTE0wN1N6ZUJEdkd0MHYyeFNRR2xvVUpjb3huL2xwZ1Q0dWNzMHZzRlJRRndSQmVGbzMwWEdpQS9IVHpGeTFlY3NUMVViSnRUcWtKYk9FU3BqTjhWQ0pzd1pvQ201eU5jcWpXNlk3MnQzK1FaKzIydlBkRmlPOEJxM3BwQ245YW1tNWswbjl6azFxZzZpK29kY0pTODQ2YWgybDBKbmVUaWNnRTlaLzhHYnFSamNVcEVBTjhjQXR3VERpZGpQMHJIMlpkQXNaVWwweXl6QXF2YVNZbmJKU0U5OWJuZ3YrekVFYlBLS2FGa2gycWt5MGpwdXpGaVJUcHQ2Z09vNFMzc0lPa2x3R1FzT1pOendHZnVVZWpxRzlHVw=='
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    expect(result.statusCode).toBe(200);
});

test('[Stripe Pay]  Delivery amount passed as negative for non eatappy -> 200 is returned', async () => {
    const { stripePay } = require('../functions/stripe-pay-handler');
    const { customerController, paymentsController } = require('../business-logic');

    //Act
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    customerController.getCustomerDetails = jest.fn().mockReturnValue({
        id: 63155140,
        clients_fname: 'FirstnameO',
        clients_sname: 'Surname',
        customer_password: '4101bef8794fed986e95dfb54850c68b',
        customers_email: 'prakas@datman.je',
        business_email: 'test@test.com',
        customers_mobile: '07676767676',
        business_phone_number: '0777777777',
        business_name: 'Test takeaway',
        business_number: '46',
        business_street: 'My company street',
        business_city: 'Stoke on Trent 123',
        business_county: 'staffordshire',
        customers_number: '07867550641',
        customers_street: '55',
        customers_city: 'Stoke on Trent',
        customers_county: 'Staffordshire',
        customers_post_code: "ST6'@!$32234 1JQ",
        stripe_sk: 'sk_test_ph6p3YpBCAyQZOqCjaRntMKg008Piprs21',
        stripe_pk: 'pk_test_8L7ouUdD1yQ92FyXEoa1xEHn00WeyjTCoQ',
        stripe_whsec: 'whsec_AVV8m22JO88rgPQzC1mWfdEwFP7Em1P1',
        stripe_acc_id: 'acct_1Hj0oIDk9C6aczgq',
        business_post_code: 'xyz 123',
        currency: 'gbp',
        progress_status: 2,
        account_verification_status: 'VERIFIED',
        refresh_key: null,
        internal_transfer_status: 'ENABLED',
        payment_provider: null,
        customer_type: null,
        stripe_fee_percent: '2',
        stripe_admin_fee: '1',
        country_id: 1,
        fee_last_review_date: '2021-01-22',
        fee_next_review_date: '2021-04-22',
        fee_tier_id: 1,
        signup_link_from: null,
        stripe_acc_type: 'DATMAN',
        CountryId: 1
    });

    paymentsController.addPaymentRecord = jest.fn().mockReturnValue({
        dataValues: {
            id: 1
        }
    });
    const stripe_cred = JSON.parse(process.env.STRIPE_CREDENTIALS);
    customerController.getStripeCeredentialsDetails = jest.fn().mockReturnValue({
        STRIPE_SK: stripe_cred['datman'].sk,
        STRIPE_PK: stripe_cred['datman'].pk,
        STRIPE_WH: stripe_cred['datman'].wh
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const queryStringParameters = {
        data:
            'TmVHUG15bTQrOFBoUUU2Q2tqcEVSRHdDL2QvQ1hZUTFlRlZmSmwyWERMR1BsT21WblMrN2JjWFhDVDYveTh4eDREVzRCVkFvNjBWdC9sQWNPM1UwMUVQSW9HS0s1Zk9SWVNOeUNENXlMWHdLR1UvWDhlZHdocEZWNzVYNXR3V3lBSGVPRStJYVJ0amlObDlSeW5WWEwzNFNVelQzc2cyUEJMWFE4R3Y0UUtjZ3h2SFcrQVZWNElMQWZuZSs2eUVkVWtxWDcrYWRDZVpGdzFrQzR6dGpqZW9JUklKOHU3WUNodnR2SHV1bGVKa3FndjZzNmpORkVHYUNVNW54RlkxZnFWY3oxQ29seFZ4Y1V0ZjIxd2tJeW4vR2h1MGZRUURHbEpJbWlnUWs0TkwvY1lDSmtCODFNZUcwSlhjWWdINEd0Mit1YW53RDVRNkljbGlmVVExWWRSVkFnbGU3d2l4RGgzT05xZ0RMTCt1Z0JtYk9ZWHlCWHVLU29UYXlGS2EzVHduWFBzZWwyMk9vcFZDMS85cGRjTmhWYkYzNlR6KzhvU3c3VWd1SmpNaFVpN2publZGQWJvdm1DSmh3TWZlSytNNDJGWkJZNEhmSUMvN21CaXA5TXhiOW1CdVJIdEVoZENxbytkdXFVaThiL0ppUUEvOVhXRlpPNExld3hzb0pTNlZTUG5kY3k2eUwrUSs1NWNpWFZ2TG5aeUFoZzM0dHZYbmtLd3VqME5HT1lNelE2a2h1VHg0S1RiUWg3UDA1TlZLYkRuRUFvd1Z1ajhUY2VIV0xUNWRZQkc1OGNlMkZXczBZc1FiV08vZFdyZXhzTWd6RllWRnZ5Q3YrUjNSZ2o4QWVDY1NLRzhBZUEzVkZkK05IUTZ4TXZpUTkxU2t5aE1aOG12a1RUZnJ3WnJnalVZZ3Y1ZkFwVnZmL3h6b3MrWUtsODVpL3lmN3M1M25ERHQxdnBRPT=='
    };
    const result = await stripePay({ queryStringParameters, headers }, { awsRequestId: 1 });
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('failed');
    expect(parsedResult.err).toBe('delivery_fee cannot be negative');
    expect(result.statusCode).toBe(200);
});
