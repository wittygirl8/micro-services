const { logHelpers,splitFeeHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const { notifyT2SSubscriber, sendDataQueue } = require('../../services/dna-service');
const ni = require('nanoid');
const logger = logHelpers.logger;

const T2S_MERCHANT_PROVIDER = 'OPTOMANY';

export const update3rdParty = async (db, obj, awsRequestId) => {
    if (process.env.IS_OFFLINE) {
        return true;
    }

    const logMetadata = {
        location: 'dna ~ dnaNotificationWebhook ~ update3rdParty',
        awsRequestId
    };

    const { amount, cardPanStarred, cardExpiryDate, cardSchemeName } = obj.notificationObject;

    // check if master token exists
    var currentProvider = await db.MasterToken.findOne({
        attributes: ['id'],
        where: {
            customer_id: String(obj.payload?.customer_id),
            provider: {
                [db.Sequelize.Op.in]: ['DNA', 'OPTOMANY']
            },
            last_4_digit: cardPanStarred?.substr(-4),
            expiry_date: cardExpiryDate
        },
        raw: true
    });
    logger.info(logMetadata, 'CurrentProvider Data in DB', currentProvider);

    //prepare payload to send
    let t2sPayload = {
        transaction_id: parseInt(obj.transactionId),
        order_info_id: parseInt(obj.order_id),
        customer_id: parseInt(obj.payload?.customer_id),
        amount: amount?.toString(),
        reference: obj.payload?.reference
    };
    if(obj?.payload?.split_fee?.length){
        let SplitStatusNotifyPayload = await splitFeeHelpers.GetSplitNotifyPayload({
            db,
            order_id : obj.order_id
        })
        console.log({SplitStatusNotifyPayload})
        t2sPayload['SplitFeeStatus'] = SplitStatusNotifyPayload
    }
    if (!currentProvider) {
        // new card sale
        const masterToken = `mxtoken_${ni.nanoid(32)}`;

        t2sPayload = {
            ...t2sPayload,
            provider: T2S_MERCHANT_PROVIDER,
            token: masterToken,
            last_4_digits: cardPanStarred.substr(-4),
            expiry_date: parseInt(cardExpiryDate?.replace('/', '')),
            card_type: cardSchemeName,
            one_click: 'YES',
            is_primary: 'YES'
        };

        logger.info(logMetadata, 'Storing master token details for Token sale', masterToken);
        await sendDataQueue(obj.notificationObject, obj.payload, masterToken, logMetadata.awsRequestId);
    }

    logger.info(logMetadata, 't2s_payload', t2sPayload);

    if (obj.payload?.webhook_url && obj.payload?.webhook_url !== 'undefined') {
        await notifyT2SSubscriber(obj.payload, t2sPayload, obj.transactionId, logMetadata.awsRequestId);
    } else {
        logger.info(logMetadata, `Order id: ${obj.payload?.order_id}, Webhook url missing with T2S payload`);
    }
};
