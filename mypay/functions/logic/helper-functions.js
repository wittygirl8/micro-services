export const GetCustomerName = (params, name_type = '') => {
    let { shopperInformation, cardholder_firstname, cardholder_lastname } = params;
    let firstname = shopperInformation.first_name ? shopperInformation.first_name : cardholder_firstname;
    let lastname = shopperInformation.last_name ? shopperInformation.last_name : cardholder_lastname;
    if (name_type === 'firstname') return firstname;
    if (name_type === 'lastname') return lastname;
    if (name_type === 'both') return `${firstname} ${lastname}`;
    return { firstname, lastname };
};
