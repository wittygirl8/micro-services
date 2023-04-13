beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../layers/models_lib/src', () => {
        const { SequelizeMock, WebhookMock } = require('../../../libs/test-helpers/__mocks__');
        return {
            connectDB: () => ({
                WebhookLog: WebhookMock.WebhookModel,
                sequelize: SequelizeMock.sequelize,
                Sequelize: { Op: {} }
            })
        };
    });
});

test('[notifyConsumer] axios failed', async () => {
    //Arrange
    const axios = require('axios');

    jest.mock('axios');

    // Arrange
    const { WebhookMock } = require('../../../libs/test-helpers/__mocks__');

    WebhookMock.setWebhookOptions({ isUpdateDeleteMode: true });
    const webhookCount = WebhookMock.WebhookList.length;

    const { MessagingService } = require('../consumer/messaging.service');
    const messagingService = new MessagingService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"payload":{"host":"example.com","order_id":11134129,"provider":"T2S","customer_id":336366,"merchant_id":63184000,"total":11,"first_name":"QA","last_name":"Test","house_number":"347","flat":"Flat 6","address_line1":"Primrose Rise","address_line2":"Lavender Road","address":"lksjd flask, sdlkfjasld","postcode":"NN178YG","email":"testing@testing.com","cc_token":"egtoken_20121014SY21SL16LM50XCK","last_four_digits":821,"redirect_url":"https://example.com/redirect","cancel_url":"https://example.com/cancel?a=b","webhook_url":"https://dc0ada0574b780b4a3ea40c7372b1696.m.pipedream.net","db_total":false,"reference":"falskdjfasdlaksjdlasd","card_number":"4929421234600821","exp_month":"12","exp_year":"20","cvv":"356","save_card":true},"t2sPayload":{"transaction_id":25083173,"customer_id":336366,"provider":"OPTOMANY","token":"egtoken_20121508GX15DF08TM15HMQ","last_4_digits":"0821","expiry_date":1220,"card_type":"Visa Credit","one_click":"YES","is_primary":"YES","order_info_id":11134129,"amount":"11.00","reference":"falskdjfasdlaksjdlasd"},"card_payment_id":25083173}',
                awsRegion: 'eu-west-1'
            },
            {
                messageId: '297ed40e-0761-431b-805e-4645667gdfgdf',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"payload":{"host":"example.com","order_id":11134130,"provider":"T2S","customer_id":336368,"merchant_id":63184009,"total":11,"first_name":"QA","last_name":"Test","house_number":"347","flat":"Flat 6","address_line1":"Primrose Rise","address_line2":"Lavender Road","address":"lksjd flask, sdlkfjasld","postcode":"NN178YG","email":"testing@testing.com","cc_token":"egtoken_20121014SY21SL16LM50XCK","last_four_digits":821,"redirect_url":"https://example.com/redirect","cancel_url":"https://example.com/cancel?a=b","webhook_url":"https://dc0ada0574b780b4a3ea40c7372b1696.m.pipedream.net","db_total":false,"reference":"falskdjfasdlaksjdlasd","card_number":"4929421234600821","exp_month":"12","exp_year":"20","cvv":"356","save_card":true},"t2sPayload":{"transaction_id":25083173,"customer_id":336366,"provider":"OPTOMANY","token":"egtoken_20121508GX15DF08TM15HMQ","last_4_digits":"0821","expiry_date":1220,"card_type":"Visa Credit","one_click":"YES","is_primary":"YES","order_info_id":11134129,"amount":"11.00","reference":"falskdjfasdlaksjdlasd"},"card_payment_id":25083173}',
                awsRegion: 'eu-west-1'
            }
        ]
    };

    axios.post.mockRejectedValue({ response: { status: 500 } });

    //Act
    try {
        await messagingService.notifyT2s(event, { awsRequestId: 1 });
    } catch (ex) {
        // Axios was indeed failing but no one was catching error
    }

    // Assert
    const webhookAfterUpdateCount = WebhookMock.WebhookList.length;
    expect(webhookAfterUpdateCount).toBe(webhookCount + event.Records.length);
    expect(2).toBe(WebhookMock.WebhookList.filter((wh) => wh.http_response_code === 500).length);
});

test('[notifyConsumer] success', async () => {
    //Arrange
    const axios = require('axios');

    jest.mock('axios');

    // Arrange
    const { WebhookMock } = require('../../../libs/test-helpers/__mocks__');

    WebhookMock.setWebhookOptions({ isUpdateDeleteMode: true });
    const webhookCount = WebhookMock.WebhookList.length;

    const { MessagingService } = require('../consumer/messaging.service');
    const messagingService = new MessagingService();

    const event = {
        Records: [
            {
                messageId: '297ed40e-0761-431b-805e-36a359273cb6',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"payload":{"host":"example.com","order_id":11134129,"provider":"T2S","customer_id":336366,"merchant_id":63184000,"total":11,"first_name":"QA","last_name":"Test","house_number":"347","flat":"Flat 6","address_line1":"Primrose Rise","address_line2":"Lavender Road","address":"lksjd flask, sdlkfjasld","postcode":"NN178YG","email":"testing@testing.com","cc_token":"egtoken_20121014SY21SL16LM50XCK","last_four_digits":821,"redirect_url":"https://example.com/redirect","cancel_url":"https://example.com/cancel?a=b","webhook_url":"https://dc0ada0574b780b4a3ea40c7372b1696.m.pipedream.net","db_total":false,"reference":"falskdjfasdlaksjdlasd","card_number":"4929421234600821","exp_month":"12","exp_year":"20","cvv":"356","save_card":true},"t2sPayload":{"transaction_id":25083173,"customer_id":336366,"provider":"OPTOMANY","token":"egtoken_20121508GX15DF08TM15HMQ","last_4_digits":"0821","expiry_date":1220,"card_type":"Visa Credit","one_click":"YES","is_primary":"YES","order_info_id":11134129,"amount":"11.00","reference":"falskdjfasdlaksjdlasd"},"card_payment_id":25083173}',
                awsRegion: 'eu-west-1'
            },
            {
                messageId: '297ed40e-0761-431b-805e-4645667gdfgdf',
                receiptHandle:
                    'AQEB9JBfv/Y5IJr3B/W2qku6tDGjEL6XmcPP1jflvRyvEtsLApUCRWO17xq0G+1AKgxOxwmmMgeYKIMlHeKMzoQ33+wnIMjECY4iU1ltCtQsueR4Ff2tQQrUMr+OCH2KTygdm50uQuIX8Z5rSoD4Jm0wbeQ1cNMfDm7taOYUgg/7Xw9otmkK//NJl4G4gJ4vhsMGkV4lKJ8P5gbDAqyNXrfaAMeFQ5DC8gsu0xDaufJe42beUyX3Tyb6uFXZkoBKyST83+zLq9t48FT8YLCq2yqa2b5IF+4mWk9rqfQJJcgHCdk=',
                body:
                    '{"payload":{"host":"example.com","order_id":11134130,"provider":"T2S","customer_id":336368,"merchant_id":63184009,"total":11,"first_name":"QA","last_name":"Test","house_number":"347","flat":"Flat 6","address_line1":"Primrose Rise","address_line2":"Lavender Road","address":"lksjd flask, sdlkfjasld","postcode":"NN178YG","email":"testing@testing.com","cc_token":"egtoken_20121014SY21SL16LM50XCK","last_four_digits":821,"redirect_url":"https://example.com/redirect","cancel_url":"https://example.com/cancel?a=b","webhook_url":"https://dc0ada0574b780b4a3ea40c7372b1696.m.pipedream.net","db_total":false,"reference":"falskdjfasdlaksjdlasd","card_number":"4929421234600821","exp_month":"12","exp_year":"20","cvv":"356","save_card":true},"t2sPayload":{"transaction_id":25083173,"customer_id":336366,"provider":"OPTOMANY","token":"egtoken_20121508GX15DF08TM15HMQ","last_4_digits":"0821","expiry_date":1220,"card_type":"Visa Credit","one_click":"YES","is_primary":"YES","order_info_id":11134129,"amount":"11.00","reference":"falskdjfasdlaksjdlasd"},"card_payment_id":25083173}',
                awsRegion: 'eu-west-1'
            }
        ]
    };

    const data = {
        status: 200,
        statusText: 'OK',
        config: {
            url: 'https://dc0ada0574b780b4a3ea40c7372b1696.m.pipedream.net'
        }
    };

    axios.post.mockResolvedValue(data);

    //Act
    await messagingService.notifyT2s(event, { awsRequestId: 1 });

    // Assert
    const webhookAfterUpdateCount = WebhookMock.WebhookList.length;
    expect(webhookAfterUpdateCount).toBe(webhookCount + event.Records.length);
});
