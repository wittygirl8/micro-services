export const main = async (event) => {
    let { payload } = JSON.parse(event.body);
    console.log('CSV Ireland error messages:', payload);

    return {};
};
