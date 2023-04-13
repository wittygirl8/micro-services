export const errorPage = async (obj) => {
    return `<html>
    <head>
    <style>
    .error {
      color: #9C9C9C;
      text-align: center;
    }
    </style>
    </head>
    <body>
    <br>
    <br>
    <div class="error">
    <p> Payment failed: Your payment was not complete. Any amount debited from your card will be refunded in 3-5 working days. We apologize for any inconvenience.</p>
    <p> </p>
    <p> Request id: ${obj.requestId}</p>
    <p> Order id: ${obj.orderId}</p>
    <p> message: ${obj.message}</p>
    </div>
    
    </body>
    </html>`;
};
