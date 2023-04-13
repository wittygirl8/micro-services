export const getResponse = async (params) => {
    if (params.status == 'success') {
        return {
            request_id: params.logMetadata.requestId,
            status: 'success',
            message: 'Processed successfully'
        };
    }

    if (params.status == 'failed') {
        return {
            request_id: params.logMetadata.requestId,
            status: 'failed',
            message: params.e.message,
            data: params.payload
        };
    }
};
