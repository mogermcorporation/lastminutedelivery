const axios = require('axios');
const Shipday = require('shipday/integration');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    // 1. Authenticate with PayPal
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

    if (paypalDetails.status === 'COMPLETED') {
      const capturedAmount = parseFloat(
        paypalDetails.purchase_units[0].payments.captures[0].amount.value
      );

      // Extract delivery date & time strings
      const datePart = deliveryTime ? deliveryTime.split('T')[0] : '';
      const timePart = deliveryTime ? deliveryTime.split('T')[1] : '';

      // 3. Format Delivery Order Object according to Shipday schema
      const shipdayOrderData = {
        orderNumber: String(orderID),
        customerName: customerName || 'Courier Customer',
        customerEmail: paypalDetails.payer?.email_address || 'customer@example.com',
        customerAddress: customerAddress || 'Las Vegas, NV',
        customerPhoneNumber: customerPhone || '7025550199',
        pickupAddress: pickupAddress || 'Las Vegas, NV',
        expectedDeliveryDate: datePart,
        expectedDeliveryTime: timePart,
        deliveryInstruction: deliveryInstruction || '',
        orderItem: [
          {
            name: packageDescription || 'Last Minute Express Package',
            unitPrice: capturedAmount,
            quantity: 1
          }
        ]
      };

      // Dispatch via official Shipday SDK
      const shipdayApiKey = process.env.SHIPDAY_API_KEY || 'Hrcn6bfSIb.NiYWSN3WQYDeGmWEN7aD';
      const shipdayClient = new Shipday(shipdayApiKey, 10000);

      try {
        await shipdayClient.orderService.insertOrder(shipdayOrderData);
      } catch (shipdayError) {
        console.error('Shipday SDK Error:', shipdayError);
      }

      // 4. Optional Routific Dispatch
      if (process.env.ROUTIFIC_API_KEY) {
        try {
          await axios({
            url: 'https://api.routific.com/v1/orders',
            method: 'post',
            headers: {
              'Authorization': `Bearer ${process.env.ROUTIFIC_API_KEY}`,
              'Content-Type': 'application/json'
            },
            data: {
              id: String(orderID),
              name: customerName || 'Express Customer',
              phone: customerPhone || '7025550199',
              address: customerAddress || 'Las Vegas, NV',
              notes: `Pickup: ${pickupAddress || 'N/A'} | Items: ${packageDescription || 'Standard Package'} | Notes: ${deliveryInstruction || 'None'}`
            }
          });
        } catch (routificErr) {
          console.error('Routific Warning:', routificErr.message);
        }
      }

      return res.status(200).json({ status: 'COMPLETED', success: true });
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
