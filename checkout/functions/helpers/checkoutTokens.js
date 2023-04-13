const axios = require('axios');

export const requestProviderToken = async ( obj) => {
const data = JSON.stringify({
  "type": obj.type,
  "token_data": obj.token_data
});

const config = {
  method: 'post',
  url: JSON.parse(process.env.CHECKOUT).baseUrl + '/tokens',
  headers: { 
    Authorization: `Bearer ${JSON.parse(process.env.CHECKOUT).publishKey}`,
    'Content-Type': 'application/json'
  },
  data : data
};

let response =  await axios(config).then((res) => res).catch((err) => {
  console.log('Error in requestProviderToken API', err.response);
  throw (err.response ? { status: err.response.status, message: err.response.data } :  { status: 500, message: err.message });
});
return response


}