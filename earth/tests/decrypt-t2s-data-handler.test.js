jest.mock('dotenv');
require('dotenv').config();
const {
    CardstreamRequestLogMock,
    PaymentMock,
    SequelizeMock,
    CountryMock,
    CustomerMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamRequestLog: CardstreamRequestLogMock.CardstreamRequestLogMockModel,
            Payment: PaymentMock.PaymentMockModel,
            sequelize: SequelizeMock.sequelize,
            Country: CountryMock.CountryMockModel,
            Customer: CustomerMock.CustomerMockModel,
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

test('[decryptT2SData] empty body is passed -> 500 is returned', async () => {
    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');
    //Act
    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({ data: '' });
    const result = await decryptT2SData({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[decryptT2SData] wrong data/parameter missed  -> 500 is returned', async () => {
    // Assert

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'npWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcVRHdk44M0oxbGp5WWV2bzI2dUlHRkdlR0JDdFFYNkdQWUw4RStRaGtsWlpWbXRFUE15OCtFK29mTythVzdsYzVZUEFmbnRDb2x4ckpiaENBR3F0SkFneVJBVnRyMEdQb3NTT0M0NEE4N1ZrOEVDK2wxM2YxSDZGMndDejRnZjBJbHJ2T1VDQ1BNWm1JdnU2aGFMWVdrWm1vNzQwL3VxYVdETUN2bnFUODh0ekk1bEd6ZzlSaDhPWjlGS204alNYNEM5Zzh6R0g2YVYyN1UvSHo4REZUZWExK2ZqSnk1QXc4OWtQclkyK0NQZWdzZ2pQZHQ1RFg3Tmh1c1pmUVdIVFl1OGF3MzJvNk43MldJbm4weGgyb2toeTY5QjdoQjRIQVhmR1RhdjRYUDBhUmdDYlZqMllzaVlnYVEwSVVIMUQyZnRyNldlT090Mm8yYkh5a3p4b1pBS2dKQ0NXVm0yaUU2WFkvVkdCY3prS3pQYktMMjROQm5CdHRraEZxVksyOTBUUW04TUFicVV0MzdPaXFmQ0FtdENyZUh3S01ERkdEcFlMOU9mN21vZjFFYW9tR3JwTkM5YnBKZGJrVHJJbWEvcXdOL3ZFNkhMSXI3TitTaEdmdk9UK3F1VXAvVVhKUmFUNmRZZlRRT2tYREl5TVNDaXV0ZVJuWlJWUDJYUjQyR0dhOFg0b0lZQ000eVJGSy9lMDd5az0='
    });
    const context = { awsRequestId: '1' };
    const result = await decryptT2SData({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[decryptT2SData]  Payment already done -> 500 is returned', async () => {
    // Assert

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM0ZwMUlnOXZ5REYyT2xOS012dmUxRlgvNmhwQXJpRmRWNzVOa1krK0dhamNBeEt2emZxSWZCWXhGMGU2NXZGT010ayticXdJb1IyRkdHZ3djMWErSzJxSExac0RzRE41OEs1LzB0OUNtc0xYbFhYZjV2OW1nWDJLK2FoYUpOMVBzblJpeldUZGNwZEFreFR1Q0dtMER4bEUrWDFIb2FDRkhBM2lvNHBGdDdFNVlHWm9uZ1hyVk92eEFOeHBSYlJKRFlhUHhMTjFmM2lvSHFzd2NCZGdYUVIzSTB3Mi9ibDlrbG85M0ljSXYrWUlhUmZnNGxsTTQvRTBUM1cxSmhLaTRTMm5ZY3JEd0JWTmhHbnNWcDI1bmRMODVqOEZJZXczNHhydlZ0RmFwUVFNNVRyTm5DMGkzUUwvcVZ0TzVHRjRzSldXcnpkUnMrZDBPN3F6bmVndUNaZDlwWW1INFNkeXRCWXNUZy9WNU5SckJaTzhJRWw3cW5BbW5aMG8rL0pHWmQzL2RYUVJkVGJNU2Vub2gwN2tML293c3JDNmVubGR3WDNIZktueDJIbGMwZFRoRFFrbWxNTkZGUlFQSTF3TmpHY0YzZDdDcnl5UFVOcm9oYmFINy9BPT0='
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await decryptT2SData({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.error.message).toBe('Payment already done');
    expect(result.statusCode).toBe(500);
});

test('[decryptT2SData] valid data is passed -> 200 is returned', async () => {
    // Assert

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUktkYWVDakY4TFhqaHF1NlZGOEdBeGt2RlVJNnJRcUZlMnl2L0xGeXM4elJPR3BzZWVCYzZydkVWbi92WDRiRXJEa3ZVeEhJSFBkdGZudTJOMzRnTkhRVno4N0NDaG9yTzFPY1V1aVlOV3FiODB6Yy9ZRnBGYW1lOFhEUkVZVzVtZFdxZGZEUktUVy9xMmZSb002U1pFM3JNRzVLVTJBckVBTkFJT2xmbnZoS0lrVHVCaGZYZWpGZkV3ZlBKTDNzSk45STRMbnY4NEgyd2prdEN2aXZqNE5hVEtHbFZOaXliYWcwbVIxOXJmRDRqMk93ZlJXSEVMajhwUnhPVWpITDQ2S0V5U1VkNklDWEc4R3JUbDVKdFZYYjlLMy9NREJuRFR6UFZPS2ZLZDRpMHUrUlhJMkZpUCttQVJ5OWEvTW94NkNsbW80Um15bkQwVVRWWDhMSWo2RnJJUUwycDViODNRUXFqMUUyTEZKQTUyeW9vR0VhYjFQZVB6NnFxN0thYk9tVkdpQTludnFOMlRkN3NqZHVLU0N3LytrWDcxNm1EdFN0djlJZEh1SEYvL0NXNmE1RUxCSkNYRG81Tjl2eHp3NlU2VDVlamdadTBRTXRjV0JHeWM3czcrS3J1Ry9IcGVOaWJyTlZrSkk5RFN1Mm9pS2RCSjBJb2NCY0tRSW5XNzhsaVRiZGVpSmNCQSt2ZFZWSmJMbFZyUy9IMEhUU25hcjlMZWVnTStkMHV5cXg0L0QyUGF3Z3ZVRGZ3WlQ3eW5lbjI0Tm1peUp1am5EZHg1VitGb3JpTmJsc09sa1paMTNPa3YxWTFEajJ3PT0='
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await decryptT2SData({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult.message).toBe('Decrypted Data');
    expect(parsedResult.data.host).toBe('pit-1.t2scdn.com');
    expect(result.statusCode).toBe(200);
});

test('[decryptT2SData] valid data is passed -> db_total is set to true in payload T2S DB is called -failed to connect -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eittaytndVcxbTNWYnVIaWtuMnpXSk43Z1p1bXNsalc2djM3UkZ1dEtuaDNvPQ=='
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await decryptT2SData({ body: payload, headers }, context);
    expect(result.statusCode).toBe(500);
});

test('[decryptT2SData] valid data is passed -> along with cc_token in T2S payload -> 200 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eittaytndVcxbTNWYnVIaWtuMnpXSk53Q0Y4UVpKMEtqQVI5V3lnWnVUM3dVM3QzOE0xQnFqbWJXRm5MTWZ2R0VScTM3ajRtWUc0dHU5dmowYUVSRDhtOG8yQTZsbkI2amRMcWJZU0tSeTFYND0='
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await decryptT2SData({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.message).toBe('Decrypted Data');
    expect(result.statusCode).toBe(200);
});

test('[decryptT2SData] Invalid decryption data is passed  -> 500 is returned', async () => {
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });

    const { decryptT2SData } = require('../functions/decrypt-t2s-data-handler');
    const headers = {
        'CF-Connecting-IP': '127.0.0.1'
    };
    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOEtqQmp4RVllZmhEbGEyWmc3YjBJcWYvb0E0MGlabDVpS0hIMmRtQm9sUkxkR1JFYUEwNVdCWDdyYkFGamovWXZzSDVkY3MwVUxZZjBRUGlodXRudjZSai90azJ3cjRPbjcxbmlGcFlNWVFHUDdzUUVLR0NMVGVqZ1AvQlJJdVBmdjNpM0d2dmx0SURWU1o4dGExRXVaNkZjREo4a29sMzdTd2QxTnZEczdGOUdEZG5iN2E4VDdDekdtbEh0RUtsTk1CNTVCK1NqNTA1VDBsN2JjU1cwOTMwWWw2cDNSVkZabGdIZEd2ZHFUdU9sTDcrZ1YweGtjMWJHQ3hLQkV6UzZVTWo2T0xBN2d1dFY0TkkyY00raXhaQzJWdksvakxwemdGU0l5eFB3WGdiL3FvWlRPdDRURFJiQTdJQ0hkSGoybjI0UGRvNVU2Skt4UlNlMjdJN1Exa1JwNG1Ycnlhb2RJNy9hM2lNYkFqN3RsREs5RERHbDZmTjd5QUJ6NlNBRURQNEFMTVMzZW5HTUlxZXkrMVZoOXB5K2VQVWRtd1NUQjliVGRpMzdqaER1ZXFSS1hTcHJlaVc3ZjFBSW93S1EyQVUwcnJoc2Y1azloZ29hSnFxN2UxbUhSbkkvNTQ5MjB5WGpRZmUzRnFHWTNIZzNBS3ZaUjN5eXVsSk91RzdXUFBOQ0NUN0Vya0ZuMjM3STdkVis1SzJjalVpYXN5Z3dOREJvdnBNTHJpVkFja3dLZlp3Q1lrK1pWZyt4R3BqNUJlK2Y1ckxVNTBINVVSTEViTURCK3A5Q2pVUTVXM2dINVdRVFB3OU1kVzJkbUdROGlJaDVjdnFvWU9Ud1I1eittaytndVcxbTNWYnVIaWtuMnpXSk53Q0Y4UVpKMEtqQVI5V3lnWnVUM3dVM3QzOE0xQnFqbWJXRm5MTWZ2R0VScTM3ajRtWUc0dHU5dmowYUVSRDhtOG8yQTZsbkI2amRMcWJZU0tSeTFYND0='
    });
    const context = { awsRequestId: '1' };
    //Assert
    const result = await decryptT2SData({ body: payload, headers }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toHaveProperty('error');
    expect(result.statusCode).toBe(500);
});
afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
    PaymentMock.resetPaymentOptions();
    CountryMock.resetCountryOptions();
});
