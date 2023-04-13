var { response, logHelpers } = process.env.IS_OFFLINE
    ? require('../../../../layers/helper_lib/src')
    : require('datman-helpers');

const { SESClient, GetTemplateCommand } = require('@aws-sdk/client-ses');
let logger = logHelpers.logger;

export const listTemplate = async (event, context) => {
    let logMetadata = {
        location: 'MessagingService ~ listTemplate',
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
        const params = { TemplateName: payload.template_name };
        const ses = new SESClient();

        const data = await ses.send(new GetTemplateCommand(params));
        logger.info(logMetadata, 'Success. Template:', data.Template.SubjectPart);
        logger.info(logMetadata, 'Result: ', data);
        return response({
            message: data
        });
    } catch (e) {
        logger.error(logMetadata, 'Error list template: ', e);
        let errorResponse = {
            error: {
                type: 'error',
                message: e.message
            }
        };
        return response(errorResponse, 500);
    }
};
