export const errorPage = async (obj) => {
    return `<html>
    <head>
    <style>
    body{
      font-family: sans-serif
      }
    .container{
      display: block;
      width: 500px;
      border: 1px solid #d9d5d5; 
      padding: 20px;
      margin:0 auto;
    }
    .button {
      display: block;
      width: 115px;
      height: 25px;
      padding: 10px;
      text-align: center;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      line-height: 25px;
    }
    .button_try_again{
      background: #28a745;
    }
    .button_cancel{
      background: #4E9CAF;;
    }
    .error {
      text-align: center;
    }
    .error_grey{
    	color: #9C9C9C;
      font-size: 10px;
    }
    </style>
    </head>
    <body>
    <div class="container">
      <h3>Payment failed</h3>
      <div class="error">
      <p> Your payment for Order #${obj.order_id || '######'} could not be completed . If an amount was debited, it will be refunded to your card within 3 to 5 working days.</p>
      </div>
      <center><a href="${obj?.try_again_url ? obj?.try_again_url : "#"}" class="button button_try_again">Try Again</a></center>
      <br>
      <div class="error_grey">  
        ${obj.error_code}
      </div>
    </div>
    </body>
    </html>`;
};
