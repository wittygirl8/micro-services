jest.mock('dotenv');
require('dotenv').config();

const { SequelizeMock, StripePaymentInfoMock } = require('../../../test_helpers/_mock_');

beforeEach(() => {
    jest.resetModules();
});

jest.doMock('../../../layers/models_lib/src', () => {
    return {
        connectDB: () => ({
            StripePaymentInfo: StripePaymentInfoMock.StripePaymentInfoMockModel,
            sequelize: SequelizeMock.sequelize
        })
    };
});

const stripeObj = {
    id: 'evt_1Hs52aAS5mTVweby4sCx0Kx1',
    object: 'event',
    api_version: '2019-08-14',
    created: 1606476184,
    data: {
        object: {
            id: 'cs_test_a1TlAZcxAGzETQ6lm5CEjDd0CHQaz4Y6o0n64yca8v7JZgZZbsvNyKO4Qi',
            object: 'checkout.session',
            allow_promotion_codes: null,
            amount_subtotal: 1120,
            amount_total: 1120,
            billing_address_collection: null,
            cancel_url: `${process.env.STRIPE_ENDPOINT}/sp-datman-failure?data=TmVHUG15bTQrOFBoUUU2Q2tqcEVSRHdDL2QvQ1hZUTFlRlZmSmwyWERMRmZRQ2FQM3JreXRjUlB3TWZkODBOMVRNK1hncG11UzYrL1ZuZkJUR1FNdUxLb1RtSHNGbDZEOVhWYVVZNjFSYmJ2NVZzRVZSMXR3NkVsQjBwWWp4YTNtSWc0Mzk5a1RkaVRKVlJpampxaUxBb2tsSlhMbjFrb3FlbzJJcGg5d2NoeDVPT0VCVGp2cU1GWmxWYzM1eDlPYzVxL2dNOVJVTG1rVGNFWXhVRUlPQm5uS0xBRXNacUVLNm93YUFzakdRUWd5b2o5c2lmU1ZTbmJxSythS0EwbDhpOUVtNkZsNFQyajVPMXl5Q1VLckt6cDcwV2tsSGtTSVNSTVFhSzlGa1lTWVlWSmFabDlmaC91VWU4UzVNbTByZ1NvR1A4RzBYUGdaRXZFcEZXK1ZFNEErTEpBakFwSXVSSGdodzdQdVQyenBaTDBmTHJBK0R6UzhyOTlQeXhsV2pNMk5YUE83NnFMMElhK1VLRHg5eGlzRWlic1BkMjJleWxpZmljVzFGYllpYjN5cXhQZnp0MndoT3NkdHdtZjdGYmQ0MVRLREUySWhaK1prdWRHQkhnVVhUbWtodWdHUEx3RDRIMjVQTFNieXBYRG01UkduTmZnTEdFaGQvYTBXZEVVa0VPVzhzaXh0akpwVG9WQ3BvZmhGdllDMWViQTNjQzZJNHB3clVSNjBtOU44czBsaUZrUXk3eUNZeDhML1RSdFNiL3hIR1ByU0YxK1hsaFlqYUVTT2NyUnR5MytCelBoVmczMEpwLzRUY2kyMS9Oak0wd1RNVUJnMFcvZklxcmtIZlA0TU83dmlMY3NLTytyaFQ1NDIybFhtd2V5WEJLZ0pLcWlwOXdNd2prR2hKRXdIWGhtM1kzMURyay8=\u0026d=d-111.t2scdn.com`,
            client_reference_id: 'T31178747O296119M63191680C111101',
            currency: 'eur',
            customer: 'cus_IT14Y2wMiMynLY',
            customer_email: 'testing@testing.com',
            display_items: [
                {
                    amount: 1120,
                    currency: 'eur',
                    custom: {
                        description: null,
                        images: null,
                        name: 'QA'
                    },
                    quantity: 1,
                    type: 'custom'
                }
            ],
            livemode: false,
            locale: null,
            metadata: {},
            mode: 'payment',
            payment_intent: 'pi_1Hs529AS5mTVweby3KZVgCll',
            payment_method_types: ['card'],
            payment_status: 'paid',
            setup_intent: null,
            shipping: null,
            shipping_address_collection: null,
            submit_type: null,
            subscription: null,
            success_url: `${process.env.STRIPE_ENDPOINT}/sp-datman-redirect?data=TmVHUG15bTQrOFBoUUU2Q2tqcEVSRHdDL2QvQ1hZUTFlRlZmSmwyWERMRmZRQ2FQM3JreXRjUlB3TWZkODBOMVRNK1hncG11UzYrL1ZuZkJUR1FNdUxLb1RtSHNGbDZEOVhWYVVZNjFSYmJ2NVZzRVZSMXR3NkVsQjBwWWp4YTNtSWc0Mzk5a1RkaVRKVlJpampxaUxBb2tsSlhMbjFrb3FlbzJJcGg5d2NoeDVPT0VCVGp2cU1GWmxWYzM1eDlPYzVxL2dNOVJVTG1rVGNFWXhVRUlPQm5uS0xBRXNacUVLNm93YUFzakdRUWd5b2o5c2lmU1ZTbmJxSythS0EwbDhpOUVtNkZsNFQyajVPMXl5Q1VLckt6cDcwV2tsSGtTSVNSTVFhSzlGa1lTWVlWSmFabDlmaC91VWU4UzVNbTByZ1NvR1A4RzBYUGdaRXZFcEZXK1ZFNEErTEpBakFwSXVSSGdodzdQdVQyenBaTDBmTHJBK0R6UzhyOTlQeXhsV2pNMk5YUE83NnFMMElhK1VLRHg5eGlzRWlic1BkMjJleWxpZmljVzFGYllpYjN5cXhQZnp0MndoT3NkdHdtZjdGYmQ0MVRLREUySWhaK1prdWRHQkhnVVhUbWtodWdHUEx3RDRIMjVQTFNieXBYRG01UkduTmZnTEdFaGQvYTBXZEVVa0VPVzhzaXh0akpwVG9WQ3BvZmhGdllDMWViQTNjQzZJNHB3clVSNjBtOU44czBsaUZrUXk3eUNZeDhML1RSdFNiL3hIR1ByU0YxK1hsaFlqYUVTT2NyUnR5MytCelBoVmczMEpwLzRUY2kyMS9Oak0wd1RNVUJnMFcvZklxcmtIZlA0TU83dmlMY3NLTytyaFQ1NDIybFhtd2V5WEJLZ0pLcWlwOXdNd2prR2hKRXdIWGhtM1kzMURyay8=`,
            total_details: {
                amount_discount: 0,
                amount_tax: 0
            }
        }
    },
    livemode: false,
    pending_webhooks: 5,
    request: {
        id: null,
        idempotency_key: null
    },
    type: 'checkout.session.completed'
};

test('[Stripe Status] Stripe Signature missing   -> 400 is returned', async () => {
    const { stripePaymentStatus } = require('../functions/stripe-payment-status-handler');
    //Act

    const result = await stripePaymentStatus(
        {
            body: JSON.stringify(stripeObj),
            headers: {}
        },
        { awsRequestId: 1 }
    );
    const parsedResult = JSON.parse(result.body);
    //Assert

    console.log('Here we are again', result);
    expect(parsedResult.received).toBeFalsy();
    expect(parsedResult.err).toBe('Stripe signature missing');
    expect(result.statusCode).toBe(400);
});

// test("[Stripe Status] success   -> 201 is returned", async () => {
//   const {
//     stripePaymentStatus,
//   } = require("../functions/stripe-payment-status-handler");

//   const headers = {
//     "Stripe-Signature":
//       "t=1606477185,v1=7fb4550ab9ac960ed5351fdeadf07405f042dacbd51f3f4536eb80d166f16f7d,v0=aacd2e75f7d5f33ab01a360d657e67010672668cb7b7ed28b75a244bcc63bfff",
//   };
//   const result = await stripePaymentStatus({
//     body: JSON.stringify(stripeObj),
//     headers,
//   });

//   console.log(result, "*************")
//   expect(result.statusCode).toBe(201);
// });
