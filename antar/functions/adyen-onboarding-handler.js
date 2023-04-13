const { response, logHelpers, TokenAuthorize } = process.env.IS_OFFLINE
    ? require('../../../layers/helper_lib/src')
    : require('datman-helpers');
const { connectDB } = process.env.IS_OFFLINE ? require('../../../layers/models_lib/src') : require('datman-models');
const axios = require('axios');
const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const schema = require('../schema/refund-schema');
const TIMEZONE = 'europe/london';
let logger = logHelpers.logger;

//some essential declaration in staging
var cp_document_table_name = 'cp_documents';
var s3_bucket = 'mypay-migr-documents-bucket-dev';
var s3_region = 'eu-central-1';
var s3_access_key = 'AKIAYQHXHQ6N77344NTK';
var s3_secret_key = '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';
var s3_expire_time_seconds = 600;
var ADYEN_API_AUTH_TOKEN =
    'AQE1hmfxLo7PYhZAw0exgG89s9SXSYhIQ7VFV2F+03qbkmdfmMhkHeFfW99M/IkIe/kIZ9lurDwQwV1bDb7kfNy1WIxIIkxgBw==-nEfiDoQ+aky83itWX6ukPAcY4UASNMxGZXvtSx8Le28=-WU7,+)gcpvJ*r*rq';
const s3Client = new AWS.S3({
    region: s3_region,
    accessKeyId: s3_access_key,
    secretAccessKey: s3_secret_key,
    signatureVersion: 'v4'
});

var fs = require('fs');

export const AntarOnboarding = async (event, context) => {
    let logMetadata = {
        location: 'antar ~ AntarOnboarding',
        awsRequestId: context.awsRequestId
    };

    const requestId = `reqid_${context.awsRequestId}`;
    const db = connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    const { sequelize, PaymentTransaction } = db;
    try {
        //set some limit
        let limit = 100;
        let success_count = 0,
            failed_count = 0;
        let kyc_count = {
            3: 0,
            4: 0,
            5: 0
        };
        let onboarding_ids = [];
        //read the ready data from db for Individual type
        let [MerchantInfo] = await sequelize.query(
            `SELECT * FROM adyen_client_onboarding where status = 1 and legalEntity in ('Individual','Business') limit ${limit}`
        );

        if (MerchantInfo.length === 0) {
            throw { message: 'No records to onboard!' };
        }

        for (let i = 0; i < MerchantInfo.length; i++) {
            onboarding_ids.push(MerchantInfo[i].id);
        }

        //change status to 11, so that other lambdas wont pick these
        await sequelize.query(
            `UPDATE adyen_client_onboarding 
                SET status = 11 
                WHERE id in (${onboarding_ids.join(',')})
                limit ${limit}`
        );
        //do validation of fields

        for (let i = 0; i < MerchantInfo.length; i++) {
            /* 
            Below are the steps
                1. Adyen merchant account creation
                    a. Form the adyen payload and create adyen merchant account
                    b. On success, Update adyen_client_onboarding table with status = 2
                2. Adyen document approval, 
                    a. Get the documents for the client from db and s3
                    b. Convert the document into base64
                    c. Adyen api call to update the document
                    d. On success, Update adyen_client_onboarding table with status = 3/4/5 (based on processing status)
            */
            //form the payload
            let Payload = await GetCreateAccountHolderPayload(
                {
                    MerchantInfo: MerchantInfo[i]
                },
                MerchantInfo[i].legalEntity
            );
            logger.info(logMetadata, 'adyen_request_payload', Payload);
            // console.log(Payload.accountHolderDetails.businessDetails.signatory);
            // console.log(Payload.accountHolderDetails.businessDetails.shareholders);
            // console.log('stopped here');
            // return false;
            // logger.info(logMetadata, 'adyen request payload', Payload);
            let adyen_response = await CallCreateAccountHolderAdyenAPI({
                Payload
            });
            logger.info(logMetadata, 'adyen_response', adyen_response);
            if (!adyen_response.status) {
                //update log table with error and continue
                await updateLog({
                    onboarding_id: MerchantInfo[i].id,
                    action: 'createAccountHolder',
                    api_data: JSON.stringify({
                        api_payload: Payload,
                        api_response: adyen_response.data
                    }),
                    more_info: adyen_response?.data?.invalidFields[0]?.errorDescription
                        ? adyen_response.data.invalidFields[0].errorDescription
                        : '',
                    response_type: 'ERROR',
                    sequelize
                });
                logger.info(logMetadata, `${MerchantInfo[i].accountHolderCode} failed (${MerchantInfo[i].id})`);
                failed_count++;
                continue;
            }
            await updateLog({
                onboarding_id: MerchantInfo[i].id,
                action: 'createAccountHolder',
                api_data: JSON.stringify({
                    api_payload: Payload,
                    api_response: adyen_response.data
                }),
                more_info: '',
                response_type: 'SUCCESS',
                sequelize
            });
            let adyen_sub_merchant_account = adyen_response?.data?.accountCode;
            let adyen_bank_uuid = adyen_response?.data?.accountHolderDetails?.bankAccountDetails[0]?.bankAccountUUID;
            let adyen_share_holder_code = '';
            let adyen_signatory_code = '';
            let more_info = '';

            if (MerchantInfo[i].legalEntity === 'Business') {
                adyen_share_holder_code =
                    adyen_response?.data?.accountHolderDetails?.businessDetails?.shareholders[0]?.shareholderCode;
                adyen_signatory_code =
                    adyen_response?.data?.accountHolderDetails?.businessDetails?.signatories[0]?.signatoryCode;
            }

            logger.info(logMetadata, `adyen_share_holder_code ${adyen_share_holder_code}`);
            logger.info(logMetadata, `adyen_signatory_code ${adyen_signatory_code}`);
            logger.info(logMetadata, `MerchantInfo[i].legalEntity ${MerchantInfo[i].legalEntity}`);
            logger.info(
                logMetadata,
                `adyen_response?.data?.accountHolderDetails?.businessDetails?.shareholders[0]?.shareholderCode ${adyen_response?.data?.accountHolderDetails?.businessDetails?.shareholders[0]?.shareholderCode}`
            );
            logger.info(
                logMetadata,
                `adyen_response?.data?.accountHolderDetails?.businessDetails?.signatories[0]?.signatoryCode ${adyen_response?.data?.accountHolderDetails?.businessDetails?.signatories[0]?.signatoryCode}`
            );
            logger.info(
                logMetadata,
                `adyen_response?.data?.accountHolderDetails?.businessDetails?.shareholders[0].shareholderCode ${adyen_response?.data?.accountHolderDetails?.businessDetails?.shareholders[0].shareholderCode}`
            );
            logger.info(
                logMetadata,
                `adyen_response?.data?.accountHolderDetails?.businessDetails?.signatories[0].signatoryCode ${adyen_response?.data?.accountHolderDetails?.businessDetails?.signatories[0].signatoryCode}`
            );

            if (!MerchantInfo[i].dob) {
                more_info = ",more_info = 'created without dob'";
            }
            //update main table if required
            await sequelize.query(
                `UPDATE adyen_client_onboarding 
                    SET 
                        status = 2,
                        adyen_sub_merchant_account = :adyen_sub_merchant_account,
                        adyen_bank_uuid = :adyen_bank_uuid,
                        adyen_share_holder_code = :adyen_share_holder_code,
                        adyen_signatory_code = :adyen_signatory_code
                        ${more_info}
                    WHERE id = ${MerchantInfo[i].id}
                    limit ${limit}`,
                {
                    replacements: {
                        adyen_sub_merchant_account,
                        adyen_bank_uuid,
                        adyen_share_holder_code,
                        adyen_signatory_code
                    }
                }
            );
            logger.info(logMetadata, `${MerchantInfo[i].accountHolderCode} success (${MerchantInfo[i].id})`);
            success_count++;

            //now we need to upload the documents to the merchant created
            //using try catch, so that any exception wont terminate the main script execution
            /* try {
                let KycUpdatedInfo = await updateKycDocuments({
                    MerchantInfo: MerchantInfo[i],
                    adyen_bank_uuid,
                    sequelize
                });
                if (!KycUpdatedInfo.onboardingStatus) {
                    throw { message: 'Kyc update process failed' };
                }
                await sequelize.query(
                    `UPDATE adyen_client_onboarding 
                        SET 
                            status = ${KycUpdatedInfo.onboardingStatus}
                        WHERE id = ${MerchantInfo[i].id}
                        limit ${limit}`
                );
                logger.info(
                    logMetadata,
                    `${MerchantInfo[i].accountHolderCode} KYC success (${JSON.stringify(KycUpdatedInfo)})})`
                );
                kyc_count[KycUpdatedInfo.onboardingStatus]++;
            } catch (e) {
                //below update is only for debugging in local, need to remove before pushing to prod
                // await sequelize.query(
                //     `UPDATE adyen_client_onboarding
                //         SET
                //             status = 1,
                //             adyen_sub_merchant_account = '',
                //             adyen_bank_uuid = ''
                //         WHERE id = ${MerchantInfo[i].id}
                //         limit ${limit}`
                // );
                logger.info(logMetadata, `${MerchantInfo[i].accountHolderCode} KYC failed (${e.message})`);
            } */
        }

        let message = `Onboarding Finished, Reports 
                Success: ${success_count} 
                Failed: ${failed_count} 
                KYC: ${JSON.stringify(kyc_count)}
                Total: ${success_count + failed_count}`;
        let api_response = {
            request_id: requestId,
            message
        };
        logger.info(logMetadata, 'api_response', api_response);

        sequelize.close && (await sequelize.close());
        return response(api_response);
    } catch (e) {
        const errorResponse = {
            error: {
                request_id: requestId,
                status: 'Error',
                message: e.message
            }
        };
        logger.error(logMetadata, errorResponse);
        sequelize.close && (await sequelize.close());
        return response(errorResponse, 500);
    }
};

let updateKycDocuments = async (params, test_mode = false) => {
    let document_uploaded_status = {
        bank: false,
        id_proof: false,
        both: false
    };
    if (test_mode === 'test_success') {
        return {
            onboardingStatus: randomIntFromInterval(3, 5)
        };
    } else if (test_mode === 'test_error') {
    }

    //check and get avaialable documents from db for this client
    let [AllDocs] = await params.sequelize.query(
        `SELECT * FROM ${cp_document_table_name} 
            WHERE 
            merchant_id = :merchant_id`,
        {
            replacements: {
                //using this replace to handle escape string in raw queries
                merchant_id: params.MerchantInfo.accountHolderCode
            }
        }
    );
    // console.log({AllDocs})
    //if no docs available,thow no docs available
    if (AllDocs.length === 0) {
        throw { message: 'No documents availabe in db!' };
    }

    const bankDocIds = [DocumentTypesId.BANK_STATEMENT, DocumentTypesId.VOID_CHEQUE];
    const idProofsIds = [
        DocumentTypesId.PASSPORT,
        DocumentTypesId.DRIVING_LICENSE,
        DocumentTypesId.ID_PROOF_FRONT,
        DocumentTypesId.ID_PROOF_BACK
    ];
    //filter the bank documents & id proof document
    const bankDocs = await AllDocs.filter((doc) => bankDocIds.includes(doc.doc_type_id));
    const idProofDocs = AllDocs.filter((doc) => idProofsIds.includes(doc.doc_type_id));

    //filter the ones having status = 'ACTIVE'
    const anyActiveBankDocs = bankDocs.filter((doc) => doc.status === 'ACTIVE');
    const anyActiveIdProofDocs = idProofDocs.filter((doc) => doc.status === 'ACTIVE');

    //select a one file from each bank & id proof,
    //check if any document with active status exists, if not select the latest one
    let selectedBankDoc = anyActiveBankDocs.length !== 0 ? anyActiveBankDocs[0] : bankDocs[0];
    let selectedIdProofsDoc = anyActiveIdProofDocs.length !== 0 ? anyActiveIdProofDocs[0] : idProofDocs[0];

    //preparing bank upload
    const s3BankParams = {
        Bucket: s3_bucket,
        Key: `merchant/${params.MerchantInfo.accountHolderCode}/${selectedBankDoc.id}/${selectedBankDoc.filename}`,
        Expires: s3_expire_time_seconds
    };
    const presignedBankDocUrl = await s3Client.getSignedUrlPromise('getObject', s3BankParams);
    console.log({ presignedBankDocUrl });
    try {
        let bankDoc = await axios.get(presignedBankDocUrl, { responseType: 'arraybuffer' });
        let rawBankDoc = Buffer.from(bankDoc.data).toString('base64');
        var bankBase64Image = 'data:' + bankDoc.headers['content-type'] + ';base64,' + rawBankDoc;
        // var bankBase64Image = rawBankDoc;
        // fs.writeFile("./message.txt", bankBase64Image, function(err){
        //     if (err) throw err;
        // });
    } catch (e) {
        console.log('Axios catch error - presignedBankDocUrl', e.response.data);
    }

    const uploadBankDocPayload = {
        documentDetail: {
            accountHolderCode: params.MerchantInfo.accountHolderCode,
            description: 'PASSED',
            documentType: DocumentTypesIdToName[selectedBankDoc.doc_type_id],
            filename: selectedBankDoc.filename,
            bankAccountUUID: params.adyen_bank_uuid
        },
        documentContent: bankBase64Image
    };

    let BankDocumentUploadStatus = await UploadDocumentAdyenAPI({
        Payload: uploadBankDocPayload
    });

    if (BankDocumentUploadStatus.status) {
        document_uploaded_status.bank = true;
    }

    //preparing id proof document upload
    const s3IdProofParams = {
        Bucket: s3_bucket,
        Key: `merchant/${params.MerchantInfo.accountHolderCode}/${selectedIdProofsDoc.id}/${selectedIdProofsDoc.filename}`,
        Expires: s3_expire_time_seconds
    };
    const presignedIdProofDocUrl = await s3Client.getSignedUrlPromise('getObject', s3IdProofParams);
    console.log({ presignedIdProofDocUrl });
    try {
        let idProofDoc = await axios.get(presignedIdProofDocUrl, { responseType: 'arraybuffer' });
        let rawIdProofDoc = Buffer.from(idProofDoc.data).toString('base64');
        console.log({ rawIdProofDoc });
        var idProofBase64Image = 'data:' + idProofDoc.headers['content-type'] + ';base64,' + rawIdProofDoc;
        // var idProofBase64Image = rawIdProofDoc;
    } catch (e) {
        console.log('Axios catch error - presignedBankDocUrl', e.response.data);
    }

    const uploadIdProofDocPayload = {
        documentDetail: {
            accountHolderCode: params.MerchantInfo.accountHolderCode,
            description: 'PASSED',
            documentType: DocumentTypesIdToName[selectedIdProofsDoc.doc_type_id],
            filename: selectedIdProofsDoc.filename
        },
        documentContent: idProofBase64Image
    };

    let IdProofDocumentUploadStatus = await UploadDocumentAdyenAPI({
        Payload: uploadIdProofDocPayload
    });

    if (IdProofDocumentUploadStatus.status) {
        document_uploaded_status.id_proof = true;
    }

    document_uploaded_status.both = document_uploaded_status.bank && document_uploaded_status.id_proof;

    let onboardingStatus =
        document_uploaded_status.both === true
            ? 5
            : document_uploaded_status.bank === true
            ? 3
            : document_uploaded_status.id_proof === true
            ? 4
            : null;
    console.log({ document_uploaded_status });
    return { onboardingStatus };
};

let UploadDocumentAdyenAPI = async (params, test_mode = false) => {
    console.log('params.Payload', params.Payload);
    try {
        let axios_config = {
            method: 'post',
            url: `https://cal-live.adyen.com/cal/services/Account/v6/uploadDocument`,
            data: params.Payload,
            headers: {
                'x-API-key': ADYEN_API_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        };
        if (params.Payload.documentContent) {
            axios_config.headers['Content-Length'] = params.Payload.documentContent.length;
        }
        console.log({ axios_config });
        /** single attempt */
        let response = await axios(axios_config);
        /** multiple attempt */
        /* let response
        for (let i = 0; i < 3; i++) {
            response = await axios(axios_config);
            const { errorCode } = response.data;
            if (errorCode) {
                setTimeout(function () {
                    console.log(`timing out before the next attempt`);
                }, 500);
            } else {
                break;
            }
        } */

        return { status: true, data: response.data };
    } catch (error) {
        console.log('UploadDocumentAdyenAPI Catch Error', error.response.data);
        return { status: false, data: error.response.data };
    }
};

function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

let CallCreateAccountHolderAdyenAPI = async (params, test_mode = false) => {
    if (test_mode === 'test_success') {
        return {
            status: true,
            data: {
                accountCode: 8616412907763608,
                accountHolderDetails: {
                    bankAccountDetails: [
                        {
                            bankAccountUUID: '57ae879e-58e8-4805-9f11-3a2c58d62709'
                        }
                    ]
                }
            }
        };
    } else if (test_mode === 'test_error') {
        return { status: false, data: 'Mocking error' };
    }
    try {
        let response = await axios({
            method: 'post',
            url: `https://cal-live.adyen.com/cal/services/Account/v6/createAccountHolder`,
            data: params.Payload,
            headers: {
                'x-API-key': ADYEN_API_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        return { status: true, data: response.data };
    } catch (error) {
        console.log('CallCreateAccountHolderAdyenAPI Error', error.response.data, error.response.status);
        return { status: false, data: error.response.data };
    }
};

let updateLog = async (params) => {
    return await params.sequelize.query(
        `INSERT into adyen_client_onboarding_log 
            SET 
            action = :action,
            onboarding_id = :onboarding_id,
            api_data = :api_data,
            more_info = :more_info,
            response_type = :response_type`,
        {
            replacements: {
                action: params.action,
                onboarding_id: params.onboarding_id,
                api_data: params.api_data,
                more_info: params.more_info,
                response_type: params.response_type
            }
        }
    );
};

let GetCreateAccountHolderPayload = async (params, type = '') => {
    if (!type) {
        return {};
    }
    let { MerchantInfo } = params;
    let address = {
        city: MerchantInfo.address_city,
        country: 'GB',
        postalCode: MerchantInfo.address_postalCode,
        stateOrProvince: 'GB',
        street: MerchantInfo.address_street != '' ? MerchantInfo.address_street : 'street',
        houseNumberOrName: MerchantInfo.address_houseNumberOrName
    };
    let fullPhoneNumber = `${MerchantInfo.phoneNumber}`.startsWith('+')
        ? MerchantInfo.phoneNumber
        : `+${MerchantInfo.phoneNumber}`;
    if (type === 'Individual') {
        return {
            accountHolderCode: MerchantInfo.accountHolderCode,
            accountHolderDetails: {
                bankAccountDetails: [
                    {
                        countryCode: 'GB',
                        currencyCode: 'GBP',
                        accountNumber: MerchantInfo.bank_accountNumber,
                        bankAccountName: MerchantInfo.bank_bankAccountName,
                        branchCode: MerchantInfo.bank_branchCode,
                        bankName: MerchantInfo.bank_bankName,
                        ownerCity: MerchantInfo.bank_ownerCity,
                        ownerCountryCode: 'GB',
                        ownerHouseNumberOrName: MerchantInfo.bank_ownerHouseNumberOrName,
                        ownerName: MerchantInfo.bank_ownerName,
                        ownerPostalCode: MerchantInfo.bank_ownerPostalCode,
                        ownerStreet: MerchantInfo.bank_ownerStreet
                    }
                ],

                phoneNumber: {
                    phoneNumber: MerchantInfo.phoneNumber,
                    phoneCountryCode: 'GB'
                },

                email: MerchantInfo.email,
                address: {
                    city: MerchantInfo.address_city,
                    country: 'GB',
                    postalCode: MerchantInfo.address_postalCode,
                    stateOrProvince: 'GB',
                    street: MerchantInfo.address_street != '' ? MerchantInfo.address_street : 'street',
                    houseNumberOrName: MerchantInfo.address_houseNumberOrName
                },

                // dateOfBirth: "1970-01-01",
                individualDetails: {
                    name: {
                        firstName: MerchantInfo.individualDetails_firstName,
                        lastName: MerchantInfo.individualDetails_lastName
                        // gender: "MALE"
                    },
                    personalData: {
                        // dateOfBirth: "1970-01-01"
                    }
                }
            },
            legalEntity: MerchantInfo.legalEntity,
            processingTier: 3
        };
    }

    if (type === 'Business') {
        let { MerchantInfo } = params;
        let businessDetailsSignatoryObject = {
            jobTitle: 'President',
            name: {
                firstName: MerchantInfo.individualDetails_firstName,
                lastName: MerchantInfo.individualDetails_lastName
            },
            personalData: {
                nationality: 'GB'
            },
            address,
            email: MerchantInfo.email,
            fullPhoneNumber
        };
        let businessDetailsShareHolderObject = {
            name: {
                firstName: MerchantInfo.individualDetails_firstName,
                lastName: MerchantInfo.individualDetails_lastName
            },
            address,
            email: MerchantInfo.email,
            shareholderType: 'Owner',
            personalData: {
                nationality: 'GB'
            }
        };
        if (MerchantInfo.dob) {
            businessDetailsSignatoryObject.personalData['dateOfBirth'] = MerchantInfo.dob;
            businessDetailsShareHolderObject.personalData['dateOfBirth'] = MerchantInfo.dob;
        }
        return {
            accountHolderCode: MerchantInfo.accountHolderCode,
            legalEntity: MerchantInfo.legalEntity,
            processingTier: 3,
            accountHolderDetails: {
                fullPhoneNumber,
                email: MerchantInfo.email,
                webAddress: MerchantInfo.web_address,
                address,
                businessDetails: {
                    legalBusinessName: MerchantInfo.business_name,
                    doingBusinessAs: MerchantInfo.business_name,
                    registrationNumber: MerchantInfo.registration_number,
                    signatories: [businessDetailsSignatoryObject],
                    shareholders: [businessDetailsShareHolderObject]
                },
                bankAccountDetails: [
                    {
                        countryCode: 'GB',
                        currencyCode: 'GBP',
                        accountNumber: MerchantInfo.bank_accountNumber,
                        bankAccountName: MerchantInfo.bank_bankAccountName,
                        branchCode: MerchantInfo.bank_branchCode,
                        bankName: MerchantInfo.bank_bankName,
                        ownerCity: MerchantInfo.bank_ownerCity,
                        ownerCountryCode: 'GB',
                        ownerHouseNumberOrName: MerchantInfo.bank_ownerHouseNumberOrName,
                        ownerName: MerchantInfo.bank_ownerName,
                        ownerPostalCode: MerchantInfo.bank_ownerPostalCode,
                        ownerStreet: MerchantInfo.bank_ownerStreet
                    }
                ]
            }
        };
    }
};

const DocumentTypesIdToName = {
    1: 'BANK_STATEMENT',
    3: 'DRIVING_LICENCE_FRONT',
    4: 'PASSPORT',
    8: 'BANK_STATEMENT',
    9: 'ID_CARD_FRONT',
    10: 'ID_CARD_BACK'
};

export const DocumentTypesId = {
    BANK_STATEMENT: 1,
    BUSINESS_RATES_BILL: 2,
    DRIVING_LICENSE: 3,
    PASSPORT: 4,
    RENTAL_AGREEMENT: 5,
    RESIDENCY_PERMIT: 6,
    UTILITY_BILL: 7,
    VOID_CHEQUE: 8,
    ID_PROOF_FRONT: 9,
    ID_PROOF_BACK: 10,
    BUSINESS_REGISTRATION_CERTIFICATE: 11
};
