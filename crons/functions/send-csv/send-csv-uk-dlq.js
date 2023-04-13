export const main = async (event) => {
    let { payload } = JSON.parse(event.body);
    console.log('CSV UK error messages:', payload);

    return {};
};
