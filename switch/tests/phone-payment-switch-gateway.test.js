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

test('[phonePaymentHandler] missing mandatory keys -> 500 is returned', async () => {
    const { switchPhonePGateway } = require('../functions/phone-payment-switch-gateway-handler');
    PaymentProviderMock.setPaymentProviderOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMTFaenVQc3RseGFXSnM2ZE8yTVNVeEc1TEhOZno1TWJqb2dVcHpUSlkxaHFTN1VMOHdNSHd3T0xxNy9nMmYxQVBERytCQUNhamsxV1R3amN5cURuWjBUWGM5THdiZXkvcDJETzBMdjZuZVREU2xoR05ta2R6Zm1wMGtoWkhlZVl1bVhUUlo5L01vaDhOaUlwM29Pc0lEM0xzS0VJWEhNNXJtWGNENytIWWQwT1FZQ2t3UzlWRk84ZFVSayswYStyRy8zdHhJc3AyNzFENHRraXZOdzJhY0xodGJaVWcvSXpKc0xVdUhuTHQyYklzb05BS0IwWktlTktacWYzVnZ3RzBRc2xwTC9MNUJFOXcwa1d1dW16R0dWbTBqWDQwNHUrSUpvQzRJWEZVTzc2OVBlZWdnQk1FM0crT3E5c2twU2dZS0tpUytjd1dMZW8yenB3N2Y0UXA3R2FscDE4NkVWQU4xa09odUV4dDIrdC9WN3VzNmhjVVQzRE9iZlJ2aERCYkQ1eFo5L1dNeHlVcU1lK0xGdldzaTQ1Q3RGRmtnR21NdG11MFFWcDRJbjZ3bEZNYVVzTjBHRzlDS3JHM1NEK3E4ZXJEL0Q1TGNOK0RjTU5vN08yV2l0UXZPWFR5UU9nWGpNRVk0SUxZMGRCb3JkTG9JMGlBTTl2MTBtR0xDNlhoWEUyd1JxOXJXUnA5Vndqb2ZlTlNBdkM5UEQ5aWl2VFQ3SHRUT1hyVmRtUXFrcTc1WGVWMlRhOTFmdzdKTE5CQmJHVFliSG8rNlRmMU51UHR3dFJIZmQzYWk2NDdOTzZGQmdCNlg0ODZHQVJwb09ocitpY3JnRXpvWXkrNzlsSG1Id242Q0FVTm0zTjFXeEFSYjhvdjY5bEtQOUttMUZvaUFVT0ZWbDdpUlZlVkl0bUhIVG5KL1V3VExtV0l0OVFkZjhuY2dyZG5lNy9kVGRhVVNrMzZGMTFhbldWSXVjc3VQdHFacjN3R2ZpK0t4eXM4WjYvOU1YdDQyRWFpcE5seVJDWlNVZ05mWTFpS2dCajMxbU8wdA=='
        }
    };

    const result = await switchPhonePGateway(payload);

    expect(result.statusCode).toBe(500);
});

test('[phonePaymentHandler] merchant belongs to cardstream and this transaction is done -> redirect url returned', async () => {
    const { switchPhonePGateway } = require('../functions/phone-payment-switch-gateway-handler');
    PaymentMock.setPaymentOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMTFaenVQc3RseGFXSnM2ZE8yTVNVeEc1TEhOZno1TWJqb2dVcHpUSlkxaHFTN1VMOHdNSHd3T0xxNy9nMmYxQVBERytCQUNhamsxV1R3amN5cURuWjBlMWplcDFZdzNGQ2R3MEFoRFI5Q3ZwN2pvVDllZzBXTG9CZWRtUzdXVk9Qb0hIOUFJODF4dFZ2dUltenkrT0REVTh1NTNXTVZHdkxLV2JWOU9HYy9aRUtYT0xBU2htK0RsVTdXZXdMZVFLQ3dsVllKQ1Brczh1WTNhaWh5RCtFaWpzUzFDb2JKTk1DNGdRYi91R1JQVVFKbHpNL3pPRW5oU1ppRy9xbkJIRGdwWEJNcXZ2WXpkT1VSRkxBcm5mV0xndC9PVFFEMi8veS9tVjZqVzIwQkZhL01TU3RWRFloYWg0VU96M3k5U1hOcktFck9ZWVNxNFFpVHRzeXFkTmN6SmVuRzFEeG4zWVd2U1ZERjl1L0xHb1orNmxtVHVGKzlFbEdsekZrWndINDZiUGwxdFBTQ3NOSkR1UWN5dFNQSDBpa29GS1JQWkFWbkZkMUYyZ0FwTUlyVVdJby83ZVlib0RXSFNUdFZnTWZiQXpVak1rUUt2alcwRFdmSG1MK0hnL2tZV2R2U2pvWnQzeFJBRkVUN0UyVmViVXdYU1Z0TGhnalBtdE5qTGRZaGVsQThPbW5KL2l4eTZBelptblV5TWorRjNHajhuMUgvUGdkQXVVck1SdndKVytXYWdsSmVua3dhY2N4d1pEWWFBNnVLdHluVTR0SGdoREZBZzBGS3F6S3hkZ2pjNDFDUzc0UWRHZzZBNXZKVkwwWlRPeEdFN2VTektsdlFHSDdHVG9uUXlVNDRIc3U4YVJ0dEdpSHlDL0lBbEZpMEN0Mmk1WEtiSEhHaWxRPT0='
        }
    };

    const result = await switchPhonePGateway(payload);
    expect(result.body).toBe(
        '<html><p style="text-align: center; margin-top: 3rem!important;font-size: 1.25rem;font-weight: 200;font-family: sans-serif">Your payment is successful</p></html>'
    );
});

test('[phonePaymentHandler] merchant belongs to cardstream and this transaction will go through new card -> redirect url returned', async () => {
    const { switchPhonePGateway } = require('../functions/phone-payment-switch-gateway-handler');
    PaymentMock.setPaymentOptions({ findOneEntityExists: false });
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    //Act
    const payload = {
        queryStringParameters: {
            data:
                'SGxPT045aENBZEQvdnY5SHhiZVQycXJjQUpCY3pFNjkzeWkwakhUblZxMm9wSlRNRXV1SW5nTnVQU0Rxb2NwMC9oRlZHNUpWMUxmL3NLOU55Ly80NW03OWI0dGlKL0sxdUlyVUxmdXRGRVdlWVd1T0dJVXdCMklmZzVrMmJ3djNCUEhkemZQdzFrOUVNaUFtaFdxM2tYRnc4RkI1OVRJMWx6bDJVNEhzbEE3YnhJdzEyb24xR1l2SldtUTRpaWFSZU9DN0hGM01kNFZPVU9ubmdISGY4RXE4U2xoWE95c2xXZVVBb2ZaV20zdlc2dVJ4cVVqNU10TDdhMmFxanFDeFB3emJjMlF1ZEpGbWZjVk9KNEhaOVI3amhNekJpMVhEMDYxNlFFOHpFalFnemhIOWFpNW42U3ZOUUhYN1hMYUxGaUdUbDlSRm9YZURwZFVCYStFTUQ3Z0plNC9Eam0ycHN6OGRKR2dveFNFL1JOQjRZejFtMEVxa04wSTZiRUxQb0E4WFowYmppQWhNTE9GQTNwU1JrSFlIN3gwbndDb3BnTnZDNmE2bURlN2FGYzN2MXkzaTdVRnJ1M1N0bHY2RkhTVEdwTzJvUkFhRjBiWlV1UVIvSzVqNVJRcGN5eUNiOFRySXM0blJVZTJVOFJ0M0pwcHlhRnpBUUphZ0NnNU5DcGluK1dFdUxnRjVPejlweEFKZVNZZ21Rbk5taytpU0xRMnRRVHBZMlN4MEtCTnJRa013WllFVlllcXFIZHYwcFRiRlpUS3h2bmRSRDhscUVETmNaYk1WUVRCUlZvUFRyQktpRy9zcW1mQUw1MXpoam53bW50Vm16eFZYMU93TE1sTEZxOWNWRTdFL21MS2Vkc1M2aHpBSWVlejZHVXV2azVtWTJCWEtOSmNkc3k4SC9YOStLd0ZsU2VYMmRNK3U='
        }
    };

    const result = await switchPhonePGateway(payload);

    expect(result.statusCode).toBe(302);
    expect(result['headers']['Location']).toBe(
        'http://localhost:3000/earth/?data=UGtFakFXYVh1MzlmNHVmcml2RFR3S2t5L09VejZHMnZ3M3N5Z1Z0QVh4YmcrMVFzZDhJYnVuQnRQK0U0eXdGMDNXNTVLMk1YV3UramxEbldHNThIazdkTkZtQzNrTEozTXNLUWh2NWdGdWlFbldMeWxkSTIvRXdmU1liS1VGTjR4VzNGeVlyc3VaclkwK3ZLVzVMWmx2YVBwUm1Db1EzMlJVYTJmMGRsU3NQNTZjWHgxSG1SZlVUT1hKL1VJMVcxQTZLeHBnV2tUdEhKS2ZuVXdxaUJteTNwd0lZOFhWQTRQSkV0ZWRUaUxVYTQ1aDBkYnBoMUpFVjVWbzByRUdVbXpnbTEvQjJGWWE4VVV0WW5rNXI5SUM2aWtCajB0S2ozRW90WXVHRVZUOVFNUTVKeHc5WlJaYk1pZ0FSN3VVeFFCbkJWL2ZKdlZHS0lzbmlMUnVmLzdrVmZST3MzQ2FBMkdZeHZHQVFJTjVCYW9CdkNpWW9sZ0lFZnNDUE5ESXdhb1UrdGwvNDdiSFFweVYxdkd1bXVtYkdTeEVZWmt6L0l6NUZhR3lWcFk1cDd5NkFycDFkRHJtc08xZXNkUXlTSmwwWENRQjFoODRlYWJ2QVhBL2VHS3pUUGFtRXhNZHo3OXFaRE4zMDhWTHlZWkVaS2RlM3dJWS9HQVpmcDBUUnZ4QlFrRlhUWDh3WExTWVR0YVhKaTNWRkoySmJVQVBqNkJaRGFlZzdIZUVoOFNxUS9NRStFMXd0c1p3ZXVzRE5HOXdWODB4bTduYVJlMnJGUDFKWis3dGVnOFIwejRzZFQwWUhRYUNSbk05dlBKN2VJcVBaUlhFanllWVhOa3hVanFUWkpTWmZRQ0Y3NkhKQm5zdFR4NHAwTnJmOW1kU1BxYVAxVDNFT2lrb2ZPbVJjQm1HbDE1UmMxKzVTcjBhUUM3eUVjeElITmEydmw0azRTeDl2MTZqalpiR1ErRHBvZjRVYnJ2c2grL0IxKzMwejBzNG1lWTV1cEdDWXdaRmI0eVNxYW45ZUc0WmlEaWwvUmtrQ1hwdjZRZEJwTGk3YmVnZytGWFROSjVPWXpPc25xMXZWN2ltZTc0dDlRSEdzUTIxbmQwWDhBenF6dFBrUng5SUoydHhzUzZsYVU5WllmRnhtcW1nN1ZSWDkxajQ1WFFabzNQRG0vbzBtc0lVbFN0NSswYjh6YndhTFh5TVlUY0dYVFgxd0xub0JSRllyZ1lmZjQxbDJJTEpuZXUzc2RwOXQ3SlpPYjRWS1lEeVNFOEExQk1Ec01rQnlCL2lFK0Y5ZUh3WVRYYVMwcVVrd0R0b0JVeUVYejJsVWhzS2h2bnR2RGRZdEVIK0N6bUpzZHkxemw2WC96Z3BCQUJudWtkaGZIQ0wyd25jQ2FLM05Za0VIYnVuUGpsSzJrN3IxS1RMb0paTExrYW1tTktiaUpaSVRCYmlPdVFuMnJ0WHR3NWJFcFEvZXVydkNkTm9JZjBtejBNY0JLUFhLNUxDYjhGL0RDcDFhSnFodUN6VnkzQnRLTC9XejBUTDhYRTFORU5DbUtrMEcvSnU4N293T1cvclpXMTdSZWdZbktUa3RBMXFTTkZyKzlUTm9wVDR2MFRnRjRiRHg5QTUrK1pKOE8yanU1ZlRMVForbm43TWxmd3VVT2pLUDdhUTRKRGVUbFRaalR2dStpenowdDFvSEZTbFNWWVNNWTNEdlh1SDJ3aTNwWFpybXc4b2RzSkNzek9DdlZHTzROWStkTEVBR1I1Z211OG9qSnhpSW95WEhEemx5UU90Z1U1R202MW1xb2ZJL0RGZDRnMW1rZjUyckd2SXo2ek1TRHhZOG1LK2lmUE9iYjBUSWM1ZWJjWGtxeWVwRnJoL05nWll4N3h4OHNUMUJ3dFhiS0wzc2krTTBKRzY2ZFp3MGZOQ3pqZEVuZ0JiQm5pWXU2ajdXZVBncHE0Q3BGcFlwOU4xcE9sczB1VnB2QzhhelpVZHowaUovSmRnZ3JOZ3pDcjFacWFoWkFEWGhEMGVVeC9vT29OdmlBWWFkVE94Z1R5VnFZRFRqdzRkTUtMSDEyemJ0U2JoUTdTdGZZcjY4b01BVTdNMGFTR0w2UzhvN1dkREhjdTdaNGxQZHNNY1EyRlJVMWgzcjU3QkZvT29jM3AwN2xaTkNFc0NmNDF3NVFpTlJiL1FUa1JncVFxelZDTXZLMjVnc21Od0VZY0xSV2lrUU5kTDI0NkdhV0dSQThCN1orRjVCYnlENWJuR00yQkJBd0M3dHpPQVp0Mjd3OUlPd095Y2tPQlpIbnZUYzBMOXdnNko2dWZhUWxWVVBLZTJuQVdYbE9SRFNwSUlZUkxTdGtkdHhxOUtnZGhmVTRoR3dKUDZVUXJwWDZtY2YxbXdHeXl6dytrNUJsb2pxYU9RRmVxSktzUDY3aEswU0Y3ajRuZDJYc21VclVuRUw4MUYvZGozWDcwZyt1dHBmbTc2dFJaSU90QlhhUmdDY0pjZC9OZ2R4VVJOdFpwTjRCaktxRkQ3Rk5CN2J2aXhEcDRVaXdpek9FSnU3TEMrOGdwT0x4UDg4azRvblFkN0pxLzZCcENFYjhQY3BPVjJtYTJlN0l1MGtUZXMyM041U2p0cDJJQlVjNkhWQlEzdmErSXA3UWcrQjNrU3c2TzFmZDZ4VTdBT0czSjArNUMzVWVYcGVPSjRaQzBiMlN3azlDdHZGTXhpeUdHOGo0Z0lFOG9WOTRtL1dEUnpUK21RMitrei9PaC9XU1ROYjJKYWF5YTRyWWNFR0RoMmVybmNDekhUdS9ENHZ2V0NHenVlRjMwNzlQNVQ3bWtLZGQwRVNtTjFwOWpvRHhDQ0NWNmZ2OStYRi82UXpPL1RPNkFwRkczdzQvcG1DMTZqSWk5eTlqWWtLTVVJR3FSdUZDeU1MbFQyMVRiU1p2TzFZUUNKNWpQalE9&response=eyJjdXJyZW5jeV9zaWduIjoiJnBvdW5kOyIsInRva2VuIjpbXSwidG90YWwiOjEzLCJjYW5jZWxfdXJsIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9yZWRpcmVjdCIsInJlZGlyZWN0X3VybCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vcmVkaXJlY3QiLCJjYXNoX3BheW1lbnRfdXJsIjoiaHR0cHM6Ly9vcmRlci5mb29kaHViLmNvLnVrL3BheW1lbnRTUC5waHA/c2ltcGxlPTEmZGF0YT1TR3hQVDA0NWFFTkJaRVF2ZG5ZNVNIaGlaVlF5Y1hKalFVcENZM3BGTmpremVXa3dha2hVYmxaeE1tOXdTbFJOUlhWMVNXNW5UblZRVTBSeGIyTndNQzlvUmxaSE5VcFdNVXhtTDNOTE9VNTVMeTgwTlcwM09XSTBkR2xLTDBzeGRVbHlWVXhtZFhSR1JWZGxXVmQxVDBkSlZYZENNa2xtWnpWck1tSjNkak5DVUVoa2VtWlFkekZyT1VWTmFVRnRhRmR4TTJ0WVJuYzRSa0kxT1ZSSk1XeDZiREpWTkVoemJFRTNZbmhKZHpFeWIyNHhSMWwyU2xkdFVUUnBhV0ZTWlU5RE4waEdNMDFrTkZaUFZVOXVibWRJU0dZNFJYRTRVMnhvV0U5NWMyeFhaVlZCYjJaYVYyMHpkbGMyZFZKNGNWVnFOVTEwVERkaE1tRnhhbkZEZUZCM2VtSmpNbEYxWkVwR2JXWmpWazlLTkVoYU9WSTNhbWhOZWtKcE1WaEVNRFl4TmxGRk9IcEZhbEZuZW1oSU9XRnBOVzQyVTNaT1VVaFlOMWhNWVV4R2FVZFViRGxTUm05WVpVUndaRlZDWVN0RlRVUTNaMHBsTkM5RWFtMHljSE42T0dSS1IyZHZlRk5GTDFKT1FqUlplakZ0TUVWeGEwNHdTVFppUlV4UWIwRTRXRm93WW1wcFFXaE5URTlHUVROd1UxSnJTRmxJTjNnd2JuZERiM0JuVG5aRE5tRTJiVVJsTjJGR1l6TjJNWGt6YVRkVlJuSjFNMU4wYkhZMlJraFRWRWR3VHpKdlVrRmhSakJpV2xWMVVWSXZTelZxTlZKUmNHTjVlVU5pT0ZSeVNYTTBibEpWWlRKVk9GSjBNMHB3Y0hsaFJucEJVVXBoWjBObk5VNURjR2x1SzFkRmRVeG5SalZQZWpsd2VFRktaVk5aWjIxUmJrNXRheXRwVTB4Uk1uUlJWSEJaTWxONE1FdENUbkpSYTAxM1dsbEZWbGxsY1hGSVpIWXdjRlJpUmxwVVMzaDJibVJTUkRoc2NVVkVUbU5hWWsxV1VWUkNVbFp2VUZSeVFrdHBSeTl6Y1cxbVFVdzFNWHBvYW01M2JXNTBWbTE2ZUZaWU1VOTNURTFzVEVaeE9XTldSVGRGTDIxTVMyVmtjMU0yYUhwQlNXVmxlalpIVlhWMmF6VnRXVEpDV0V0T1NtTmtjM2s0U0M5WU9TdExkMFpzVTJWWU1tUk5LM1U9JmRvPWNhc2giLCJwaG9uZV9wYXltZW50Ijp0cnVlLCJzd2l0Y2hHYXRld2F5Ijp0cnVlfQ=='
    );
});

afterEach(() => {
    PaymentMock.resetPaymentOptions();
    CountryMock.resetCountryOptions();
    CustomerMock.resetCustomerOptions();
    GatewayMock.resetGatewayOptions();
    PaymentProviderMock.resetPaymentProviderOptions();
});
