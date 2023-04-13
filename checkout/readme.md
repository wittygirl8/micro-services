#Things pending

-   source [done]
-   currency has to be dynamic [done]
-   day week month has to be populated [done]
-   transaction mode id and method id has to be populated
-   log request and response
-   decrypt dynamic [done]
-   php testing
-   unit testing
-   move all the unit functions out of one file [done]
-   need to make sure all the amount are not in decimals [done]
-   design the nice page for error and the message should be dynamic and should contain the order no. and some more details[done]
-   Update the payment id on the after the payment is successful. [done]
-   refund api has to be tested
-   webhook api has to be tested
-   why billing address has to be passed during session?

# reference

-   https://github.com/aws-samples/aws-xray-sdk-node-sample/blob/master/index.js

# Plan for the short url

path - <Custom-Domain>/shortUrl
Method - Post
long_url
expire_date
Auth - Api key  
return
Masked - Short ID

path - <Custom-Domain>/shortUrl/<id>
Method - GET
return
Masked - Short ID

# How do we really make a use of it

path - <Custom-Domain>/shortUrl/redirect/<id>
Method - GET
return
Masked - 301 redirect to the long URL
