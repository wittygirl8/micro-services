test('[sendEmail] checking for bulk emails', async () => {
    const { SESService } = require('../consumer/ses-email.service');
    const sesService = new SESService();

    var { SESClient } = require('@aws-sdk/client-ses');

    jest.mock('@aws-sdk/client-ses');
    const ssmGetParameterPromise = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SESClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));
    var result = await sesService.sendBulkEmail(
        {
            Records: [
                {
                    body: JSON.stringify({
                        payload: {
                            type: 'Bulk',
                            subject: '',
                            html_body: '',
                            cc_address: [],
                            to_address: ['yosha.garg27@gmail.com', 'ishikagarg27@yahoo.com'],
                            template_name: 'Test_one',
                            source_email: 'ishika@mypay.co.uk',
                            replacement_tag_name: '{"company": "Datman"}',
                            reply_to_address: [],
                            default_tag_name: '{"name": "Yosha"}'
                        }
                    })
                }
            ]
        },
        { awsRequestId: 1 }
    );
    console.log('MMMM: ', result);
    expect(result.success).toBe(true);
});

test('[sendEmail] checking for bulk emails without template', async () => {
    const { SESService } = require('../consumer/ses-email.service');
    const sesService = new SESService();

    var { SESClient } = require('@aws-sdk/client-ses');

    jest.mock('@aws-sdk/client-ses');
    const ssmGetParameterPromise = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SESClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));

    expect(
        async () =>
            await sesService.sendBulkEmail(
                {
                    Records: [
                        {
                            body: JSON.stringify({
                                payload: {
                                    type: 'Bulk',
                                    subject: '',
                                    html_body: '',
                                    cc_address: [],
                                    to_address: ['yosha.garg27@gmail.com', 'ishikagarg27@yahoo.com'],
                                    template_name: '',
                                    source_email: 'ishika@mypay.co.uk',
                                    replacement_tag_name: '{"company": "Datman"}',
                                    reply_to_address: [],
                                    default_tag_name: '{"name": "Yosha"}'
                                }
                            })
                        },
                        {
                            body: JSON.stringify({
                                payload: {
                                    type: 'Bulk',
                                    subject: '',
                                    html_body: '',
                                    cc_address: [],
                                    to_address: ['yosha.garg27@gmail.com', 'ishikagarg27@yahoo.com'],
                                    template_name: 'Test_one',
                                    source_email: 'ishika@mypay.co.uk',
                                    replacement_tag_name: '{"company": "Datman"}',
                                    reply_to_address: [],
                                    default_tag_name: '{"name": "Yosha"}'
                                }
                            })
                        }
                    ]
                },
                { awsRequestId: 1 }
            )
    ).rejects.toThrow('Following messag(es) was failing . Check specific error above.');
});

test('[sendEmail] checking for basic emails with template', async () => {
    const { SESService } = require('../consumer/ses-email.service');
    const sesService = new SESService();

    var { SESClient } = require('@aws-sdk/client-ses');

    jest.mock('@aws-sdk/client-ses');
    const ssmGetParameterPromise = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SESClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));

    var result = await sesService.sendBulkEmail(
        {
            Records: [
                {
                    body: JSON.stringify({
                        payload: {
                            type: 'Basic',
                            subject: '',
                            html_body: '',
                            cc_address: [],
                            to_address: ['yosha.garg27@gmail.com'],
                            template_name: 'Test_one',
                            source_email: 'ishika@mypay.co.uk',
                            replacement_tag_name: '{"company": "Datman"}',
                            reply_to_address: [],
                            default_tag_name: '{"name": "Yosha"}'
                        }
                    })
                }
            ]
        },
        { awsRequestId: 1 }
    );
    expect(result.success).toBe(true);
});

test('[sendEmail] checking for basic emails without template', async () => {
    const { SESService } = require('../consumer/ses-email.service');
    const sesService = new SESService();

    var { SESClient } = require('@aws-sdk/client-ses');

    jest.mock('@aws-sdk/client-ses');
    const ssmGetParameterPromise = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
            Parameter: {
                Version: 1,
                LastModifiedDate: 1546551668.495,
                ARN: 'arn:aws:ssm:ap-southeast-2:123:NAME'
            }
        })
    });

    SESClient.mockImplementation(() => ({
        send: ssmGetParameterPromise
    }));

    var result = await sesService.sendBulkEmail(
        {
            Records: [
                {
                    body: JSON.stringify({
                        payload: {
                            type: 'Basic',
                            subject: 'Invoice',
                            html_body: '<p> Hey There </p>',
                            cc_address: [],
                            to_address: ['yosha.garg27@gmail.com'],
                            template_name: '',
                            source_email: 'ishika@mypay.co.uk',
                            replacement_tag_name: '',
                            reply_to_address: [],
                            default_tag_name: ''
                        }
                    })
                }
            ]
        },
        { awsRequestId: 1 }
    );
    expect(result.success).toBe(true);
});
