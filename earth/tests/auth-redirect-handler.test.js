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
    const context = { awsRequestId: '1' };
    const payload = JSON.stringify({});
    const result = await createSale({ body: payload }, context);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[ redirect ] MD/PaRes missing  -> 500 is returned', async () => {
    const { redirect } = require('../functions/auth-redirect-handler');

    CountryMock.setCountryOptions({ findOneEntityExists: true });
    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';

    const result = await redirect({ body: payload }, context);

    //Assert
    const parsedResult = JSON.parse(result.body);

    expect(parsedResult).toBe('Fields missing');
    expect(result.headers.location).toMatch('');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] transaction not found   -> 500 is returned', async () => {
    const { redirect } = require('../functions/auth-redirect-handler');
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD03MjU3NDUzOCZtZXJjaGFudElEPTEyMDk0MSZfX2xpZmVfXz0xNTk2OTkyMDg5&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toBe('Could not complete this transaction! Please try again');
    expect(result.headers.location).toMatch('');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment Failed -> Unauthorized  -> 301 is returned', async () => {
    // Assert
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 65803, // responseCode for 3d transaction declined
                    riskCheck: 'approve',
                    threeDSAuthenticated: 'U',
                    merchantData: JSON.stringify({
                        masterToken: 'mxtoken_123456'
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toBe('Transaction failed: Payment error!-65803');
    expect(result.headers.location).toMatch('http://localhost:3000/earth/error/');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment Failed -> Attempted  -> 301 is returned', async () => {
    // Assert
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // 'AVS CV2 DECLINED', - Attempted
                    threeDSAuthenticated: 'Y',
                    merchantData: JSON.stringify({
                        masterToken: 'mxtoken_123456'
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');
    // Event body = MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit
    //sample payload
    //{
    //MD: 'UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2',
    //PaRes: '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',
    //submit: 'Submit'
    //}
    //responseCode: 65803, -- declined 3ds declined
    // threeDSAuthenticated: 'U',

    //responseCode: 5,
    //responseMessage: 'AVS CV2 DECLINED', - Attempted
    //threeDSAuthenticated: 'A',
    //threeDSAuthenticated: 'Y',
    //Act
    // const payload = 'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);

    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toBe('Transaction failed: Card declined-5');
    expect(result.headers.location).toMatch('http://localhost:3000/earth/error/');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment success  -> 301 is returned', async () => {
    const AWSMock = require('aws-sdk-mock');
    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0,
                    threeDSAuthenticated: 'Y',
                    merchantData: JSON.stringify({
                        masterToken: 'mxtoken_123456'
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    expect(result.body).toBeNull();
    expect(result.headers.location).toMatch('payment.php?simple=1&bSuccess&id=');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment success - opt for save token -> 301 is returned', async () => {
    // Assert
    const AWSMock = require('aws-sdk-mock');
    AWSMock.mock('SQS', 'sendMessage', () => Promise.resolve('Success'));
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 0,
                    threeDSAuthenticated: 'Y',
                    merchantData: JSON.stringify({
                        masterToken: `mxtoken_12345678`
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD02NTI5MjMyOCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNTkwNzMzMjAy&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);

    //Assert
    expect(result.body).toBeNull();
    expect(result.headers.location).toMatch('payment.php?simple=1&bSuccess&id=');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment Failed(VCS Error) -> Unauthorized  -> 301 is returned', async () => {
    // Assert
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // responseCode for 3d transaction declined
                    vcsResponseCode: 5,
                    riskCheck: 'approve',
                    threeDSAuthenticated: 'U',
                    merchantData: JSON.stringify({
                        masterToken: 'mxtoken_123456'
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toContain('Transaction failed');
    expect(result.headers.location).toMatch('http://localhost:3000/earth/error/');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] valid MD/PaRes passed and payment Failed(riskCheck Error) -> Unauthorized  -> 301 is returned', async () => {
    // Assert
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {
                    responseCode: 5, // responseCode for 3d transaction declined
                    vcsResponseCode: 0,
                    riskCheck: 'decline',
                    threeDSAuthenticated: 'U',
                    merchantData: JSON.stringify({
                        masterToken: 'mxtoken_123456'
                    })
                };
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD05NzY3NDk3NCZtZXJjaGFudElEPTEyMjQ2OCZfX2xpZmVfXz0xNjE1OTg2MTc2&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toContain('Transaction failed');
    expect(result.headers.location).toMatch('http://localhost:3000/earth/error/');
    expect(result.statusCode).toBe(301);
});

test('[ redirect ] application failure happned -> Unauthorized  -> 301 is returned', async () => {
    // Assert
    CountryMock.setCountryOptions({ findOneEntityExists: true });
    jest.doMock('../../../layers/helper_lib/src/sale-helpers', () => {
        return {
            processCardStreamPayment: () => {
                return {};
            }
        };
    });
    const { redirect } = require('../functions/auth-redirect-handler');

    //Act
    const context = { awsRequestId: '1' };
    const payload =
        'MD=UDNLRVk6dHJhbnNhY3Rpb25JRD0xMjg4OTY5MTQmbWVyY2hhbnRJRD0xMjI0NjgmX19saWZlX189MTYzMjM4NjMzNg==&PaRes=eJylVlmTqkoS%2FisdfR%2BNPiyCygnaG8WOCsqq8IZQLMoii7L8%2BkHt7tNz5sTEjRkiCLKyMr9cKyn67y5LX26wqpMif3%2FFfqCvL38vaTOuIOQM6F8ruKQVWNdeBF%2BS4P11hpJYOAvnkPS9xeuS3gEd1o%2BdS9h5KL4IiQX5Fs4x6m0x94K3OUrN3%2BB07uHENKB8Mhh1PswtR2s%2FcBr5XI52Kj%2F28mZJe37JyOoSw6cEOaORjyWdwUrmluj4UNSo%2BFzSyC%2B93fVO1aPPXRIsFQ6039%2Bt6ePqoJHj%2B04jdwk68Bq4xFEcQ6fY%2FAXDf07xn3eLDz59ucOBrLiO2NholUa%2Bc%2BgxOxXM%2FX65wEeVrxUNu0uRw1Fi9PGLppFfzl28%2FBHF17PAsRF75NLmYUk3SfafTi1o5MGn68ZrrvXSopEPiva9222poLpp8am1sQROQ23TQtWdmeqGibZjsA8RGvrJEh1dvX8fWiCNiipp4uzu6r8zaOTuCvKo75I2kigfjVXwZeyXvH5%2FjZvm8hNB2rb90U5%2FFFWE4GMcCEoho0BQJ9Ffr08tGMh5WCxp1suLPPG9NBm8Ziy3Apu4CF6%2BDP4J0tTvqBii8%2BzbCPvmY0T%2BdueMiSFHfOTPoN%2Fc%2FSdWfne8qr23Ovawu4HfgJa0DkN4LzN8sXT5%2FfWvf971ZuXldVhUWf2N%2Fj%2Fj%2F8L5To%2F4XBLBuvlfgv8M%2FDvCJ57tpVe4TC%2BFjEZcbmSEeyaUvKgNOMmPRJgR7596T0ka%2BcrWRyo%2Fm%2BErrU%2FB66LjQz7bFb4zS4Fb9jcqgTepKOy2Ek82vkhWbjMp1fiSoQezcbdW52qMyCHhOQiJ6TpuC1tDNky7h17ilnseIPv4NF9L8x1GrgixaGedW6bFJh7ioWTFk3VQ5wk4hTOcMPm0zRVimIiImWYWOTkm0%2Fzs%2BGWNlGTYIZtqM6OSm4uY7WWzmJLTdSAf3Cu1d5vp9rbyXdOP1fO5qAnueNEd2JVXV6n3GuTLQh36rXedXEW%2F3O4nE8EwdM89CtWcsLVDxi%2BqTQl2wcS%2B9F3KMaKVdYhaiViRaf7VPyT%2BdReaaTDRF1FAIcRmo4U1Pjvz6OnUK4w8z9oGiwwjtLjWyvsoOcly0ddSt7OpK0Vq7%2B%2Ff%2BvejImvYPytwIFGK8xrvSbGwapJwPEjj1FNkmbueWBaU6wi0MgMimd%2BnW6gNQGWicxmfE5FqUQZotQA4Ble0umU1h7M1TeTblW0M%2FF5hNBFgFs9GraqgWmTh9ik4rFJZYFY2x0OFaZ%2F7bWtre%2FXkHtRB5tXbMdf7I97e5fsgs3tFj1ohemBzHKBiZ6pcFVwfNgfmErDk6YijnWACk4lUmwG%2BwvF66mYCdpS0SMNTFJoACi3abTnQKVzUqSdlqpxUb%2BT1T57zxVMkp2MHsHpiOSZI7Y2iO60AHvbXHEAHnWVMd69ifmZF92Gr6EQrPfc3HGMzDq6m%2FlQZbVPXQFrdjnf5wwp3D3IncmD%2FxFYUDhdOfk8MrqQ0vpiim2yM3eRthVEeeWHaVtFFO3MOdh2wDOcddHKsCyOffq8BLwCwZYG2APd9NlqPNA869sKrh3o3GTuiKsgUFuXAM8wJEXRBSxdGnucr7hbJbWKs%2Fa20to9Xxr1ZyWIXyVqpERMrhFR9pixlEJuM1%2Fd7A4rsvPH7crPaKuoC6lF46WoM6bfrFVgtbIVcDYYH833RTrjBBlHJGmh0zZz04I7SXdTtwpPAdDa3Xp9CFT2HMQOIhab6C8ZGExAU01XKXCYpUHvumCD5nEzO0vmCCYfqGCQEikyuauRBglRBe1UtreR7l3MK%2Byh7M6cSyEGyIG7pfG0KZ5xzMoaMqvU878RckhxRsAmiMWb6QtN9wklT2XZTJFxhx0zos5MOACevbzVrrPKVptyMIpRN7naNkavnjO5wk1qKB03mgAaYAgOteQLBvZaSRvBCpFmzRg%2BGIyIFLNbApme1qNpclFyTxXMrtWN%2F6OiJYcZeLsB%2FleXAQ9ZkgNWClmeQP525R715wBxI3ppRiDFvo3wqk9xuse0THqbytlfDWHflgUd1SaAy8hCIaOx6BqfMOhDOy5oPjhs7NROd5EixXuuREbsTR67nXhyS2J4jOcywdNKR0dnYf5jED9uw3JRmfcE2uziZcqjo3Wp5olu5fDzqBkXptqexDsNutwUrDDir2%2FvkpnmVP%2F5EqKzmqxIYcFX428vBF9ijpeCOV2Wm1daFU1tawmup1PPzSU2imLh3o7PMo4e0Uudkwa4m6VSKY7ZAWKwirDpKsUnWC6E%2BVoYY5r1QcX7LjlEV2%2FMqDz2gEtFkh57cGj3Mptox6dZaN03PlORJAA594E2OczE9qxuu3AeEkICeY21XLZ05uA%2FN3yfik%2FOclsjXBP01Wx9X0McV%2Bf4b%2Fn51%2Fhd4O7%2Bm&submit=Submit';
    const result = await redirect({ body: payload }, context);
    //Assert
    const parsedResult = JSON.parse(result.body);
    expect(parsedResult).toContain('Intentionally crashed the application');
    expect(result.headers.location).toMatch('http://localhost:3000/earth/error/');
    expect(result.statusCode).toBe(301);
});
