export const main = async (event) => {
    console.log('DLQ', event.Records[0]);

    return {};
};
