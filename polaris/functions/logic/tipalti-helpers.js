var { connectDB } = process.env.IS_OFFLINE ? require('../../../../layers/models_lib/src') : require('datman-models');
var axios = require('axios');
var convert = require('xml-js');
var CryptoJS = require('crypto-js');
const moment = require('moment-timezone');
const TIMEZONE = 'europe/london';

export const getDbConnection = async () => {
    let db = await connectDB(
        process.env.DB_HOST,
        process.env.DB_DATABASE,
        process.env.DB_USERNAME,
        process.env.DB_PASSWORD,
        process.env.IS_OFFLINE
    );
    return db;
};

export const convertJSONtoXML = (json) => {
    return convert.json2xml(json, { compact: true });
};

export const convertXMLtoJSON = (xml) => {
    return convert.xml2json(xml, { compact: true });
};

export const ProcessTipaltiPayouts = async (OrderItemsArray) => {
    let TipaltiPaymentOrderItems = getTipaltiPaymentOrderItemsPayload(OrderItemsArray);
    let InitialPayloadObjectJSON = getFullRequestPayload(TipaltiPaymentOrderItems);
    let InitialPayloadObjectXML = convertJSONtoXML(InitialPayloadObjectJSON);
    console.log('TipaltiPaymentOrderItems', JSON.stringify(TipaltiPaymentOrderItems));
    console.log('InitialPayloadObjectJSON', JSON.stringify(InitialPayloadObjectJSON));
    console.log({ InitialPayloadObjectXML });
    var config = {
        method: 'post',
        url: `${process.env.TIPALTI_API_DOMAIN}/PayerFunctions.asmx`,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: 'http://Tipalti.org/ProcessPayments'
        },
        data: InitialPayloadObjectXML
    };

    return await axios(config)
        .then(function (response) {
            console.log('Tipalti api response', response.data);
            return {
                status: true,
                http_code: response.status,
                data: JSON.parse(convert.xml2json(response.data, { compact: true }))
            };
        })
        .catch(function (error) {
            return { status: false, error };
        });
};

export const getFullRequestPayload = (TipaltiPaymentOrderItems) => {
    let payerName = 'FoodhubUSA'; //this should be configured in db later one,  so that it can be dynamical based on certain conditions
    let currentTime = Math.round(new Date().getTime() / 1000);
    let paymentGroupTitle = 'block1'; //this name is supposed to be the name of the payout groups, if not reflecting in dashboard, need to check
    let msg = payerName + currentTime + paymentGroupTitle;
    let messageSignature = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, process.env.TIPALTI_API_TOKEN)
        .update(msg)
        .finalize()
        .toString();
    return {
        _declaration: {
            _attributes: {
                version: '1.0',
                encoding: 'utf-8'
            }
        },
        'soap:Envelope': {
            _attributes: {
                'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/'
            },
            'soap:Body': {
                ProcessPayments: {
                    _attributes: {
                        xmlns: 'http://Tipalti.org/'
                    },
                    payerName: {
                        _text: payerName
                    },
                    paymentGroupTitle: {
                        _text: 'block1'
                    },
                    tipaltiPaymentsOrders: TipaltiPaymentOrderItems,
                    timeStamp: {
                        _text: currentTime
                    },
                    key: {
                        _text: messageSignature
                    }
                }
            }
        }
    };
};

export const getTipaltiPaymentOrderItemsPayload = (OrderItemsArray) => {
    let BankingMessage = 'Foodhub';
    let TipaltiPaymentOrderItemsArray = [];
    OrderItemsArray.forEach((item) => {
        var TipaltiPaymentOrderItem = {
            Idap: {
                _text: item.merchant_id
            },
            Amount: {
                _text: item.amount / 100 //converting the value in cents to decimal
            },
            RefCode: {
                _text: item.ref_code
            },
            IgnoreThresholds: {
                _text: 'true'
            },
            BankingMessage: {
                _text: BankingMessage
            },
            Currency: {
                _text: item.currency
            }
        };
        TipaltiPaymentOrderItemsArray.push(TipaltiPaymentOrderItem);
    });
    return { TipaltiPaymentOrderItem: TipaltiPaymentOrderItemsArray };
};

export const updatePayoutResultsAction = async (params) => {
    let { TipaltiApiResponse, batch_ids, db } = params;

    let TipaltiProcessPaymentsResult = TipaltiApiResponse?.data['soap:Envelope']['soap:Body']['ProcessPaymentsResponse']['ProcessPaymentsResult'];
    let TipaltiErrorCode = TipaltiProcessPaymentsResult?.errorCode?._text;
    let TipaltiErrorMessage = TipaltiProcessPaymentsResult?.errorMessage?._text;
    let ExpandedLineResult = TipaltiProcessPaymentsResult?.linesResults?.ExpandedLineResult || new Array();

    //ExpandedLineResult is always expected to be an array
    //but if there is only one element in a group, then ExpandedLineResult will be an object instead of array.
    //Hence converting it to array for further code reusability
    ExpandedLineResult = ExpandedLineResult.constructor === Object ? [ExpandedLineResult] : ExpandedLineResult;

    console.log({ TipaltiErrorCode });
    console.log({ TipaltiErrorMessage });
    console.log('ExpandedLineResult', JSON.stringify(ExpandedLineResult));
    let updatedResults, promiseExecutionResponse;
    if (Array.isArray(ExpandedLineResult) && ExpandedLineResult.length > 0) {
        console.log('Loop #1');
        //one or more payouts are affected
        updatedResults = ExpandedLineResult.map(async (item) => {
            let status =
                item.status._text === 'OK' && item.paymentOrderStatus._text === 'Submitted' ? 'SENT' : 'FAILED';
            let batch_id = ConvertRefCodeToBatchID(item.refCode._text);
            let TipaltiPayoutLogObject = {
                status,
                batch_id,
                aws_request_id: params.logMetaData.awsRequestId,
                http_response_code: TipaltiApiResponse.http_code,
                data: JSON.stringify(item)
            };
            let PayoutBatchUpdateObject = {
                status
            };
            if (status === 'SENT') {
                PayoutBatchUpdateObject['date_sent'] = moment().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');

                //updating payments table status to 4 on SENT
                let updatePaymentsStatusResponse = await updatePaymentsTable({
                    transaction_status_id: 4,
                    ref_code: item.refCode._text,
                    Payments: db.Payments,
                    PayoutBatchItem: db.PayoutBatchItem
                });
                console.log({updatePaymentsStatusResponse})
            }
            
            return await updatePayoutTables({
                TipaltiPayoutLogObject,
                PayoutBatchUpdateObject,
                batch_id,
                db
            });
        });
        promiseExecutionResponse = await Promise.all(updatedResults);
        return promiseExecutionResponse;
    }

    console.log('Loop #2');
    //all other cases are found to be failed and affected all payouts in general
    updatedResults = batch_ids.map(async (batch_id) => {
        let status = 'FAILED';
        let TipaltiPayoutLogObject = {
            status,
            batch_id: batch_id,
            aws_request_id: params.logMetaData.awsRequestId,
            http_response_code: TipaltiApiResponse.http_code,
            data: JSON.stringify(TipaltiProcessPaymentsResult)
        };
        let PayoutBatchUpdateObject = {
            status
        };
        return await updatePayoutTables({
            TipaltiPayoutLogObject,
            PayoutBatchUpdateObject,
            batch_id,
            db
        });
    });
    promiseExecutionResponse = await Promise.all(updatedResults);
    return promiseExecutionResponse;
};

export const updatePayoutTables = async (params) => {
    let { TipaltiPayoutLogObject, PayoutBatchUpdateObject, batch_id, db } = params;
    let { TipaltiPayoutLog, PayoutBatch } = db;
    let TipaltiPayoutLogInfo = await TipaltiPayoutLog.create(TipaltiPayoutLogObject);
    let UpdatePayoutBatchInfo = await PayoutBatch.update(PayoutBatchUpdateObject, {
        where: {
            batch_id,
            status: 'PENDING',
            payout_provider: 'TIPALTI'
        }
    });
    return { TipaltiPayoutLogInfo, UpdatePayoutBatchInfo };
};

export const ConvertBatchIDToRefCode = (batch_id) => {
    return `${batch_id}-${moment().tz(TIMEZONE).format('HHmmss')}`;
};

export const ConvertRefCodeToBatchID = (ref_code) => {
    //a ref_code generated will be in a format batchID-HHmmss
    const myArray = ref_code.split('-');
    return myArray[0];
};

export const verifyIpnRequest = async (data) => {
    var config = {
        method: 'post',
        url: `${process.env.TIPALTI_ACKNOWLEDGEMENT_API_DOMAIN}/notif/ipn.aspx`,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data
    };
    console.log('verifyIpnRequest config',config)
    return await axios(config)
        .then(function (response) {
            console.log('Tipalti api response', response.data);
            if (response.data === 'VERIFIED') {
                return {
                    status: true,
                    http_code: response.status,
                    data: response.data
                };
            }
            throw { message: `Invalid respose ${response.data}` };
        })
        .catch(function (error) {
            return { status: false, error: error.message };
        });
};

export const addWebhookLog = async (params) => {
    console.log('addWebhookLog params', params);
    let { ref_code, aws_request_id, payload, TipaltiWebhookLog } = params;
    let TipaltiWebhookLogInfo;
    //ref_code can be an array or object
    if (Array.isArray(ref_code)) {
        let WebhookLogInsertObjects = ref_code.map((record) => {
            return {
                payout_batch_id: ConvertRefCodeToBatchID(record.ref_code),
                aws_request_id,
                event_type: payload?.type,
                data: JSON.stringify(payload)
            };
        });
        console.log({ WebhookLogInsertObjects });
        TipaltiWebhookLogInfo = await TipaltiWebhookLog.bulkCreate(WebhookLogInsertObjects).then((data) => {
            return data;
        });
        return TipaltiWebhookLogInfo.map((item) => {
            return item.id;
        });
    }

    //if ref_code is not an array, jus do a single insert
    TipaltiWebhookLogInfo = await TipaltiWebhookLog.create({
        payout_batch_id: ConvertRefCodeToBatchID(ref_code),
        aws_request_id,
        event_type: payload?.type,
        data: JSON.stringify(payload)
    }).then((data) => {
        return data.id;
    });

    return TipaltiWebhookLogInfo;
};

export const updatePayoutBatchStatus = async (params) => {
    console.log('updatePayoutBatchStatus params', params);
    let { ref_code, updateData, PayoutBatch } = params;
    let promiseExecutionResponse;
    //ref_code can be an array or object
    if (Array.isArray(ref_code)) {
        let updatedResults = ref_code.map(async (record) => {
            console.log({ record });
            console.log(ConvertRefCodeToBatchID(record.ref_code));
            return await PayoutBatch.update(updateData, {
                where: {
                    batch_id: ConvertRefCodeToBatchID(record.ref_code)
                }
            });
        });
        promiseExecutionResponse = await Promise.all(updatedResults);
        return promiseExecutionResponse;
    }

    //if ref_code is not an array, jus do a single update
    return await PayoutBatch.update(updateData, {
        where: {
            batch_id: ConvertRefCodeToBatchID(ref_code)
        }
    });
};

export const updatePaymentsTable = async (params) => {
    let { transaction_status_id, ref_code, Payments, PayoutBatchItem } = params;
    let batch_id = ConvertRefCodeToBatchID(ref_code);

    //retreive the payments_id from batch_item table
    let PayoutBatchItemsInfo = await PayoutBatchItem.findAll({
        where: {
            batch_id
        },
        attributes: ['card_payment_id'],
        raw: true
    });
    console.log({ PayoutBatchItemsInfo });

    if (!PayoutBatchItemsInfo.length) {
        console.log('No payments to update#1');
        return false;
    }

    let transaction_ids = PayoutBatchItemsInfo.map((record) => {
        return record.card_payment_id;
    });

    console.log({ transaction_ids });

    if (!transaction_ids.length) {
        console.log('No payments to update#2');
        return false;
    }

    return await Payments.update(
        {
            transaction_status_id
        },
        {
            where: {
                id: transaction_ids
            }
        }
    );
};
