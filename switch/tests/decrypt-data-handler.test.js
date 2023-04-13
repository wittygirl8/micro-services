beforeEach(() => {
    jest.resetModules();
});

test('[decrypt] empty body is passed -> 500 is returned', async () => {
    // Assert
    jest.mock('../functions/decrypt-data-handler', () => {
        const data = {
            error: {
                request_id: 'reqid_6726786909437165568',
                type: 'Error',
                message: "Cannot read property 'data' of null"
            }
        };

        return {
            decrypt: jest.fn().mockImplementation(() => {
                return { data, statusCode: 500 };
            })
        };
    });

    const { decrypt } = require('../functions/decrypt-data-handler');

    //Act
    const payload = JSON.stringify({ data: '' });

    const result = await decrypt(payload);

    //Assert
    expect(result.data.error.type).toBe('Error');
    expect(result.statusCode).toBe(500);
});

test('[decrypt] wrong data is passed -> 500 is returned', async () => {
    // Assert
    jest.mock('../functions/decrypt-data-handler', () => {
        const data = {
            error: {
                request_id: 'reqid_6726800223303106560',
                type: 'Error',
                message: 'error:0606506D:digital envelope routines:EVP_DecryptFinal_ex:wrong final block length'
            }
        };

        return {
            decrypt: jest.fn().mockImplementation(() => {
                return { data, statusCode: 500 };
            })
        };
    });

    const { decrypt } = require('../functions/decrypt-data-handler');
    //Act
    const payload = JSON.stringify({ data: 'jkkhhhhhgg==' });
    const result = await decrypt(payload);
    //Assert
    expect(result.data.error.type).toBe('Error');
    expect(result.statusCode).toBe(500);
});

test('[decrypt] encrypted data is passed -> 200 is returned', async () => {
    // Assert
    jest.mock('../functions/decrypt-data-handler', () => {
        const data = {
            request_id: 'reqid_6726783599846096896',
            message: '',
            data: {
                redirect_url: 'https://example.com/success'
            }
        };
        return {
            decrypt: jest.fn().mockImplementation(() => {
                return { data, statusCode: 200 };
            })
        };
    });
    const { decrypt } = require('../functions/decrypt-data-handler');

    //Act
    const payload = JSON.stringify({
        data: 'jdfhekjfkfdhkrelnfnk'
    });
    //Assert
    const result = await decrypt(payload);

    expect(result).not.toBeNull();

    expect(result.data.data.redirect_url).toBe('https://example.com/success');
    expect(result.statusCode).toBe(200);
});
