const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderID, customerName, customerPhone, customerAddress } = req.body;

  if (!orderID) {
    return res.status(400).json({ error: 'Missing orderID in request body' });
  }

  try {
    // 1. Obtain PayPal Access Token
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios({
      url: 'https://api-m.paypal.com/v1/oauth2/token',
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: 'grant_type=client_credentials'
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Capture PayPal Order
    const captureResponse = await axios({
      url: `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const paypalDetails = captureResponse.data;

    // 3. Forward Dynamic Delivery Address to Shipday
    if (paypalDetails.status === 'COMPLETED') {
      const shipdayOrder = {
        orderNumber: orderID,
        customerName: customerName || (paypalDetails.payer.name.given_name + ' ' + paypalDetails.payer.name.surname),
        customerEmail: paypalDetails.payer.email_address,
        customerAddress: customerAddress || 'No Address Provided',
        customerPhoneNumber: customerPhone || '0000000000',
        orderItem: [
          {
            name: 'Last Minute Delivery Item',
            unitPrice: 10.00,
            quantity: 1
          }
        ]
      };

      await axios({
        url: 'https://api.shipday.com/orders',
        method: 'post',
        headers: {
          'Authorization': `Basic ${process.env.SHIPDAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: shipdayOrder
      });

      return res.status(200).json({
        status: 'COMPLETED',
        success: true,
        paypal: paypalDetails
      });
    } else {
      return res.status(400).json({ error: 'PayPal payment was not completed' });
    }
  } catch (error) {
    console.error('Backend Processing Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.response ? error.response.data : error.message
    });
  }
};
