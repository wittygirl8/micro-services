jest.mock('dotenv');
require('dotenv').config();
const {
    CardstreamRequestLogMock,
    WebhookLogMock,
    SequelizeMock,
    PaymentMock,
    CardstreamSettingsMock,
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
            sequelize: SequelizeMock.sequelize,
            CardStreamResponse: CardStreamResponseMock.CardStreamResponseMockModel,
            Country: CountryMock.CountryMockModel,
            Customer: CustomerMock.CustomerMockModel,
            Tier: TiersMock.TierMockModel,
            RiskCheckResponse: RiskCheckResponseMock.RiskCheckResponseMockModel,
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

test('[createTokenSale] empty body is passed -> 500 is returned', async () => {
    const { createTokenSale } = require('../functions/create-token-sale-handler');
    //Act
    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({ data: '' });
    const result = await createTokenSale({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] wrong data/parameter missed  -> 500 is returned', async () => {
    // Assert

    const { createTokenSale } = require('../functions/create-token-sale-handler');

    //Act
    const payload = JSON.stringify({
        data: 'hgjggfgfggf=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '233',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    const result = await createTokenSale({ body: payload }, context);
    //Assert

    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed and Payment already done -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });

    // Assert

    const { createTokenSale } = require('../functions/create-token-sale-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM0ZwMUlnOXZ5REYyT2xOS012dmUxRlgvNmhwQXJpRmRWNzVOa1krK0dhamNBeEt2emZxSWZCWXhGMGU2NXZGT010ayticXdJb1IyRkdHZ3djMWErSzJxSExac0RzRE41OEs1LzB0OUNtc0xYbFhYZjV2OW1nWDJLK2FoYUpOMVBzblJpeldUZGNwZEFreFR1Q0dtMER4bEUrWDFIb2FDRkhBM2lvNHBGdDdFNVlHWm9uZ1hyVk92eEFOeHBSYlJKRFlhUHhMTjFmM2lvSHFzd2NCZGdYUVIzSTB3Mi9ibDlrbG85M0ljSXYrWUlhUmZnNGxsTTQvRTBUM1cxSmhLaTRTMm5ZY3JEd0JWTmhHbnNWcDI1bmRMODVqOEZJZXczNHhydlZ0RmFwUVFNNVRyTm5DMGkzUUwvcVZ0TzVHRjRzSldXcnpkUnMrZDBPN3F6bmVndUNaZDlwWW1INFNkeXRCWXNUZy9WNU5SckJaTzhJRWw3cW5BbW5aMG8rL0pHWmQzL2RYUVJkVGJNU2Vub2gwN2tML293c3JDNmVubGR3WDNIZktueDJIbGMwZFRoRFFrbWxNTkZGUlFQSTF3TmpHY0YzZDdDcnl5UFVOcm9oYmFINy9BPT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.errorResponse.error.message).toBe('Payment already done');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed for 3D token sale  -> 201 is returned', async () => {
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

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('threeDSreq');
    expect(parsedResult.data.success).toBe('3d');
    expect(result.statusCode).toBe(201);
});

test('[createTokenSale] valid data is passed for Non-3D sale  -> 200 is returned', async () => {
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

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.message).toBe('The request was processed successfully');
    expect(parsedResult.data.success).toBe('ok');
    expect(parsedResult.data).toHaveProperty('success');
    expect(parsedResult.data).toHaveProperty('redirectUrl');
    expect(result.statusCode).toBe(200);
});

test('[createTokenSale] valid data is passed Cardstream error happen  -> 500 is returned', async () => {
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

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed with invalid cvv details  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '2033',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);

    const parsedResult = JSON.parse(result.body);
    //Assert
    expect(parsedResult.errorResponse.error.message).toBe('Invalid CVV number');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed Cardstream riskCheck failed  error happen  -> 500 is returned', async () => {
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

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed Cardstream failed error happen  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65800, // other than 0 - somthing wrong with cardstream api r
                    riskCheck: 'approve'
                };
            }
        };
    });

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] valid data is passed Cardstream(VCS) error happen  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // other than 0 - somthing wrong with cardstream api r
                    vcsResponseCode: 5
                };
            }
        };
    });

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0=',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Transaction failed');
    expect(result.statusCode).toBe(500);
});

test('[createTokenSale] application failure error happen  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    // Assert
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // other than 0 - somthing wrong with cardstream api r
                    vcsResponseCode: 5
                };
            }
        };
    });

    const { createTokenSale } = require('../functions/create-token-sale-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4YWhzRVlYOGN6bWYyVGI4TERkUWdVSXBOQVFhQTdSVXhYeVJBUHpLVjcvTlBzZm04S2tKU0J4STRhanoxbUJMdktmYXROSFovckYyMEdxMVhVYWlvNVRiZWx4UXhBcTJNR0UwdGZQL2VMUkk0eTV1clU3aWM0dG9jYnd5M2lDR1drMENtTW9vVHJpUFgzMGRrSlJwekRhZHZOaU5DcjJnUmNQVVFqWExyVDB2N2NzNGhhckU0eUIxRTFNVXF1eUVxT2F4R21xU2tzVThia2huQXVIaUl0ZzBTa0hsV0FFOEFpOUpwQ3Y4WWpVUDZOYUhHVGZVVGVxaGNOdHZ4a2g0VnFHa3l6K2Z5ZnoyZVR3bkxVejdvNXhGOU9jcmVjazl1ckJSTll5SzJIMGhGNFQ4c3lEZTVqNTRta2NEcy9KK1hQSW5pK3hIU0xwRitYT3JFK0txaFFFU0l3aWRES3pDa3k3ZnhWTVdjdFp6SVhNRkVMSkhtb1RRME5nanFNOFJCVHpyZWk5WVNjeDBRZnhwWlhicjFEQ1R1SU5RNmZsRDhhb1NXNlU1ek5rNmNlQStHYTNmWlJ0Z1Jnd2JKeDVMd3I5R2ZmdGxNdFNZQ245SC8zMWJONmpScXZIeXFyRmEvT0lUUTJKdVNaTzBNZ3hiVGx6dzY0UWNJTDRZT1hZNm5GTWoyN1JXbHNLQUMrNGRBZFF0Q2sxck5wWGozWkF6WTJvQmZWRTFzUHZBZ1NqREUvUzJEdTdZUjZZQ2xNSWErTkRKN2krcHBsTXFTaDNaR1UvRWpQSXhvUWt3ZDg0d3lDdU1Qck83U3VvS09OV1MxbkQveU9EZlFLa1E5Ulh6b3VxUk5OZFp3ZEdIVEVFbXU1aHlEN1hCVkxIcHRjc0R3emhjR2dLVlY3akJCbEl2MFMxVGFKb2cvdndocG9rYkN2Z1JZRXcxdjlvZUQ2OG1wYWEzS244QW9FVUpFQWVnMTVQY213bG5jM2JHV1RIUlJKZnVQbUR6TTBxN0UvNEtjb3RNZEQ3SEFjbXV3SGQ2aEtMdk1FOQ==',
        card_token: '20072815FY41MC21MD20KQB',
        session_id: '1',
        cvv: '203',
        base64Data: 'abcd'
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await createTokenSale({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain('Intentionally crashed the application');
    expect(result.statusCode).toBe(500);
});

afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
    PaymentMock.resetPaymentOptions();
    CardstreamSettingsMock.resetCardstreamSettingsOptions();
    WebhookLogMock.resetWebhookOptions();
    CountryMock.resetCountryOptions();
    CustomerMock.resetCustomerOptions();
});
