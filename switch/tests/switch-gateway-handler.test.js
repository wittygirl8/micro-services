jest.mock('dotenv');
require('dotenv').config();

const {
    SequelizeMock,
    PaymentMock,
    CountryMock,
    CustomerMock,
    GatewayMock,
    PaymentProviderMock
} = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            Payment: PaymentMock.PaymentMockModel,
            Country: CountryMock.CountryMockModel,
            Customer: CustomerMock.CustomerMockModel,
            GatewayRequestLog: GatewayMock.GatewayRequestMockModel,
            PaymentProviders: PaymentProviderMock.PaymentProviderMockModel,
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

test('[switchHandler] missing mandatory keys -> 500 is returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMTFaenVQc3RseGFXSnM2ZE8yTVNVeEc1TEhOZno1TWJqb2dVcHpUSlkxaHFTN1VMOHdNSHd3T0xxNy9nMmYxQVBERytCQUNhamsxV1R3amN5cURuWjBUWGM5THdiZXkvcDJETzBMdjZuZVREU2xoR05ta2R6Zm1wMGtoWkhlZVl1bVhUUlo5L01vaDhOaUlwM29Pc0lEM0xzS0VJWEhNNXJtWGNENytIWWQwT1FZQ2t3UzlWRk84ZFVSayswYStyRy8zdHhJc3AyNzFENHRraXZOdzJhY0xodGJaVWcvSXpKc0xVdUhuTHQyYklzb05BS0IwWktlTktacWYzVnZ3RzBRc2xwTC9MNUJFOXcwa1d1dW16R0dWbTBqWDQwNHUrSUpvQzRJWEZVTzc2OVBlZWdnQk1FM0crT3E5c2twU2dZS0tpUytjd1dMZW8yenB3N2Y0UXA3R2FscDE4NkVWQU4xa09odUV4dDIrdC9WN3VzNmhjVVQzRE9iZlJ2aERCYkQ1eFo5L1dNeHlVcU1lK0xGdldzaTQ1Q3RGRmtnR21NdG11MFFWcDRJbjZ3bEZNYVVzTjBHRzlDS3JHM1NEK3E4ZXJEL0Q1TGNOK0RjTU5vN08yV2l0UXZPWFR5UU9nWGpNRVk0SUxZMGRCb3JkTG9JMGlBTTl2MTBtR0xDNlhoWEUyd1JxOXJXUnA5Vndqb2ZlTlNBdkM5UEQ5aWl2VFQ3SHRUT1hyVmRtUXFrcTc1WGVWMlRhOTFmdzdKTE5CQmJHVFliSG8rNlRmMU51UHR3dFJIZmQzYWk2NDdOTzZGQmdCNlg0ODZHQVJwb09ocitpY3JnRXpvWXkrNzlsSG1Id242Q0FVTm0zTjFXeEFSYjhvdjY5bEtQOUttMUZvaUFVT0ZWbDdpUlZlVkl0bUhIVG5KL1V3VExtV0l0OVFkZjhuY2dyZG5lNy9kVGRhVVNrMzZGMTFhbldWSXVjc3VQdHFacjN3R2ZpK0t4eXM4WjYvOU1YdDQyRWFpcE5seVJDWlNVZ05mWTFpS2dCajMxbU8wdA=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(500);
});

test('[switchHandler] amount greater than 100 for non allowed merchant ids -> 500 is returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    GatewayMock.setGatewayOptions({ findOneEntityExists: false });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMTFaenVQc3RseGFXSnM2ZE8yTVNVeEc1TEhOZno1TWJqb2dVcHpUSlkxaHFTN1VMOHdNSHd3T0xxNy9nMmYxQVBERytCQUNhamsxV1R3amN5cURuWjBnalI0RlFyTSt2cUttcGV6dHFWaFNXSVIyaktrdDVsS2ZXUzhMQmxuT3RucWVSNmZjc0swRG8rU2p3eGhtRjRkbjR2NjZNSWVFeVNEY2UwSEpNb2xRbTJlRDRGQlZibCtuT0RKQ0ovUDlvRTJTVys2VGJHZDJHUFB6YWs0c3BreENXeWRiRWNaNWJ3d3l6OUcxb2FLSVE4akR4VG03ZWJ2MWNCa0NZUEh3ZGNsaGNPOXdKaStrNlpwK0JPbkpGcGY2MXF4MlUwSXhZd3lGOFEyU2p0TkFBTktrNXI3czAveEk1MWIzc2IwbE52TnQ3dWszRHpQS1d2UENJVTFZT3JFeDNTWENQdDNqa1ZNTGFWUDhDWmxpMWgvSFdvNFRxd3dDb3RIekpXemVBeHBUOGxkdEtaWk1xa1FTb1JCZCtLZE03NTIvMzRkTjdPMUZ3UVVtVGxNWXVacVZQaWZMazJtV3FhbkhzSkpmZFd5aDZaUmluTHV0VFZPWEIvQXF2c0c1d2R4OGoraEErR1o1N3d1R1FYQnJ4QzVuZnVCTytLQXN4YUFObDFlQk5mL0hsajNBU1JUWjU4akNuWllnS3VDVEhCa0JSYzBlNmg4MUI3REMxZE9HQXZBMldGYk1CbC94Q2luczBZSTBxdHlhUTRRREMwUlFadFhqMnFUQWJoQngwLzgwUFpranFEWGVwQWg2b0VUQzZUdE5RRm05R0xudHlmb0dlOHIzM2ZWdkxkOUxheGZFellnRDd1ZXlNVEIzVUlyV2tuVU42bC9tSGxsZ2FsVVVHZkNneUxEYnp1UkZXcGpLVXFBczByZmEwWFFKYnBvdklSWnJsbVNEQWRjWWlvYXFPQm9wNm9HN1o2bjFHMHNHRUlzTjAyaDhRbkpjdHJqNDJKM0hCRGc4T3BmRzNaWGZKVlpwdTAvU0xNbFU2YnhqNnRrSVBQbHY5MHV1bi81YlE9PQ=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(500);
});

test('[switchHandler] merchant belongs to cardstream and this transaction is done -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: false });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    PaymentMock.setPaymentOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMTFaenVQc3RseGFXSnM2ZE8yTVNVeEc1TEhOZno1TWJqb2dVcHpUSlkxaHFTN1VMOHdNSHd3T0xxNy9nMmYxQVBERytCQUNhamsxV1R3amN5cURuWjBlMWplcDFZdzNGQ2R3MEFoRFI5Q3ZwN2pvVDllZzBXTG9CZWRtUzdXVk9Qb0hIOUFJODF4dFZ2dUltenkrT0REVndaZkkvTUtBcm93WFZDS2h5M1V5K0tRYnRmd1cxMDZHcjRYL3RTcGN3OUdjNy9mdDZ6eCs5S051VTVpN0hUcm5SVFNEQTNQZVM5WWhMZUl1VVU3SkdaWU4ybjRSU3M4TlVyMUpSWFU0VWVueXJMYXYyZXgxbDkxcXgwMmJqWjJDUjc3NU5aaW9sZmRPTEYvYVIrZFg5MUJ2OEI5cG1YSXltZ2xYVE1KaEZKOStnSTdpSDhtdjFzUUZFbjdOT1IvaGtyeGtMMytQWlZYeDdDUklNMGh0cnBXL1J5MW9HQ1JSajl5SkpJSWpNeWYrUWp0QjI3QUhjenZEWTlIU3hWOEdVTW52Tm42WFhDdFNrZnFBVGlDQzNzVkNuZXJDUFdDdEhCVktPVTJQN3FqRzgrdm5JN05pZGFKQVQ0WXFiQ1JOWHZ0VTNPMkhEdDVQT0VRRldBbU9UcTRuaXVkYTVreFozNUk0VFZ4QjJESnpYakcwQ1ZvcXM1aU1XcUtid3NTQnRKMk44dUNkS3EyZE1SRnRSWlNOK0dUWmtWdW45QlJJdUNLU1ZmV3pLa3lIT1BFZXZqSTdxckRmekRubkVDek5oTGRFZ0FzSThGWllPckIwKzNZd1U4dUFtVjc2THJQZU0vVStvNytZV1RmZnRHUzJJNGxFSDlqc1ovekowbjFPSmFPU1Z1N1NHMDNZQTBGTmovQ1ZPa1V1b1FvZkNGUU13ekI0ZkRLU3U5djRxMUEvWURWMGxUeTRrY3dZamtaSTQvMVUzR3NCVzF6NmZDbm16UytPeWNkNjUremNabG9keXlZS1Q4MENaa2NpeWdOa3NvNVZrbzZNSTl6L01nN2VWN3FFb1VjV2VjSEtXMEh2WEd0TGc9PQ=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe('https://example.com/redirect');
});

test('[switchHandler] merchant belongs to cardstream and this transaction will go through new card -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMkFmSG9qZk1KeE5IY1ZveGg0TjdTdFRMRlZZb0NDbW1Ia0J0MDRhN2VQaGVlZkJtUm9ULy9YMWpYcjZ1dUpQdmZsNDNOSG5PdHpDWnh3WEpxekJidE43b2o5dDhmOVlINWtHczRUZGlybUNWMzUwRG9aQ0xFRFVUdTExZ3JCRWRwcndYRE1jbGI3Tk1mM0w2cVBWa0UvVnJidTBXRko0T1dEdm8rOW5wRklUeGF3YlA5MkFjU3BtMlJmSjA2SXVDdG93bFo3T3BKS1Y4TlJCQTI1WC8vU0F1OWl5WjJ3WjRBRjhFakExQ25YY3dUWEV6V0FPWVUxSlNrYk9UNXJ4YlBKV201Mm9GWVcvUElCNXlPR09RYktaQWNjVEIvT0cwbjRraitvMWpyd2M1U080RGJpNDljOHhCTThQam5zbFNHaFQ1RzE3Z2p3aGlqRTFnek5DSG1kWldFQ2hoclcrRlFEWjBia2JQUm9HbndMMjZwS2N5L3h4U3dlcmhqUm9KV2NVSnZDV3NKOC9TVnZYV29TNEdIQ3RKUTc0RU1uZDFxQzFYUGFTNFltRWc2U0ZCc3B6cm5lVXc2R0hLbVVxQm9FU0MxUWo4QkQ5VDAyYXdKMzlma3JRNXB6R1RHQWVNVkRiN2Zna3pNRllJMHZxbmNtNmVWNjV5QjRZZnpkMitnUzJ6aFFvOGlLRE9MeStmRUJnYVZGUm1tTnBMU3RIWnNVSlp1MnlORlNLRkZ0Vk9WbWNvSzd6Mm5IeUwzd1pJTWhPd0lPUGFPL0VGeGxYcXJTVmNjd1plZnAzY3RlL1YvUnMycmlhL1FOaEpCYnI3c21LS1ovTE8rdHJmM1E0R01KSVpoVjAwdE1tcGpDR21ab1kvcmgxWHhrTFkzNkV6TnVoUExyQXgzNFN2dHFNQWo4MjhlZXp6VEZsL2NTdDIzVjVvVkJ2RytUM2tyR1AweGZQc3QxaDFCQVFiMlV0WHY2aTExSkxRVnBCRGhuY2xZMmZNMXdvanFCZ3ZYZ3lXenc1aTR6Z2t4bFVxcHJUTzMzYlpBWTJlUUtvajdQVnE3U1RNNHR2Wkw5bWc9PQ=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'http://localhost:3000/earth/?data=UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4WldtMTIwb25sVE8zTG5ZT29mYnBqcXh1MlFhbmQwVkNIZTM1R3BDSjZ6aGM1QUFueHZUOGJINE54RHpYQkJVOWJSYnVKbjQ2ajVGRWtIdUpRWnpHazEzRUlrRG54eUhlTitUVFBZVmtuS2JZbWNZMHZqQUtkSndScEt6dmg2MmZSWHhnQ255QVJxSTE2THZqdTJBdkNxcHRPOTNlZ1JEcXNLd0N3ZUFzR1FTUlBIUzE4T200eFV1T3Z1eThRcEYzZnlCVDJKZGxJdGVGYk5PaWZPUS8rS3M5Zy8xL0p5NVdlYUVKd3RBRGpaN0JyeFZUaHh5cW4ydm5iQStZcHAreEcyWjZjNmZ4YmRFRFBNTUpWcTROaWRuYjVCZzgvN2tHeTF4RHdoNXdCWmhnT0tXNzdWWmN2R3AxbmdKYVFHemtzZklpbHVOVjR1b2xVaC9mQXlrYWJ3SUViZVF0RTVJanIwampQY1JpSlUrYm5lNXZBNElvUTM2U2FEdXhrRlRKZUQxNnpRdUQ0aDBVUjNYY3JHRFpnWmZCMWJEN1IvU0QvaXhQZi85cU8vVi8xR1poRjE5S3VoMm0yUEhJdTB0WUt0ZDliWm05bzNZaDJCUUU3dE93OURmbGliVnM1RVF4bjQrcDFDYWMyQVJsOGZkV0ZtTE9pZ0ZCSlJrK2pVK0llLzFZK3hVbnc5VUNSKy9nb0VxQjk2SWlpcEJRbUtSc1F0elkvZkpNRUhnQXdUNEhTQm5EM0JQNWk1Ly9kd2xadWdJWmllT0lYU211Yi96SHRGVXBBR0JhMTRMSnV6S0k5eDVYSmx2VXJMTEJsSUYyci9PZVh0bjFOZWp0aUx2V2pqOFliR2JTeWE5NkJxTFlxWlhtTnZlT1ZKZjVaaWlrY215bkdjVlV2bTNHdlZ1bEhRM1BZZVRuMm5tOWNZdjNYU29FZnJvazlQUEVGTmJvWGFTai9sbjI1VUgxanVqUGJoUHROWXBtZWprT21lVk50Q2xBWUs1K0ZYVmwwbEUrMnVPQlBvYmNmYmI1OWlwbkgxemFnYjcrUlpGK01QZ3JNYnRLMTB1WS9DVU9BdUdqS25NcHM3V3dnRE82NGNlczg9&response=eyJjdXJyZW5jeV9zaWduIjoiJnBvdW5kOyIsInRva2VuIjpbXSwidG90YWwiOjEzLCJjYW5jZWxfdXJsIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9jYW5jZWwiLCJyZWRpcmVjdF91cmwiOiJodHRwczovL2V4YW1wbGUuY29tL3JlZGlyZWN0In0='
    );
});

test('[switchHandler] merchant belongs to optomany and this transaction will go through new card -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: false, isUpdateDeleteMode: false });

    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxM0I0NkNYcm9zMG9JRWxLdVMyZzlWQ3dkSDdNelBGbXFLQWlwWFoxaGtIWGl2VjYrU2FRV0xFL1J2dVVVbTdTWlpBQ0V3MTNBdkV4SldCZFU4T01jSmczb3RmZFJzbmk4RU5jOVdaaXdIa0dPeEp2MFJUdkpDQWlzWTNlQVMxSHljT0pXdnozMGo4dVB2WFdBY1hPYUVqeWozNHNvRkdRay9JdTl6aFgxMk85YkEwaHdVTm5GQzUzckx1aWNzZlpWbXBnNXpjRVpmbEUrcUhDb0x5NHV6aWNnRXhQQ25CSUl0ZEsyZGNIdHlMVjlRdFJjQndzK3RWdUVPYk5hZ1VncjA2RURwbjE4d3k2aXZTVS9yRjJnczVQcGM1WGZaRXRoWlJSbTR2R3pUQmpmdlhFRCsyNnBSbHB3bVd5aTJQZGF5TWRYcVQ5QXhPUzdhOWsvRnlwNzVUeU10QmJxMjNXbGQxTEdvd3V1OVlUS1FVMWVVcTlabG05ZFBJcmRmSHlJc2Y5Mlp5Nk02MHYvMjRSR0RJZGNaVkowY2tRb1FpMGZaOFJIRUNHeEErUXp3aXRkakFPVjdQNEZrUGZnenBsODVyV0J4M2llYmowME9xanBYaldhSlhhV2Rnb1VTelF1VjErUlovcXlrODJkb0s0MkZ5bTFWQjlCd25uTkdiR0xnZGs5TThOdHU1OHZWQ2JDR2tIV1ozTXNJNEhHVkQ4Y1N3am9zbnFoeWtuT1dnbWVSYnZFL0V0RUkvZzNSUUd1b2JJL2JlWTNIVkMrL2dpTDY3VkNlYnNySTZwZEZjanRZZHYzeEg3cnB1MEVON05QOTI0b2NxRnZuM2Fwc01JR25qU2xCS1Fzd1F5SGFUQm1oRDJzUUxkY0txQ0pqZ2dCMUZuUTVvWTRGT2UrengvWEd6TEJsZU1XSExzNGNWSFMxYXFvQTlmT3VmTkNMZER6V1IvSzl4UlkxeVh1QU5DVm1FaEcvbVN0bExmNk11OHdabkhiNWNwTGpYKzY0eW1GT1llMGtoWldTOTI3T01DR1JJLzZiMg=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'https://legecy-release.datmanpay.com/opto/card.php?data=SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxM0I0NkNYcm9zMG9JRWxLdVMyZzlWQ3dkSDdNelBGbXFLQWlwWFoxaGtIWGl2VjYrU2FRV0xFL1J2dVVVbTdTWlpBQ0V3MTNBdkV4SldCZFU4T01jSmdoMHNYaGdaUEVKSEkvWlljbFlNY0VESmVtNW9VQWpKeUJhMzZkektxTDlRcllFQm5xSm5KVEIxdEVOOWZockNibEpYUDJaaWdJVmtNWHVNMk91OTVCcW5wQ1FRdm0vcHRLVjUyaGFXWnkyYnJlRS9TMXZsMmpjUmJUQnlZUjY3TWt1Ni9qSlVoeG9OdUlMY2MvYXNXaVJDV29EYzRYQ1BFRFBtYXdnTCtKdGdNWlVtSDBBN1JnWnVqTWgyNnRLSFk0M1prbmJvcjhlRFFKMTMzTE9sN3l2YWUrRXl4NnE3dVgyUHI2Si83TEt2a2k2MVlVcm5UYUNjcjkzSW1NR2Ri&e=dDJzLTAx'
    );
});

test('[switchHandler] merchant belongs to stripe and this transaction will go through new card -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: false, isUpdateDeleteMode: false });

    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMjVtZ05jdGhRV1hrMUsvazBFN1YxWFV1UzcvZlZMQXFtL05jcHN2akFKTmRTN1BIZ0VneEFyNmhjeGpPZnpob005MjVzamo0Z0NZRUkwTjNEWUxDaldsYmVHSmVoRW5JcFo1VXQxRVZwTnhla215TjJXeVJsc1RwZERXN2lobURKN3NrQnk2ZGVWdjl4dVNKcmx5a3VlOXptNmphYjBQMVo1SFpzLzZCUkxQVkFNVjc4ZndNQ3U1dU4xVERTUUxBRU5yS0d0ZUUxVlBoWFNCcXkxWXdMSEJyOXVDL01JTUhnN1VCUmppS1pGa1hKMkxqTlFlZC9TTDhpSG5jV0ZPVklyeURSenRSY3R5bkU1MkJFdXZWL0tuS1N5NlhjaXBuc0hjYTdqNzB3SUhVbXZpQzN6SjlYa09INVg2NkVCTVYrS2xsSWM3TVAvU1NwTU82cHJvbFVDWjVWWUIrRTlpbnZxWlFYczVueEoyWlJ5RTZEVDRyV1p5VWhNSWJRVjZhdDlTYmpiTDJRSHY0T0hVRlZOODN1cm5RR3d1ZGs2THdBdysrYkZTdFpjNGo3YmJBNGFqQ1cwU1RhMVZFbGNOY2Q0aXNHOWJQUGVJRWM3cm4rN3JNS2lkOG4wK2ZwU0tUclFQcHZab0VpYjdTZkFMNzQyVnVSSGZtSm1Rbml6UitrMUQ5S2RqaXJXdEZPb245SXJiR2ZlNW00UGtSU1E3NGFJNDdNSng2ZzNabTNUczYxKzZwbVduNldBek5JeWZKcFhpWFFaV0JvbmlwYjBGQ3U1RG12aUNwOEhqR1draVZpK3NOZ1NBOGJSN2F2U3lJYTVCZTB1aDRILzFvVTJIaHZKSWUwMkZETzhaRFoxZ2tYdk5jclRVSmY3U0xoa2FRQVJZMmlWLy9QMEVlL25BTlRya3BZeGVkMmlDNUg0UW9ESnhuQ2dseW5Wd01kSFpLTEdaLysyUWRHUlVBditkamUxK0xlWjhBTVRHWkxGenV5U3VDVTJsblVBRFpPNFYreGwzY2VLeVV0aGFDT1NwbU1NN2JIRWFkRDlzQWYvTW9KTldaVGJUaG9ZN2c9PQ=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'http://localhost:4004/dev/api/v1/saturn/stripe-pay?data=SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMjVtZ05jdGhRV1hrMUsvazBFN1YxWFV1UzcvZlZMQXFtL05jcHN2akFKTmRTN1BIZ0VneEFyNmhjeGpPZnpob005MjVzamo0Z0NZRUkwTjNEWUxDaldVbXNVV2trWDhYQUh5eC8wT2RTMVJuZ0UxUHhuL2ZIb0NQMzFxWmlPT3g0L3NoVis1dVd0UTRZc1BQNE5rY1NUNVR6dWV5OGFzVnZHNXBabklpODNzTTA4U2FjcE5NbWFwbEJwS3hRa0tnOUFJRUhmdWxCeGdmbURXS0V0NURJMG0wajNBeFJkS05rUSthc2krcnRnUFhKQ3NKT1NWcmJCKy8vMEpvL0M4bldpYTJQTXpQbXA2TmtkZjl4YnFIOUQvM09tbi90ZUNvZ1Fya2F0MnB0L2xheERRYnRDTGt0SENOOEhwQU41RWFLRGQxWnAxWEYwMXFESUdEUTg4VFBKWWVwbWd3eE5MS2JzUFk2UjZHNnEvRllxVldBUXJrdnN5dDc3SmNGQTYzTXZxekRWSXkycCtURjI5aVlISTREZ3p2ZUg4MWpua0JXRS9GN21XZEJqdC9lWGZ0SkUyVW9FQ083ZnJHdHgyc2t3cVlVaFdXbTBCZmFUVWxHVzVzcWpycHluMXB5ZUhsZTVENklCK1RQak1jWVRuSHRuSVNZcXJick0yOGxUQ3VkUzRNRGRua3BIZlpodGhORnR6dEEwVWU5aVRma2dGMlh1M3pMaGE3eGpJRVFYanJ5Ui95dkdGclFXQW5maTB1aFZCOWR4eHVGcVdoNVdPOWxzL0FFUkhPR3FIN0RIZGRTb0diaGZqRFdQSDFackNRUlJiYzY2Y2pOR0FjTFUxdWNiN1JLaFNwRm1PN25GNGVNcHRoL3hla3JiZVBPZWY0dmVQYW9rTHl1NHNmVVhibzJPbEM3Rkk0Mnp5UldkQ0dpZUxReXBLRVR5TFRKL1dSakdvWXZRVDdQRDhlUTkyZ0p2cXZ3ZENlK21Ybk9vcmNHQml2WGFUMHRrZk1EcXRET2haYzZFUUdtclJrK2lLMFN6MlpCSFdOSlJET1IvRVRzWW9XOTEzN2NYWnJOV3Ria1hlb2NXZTBIb2RGV2tpbmxmOXRGTWJFRU9LNS95ZjBCbHVtNzJnb0VlUllqVm1HZnJpVzNsNjVUOUNmT0EwRUV1T2lWUTd6QVdxM3owaVhRPQ=='
    );
});

test('[switchHandler] transaction will go through saved card as token provided is eg token -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: true });
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxM0I0NkNYcm9zMG9JRWxLdVMyZzlWQ3dkSDdNelBGbXFLQWlwWFoxaGtIWGl2VjYrU2FRV0xFL1J2dVVVbTdTWlpBQ0V3MTNBdkV4SldCZFU4T01jSmdvTktydFBRMzVvaXN1N3FjREhmVjVBelZINW9XZWZxUzd3ZFcxQWtNT1dDY2VtNGdnand5ZGxock5BcGFZZUplQXlZTk1QaEVZWDNObzRLZ1JKdm5hOVhvam5TNlFGUFVmbk11VEtDU3o4MkVSQkc2aDF2SUdGWmJmbWpCZi93SytOLzFDRkR0M1dBcDR0QzJrSG0xa0I5Vm9FbVYwSkdQWnFSaE5UUThmUjlzT20yajJTMi9hOWl5R2d4WHdtRFJkd2VKQ0tWSG8yQk1wY1A2SjV0eXh5dy9USFAvYzI1TG1mbFdFVVJpVHd4V0ZudU5OZ1gwTjZTdUhwV3gvNVlKSjNQN3NuMm5VTEYyM0luSzlzdjFESm1Lbnc4RUlrTlllMXBQenRMVmU0WFZrczZ0L0xFWS9idUNsSURKV1VKdU9xVU9xSm5HUks3czBkNGlORitaRTJjUnYzZUNvbzFqSmxBSEpzUVFSelluQWZGa2pSdjBRZVpkaGQvNVkrSUliYWp4L0pHUVN0cjcxaVMyME4xeSs2Y0svUHhOcTIxd3JUL1V3NGcxVWdXWDRTU0xlVzZFanVrV1czdnJXUkR6UUgybExJZmtTMTFQeXNRWnMxUGIxSE5MNzBNUU44anB5TjlDS3hJZ0tPUWRXOXdUeHpNaGtiZGh6cCthSjBMdnBWcjBDaXFxYnNwSkpLZDJNRlkwVEZacUkwMmVCMlNLYTdhamprUVZUWitWbC9hUHdZOGpwdFdyZ0VzYkx6SEVLckhRS25XZk5oOHhHMWZsTG9aRGg0czdqb3RxNU93NTNWM2l5TTVOak9mNWJxZGR5TTBwTlFRMlNQSXk5QUZ3VDMzd3drT285SmlrT2dpRjA0MEpsOXQrdFVVbUJrejNQNWRNTG9WU01icjFMMXNSVlNrcVA4VVlwZG82dm1NY2tCNjFpRE4zUHRaaDlVK08rUVlFbC9mdFFpMDQrdXR0ZlY1NmpSZ01nb0lyZTZ5aWE3U3lqTzB4UGFPcU1oUldTbHYvTlFQQ2dlSnF0L0ZBVSsydTJDeSs1UWxrcUVxdDN6bnRUaDJCSDRKSThwSW8yak9OZlptaGhFaUlDL0tIRVEwUVFUNDlNTnJJVC9sL01aZTBVUVF6QXFOZHdXWUNpYS9zSHQ3empCck5JR21jNFd3ZGVTU3VEY0JqaS91bzVHUERDR1lvTkR2eDVFakFRQnlraDJsM0N3WklPeUx1N2FyYmFqSkxxdWs9'
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'http://localhost:3000/earth/?data=UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4YXV0Y1ZmNGNlOUxTVmZrREt6eW9QdGNlQXN2S09kRGtuazVtOXVWdjl6Y2VWVDJSVmRzNnZhRGh2OG55QktuVGh0bmhwMzdnOXpMOEEwbzBTNG5OWWpsTnNEWUlrT0M4Uy9TWUkrOUJDUWhIQmFLRTk0NkxGUEFPNXNDVlcyOEpWdFdRWFNFUlpWSjIyN1U1Wkd2MGttQWMwRHBsc1NTZ05OM240NWx6RkR2Kzh6YVB1aEcvOFYwc3pDbk0wOENKOHRnS1orSStvL09XOU9YbUcxZllVV2RUVkVub2hxS3lRNDNXYXpsMmNUVGFDc05BSU9nSGFBbDVadWdHNzR4Qm1nM2tlcGxaQUlYSHkyNitkUzFOMlhMcmhvbWNwRnp4bEV2aVpoR05wQURIYll5MkFjR1piTU45Qm8vSUp4R0dmK0JZZ28rSDlaTFJ0ZXNUdU14QUUzQnY4MEVUNk5TSDhGd1JOdkFULzQxQmMrVzBmeTcrWlJpWFVORU1DTzB6cFRYclhzbWEwOENaa2l5blNQRmRXV3VYdGdlRWpscUNlRGNMTmZYVkh4L3JEanB0c1ZkR1JPeU1DWnNKcXZDeUlUcnpCMDhnaU53S0FJbDU5TmVKSE1KUDd0SWZSUWUxMkRsVEpXZHVHNVJNdmJpZDlxRlk2WTFNTDRpRDBhMm54V2x5dVNiVkxFdThydUNuaWd1eVcvcnJXU25zbk1IZHFtc0MwdS9NWTlGZU9ObUFmbU1iNDUwelBOa2Zvd1E2ZWJtR1N0NVBnN2VTS1d6MnNoS0ZodVE4cW5QcEtDRXR6SVlsZjJUSmdKeHQwMCtCM043TS90aVE4WlhLSUFaZGU0Ym9QR3BjUFhRMjU0S3hNNnR2YjBiZmZTc2x6MGJwNnVtQ3BIZW9kZlNzQVZwZlJhcEI3dnU5T2E0R0RHa1J0RkRtU29lRDExb0JVR2o2SjZIY1BUWDhVanhSZG1QOVRaVk05eE1GU0RiTjBYNHhUWmJDeUpkVlUzK0tGbm9BSHdQTjF0ckc5SmpzR1hPK0J6bDZSdGluWUx4T2JTdGdsUGc1WlViQ2pyWjNza01QbzBtWGVPa0lzWEJHZ0xHeVlnTkloZGdDckcvTkJlcWxsOGJpaFptT09xTm5DWGJhSDZNUURKaDhhUWNCNFQzZDJHZEhSczY1SXpCZFhnaFdXcjEvWVc4S09KeGdQU1FuRFp5Q0R5&response=eyJjdXJyZW5jeV9zaWduIjoiJnBvdW5kOyIsInRva2VuIjpbeyJ0b2tlbiI6IjIxMDUwNTA3Q0YzNlhMMTZQVzY5WlZSIiwibGFzdF9mb3VyX2RpZ2l0cyI6IjA4MjEifV0sInRvdGFsIjoxMywiY2FuY2VsX3VybCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vY2FuY2VsIiwicmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9yZWRpcmVjdCJ9'
    );
});

test('[switchHandler] transaction will go through saved card as token provided is of optomany -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: false, isUpdateDeleteMode: false });

    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxM1IvZzUySUhleFlDVUJzQ0RiVlk4UVBwcTFSK1dnckVLMko3ZXR2cktYM0hqYndKcVJLSm1qclN1QzV6QWYzTHJIdVAzUTdad3BOd3I5UzFDai9uWU5hOXh5TExTVndKM1RNZy9VaDYwekY2RGNVTUlFamNJbGdwS0NqTWdDd2tjQ0ZodXBVYkxMSVBHM0pqeU01cmJMUy9iRURnWWd2V1Z5VXFZeFR6VldXLzZqSDBBbE9sMzg3U05mNDRMeXJOQ0QrUWRzQWFUWks0S0QzREdHUURaYytZTzZ5V0podGY5T2J6NkRIY1FxN0NiRDlmREE0KzdYN0Y0WnBaSmxHZXZpTHhWdUp0cjY2djk5SHlCV3kxY2VYazYxakgwNVkyNXFLY1VHdDdWVlJnRjJpa3Vrb0Rtamhlc3pSdUhueEphVld6Z29KMUI0VnM5aVBHeVRlVXl0K2g0ZEtDeG5oTkJjY0lHZXZLWHVWTEtxQWZRbGZNTWwwWmpoOVk5Qk9RVXJkbjl0dExqOGR3K3pMVDB1R2tYdU41RkpHcnRkVFc4MFpZQ0Jhb0JNeXR4M0RrUlU0N1Y5QzNLdm5sWEQxN2VYWWtJZzFIMkVJVG1ReTduTFJHUDBLSENWV0NPc0ZRdXlUS3JQOFZJTHRjZzZsUXd5b2lDbGtGVEZWeTZiOVdsclZuR3E4MnVVTUdiMDQwZGlzN0JtVlIxUUhVYWZESVkxQzdHMnhmTVl0cEQzYldOOWRXaEZjNjlGbDRESFhzMWpjeStlTkVtSjZCL2hhRUVCd0RtMzdCVm5YU2Y0QTNWdFIrLzdHb1ZOcUFEM093V2pTcDl3NjFvTXAxY3A3Z25nd0dXNnVJM1BqSVdVZ2phV2luOU8yR0I1UVkxa005RXFrUDhYRjhnVXR5aUJySmpWWWxJVmFMc29Ia2FhY0Nwd2dmTVVxMWJiM3g4UmJOVFNnMWtiQkd4aFYxM1hjSmNSRFFBMGNpR25EaTFaenF1SVhqdXEvaDNHRk1PYXZwbStCZDdORUN5bkpORFVrakNUeFNSRFZXR0N4N0dWWXJQbmwza1FyczU0cmc3U0RJTVdqWDlqcXREMXVQdXBob1N0V25SUWtlWUdLMnVkdm53VDd5UVJUSmdTK2t4VUxUbFY3TGFwMlNUdGF6aEtUVXNXQjRUWm1RRkpTWStLMis5Ny9pb01sTTN2czU4RHdZK2JkbGkxK0p3ZXZRV040dHBTTmFleHdDcE9GSTFKU094SUMraHdaaXB5MVgvVzVHakhBTmxJYzRyV1BpMXNOMG9kR3BrUi9zVlFXMkZaTkNEOG1qajZiSU50aEI1eWI4TG9LaEJkY3dNS3NLdWpEOTR2YnowNTNObWFEdGE0QVJnbjA5c0w='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'https://legecy-release.datmanpay.com/opto/card.php?data=SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxM1IvZzUySUhleFlDVUJzQ0RiVlk4UVBwcTFSK1dnckVLMko3ZXR2cktYM0hqYndKcVJLSm1qclN1QzV6QWYzTHJIdVAzUTdad3BOd3I5UzFDai9uWU42WTJ5U3BDMG1wc1Vaa1VzN0JZSkh1OGcyYW9RVGY5bHByYmRJMlR5WWFhc0ViYlQxT0hVVklkcXpCZHBtQjN1UVVFSlM1djRZWFA4cEVRZkpiT3N5L0lEa1RNWlVmcktOM0pWUlcyS1pMOFdMOXZBTzE0a0ZYd3lkOVJIUnQzT2lTSHhtTG1hNXEyZDF5aWI3b013WE1HOUxNM0pDc2ZYS3dNS3o0VE5wUm90U3llYlBuRFlKbkF4L3o5bWt2RmUrMi9XelFPUU4wSmRJRWRGZ2hhRXZ5UjduM294M21iSDEvTG45L3BWRVMvcnhpNnVHTG5CbDJLRzlDczI1c3djWFFBcHlJNE51UEVGTjNkT0NYNVFDS3h4bzVicVFuLytyZUtvN2YyeFoxV3dwZlJ3cUR4eTloRFpGeFVpZklqMitGQ2k3SFdPM2cxVGRUUXY4WVZ5Q2pBZFR3ZE1TTDNOVXpsQ2ovajlUTkVaZDN1akFTcGo4VDNqM0NZLzRHa29OeHZkbmZWVkM2YWE5MzBVL0p1N0JNdFAzb0t6dFh0WTBnVEM3dFFnYmtDQmtPanFxZHB1blFzdmZDN1UzemlKdDZ1bUQ2R3g5ZnBJVjBpWER1VFBxSmFiYkRzRUNBU2hheTRNNVpHTjlPcz0=&e=dDJzLTAx'
    );
});

test('[switchHandler] transaction will go through barclays -> redirect url returned', async () => {
    const { switchGateway } = require('../functions/switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    CustomerMock.setCustomerOptions({ findOneEntityExists: false, isUpdateDeleteMode: false });

    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMzBGeUhnMk1Wc1RHWk1NNWlDTGxqVWlqOElpSWdqdHphNFk3VnVuN084RzdnSFQxeXZCdmZpY1YzVEZyOHZidHFWcmZ2OXJSVzB4Z1JodUtub1RLcnFzbkUyTXRrVjdSa3ZDSjNEUFZNbXNlVTl2bUNvZWVmNVExUVdnRzlEZzNWOVpGOXRKaEJKM214cjJESTZHZDYyd3dCRGw5dXZFR2F1L0VBZStUcmtSR2lZMkZsUVNhVzBUdE9sbUM3K0FjSHhRUEVNRy9haWR5WEhJNHRxZGI0aGUwWlU5STRXdWFQcEZqMU54K09CRlFFaUtTNWpIOE0wb1hTZ0tXTm03bmZITHpXcFU4SUp0cG55QnU3aExTY0wxWEFNcmJkR1VmRXBlM0FEcDhpbmFXR2NYRHVybVM3YjVZR3FpcXVCVXBLZGtuTHNhQmZoT1I0bXBXSHVvMi92bVQ2czR1YzVpZ2ZKOXFMRloyZGx3bGVFL0tjNjZrWmZUWkJXN1Q4dFN1TWd0bzZPWGNMcUtVZ1VWUlU3aDkySWpXZkxzdkJXUlEwN1g2dE0rbVVmMlBhb1Y0aytnOUZkUm5iSVFaUGtLZW8rMm1MZldMb0xnQlhWbklxZ0swSUwrVUl3UkE3Umd4cG9idnZGQTljZDZPYXZjSWVXWHptRHJMOTZuZUFrUG1zS1F2UnBKeWgxQmlJZnpFN2ErYUxrenN6TTlnVkp2Q1JQVmZPbEszZE5JUCtEMmRXaUk3OUQ4WTZQMXFROHU0L251WGJnd3BVR2xJN0RPOTY2YW1WS3VCYTlkSG9MVk5JbHRqY2ZvWGV1K0NvV2lSN0FsbTRTaUFFN0dKanIra2Y2dDEyb2d0bUFQc2p2UEdyTHNXQTJQUzFRWEJCaFNocy9FYlpEZmwxcmxwUnowK2MyWjdFWmIzUmJVN3hpblBSQ1JLVFQxeWNLaFRmYURQby84SHBOTm5meHM0azRuYU5nWUJ0Z3RCSDN3RDZZUkEwd1JrVk1Kcy9mcEhYSU0vOFN1WUxzbldHZjJ6TVA0VkFmcGtkeTFTYmdUM3M3KzNsU1Bib3NCT21XbGc9PQ=='
        }
    };

    const result = await switchGateway(payload, { awsRequestId: 'abc' });

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'https://legecy-qa.datmanpay.com/barclays-irl/onlinePaymentV4.php?data=SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMzBGeUhnMk1Wc1RHWk1NNWlDTGxqVWlqOElpSWdqdHphNFk3VnVuN084RzdnSFQxeXZCdmZpY1YzVEZyOHZidHFWcmZ2OXJSVzB4Z1JodUtub1RLcnE1S2RxWFdSMktjUVY0ZWFaSjNkTVFDVnRFOGp4eDBUSHM2dVJmZ1VCWEl6N0RyVGtEMXFEWjgySkNBOFI3MEx1bkM1ODR0dHZqOEdZTFp6U3lRUERaNmc1di9hemNnYlpBZlZZZG5sL0F1RDVXdi8rd3YwZGcvNVdvb21MT1FRN2NmLzZyVWl1VUw1dDMvcU14MFkwTWl5M01ibHBMSWtITFJzb0ZFRWpCSWFVVmxvNyt1cmRWL3V1QUo4cXlXSW9xejlSazR1S3QraWErb054NVFwVDhrRnRGcmxFaUpMSlZ3UUVXUk9FdFNrN09leGRGNTdERGtZdTVYU041WHUrNW9odkgwb0YzY0VLSkRIdGhnNkliRmNJRWhyZzQyaGxXeXNDT1NRNnpvZ1ZSOHJYQlFoZlpvbVZEQk1iY0F3RThzblhxWStQNVFFcWwyTG5xYXFsYmNhWWkzVXBudElzZkFEdlBDZU5oazFEZUhVN2E1ZXB3QkxtUTUwcE5HQm9HUWdPbHM3ZWZWR3dOSEdKMzVZVXdNNzZOdTV2c1p5bE9ZWkU3bUYzZ2wzVlBHZUNhOVdNOU5EQVZSZkpyeUN3NWpZRWJuOVFtMlhNaFp0S0ZzSDB4T0d6aTNOTWtRMHMybEN2SDF1SU1Jb1g1WUJibDNHeEFnWHUxNHhnbVZvMkhQT09sOTh0UnVqa3BHRG1ibG1uWEZnenB2RktWY0lqUzR5anVwVituSUxneXdEalBSK1pNOWhqdmpTa3JDMTJ0MHU4Y3RqN2VtVCtieGRjb2F2bkRlQzNjTndlR2k0S3R2aWs5SDZkdElLeUtrKzFMQ3FjRmJFczUwVkFkK3F2eEdSaTdRbUdjejlQendWMk1ubjMxUy9WOW8yYWlyWHI1NCt0V2ZEcjdjaz0=&e=dDJzLTAx'
    );
});

afterEach(() => {
    PaymentMock.resetPaymentOptions();
    CountryMock.resetCountryOptions();
    CustomerMock.resetCustomerOptions();
    GatewayMock.resetGatewayOptions();
    PaymentProviderMock.resetPaymentProviderOptions();
});
