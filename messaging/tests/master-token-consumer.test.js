jest.mock('dotenv');
require('dotenv').config();
const { CardstreamSettingsMock, MasterTokenMock, SequelizeMock, CountryMock } = require('../../../test_helpers/_mock_');

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            CardstreamSettings: CardstreamSettingsMock.CardstreamSettingsModel,
            MasterToken: MasterTokenMock.MasterMockModel,
            sequelize: SequelizeMock.sequelize,
            Country: CountryMock.CountryMockModel,
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

var { cryptFunctions } = process.env.IS_OFFLINE ? require('../../../layers/helper_lib/src') : require('datman-helpers');

// test('[masterToken] checking optomany tokenisation', async () => {
//     const { MasterTokenService } = require('../consumer/master_token.service');
//     const masterTokenService = new MasterTokenService();

//     let encrptedQueueData = cryptFunctions.encryptPayload(
//         JSON.stringify({
//             card_number: '5224999999999909',
//             expiry_month: '12',
//             expiry_year: '21',
//             merchant_id: '122466',
//             cvv: '000',
//             provider: 'CARDSTREAM',
//             provider_token: 'egtoken_1234567890',
//             last_4_digit: '0821',
//             customer_id: '1234',
//             other_provider: 'OPTOMANY',
//             first_name: 'Ishika',
//             last_name: 'Garg',
//             postcode: 'NN178YG',
//             address: 'Flat 6 Primrose Rise 347 Lavender Road Northampton',
//             master_token: 'mxtoken_1234567890'
//         }),
//         process.env.MX_PAYLOAD_ENCRYPTION_KEY
//     );

//     MasterTokenMock.setMasterOptions({ findOneEntityExists: false });

//     var result = await masterTokenService.mastertoken({
//         Records: [
//             {
//                 body: JSON.stringify({
//                     payload: encrptedQueueData
//                 })
//             }
//         ]
//     });
//     expect(result.success).toBe(true);
// });

test('[masterToken] checking cardstream tokenisation', async () => {
    const { MasterTokenService } = require('../consumer/master_token.service');
    const masterTokenService = new MasterTokenService();

    CountryMock.setCountryOptions({ findOneEntityExists: true });
    const axios = require('axios');

    jest.mock('axios');

    axios.mockImplementationOnce(() =>
        Promise.resolve({
            data: 'responseCode=0&xref=21050408GJ06JZ06SV33DYY'
        })
    );

    let encrptedQueueData = cryptFunctions.encryptPayload(
        JSON.stringify({
            card_number: '4929421234600821',
            expiry_month: '12',
            expiry_year: '21',
            cvv: '356',
            merchant_id: '122466',
            provider: 'OPTOMANY',
            provider_token: '1234567890',
            last_4_digit: '0821',
            customer_id: '1234',
            other_provider: 'CARDSTREAM',
            first_name: 'Ishika',
            last_name: 'Garg',
            postcode: 'NN178YG',
            address: 'Flat 6 Primrose Rise 347 Lavender Road Northampton',
            master_token: 'mxtoken_1234567890',
            transactionUnique: 'O1234T1234M4567'
        }),
        process.env.MX_PAYLOAD_ENCRYPTION_KEY
    );

    MasterTokenMock.setMasterOptions({ findOneEntityExists: false });

    var result = await masterTokenService.mastertoken({
        Records: [
            {
                body: JSON.stringify({
                    payload: encrptedQueueData
                })
            }
        ]
    });
    expect(result.success).toBe(true);
});

test('[masterToken] checking if any error queue should be deleted manually', async () => {
    const { MasterTokenService } = require('../consumer/master_token.service');
    const masterTokenService = new MasterTokenService();

    const axios = require('axios');

    jest.mock('axios');

    axios.mockImplementationOnce(() =>
        Promise.resolve({
            data:
                'responseCode=66057&responseMessage=ERROR+CODE+%28RC_MISSING_CURRENCYCODE%29&responseStatus=2&merchantID=122466&caEnabled=N&rtsEnabled=N&cftEnabled=N&cardCVVMandatory=Y&threeDSEnabled=N&threeDSCheckPref=authenticated%2Cattempted+authentication&riskCheckEnabled=Y&riskCheckPref=not+known%3Dcontinue%2Cnot+checked%3Dcontinue%2Capprove%3Dcontinue%2Cdecline%3Dcontinue%2Creview%3Dcontinue%2Cescalate%3Dcontinue&avscv2CheckEnabled=Y&addressCheckPref=not+known%2Cnot+checked%2Cmatched%2Cnot+matched%2Cpartially+matched&postcodeCheckPref=not+known%2Cnot+checked%2Cmatched%2Cnot+matched%2Cpartially+matched&cv2CheckPref=not+known%2Cnot+checked%2Cmatched%2Cnot+matched%2Cpartially+matched&surchargeEnabled=N&customerReceiptsRequired=N&eReceiptsEnabled=N&riskProcessorID=41&riskProcessorName=Kount&__wafRequestID=2021-04-08T07%3A00%3A06Z%7Cbe279170fc%7C103.5.134.41%7COT4BKYPbGo&action=VERIFY&amount=0&cardExpiryMonth=12&cardExpiryYear=21&customerAddress=Flat+6+Primrose+Rise+347+Lavender+Road+Northampton&customerName=Ishika+Garg&customerPostCode=NN178YG&duplicateDelay=1&type=1&requestID=606ea9f716390&customerPostcode=NN178YG&state=finished&requestMerchantID=122466&processMerchantID=122466&paymentMethod=card&cardType=Visa+Credit&cardTypeCode=VC&cardScheme=Visa&cardSchemeCode=VC&cardIssuer=BARCLAYS+BANK+PLC&cardIssuerCountry=United+Kingdom&cardIssuerCountryCode=GBR&cardFlags=8323072&cardNumberMask=492942%2A%2A%2A%2A%2A%2A0821&cardNumberValid=Y&xref=21040808VC00MQ07VF67TCC&transactionID=101162765&vcsResponseCode=0&vcsResponseMessage=Success+-+no+velocity+check+rules+applied&timestamp=2021-04-08+08%3A00%3A07&signature=4bda16d6d4a2d9b88773f1efe45397e01e95176e417649126bc2f6e545db99ee0f280ffea5c3857f5414168d31cc8ecd6db2775c8da058be33a855424be85f90'
        })
    );

    let encrptedQueueData = cryptFunctions.encryptPayload(
        JSON.stringify({
            card_number: '4929421234600821',
            expiry_month: '12',
            expiry_year: '21',
            cvv: '356',
            merchant_id: '122466',
            provider: 'OPTOMANY',
            provider_token: '1234567890',
            last_4_digit: '0821',
            customer_id: '1234',
            other_provider: 'CARDSTREAM',
            first_name: 'Ishika',
            last_name: 'Garg',
            postcode: 'NN178YG',
            address: 'Flat 6 Primrose Rise 347 Lavender Road Northampton',
            master_token: 'mxtoken_1234567890',
            transactionUnique: 'O1234T1234M4567'
        }),
        process.env.MX_PAYLOAD_ENCRYPTION_KEY
    );

    MasterTokenMock.setMasterOptions({ findOneEntityExists: true });

    expect(
        async () =>
            await masterTokenService.mastertoken({
                Records: [
                    {
                        body: JSON.stringify({
                            payload: encrptedQueueData
                        })
                    },
                    {
                        body: JSON.stringify({
                            payload: ''
                        })
                    }
                ]
            })
    ).rejects.toThrow('Following messag(es) was failing . Check specific error above.');
});

afterEach(() => {
    MasterTokenMock.resetMasterOptions();
    CardstreamSettingsMock.resetCardstreamSettingsOptions();
    CountryMock.resetCountryOptions();
});
