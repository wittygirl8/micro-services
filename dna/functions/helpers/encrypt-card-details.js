const NodeRSA = require('node-rsa');
const axios = require('axios');

export const encryptCardDetails = async (payload, token) => {
    // console.log('encryptCardDetails', payload);

    const key = await getIdRsaPublicKey(token);
    const encrypted = await key.encrypt(payload, 'base64');
    return encrypted;
};

const getIdRsaPublicKey = async (token) => {
    const keyData = await axios
        .get(`${JSON.parse(process.env.DNA_HOSTED_FORM).baseUrl}/public.rsa`)
        .then((res) => res.data);

    const key = await new NodeRSA(keyData);
    await key.setOptions({
        encryptionScheme: { scheme: 'pkcs1_oaep', hash: 'sha256', label: token },
        environment: 'browser'
    });

    return key;
};
