jest.mock('dotenv');
require('dotenv').config();
const { CardstreamRequestLogMock, SequelizeMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamRequestLog: CardstreamRequestLogMock.CardstreamRequestLogMockModel,
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

test('[Cancel Payment] empty body is passed -> 500 is returned', async () => {
    const { pay } = require('../functions/cancel-payment-handler');
    //Act
    const payload = JSON.stringify({ data: '' });
    const context = { awsRequestId: '1' };
    const result = await pay({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[Cancel Payment] wrong data/parameter missed  -> 500 is returned', async () => {
    // Assert

    const { pay } = require('../functions/cancel-payment-handler');

    //Act
    const payload = JSON.stringify({
        data:
            'NnpWTG5zQVpNdJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOFo4OW1kOGJaZnZCakFpbjcwTEdTUFFmM00rdVd2NDlyS01rNjdtTHFnR24wZHZaQnptTkhHMXdZZFJONnM4YjZrS1ZIcER4NXYvTUlMUXRnWjRheldTM2pHZGRQRCtZTVpZNkhCcTJVODJtYlZrVExNbHJwTGxIMzcxQ2dUY1JIN3NxT3ZIbVRaSHFyeXNMeDc1TFpINnp4RGdtTTBLK2pyTzBGa0sxVGJJcUtLT0R2RUdXUDRBWEhRNFVvNWg1Vk9EN3BzT3BDRDdINVBLbXd6S1BVMUM2aUJQMGJ5dkhaaGsrSkczN3F6c1ZtY05mOEM1aWVsWG44WS9GQk1MWDE0Z0srVkdFSmI2RjhYRVNuU1ZUcjd0NjZMVnljejE1a1lZMSs0dHVuYU9DdDl0WU1WRGxzL0dFUTRJUHZSK0pMRy9SSCs0YnhtaVdIbTBzc1JTWStmSWViTm01TG9wY1JpWTFFNjZrblAvOWZwMlNxTVhWbkVLZzVsQW14bTliamVleHVhU2pGK2Y2OGdQSjh0elB3bXhsU2pNekcyZzhLSU9BTnVBaG9sdFdMMUw1MHdMbHdVUU9Yb0JUR09nbUNUSUZmc0QzZUc0MFRydS9nbk8rU3dya0FIUnFXTFpJV3NoL3RSalpMMUFkSnhrSElValdHdGpORkE4K3dPQnVydnRTRHRUbzhjb0phS3RyL05Ia2FaYkJKMyswRFNnbXZLY244Ty9tYm5od3k2dlpZMXVKOHMrc2dtRXh0Q2NVTQ=='
    });
    const context = { awsRequestId: '1' };
    const result = await pay({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[Cancel Payment] mandate payload webhook url is not passed  -> 500 is returned', async () => {
    // Assert

    const { pay } = require('../functions/cancel-payment-handler');

    //Act
    const payload = JSON.stringify({
        error_message: 'Transaction failed',
        data:
            'NnpWTG5zQVpNdHV2dVFJbFozck8rbUI0azJPRFVwcWtpclViWDc3Njd1ZHRMZGkxeWc4SktWV1lBV2N4L0pKOFo4OW1kOGJaZnZCakFpbjcwTEdTUFFmM00rdVd2NDlyS01rNjdtTHFnR24wZHZaQnptTkhHMXdZZFJONnM4YjZrS1ZIcER4NXYvTUlMUXRnWjRheldTM2pHZGRQRCtZTVpZNkhCcTJVODJtYlZrVExNbHJwTGxIMzcxQ2dUY1JIN3NxT3ZIbVRaSHFyeXNMeDc1TFpINnp4RGdtTTBLK2pyTzBGa0sxVGJJcUtLT0R2RUdXUDRBWEhRNFVvNWg1Vk9EN3BzT3BDRDdINVBLbXd6S1BVMUM2aUJQMGJ5dkhaaGsrSkczN3F6c1ZtY05mOEM1aWVsWG44WS9GQk1MWDE0Z0srVkdFSmI2RjhYRVNuU1ZUcjd0NjZMVnljejE1a1lZMSs0dHVuYU9DdDl0WU1WRGxzL0dFUTRJUHZSK0pMRy9SSCs0YnhtaVdIbTBzc1JTWStmSWViTm01TG9wY1JpWTFFNjZrblAvOWZwMlNxTVhWbkVLZzVsQW14bTliamVleHVhU2pGK2Y2OGdQSjh0elB3bXhsU2pNekcyZzhLSU9BTnVBaG9sdFdMMUw1MHdMbHdVUU9Yb0JUR09nbUNUSUZmc0QzZUc0MFRydS9nbk8rU3dya0FIUnFXTFpJV3NoL3RSalpMMUFkSnhrSElValdHdGpORkE4K3dPQnVydnRTRHRUbzhjb0phS3RyL05Ia2FaYkJKMyswRFNnbXZLY244Ty9tYm5od3k2dlpZMXVKOHMrc2dtRXh0Q2NVTQ=='
    });

    //Assert
    const context = { awsRequestId: '1' };
    const result = await pay({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain(`"webhook_url" is required`);
    expect(result.statusCode).toBe(500);
});

test('[Cancel Payment] mandate payload redirect url is not passed  -> 500 is returned', async () => {
    // Assert

    const { pay } = require('../functions/cancel-payment-handler');

    //Act
    const payload = JSON.stringify({
        error_message: 'Transaction failed',
        data:
            'UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4YkRGUVBGRUFYRmQ3c2NWTmI3bTgrZU5CUEl1ZnhLU2IybkNmd0N2KzVQeElHeDUrREtYUmU0S1dWem9ua1U1MVloaWF0WXBxbkd5cUF2TUpDeTdobW9LN1hFMUFuMXZmTVdXMG1KdDdiQWNGZE9mWHlYRmJDNVM0ajJuRDlnay9xRlA0SnZjczlFMHBBYWpXSTJOREZJc2djQUtpVjcrandDM2RaeFpFNmRCU0dXYmM3bHpQWmlLUk5wT2lRYTVrRVFHMG9zdVYvMk5BYlp4a2ZmRzBTUFBhSGxzN1dMZlNhRkcwV2VPSzlFRUFUTElmOUtqcktXdUxZOVNBeE02Z3V3bE96RTZnUEhnalp4a1BrOEdWVFMrRkJ6M1Ztak9OSG9YNHErNXdGZ0tVTzlBcGlCVkZuMjVoREp5V1F3OGNBMVNLaml1K28veGQxaHNtTGNLNXp2OUhaQ3FHc0Z1RDJXbmNoVkVqb3pCY3BTbjFmRFB6aGE2cUpIS3d0eGxCK0NhSkZQZktHby9zVGtUMW14cTVMV2g4QjFHTGlNMkxvVmZLWGNpTWlReDJoNHRseHFYczZITGorbGlGNjczeldzMTRNenprUGRzVzJwV2huNWZQdTdoTHZRbDZMVmV3ZGpQVUV3SnV3M09BSEdwejZCbllrRkhCVnRNeEdzQnFrQXhVZVAwNWM3TW1nbWJCSzBraGVNQ2d0c1RtN2o3cXRnUXA0M3g3c05NQm5zTFFtS0NiZkFpY2VIK1RSL2xWQUhPVVFlRlRDUU1uYVNwSmZJNXplTW9rUHRVYUpQRG9hczl6RkNmVUdxU0VXVUhZQzZna1lEcVo3dkozeFAzbXFLekdKSFFnL28xZGpCSCs2WEdGOGdtbktoc1hFSyszNUtKQlczbmRKcGhOaCtqaXRFWnV6eE42UG5UYllZOVU0ZVJ3VzBGWEh5dVAvbTZJSW5VdFZrQkoxZGVlY3hDU1hQSXF5ZXpBMnV4dz09'
    });

    //Assert
    const context = { awsRequestId: '1' };
    const result = await pay({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult.errorResponse.error.message).toContain(`"redirect_url" is required`);
    expect(result.statusCode).toBe(500);
});

test('[Cancel Payment] Failed message from frontend -> 200 is returned', async () => {
    // Assert

    const { pay } = require('../functions/cancel-payment-handler');

    //Act
    const payload = JSON.stringify({
        error_message: 'Transaction failed',
        data:
            'UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4WUhwSnA0UFZyTVRDZmVhaWZhUFRKdXlqNDM4RHA0TVBhUzB5RFhpdTYvUGhlSG5xOGdRZzlEaDRWSmt3MTY0eUVTc2l1akZULzQwZzNrUGwrb1haMWxjWGlqRmxSdC9GeFc2SjJuTDdwZkJoNTNXTGF0eHduUVBlZWVsbkxxVWxHRW1wbTY1TDdpQ0wza1krL29tYzBxeEczTTZIa0hZeGpSN0VvbWYxandZeXVDSDNycDkxYk1TM2llSUZONlNVTHBZK0pZSGdGSE5uTGFmQkI0UzZDREVmRGk3UTRJYnh6VTZGQjNKQjNXQ3BoYTJuaHY0MnZpWStVMWNVTFlxV2lGL1RxVlU0NU1aUVBvQ1U1TUxSNHZjMGVIWTV6U0VobzZOV3pGOG9Zc2JWQ21tajJHYkJuNjU3UGxXR0M5cGp6M01VT1c1S0VxaHNPY0pTbm53NG04RG9xYjU0YW9IN2JkUmNuejlhYURiUmNKdnNlS1hPSFdpajBSclV4T1JTdiswTzczbC9obmtQR1ZzRkhYWXN2elQvb1lSR25SY2VpZ2VtZkJkOUx2NWxQd2l3WnRtYmVRK0ZWbDcwaEJPakFZVWdIa1NRRm5ZRmJ5T1EzVFJ6a2NHNlJJL0NraEswL2R3UGEyc1hVcUMyTkVnY0lZUnJoZGhJUHV2SUY2VEdpS2dtM1NCaXVMVXBhTDY2YXFzYld6N1VmK1NqMFlyd2lpVWxlSDBnT0ViaDRDSkVLTW1GTVFFRWRzT2FZSXI5RFU4amdmalRVM3lJNFYwWmgwdXpJb1lCaFc0RllZbmFucHpjckcwbkJTUzhJd2JNaStpU2FFeWhRUUtGcWNrYzNwVjVjODhwZ3lMdllCelY5dGRwME15NGpuTTZpOVpxM0J2OEZjL0VodGFNT1NZV01GNUdxOXdGOHBKc3dYT2tHdDFJaDlUVVdKUkt1a2VGd1ZMbGhkb0E1OFFZWElNbHUzSjQzN0lFNGFUWW5NcHFUSzQyOVhReDJXeXBRaGdmU0lpUUlYUFNEb2ZOblR1aEdXZGFGcVNUaVhyVWY0TFlBS3M5QWZjVEJvaUE9PQ=='
    });

    const beforeCreateCountCS = CardstreamRequestLogMock.CardstreamRequestLogList.length;

    //Assert
    const context = { awsRequestId: '1' };
    const result = await pay({ body: payload }, context);
    console.log('REsult is', result);
    const parsedResult = JSON.parse(result.body);

    const afterCreateCountCS = CardstreamRequestLogMock.CardstreamRequestLogList.length;

    expect(afterCreateCountCS).toBe(beforeCreateCountCS + 1);
    expect(parsedResult.message).toContain('Payment successfully canceled.');
    expect(parsedResult.data).toHaveProperty('cancel_url');
    expect(result.statusCode).toBe(200);
});

test('[Cancel Payment] Failed message from frontend -transaction failure message is a string  -> 200 is returned', async () => {
    // Assert

    const { pay } = require('../functions/cancel-payment-handler');

    //Act
    const payload = JSON.stringify({
        error_message: 'Failed',
        data:
            'UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4WUhwSnA0UFZyTVRDZmVhaWZhUFRKdXlqNDM4RHA0TVBhUzB5RFhpdTYvUGhlSG5xOGdRZzlEaDRWSmt3MTY0eUVTc2l1akZULzQwZzNrUGwrb1haMWxjWGlqRmxSdC9GeFc2SjJuTDdwZkJoNTNXTGF0eHduUVBlZWVsbkxxVWxHRW1wbTY1TDdpQ0wza1krL29tYzBxeEczTTZIa0hZeGpSN0VvbWYxandZeXVDSDNycDkxYk1TM2llSUZONlNVTHBZK0pZSGdGSE5uTGFmQkI0UzZDREVmRGk3UTRJYnh6VTZGQjNKQjNXQ3BoYTJuaHY0MnZpWStVMWNVTFlxV2lGL1RxVlU0NU1aUVBvQ1U1TUxSNHZjMGVIWTV6U0VobzZOV3pGOG9Zc2JWQ21tajJHYkJuNjU3UGxXR0M5cGp6M01VT1c1S0VxaHNPY0pTbm53NG04RG9xYjU0YW9IN2JkUmNuejlhYURiUmNKdnNlS1hPSFdpajBSclV4T1JTdiswTzczbC9obmtQR1ZzRkhYWXN2elQvb1lSR25SY2VpZ2VtZkJkOUx2NWxQd2l3WnRtYmVRK0ZWbDcwaEJPakFZVWdIa1NRRm5ZRmJ5T1EzVFJ6a2NHNlJJL0NraEswL2R3UGEyc1hVcUMyTkVnY0lZUnJoZGhJUHV2SUY2VEdpS2dtM1NCaXVMVXBhTDY2YXFzYld6N1VmK1NqMFlyd2lpVWxlSDBnT0ViaDRDSkVLTW1GTVFFRWRzT2FZSXI5RFU4amdmalRVM3lJNFYwWmgwdXpJb1lCaFc0RllZbmFucHpjckcwbkJTUzhJd2JNaStpU2FFeWhRUUtGcWNrYzNwVjVjODhwZ3lMdllCelY5dGRwME15NGpuTTZpOVpxM0J2OEZjL0VodGFNT1NZV01GNUdxOXdGOHBKc3dYT2tHdDFJaDlUVVdKUkt1a2VGd1ZMbGhkb0E1OFFZWElNbHUzSjQzN0lFNGFUWW5NcHFUSzQyOVhReDJXeXBRaGdmU0lpUUlYUFNEb2ZOblR1aEdXZGFGcVNUaVhyVWY0TFlBS3M5QWZjVEJvaUE9PQ=='
    });
    const context = { awsRequestId: '1' };
    const beforeCreateCountCS = CardstreamRequestLogMock.CardstreamRequestLogList.length;

    //Assert
    const result = await pay({ body: payload }, context);
    const parsedResult = JSON.parse(result.body);

    const afterCreateCountCS = CardstreamRequestLogMock.CardstreamRequestLogList.length;

    expect(afterCreateCountCS).toBe(beforeCreateCountCS + 1);
    expect(parsedResult.message).toContain('Payment successfully canceled.');
    expect(parsedResult.data).toHaveProperty('cancel_url');
    expect(result.statusCode).toBe(200);
});
afterEach(() => {
    CardstreamRequestLogMock.resetCardstreamRequestLogOptions();
});
