const axios = require('axios');

module.exports = async (req, res) => {
  // CORS and Method Checks (already in place)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or configure for security
  // ...

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    orderID,
    customerName,
    customerPhone,
    pickupAddress,
    customerAddress,
    deliveryTime,
    deliveryInstruction
  } = req.body;

  if (!orderID) {
    return res.status(400).json({ error: 'Missing orderID in request body' });
  }

  try {
    // 1. Get PayPal Access Token using ENVIRONMENT VARIABLES
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios({
      url: 'https://api-m.paypal.com/v1/oauth2/token',
      method: 'post',
      headers: {
        'Accept': 'application/json',
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

    // 3. Dispatch Delivery to Shipday with ALL details
    if (paypalDetails.status === 'COMPLETED') {
      const shipdayOrder = {
        // ... (as previously set up)
        deliveryInstruction: deliveryInstruction || '', // Capture the notes
        // ...
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

      return res.status(200).json({ status: 'COMPLETED', success: true });
    } else {
      return res.status(400).json({ error: 'PayPal payment was not completed' });
    }
  } catch (error) {
    console.error('Backend Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
