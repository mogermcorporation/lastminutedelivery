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

  const {
    orderID,
    customerName,
    customerPhone,
    pickupAddress,
    customerAddress,
    deliveryTime,
    deliveryInstruction,
    packageDescription
  } = req.body;

  if (!orderID) {
    return res.status(400).json({ error: 'Missing orderID in request body' });
  }

  try {
    // 1. Get PayPal Access Token
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

    // 3. Dispatch to Shipday
    if (paypalDetails.status === 'COMPLETED') {
      const capturedAmount = parseFloat(
        paypalDetails.purchase_units[0].payments.captures[0].amount.value
      );

      const shipdayOrder = {
        orderNumber: orderID,
        customerName: customerName || 'Courier Customer',
        customerEmail: paypalDetails.payer?.email_address || 'customer@example.com',
        customerAddress: customerAddress || 'Las Vegas, NV',
        customerPhoneNumber: customerPhone || '7025550199',
        pickupAddress: pickupAddress || 'Las Vegas, NV',
        expectedDeliveryDate: deliveryTime ? deliveryTime.split('T')[0] : '',
        expectedDeliveryTime: deliveryTime ? deliveryTime.split('T')[1] : '',
        deliveryInstruction: deliveryInstruction || '',
        orderItem: [
          {
            name: packageDescription || 'Last Minute Delivery Express Package',
            unitPrice: capturedAmount,
            quantity: 1
          }
        ]
      };

      try {
        await axios({
          url: 'https://api.shipday.com/orders',
          method: 'post',
          headers: {
            'Authorization': `Basic ${process.env.SHIPDAY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: shipdayOrder
        });
      } catch (shipdayError) {
        console.error('Shipday API Error:', shipdayError.response ? shipdayError.response.data : shipdayError.message);
        return res.status(200).json({
          status: 'COMPLETED',
          success: true,
          shipdayError: shipdayError.response ? shipdayError.response.data : shipdayError.message
        });
      }

      return res.status(200).json({
        status: 'COMPLETED',
        success: true
      });
    } else {
      return res.status(400).json({ error: 'PayPal payment was not completed' });
    }
  } catch (error) {
    console.error('Capture Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.response ? error.response.data : error.message
    });
  }
};
