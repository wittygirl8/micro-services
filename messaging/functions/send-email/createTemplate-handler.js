var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');
const { SESClient, CreateTemplateCommand } = require('@aws-sdk/client-ses');

let logger = logHelpers.logger;

export const createTemplate = async (event, context) => {
    let logMetadata = {
        location: 'MessagingService ~ createTemplate',
        awsRequestId: context.awsRequestId
    };

    try {
        const SES_API_KEY = process.env.DATMAN_SES_HANDLER_API_KEY;
        const { api_key } = event.headers;

        if (!api_key || api_key !== SES_API_KEY) {
            return response(
                {
                    message: 'UNAUTHORISED'
                },
                401
            );
        }

        const payload = JSON.parse(event.body);
        // Create SES service object
        const ses = new SESClient();

        const data = await ses.send(
            new CreateTemplateCommand({
                Template: {
                    TemplateName: payload.template_name /* required */,
                    HtmlPart: payload.html_content,
                    SubjectPart: payload.subject,
                    TextPart: payload.text_content
                }
            })
        );
        logger.info(logMetadata, 'Success, template created; requestID', data.$metadata.requestId);
        logger.info(logMetadata, 'Result: ', data);

        return response({
            message: 'The template created successfully',
            data: data
        });
    } catch (e) {
        logger.error(logMetadata, 'Error: ', e);
        let errorResponse = {
            error: {
                type: 'error',
                message: e.message
            }
        };
        return response(errorResponse, 500);
    }
};
