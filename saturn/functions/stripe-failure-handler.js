export const stripeFailure = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'content-type': 'text/html'
        },
        body: `
        <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Payment Error</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <!-- Latest compiled and minified CSS -->
                    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css">
                    <!-- Latest compiled and minified JavaScript -->
                    <script src="https://code.jquery.com/jquery-1.11.3.min.js"></script>
                    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.5/js/bootstrap.min.js" integrity="sha512-K1qjQ+NcF2TYO/eI3M6v8EiNYZfA95pQumfvcVrTHtwQVDG+aHRqLi/ETn2uB+1JqwYqVG3LIvdm9lj6imS/pQ==" crossorigin="anonymous"></script>
                </head>
                <body>
                <div class="container">
                    <div class="row">
                        <div class="col-md-6 col-md-offset-3">
                            <h2>Sorry, we can't process your request.</h2>
                            <a class="btn btn-block loadingBtn btn-success btn-lg" data-loading-text="Processing, please wait..." href="${process.env.STRIPE_ENDPOINT}/stripe-pay?data=${event.queryStringParameters.data}" class="button" target="_self" >Try Again</a><br><br>
                            <a class="btn btn-block loadingBtn btn-danger btn-lg" data-loading-text="Processing, please wait..." href="https://${event.queryStringParameters.d}/paymentSP.php?simple=1&data=${event.queryStringParameters.data}&do=cancel&stripe=true" class="button" target="_self" >Cancel Order</a>
                        </div>
                    </div>
                </div>
                <script>
                </script>
                </body>
                </html>
        `
    };
};
