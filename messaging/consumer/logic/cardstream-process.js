const axios = require('axios');
const crypto = require('crypto');
const queryString = require('query-string');

export const processCardStreamPayment = async (payload, signature) => {
    try {
        // get the keys in the object
        var items = Object.keys(payload);

        var string = '';

        // sort the array of keys
        items.sort();

        // for each key loop over in order
        items.forEach(function (item) {
            string += item + '=' + encodeURIComponent(payload[item]) + '&';
        });

        // remove the trailing &
        string = string.slice(0, -1);

        // below replaces are to ensure the escaping is the same as php's http_build_query()
        string = string.replace(/\(/g, '%28');
        string = string.replace(/\)/g, '%29');
        string = string.replace(/%20/g, '+');

        // make the new string
        payload =
            string +
            '&signature=' +
            crypto
                .createHash('SHA512')
                .update(string + signature)
                .digest('hex');

        let r = await axios.post('https://gateway.cardstream.com/direct/', payload);
        let q = queryString.parse(r.data, { parseNumbers: true });
        return q;
    } catch (err) {
        err.data ? (err.data = '') : '';
        err.config && err.config.data ? (err.config.data = '') : '';
        console.log('~ MasterTokenServiceV2 ~ cardStreamTokenisationError ~ ', err);

        return err;
    }
};

export const alreadyExist = async (dbInstanse, reqParams) => {
    var { MasterToken } = dbInstanse;
    return await MasterToken.findOne({
        attributes: ['master_token'],
        where: {
            master_token: reqParams.metaData.master_token,
            provider: reqParams.metaData.provider,
            customer_id: reqParams.metaData.customer_id
        }
    });
};

export const getCsVerify = async (dbInstanse, decryptedPayload) => {
    var { CardstreamSettings, Customer, Country } = dbInstanse;
    let csSettigs = await CardstreamSettings.findAll({
        attributes: ['name', 'value']
    }).then(function (resultSet) {
        let settings = {};
        resultSet.forEach((resultSetItem) => {
            settings[resultSetItem.name] = resultSetItem.value;
        });
        return settings;
    });

    var { cardstream_id } = await Customer.findOne({
        where: { id: decryptedPayload?.merchant_id }
    });

    const countryInfo = await Country.findOne({
        attributes: ['id', 'iso_country_code', 'iso_currency_code'],
        include: [
            {
                attributes: ['id'],
                model: Customer,
                where: {
                    id: decryptedPayload?.merchant_id
                }
            }
        ],
        raw: true
    });

    var signature = csSettigs.api_key;

    let cs_payload = {
        action: 'VERIFY',
        amount: 0,
        merchantID: cardstream_id,
        type: 1,
        currencyCode: countryInfo.iso_currency_code,
        countryCode: countryInfo.iso_country_code,
        cardNumber: decryptedPayload?.card_number,
        cardExpiryMonth: decryptedPayload?.exp_month ? decryptedPayload?.exp_month : decryptedPayload?.expiry_month,
        cardExpiryYear: decryptedPayload?.exp_year ? decryptedPayload?.exp_year : decryptedPayload?.expiry_year,
        cardCVV: decryptedPayload?.cvv,
        customerPostCode: decryptedPayload?.billing_post_code
            ? decryptedPayload?.billing_post_code
            : decryptedPayload?.postcode,
        customerAddress: decryptedPayload?.billing_address
            ? decryptedPayload?.billing_address
            : decryptedPayload?.address,
        transactionUnique: '013ds' + Math.random(),
        threeDSRequired: 'N',
        addressCheckPref: 'not known, not checked, matched, not matched, partially matched',
        postcodeCheckPref: 'matched',
        cv2CheckPref: 'matched',
        riskCheckRequired: 'N'
    };

    return await processCardStreamPayment(cs_payload, signature);
};
