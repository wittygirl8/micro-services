beforeEach(() => {
    jest.resetModules();
});

test('[createSale] empty body is passed -> 500 is returned', async () => {
    // Assert
    jest.mock('../functions/create-sale-handler', () => {
        const data = {
            errorResponse: {
                error: {
                    request_id: 'reqid_6726820979248463872',
                    type: 'error',
                    message: 'Field missing'
                }
            }
        };

        return {
            createSale: jest.fn().mockImplementation(() => {
                return { data, statusCode: 500 };
            })
        };
    });

    const { createSale } = require('../functions/create-sale-handler');

    //Act
    const payload = JSON.stringify({ data: '' });
    const result = await createSale(payload);
    //Assert
    expect(result.statusCode).toBe(500);
});

test('[createSale] wrong data/parameter missed  -> 202 is returned', async () => {
    // Assert
    jest.mock('../functions/create-sale-handler', () => {
        const data = {
            request_id: 'reqid_6726800223303106560',
            message: 'Transaction Request failed',
            data: {
                redirect_info: 'kfdkf'
            }
        };

        return {
            createSale: jest.fn().mockImplementation(() => {
                return { data, statusCode: 202 };
            })
        };
    });

    const { createSale } = require('../functions/create-sale-handler');

    //Act
    const payload = JSON.stringify({
        session_id: 'jhj=54=',
        cardno: '4929421234600821',
        cvv: '334',
        exp_mm: '12',
        exp_yy: '23'
    });
    const result = await createSale(payload);
    //Assert

    expect(result.data.data).not.toBeNull();
    expect(result.statusCode).toBe(202);
});

test('[createSale] valid data is passed -> 201 is returned', async () => {
    // Assert
    jest.mock('../functions/create-sale-handler', () => {
        const data = {
            request_id: 'reqid_6726800223303106560',
            message: 'The request was processed successfully',
            data: {
                success: '3d',
                threeDSreq: {
                    acsUrl: 'fdfdf',
                    md: 'jkgfjgf',
                    paReq: 'jkkdfdl',
                    termUrl: 'https://somebankurl.com'
                }
            }
        };
        return {
            createSale: jest.fn().mockImplementation(() => {
                return { data, statusCode: 201 };
            })
        };
    });
    const { createSale } = require('../functions/create-sale-handler');

    //Act
    const payload = JSON.stringify({
        session_id: 'jhj=54=',
        cardno: '4929421234600821',
        cvv: '334',
        exp_mm: '12',
        exp_yy: '23'
    });
    //Assert
    const result = await createSale(payload);
    expect(result.data.data).not.toBeNull();
    expect(result.statusCode).toBe(201);
});
