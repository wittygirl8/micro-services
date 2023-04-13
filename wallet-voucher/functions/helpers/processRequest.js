export const processRequest = async (params) => {
    const { action } = params;

    if (action === 'TOPUP') {
        const { processWalletTopup } = require('./processWalletTopup');
        const { validateInputAmount } = require('./validateInputAmount');
        const { payload, db, BonusRange, amount, MerchantDetails, orderDetails, wallet_id, api_response } = params;

        let validAmount = await validateInputAmount({ BonusRange, amount });

        if (!validAmount) {
            throw new Error(`Invalid Amount`);
        }

        validAmount = Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

        let processWalletTopupData = await processWalletTopup({
            payload,
            MerchantDetails,
            orderDetails,
            wallet_id,
            validAmount,
            db
        });

        if (processWalletTopupData) {
            api_response.data = processWalletTopupData;
        }

        return processWalletTopupData;
    }

    if (action === 'REVERSE') {
        const { processTopupReversal } = require('./processTopupReversal');
        const { payload, db, MerchantDetails, orderDetails, wallet_id, api_response, TopUpTransaction } = params;
        let processTopupReversalData = await processTopupReversal({
            payload,
            MerchantDetails,
            TopUpTransaction,
            orderDetails,
            wallet_id,
            db
        });
        if (processTopupReversalData) {
            api_response.data = processTopupReversalData;
        }

        return processTopupReversalData;
    }
};
