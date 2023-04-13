jest.mock('dotenv');
require('dotenv').config();
const {
    CardstreamRequestLogMock,
    WebhookLogMock,
    SequelizeMock,
    CardstreamSettingsMock,
    PaymentMock,
    CardstreamTokenLogMock,
    CardStreamResponseMock,
    CountryMock,
    CustomerMock,
    TiersMock,
    RiskCheckResponseMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamRequestLog: CardstreamRequestLogMock.CardstreamRequestLogMockModel,
            WebhookLog: WebhookLogMock.WebhookLogModel,
            Payment: PaymentMock.PaymentMockModel,
            CardstreamSettings: CardstreamSettingsMock.CardstreamSettingsModel,
            CardstreamTokenLog: CardstreamTokenLogMock.CardstreamTokenLogMockModel,
            CardStreamResponse: CardStreamResponseMock.CardStreamResponseMockModel,
            Country: CountryMock.CountryMockModel,
            Customer: CustomerMock.CustomerMockModel,
            Tier: TiersMock.TierMockModel,
            RiskCheckResponse: RiskCheckResponseMock.RiskCheckResponseMockModel,
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

test('[createSale] empty body is passed -> 500 is returned', async () => {
    const { createSale } = require('../functions/create-sale-handler');
    //Act
    const payload = JSON.stringify({ session_id: '1' });
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[createSale] wrong data/parameter missed  -> 500 is returned', async () => {
    // Assert

    const { createSale } = require('../functions/create-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcVRHdk44M0oxbGp5WWV2bzI2dUlHRkdlR0JDdFFYNkdQWUw4RStRaGtsWlpWbXRFUE15OCtFK29mTythVzdsYzVlaEtvcWpsVUpwbFhNU2RiRGpOWm5RYnpNdkpMVStPME42a0dmZzRUcnp6VEJmR3Z1c2lIc1NlSjVUbHE2bUpwVE91OVFDUUk5bk5Md040S0JsQnRuempXK29Rb3V0Z00wY2RaWmFZZkxiNXFOYUJ0eFhvYnd2dWlxOU44cDBrN253d25LSXMvMEpmUDBHdjZYZlBnSlVuZFJkbWhhMXR1ZTFaNERKeFg4aCtGVklSN3dwMnhibnBXRTRtYnNLTXJZWUhXenZPOGxMbmpDZTQ1clFxcXBySXVWeVdiVnBwUUxKYWVyekU3QmNzSzJYWVdNM1JDY3VQT3NkWmdrT082K0ZHdHZvSUVSQ1M1RWZVTDNWNFpMUi9HQ0dFRnlDd1ByZC9ScWRIQ1hmVklnZWNvZ0g1M2QvOEp4Mm52VlRjejlNQTFpektjYklhaDQ4WUxITVlpUTZHQzJHK2x5NkRhS21LWnl1ZXdSTGlZYytXUElwY2dBbjZyd2ZENU0ydnpOOC9ObHc4Y01KejhwVkNOMS8rWC9xT0pVYjR3c0xERW5CWlg0MWplSlIwWW1Bd1BmWjdlR0ZmYk8zOFg2bEdLa1g5WXNNKzZwNXlxeWtjbmpMcnZEcXZBZC8xMlQxVnU5Sy9ZNjlHMjEvdQ==',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    const result = await createSale(payload, context);

    //Assert

    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed and Payment already done -> 500 is returned', async () => {
    // Assert

    const { createSale } = require('../functions/create-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM0ZwMUlnOXZ5REYyT2xOS012dmUxRlgvNmhwQXJpRmRWNzVOa1krK0dhamNUdVMrZmlUK3ZHUWxmZHhaenRyaDJ6ZjJ1b1YrVWEwK3BZcXg3cnNka1BNZ0ZJT04vbGRMdE9HK3AwNlV2dDF3S3RlZ2x0MVFoUE4xY2s5TUU2bUVaMUttNmVydEVVL2FINjdDRjNwcEJUYkNVN3NPQmplaW4vT1hXZjQ4aEIwdm0vVU1tckZ5TTk2RS94M3U2SUpYTXRKM3FFS1hOdTg0Y2p3b3pBODQ3cjdGVEZoc1ZZYkV1NlFmNnZKOVd0Z1lza3BjUXZKMHRZdnhVRzhBTm14UGxpZi82RVZUZ1pmMS9EVUs5OE5LRHExZFhuNzlIVFdVNmp4WTRIelh3bkRpSVI1QlY1ZHE0bDBQVnNXL1I0cnN3OElzOUxadzZ3N3FQdGtHSHJSTnNZUjI5TThuUW02ZVVQY0VWVXhENDFRTlNnaG16cy9wUmh3T3BUMHFyRFZNbkpiNzJJRUEwV3FRUWxXVjk1QmNiL2hyT3E0Z2xka0lydTArcENjbGxPUFZoMDJjUk9UQTljeHB6b3g3MnlZL0Z3UmIzN3VnSU5JT0VRelhPbzV1TEFBPT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Assert
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toBe('Payment already done');
    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed for 3D sale  -> 201 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65802 // responseCode for 3d transaction
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('threeDSreq');
    expect(parsedResult.data.success).toBe('3d');
    expect(result.statusCode).toBe(201);
});

test('[createSale] valid data is passed for Non-3D sale  -> 200 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    var AWSMock = require('aws-sdk-mock');
    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));

    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0 // responseCode 0 is for non- 3d transaction
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });
    //Assert
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);
    console.log('Parsed REsult', parsedResult);
    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data.success).toBe('ok');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('redirectUrl');
    expect(result.statusCode).toBe(200);
});

test('[createSale] valid data is passed Cardstream error happen  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65800 // other than 0 - somthing wrong with cardstream api r
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed with invalid card details  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '492942123460082144',
        cvv: '334',
        exp_month: '12',
        exp_year: '19',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = { awsRequestId: '1' };
    const result = await createSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult.errorResponse.error.message).toBe('Invalid Card');
    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed Cardstream(VCS) error happen  -> 500 is returned with 05 response message', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // other than 0 - somthing wrong with cardstream api r
                    vcsResponseCode: 5,
                    riskCheck: 'approve'
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = JSON.stringify({ awsRequestId: '1' });
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toBe('Transaction failed: Card declined-5');
    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed for Non-3D sale -> session ID not passed  -> 200 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    var AWSMock = require('aws-sdk-mock');
    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));

    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0 // responseCode 0 is for non- 3d transaction
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        save_card: true,
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data.success).toBe('ok');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('redirectUrl');
    expect(result.statusCode).toBe(200);
});

test('[createSale] valid data is passed for Non-3D sale -> Doesn not opt for save card   -> 200 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    var AWSMock = require('aws-sdk-mock');
    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));

    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0 // responseCode 0 is for non- 3d transaction
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        save_card: false,
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data.success).toBe('ok');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('redirectUrl');
    expect(result.statusCode).toBe(200);
});

test('[createSale] valid data is passed for Non-3D sale -> db_total is set to true in payload T2S DB is called -failed to connect -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eittaytndVcxbTNWYnVIaWtuMnpXSk43Z1p1bXNsalc2djM3UkZ1dEtuaDNvPQ==',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        save_card: false,
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createSale({ body: payload, headers }, context);

    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed Cardstream(riskCheck) error happen  -> 500 is returned with 05 response message', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // other than 0 - somthing wrong with cardstream api r
                    riskCheck: 'decline'
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = JSON.stringify({ awsRequestId: '1' });
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toBe('Transaction failed: Card declined-5');
    expect(result.statusCode).toBe(500);
});

test('[createSale] valid data is passed Cardstream failed error happen  -> 500 is returned with 05 response message', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65563, // other than 0 - somthing wrong with cardstream api r
                    riskCheck: 'approve'
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eit0cFlreithV29EWFMyRXQrK0JMM2Z3PT0=',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = JSON.stringify({ awsRequestId: '1' });
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createSale] application failed error happen  -> 500 is returned ', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65563, // other than 0 - somthing wrong with cardstream api r
                    riskCheck: 'approve'
                };
            }
        };
    });

    const { createSale } = require('../functions/create-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4YWhzRVlYOGN6bWYyVGI4TERkUWdVSXBOQVFhQTdSVXhYeVJBUHpLVjcvTlBzZm04S2tKU0J4STRhanoxbUJMdktmYXROSFovckYyMEdxMVhVYWlvNVRiZWx4UXhBcTJNR0UwdGZQL2VMUkk0eTV1clU3aWM0dG9jYnd5M2lDR1drMENtTW9vVHJpUFgzMGRrSlJwekRhZHZOaU5DcjJnUmNQVVFqWExyVDB2N2NzNGhhckU0eUIxRTFNVXF1eUVxT2F4R21xU2tzVThia2huQXVIaUl0ZzBTa0hsV0FFOEFpOUpwQ3Y4WWpVUDZOYUhHVGZVVGVxaGNOdHZ4a2g0VnFHa3l6K2Z5ZnoyZVR3bkxVejdvNXhGOU9jcmVjazl1ckJSTll5SzJIMGhGNFQ4c3lEZTVqNTRta2NEcy9KK1hQSW5pK3hIU0xwRitYT3JFK0txaFFFU0l3aWRES3pDa3k3ZnhWTVdjdFp6SVhNRkVMSkhtb1RRME5nanFNOFJCVHpyZWk5WVNjeDBRZnhwWlhicjFEQ1R1SU5RNmZsRDhhb1NXNlU1ek5rNmNlQStHYTNmWlJ0Z1Jnd2JKeDVMd3I5R2ZmdGxNdFNZQ245SC8zMWJONmpScXZIeXFyRmEvT0lUUTJKdVNaTzBNZ3hiVGx6dzY0UWNJTDRZT1hZNm5GTWoyN1JXbHNLQUMrNGRBZFF0Q2sxck5wWGozWkF6WTJvQmZWRTFzUHZBZ1NqREUvUzJEdTdZUjZZQ2xNSWErTkRKN2krcHBsTXFTaDNaR1UvRWpQSXhvUWt3ZDg0d3lDdU1Qck83U3VvS09OV1MxbkQveU9EZlFLa1E5Ulh6b3VxUk5OZFp3ZEdIVEVFbXU1aHlEN1hCVkxIcHRjc0R3emhjR2dLVlY3akJCbEl2MFMxVGFKb2cvdndocG9rYkN2Z1JZRXcxdjlvZUQ2OG1wYWEzS244QW9FVUpFQWVnMTVQY213bG5jM2JHV1RIUlJKZnVQbUR6TTBxN0UvNEtjb3RNZEQ3SEFjbXV3SGQ2aEtMdk1FOQ==',
        card_number: '4929421234600821',
        cvv: '334',
        exp_month: '12',
        exp_year: '23',
        session_id: '1',
        save_card: true,
        base64Data: 'abcd'
    });

    //Assert
    const context = JSON.stringify({ awsRequestId: '1' });
    const result = await createSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Intentionally crashed the application');
    expect(result.statusCode).toBe(500);
});

afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
    WebhookLogMock.resetWebhookOptions();
    PaymentMock.resetPaymentOptions();
    CardstreamSettingsMock.resetCardstreamSettingsOptions();
    CardstreamTokenLogMock.resetCardstreamTokenLogOptions();
    CountryMock.resetCountryOptions();
    CustomerMock.resetCustomerOptions();
});
