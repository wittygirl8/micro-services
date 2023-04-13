export const getOrderDetails = async (params) => {
    const { order_id, db, payload, Sequelize } = params;
    const { Payment, Payments, PaymentTransaction } = db;

    let PaymentResponse;

    if (payload.action == 'TOPUP') {
        //card_payment
        PaymentResponse = await Payment.findOne({
            attributes: ['id', 'customer_id'],
            where: {
                [Sequelize.Op.and]: [
                    { order_id: `${order_id}`, payment_status: 'OK' },
                    {
                        refund: { [Sequelize.Op.eq]: '' }
                    },
                    {
                        customer_id: { [Sequelize.Op.ne]: 0 }
                    }
                ]
            },
            raw: true
        });

        //Payments
        if (!PaymentResponse) {
            PaymentResponse = await Payments.findOne({
                attributes: ['id', ['merchant_id', 'customer_id']],
                where: {
                    [Sequelize.Op.and]: [
                        { order_ref: `${order_id}`, transaction_status_id: [1, 3, 4, 5, 6] },
                        {
                            refund_reason_id: { [Sequelize.Op.eq]: null }
                        },
                        {
                            merchant_id: { [Sequelize.Op.ne]: 0 }
                        }
                    ]
                },
                raw: true
            });
        }

        //Payment_transaction
        if (!PaymentResponse) {
            PaymentResponse = await PaymentTransaction.findOne({
                attributes: ['id', ['merchant_id', 'customer_id']],
                where: {
                    [Sequelize.Op.and]: [
                        { order_id: `${order_id}`, payment_status: 'OK' },
                        {
                            refund: { [Sequelize.Op.eq]: null }
                        },
                        {
                            merchant_id: { [Sequelize.Op.ne]: 0 }
                        }
                    ]
                },
                raw: true
            });
        }

        if (!PaymentResponse?.id) {
            throw new Error(`Invalid order details`);
        }
    } else if (payload.action == 'REVERSE') {
        PaymentResponse = await Payment.findOne({
            attributes: ['id', 'customer_id'],
            where: {
                [Sequelize.Op.and]: [
                    { order_id: `${order_id}`, payment_status: 'OK' },
                    { customer_id: { [Sequelize.Op.ne]: 0 } }
                ]
            },
            raw: true
        });

        //Payments
        if (!PaymentResponse) {
            PaymentResponse = await Payments.findOne({
                attributes: ['id', ['merchant_id', 'customer_id']],
                where: {
                    [Sequelize.Op.and]: [
                        { order_ref: `${order_id}`, transaction_status_id: [1, 3, 4, 5, 6] },
                        { merchant_id: { [Sequelize.Op.ne]: 0 } }
                    ]
                },
                raw: true
            });
        }

        //Payment_transaction
        if (!PaymentResponse) {
            PaymentResponse = await PaymentTransaction.findOne({
                attributes: ['id', ['merchant_id', 'customer_id']],
                where: {
                    [Sequelize.Op.and]: [
                        { order_id: `${order_id}`, payment_status: 'OK' },
                        { merchant_id: { [Sequelize.Op.ne]: 0 } }
                    ]
                },
                raw: true
            });
        }

        if (!PaymentResponse?.id) {
            throw new Error(`Invalid order details`);
        }
    }

    return PaymentResponse;
};
