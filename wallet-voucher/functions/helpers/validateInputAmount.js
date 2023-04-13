export const validateInputAmount = async (params) => {
    let { BonusRange, amount } = params;
    amount = amount * 100;
    let { maximum_amount, minimum_amount } = BonusRange;

    return amount >= minimum_amount && amount <= maximum_amount && amount != 0;
};
