const ni = require('nanoid');

export const CreateShortUrl = async (dbInstance, obj) => {
    let shortId = ni.nanoid(21);
    await dbInstance.ShortUrl.create({
        short_id: shortId,
        longurl: obj.url
    });
    return shortId;
};

export const GetLongUrl = async (dbInstance, obj) => {
    let res = await dbInstance.ShortUrl.findOne({
        where: {
            short_id: obj.shortId
        },
        attributes: ['short_id', 'longurl'],
        raw: true
    });
    console.log('hree are the findone', res);

    return res;
};
