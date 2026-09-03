const axios = require('axios');

module.exports = async (req, res) => {
  // CORS Headers
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

  const { orderId, paymentStatus, pickup, dropoff, packageInfo } = req.body;

  try {
    // Only dispatch to Shipday if payment capture succeeded
    if (paymentStatus === 'COMPLETED') {
      const shipdayOrder = {
        orderNumber: orderId,
        customerName: dropoff?.name || 'Valued Customer',
        customerAddress: dropoff?.address || 'Las Vegas, NV',
        customerPhoneNumber: dropoff?.phone || '0000000000',
        pickupName: pickup?.name || 'Pickup Location',
        pickupAddress: pickup?.address || 'Las Vegas, NV',
        pickupPhoneNumber: pickup?.phone || '0000000000',
        specialInstruction: `[${packageInfo?.description || 'Courier Delivery'}] ${packageInfo?.notes || ''}`.trim(),
        orderItem: [
          {
            name: packageInfo?.description || 'Express Courier Delivery',
            unitPrice: 15.95,
            quantity: 1
          }
        ]
      };

      // Dispatch order to Shipday API
      const shipdayRes = await axios({
        url: 'https://api.shipday.com/orders',
        method: 'post',
        headers: {
          'Authorization': `Basic ${process.env.SHIPDAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: shipdayOrder
      });

      return res.status(200).json({
        success: true,
        shipday: shipdayRes.data
      });
    } else {
      return res.status(400).json({ error: 'Payment status not completed' });
    }
  } catch (error) {
    console.error('Shipday Dispatch Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: 'Internal Fulfillment Error',
      details: error.response ? error.response.data : error.message
    });
  }
};
