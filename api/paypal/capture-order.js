const axios = require('axios');

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    'https://api-m.paypal.com/v1/oauth2/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data.access_token;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paypalOrderID, orderDetails } = req.body;

  try {
    const accessToken = await getPayPalAccessToken();
    const captureResponse = await axios.post(
      `https://api-m.paypal.com/v2/checkout/orders/${paypalOrderID}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (captureResponse.data.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Payment capture failed.' });
    }

    const shipdayPayload = {
      orderNumber: `LMD-${paypalOrderID.slice(-6).toUpperCase()}`,
      customerName: orderDetails.customerName,
      customerPhoneNumber: orderDetails.customerPhone,
      customerAddress: orderDetails.dropoffAddress,
      restaurantName: "Last Minute Delivery HQ",
      restaurantAddress: orderDetails.pickupAddress,
      restaurantPhoneNumber: orderDetails.customerPhone,
      totalOrderCost: parseFloat(orderDetails.totalAmount),
      deliveryFee: parseFloat(orderDetails.deliveryFee),
      tips: parseFloat(orderDetails.tip || 0),
      paymentMethod: "paypal",
      deliveryInstruction: orderDetails.notes || "Priority Last Minute Delivery"
    };

    const shipdayResponse = await axios.post(
      'https://api.shipday.com/orders',
      shipdayPayload,
      {
        headers: {
          'Authorization': `Basic ${process.env.SHIPDAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.status(200).json({
      success: true,
      shipdayOrderId: shipdayResponse.data.orderId,
      trackingUrl: shipdayResponse.data.trackingLink || ''
    });

  } catch (err) {
    console.error('Checkout Error:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data?.message || 'Failed to process order.'
    });
  }
};
