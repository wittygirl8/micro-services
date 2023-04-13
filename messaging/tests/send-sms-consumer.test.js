test('[sendEmail] checking for error by PublishCommand', async () => {
    const { SNSService } = require('../consumer/sns-sms.service');
    const snsService = new SNSService();

    var { SNSClient } = require('@aws-sdk/client-sns');

    jest.mock('@aws-sdk/client-sns');
    const ssmGetParameterPromise = jest.fn().mockRejectedValue({
        promise: jest.fn().mockRejectedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SNSClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));

    expect(
        async () =>
            await snsService.sendSMS(
                {
                    Records: [
                        {
                            body: JSON.stringify({
                                payload: {
                                    phone_number: '+918109026221',
                                    message_text: 'Here is your invoice'
                                }
                            })
                        }
                    ]
                },
                { awsRequestId: 1 }
            )
    ).rejects.toThrow('Following messag(es) was failing . Check specific error above.');
});

test('[sendEmail] checking for proper phone number and text', async () => {
    const { SNSService } = require('../consumer/sns-sms.service');
    const snsService = new SNSService();

    var { SNSClient } = require('@aws-sdk/client-sns');

    jest.mock('@aws-sdk/client-sns');
    const ssmGetParameterPromise = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SNSClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));

    var result = await snsService.sendSMS(
        {
            Records: [
                {
                    body: JSON.stringify({
                        payload: {
                            phone_number: '+918109026221',
                            message_text: 'Here is your invoice'
                        }
                    })
                }
            ]
        },
        { awsRequestId: 1 }
    );
    expect(result.success).toBe(true);
});
