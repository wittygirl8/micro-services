export const createUpdateRefundEntry = async (merchant_id, params, Customer, Payment, Payments, Sequelize) => {
    try {
        let NEW_PAYMENT_PROVIDERS = ['CARDSTREAM-CH'];
        var { payment_provider } = await Customer.findOne({
            where: { id: merchant_id }
        });

        if (NEW_PAYMENT_PROVIDERS.includes(payment_provider)) {
            return await Payments.update(
                {
                    transaction_status_id: 2
                },
                {
                    where: {
                        [Sequelize.Op.and]: [
                            { transaction_status_id: { [Sequelize.Op.in]: [1, 3, 4, 5] } },
                            { order_ref: params.order_id, merchant_id: params.customer_id }
                        ]
                    }
                }
            );
        } else {
            return await Payment.create({
                customer_id: params.customer_id,
                order_id: params.order_id,
                firstname: 'Refund',
                lastname: params.lastname,
                address: params.address,
                total: params.total,
                fees: params.fees,
                payed: params.payed,
                CrossReference: params.CrossReference,
                payment_provider: params.payment_provider,
                payment_status: 'OK',
                refund: params.refund
            });
        }
    } catch (error) {
        console.log(`createUpdateRefundEntry~error`, error);
        return error;
    }
};

export const getProvider = async (params, Customer) => {
    try {
        console.log(params);
        let providers = ['CARDSTREAM', 'CARDSTREAM-CH'];

        if (providers.includes(params.payment_provider)) {
            var { payment_provider } = await Customer.findOne({
                where: { id: params.merchant_id }
            });
            return payment_provider;
        } else {
            return params.payment_provider;
        }
    } catch (error) {
        console.log('mastertoken~getprovider', 'error in getting provider', error);
        return error;
    }
};

// process DNA or Checkout HF
export const modifyMasterToken = async (currentProvider, data, avs_token, MasterToken) => {
    console.log('inside modifyMasterToken: ', currentProvider, avs_token);
    //if no data found against for this provider against this master token, then generate one and insert in table
    if (!currentProvider) {
        console.log('creating new master_token record');
        await MasterToken.create({
            master_token: data.master_token,
            provider: data.provider,
            token: data.provider_token,
            last_4_digit: data.last_4_digit,
            customer_id: data.customer_id,
            expiry_date: `${data.expiry_month}/${data.expiry_year}`,
            scheme_id: data.cardSchemeId,
            scheme_name: data.cardSchemeName,
            avs_token: avs_token,
            is_billing_address: data.is_billing_address
        });
    } else {
        console.log('updating master_token record');
        await MasterToken.update(
            {
                token: data.provider_token,
                avs_token: avs_token,
                is_billing_address: data.is_billing_address
            },
            {
                where: {
                    master_token: data.master_token,
                    provider: data.provider,
                    customer_id: data.customer_id
                }
            }
        );
    }
};

export const processCsProvider = async (currentProvider, csData, avs_token, MasterToken) => {
    if (!currentProvider) {
        console.log('Adding new details to MasterToken table');
        await MasterToken.create({
            master_token: csData.master_token,
            provider: csData.provider,
            token: csData.provider_token,
            last_4_digit: csData.last_4_digit,
            customer_id: csData.customer_id,
            expiry_date: `${csData.expiry_month}/${csData.expiry_year}`,
            scheme_id: csData.cardSchemeId,
            scheme_name: csData.cardSchemeName,
            avs_token: avs_token,
            is_billing_address: csData.is_billing_address
        });
    } else {
        console.log('Updating details to MasterToken table');
        await MasterToken.update(
            {
                token: csData.provider_token,
                avs_token: avs_token,
                is_billing_address: csData.is_billing_address
            },
            {
                where: {
                    master_token: csData.master_token,
                    provider: csData.provider,
                    customer_id: csData.customer_id
                }
            }
        );
    }
};