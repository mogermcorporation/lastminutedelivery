export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { orderId, pickup, dropoff, packageInfo, paymentStatus } = req.body;

  // Optional: Reject if payment failed or is unverified
  if (!paymentStatus || (paymentStatus !== 'COMPLETED' && paymentStatus !== 'PENDING')) {
    return res.status(400).json({ error: 'Payment not verified.' });
  }

  try {
    const response = await fetch('https://api.shipday.com/orders', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `API-KEY ${process.env.Hrcn6bfSIb.NiYWSN3WQYDeGmWEN7aD}`
      },
      body: JSON.stringify({
        orderNumber: orderId,
        customerName: dropoff.name,
        customerAddress: dropoff.address,
        customerPhoneNumber: dropoff.phone,
        pickupName: pickup.name,
        pickupAddress: pickup.address,
        pickupPhoneNumber: pickup.phone,
        deliveryInstruction: packageInfo.notes,
        orderItem: [{ name: packageInfo.description, unitPrice: 0, quantity: 1 }]
      })
    });

    const data = await response.json();
    return res.status(200).json({ success: true, shipdayData: data });
  } catch (error) {
    console.error('Shipday dispatch error:', error);
    return res.status(500).json({ error: 'Failed to dispatch order to Shipday' });
  }
}
