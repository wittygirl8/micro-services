export const validateShopperId = async (params) => {
    try {
        const { shopper_id, db } = params;
        const { Wallet } = db;

        let wallet = await Wallet.findOne({
            attributes: ['id'],
            where: {
                shopper_id
            },
            raw: true
        });

        if (!wallet?.id) {
            wallet = await Wallet.create({
                shopper_id,
                balance: 0
            });

            return wallet?.id;
        }

        return wallet?.id;
    } catch (error) {
        console.log('validateShopperId~error', error);
        return;
    }
};
