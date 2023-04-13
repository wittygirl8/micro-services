const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('https'));

export const getSetupFeeAdjustmentSum = async (params, StripeFeeAdjustments, Sequelize) => {
    return StripeFeeAdjustments.sum('adjustment_amount', {
        where: {
            [Sequelize.Op.and]: [
                { payment_status: { [Sequelize.Op.in]: ['OK', 'REFUND'] } },
                { customerId: params.customerId }
            ]
        }
    });
};

export const addStripeFeeAdjustmentsRecord = async (info, StripeFeeAdjustments) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    var data = await StripeFeeAdjustments.create({
        customerId: info.customerId,
        total: parseFloat(info.total).toFixed(2),
        fees: info.fees,
        payed: info.payed,
        cardPaymentId: info.cardPaymentId,
        paymentStatus: info.paymentStatus,
        adjustmentAmount: info.adjustmentAmount
    });
    return data;
};

export const updateStripeFeeAdjustmentsRecord = async (
    { cardPaymentId, customerId, paymentStatus },
    StripeFeeAdjustments
) => {
    AWSXRay.capturePromise();
    if (process.env.IS_OFFLINE) {
        AWSXRay.setContextMissingStrategy(() => {}); //do nothing
    }
    var data = await StripeFeeAdjustments.update(
        {
            paymentStatus
        },
        {
            where: { cardPaymentId: cardPaymentId, customerId: customerId }
        }
    );
    return data;
};
