export const getCurrencyCode = async (params) => {
    const { customer_id, db, payload } = params;
    const { Customer, Country } = db;

    let customerDetails = await Customer.findOne({
        attributes: ['id', 'country_id'],
        where: {
            id: customer_id
        },
        raw: true
    });

    let currency_iso_code;
    if (customerDetails?.country_id) {
        currency_iso_code = await Country.findOne({
            attributes: ['iso'],
            where: {
                id: customerDetails.country_id
            },
            raw: true
        });
    }

    if (!currency_iso_code?.iso) {
        throw new Error(`Invalid currency code`);
    }

    if (!customerDetails?.country_id) {
        throw new Error(`Invalid country`);
    }

    return { currency_code: currency_iso_code?.iso, country_id: customerDetails?.country_id };
};
