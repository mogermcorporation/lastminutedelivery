module.exports = async (req, res) => {
  // Allow OPTIONS preflight for webhook configuration tests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Validate custom token passed in headers
  const webhookToken = req.headers['token'];
  const EXPECTED_TOKEN = process.env.SHIPDAY_WEBHOOK_TOKEN;

  if (EXPECTED_TOKEN && webhookToken !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized webhook request' });
  }

  const { event, order_status, order, carrier, delivery_details } = req.body;

  console.log(`[Shipday Webhook Received] Event: ${event} | Status: ${order_status}`);
  console.log(`Order Number: ${order?.order_number || 'N/A'}`);

  // Process specific delivery events
  switch (event) {
    case 'ORDER_ASSIGNED':
      console.log(`Driver ${carrier?.name} assigned to Order ${order?.order_number}`);
      break;

    case 'ORDER_ACCEPTED_AND_STARTED':
    case 'ORDER_ONTHEWAY':
      console.log(`Order ${order?.order_number} is in transit with ${carrier?.name}`);
      break;

    case 'ORDER_PIKEDUP':
      console.log(`Package picked up for ${delivery_details?.name}`);
      break;

    case 'ORDER_COMPLETED':
      console.log(`Order ${order?.order_number} successfully delivered! POD URLs:`, order?.podUrls);
      break;

    case 'ORDER_FAILED':
      console.warn(`Delivery failed for Order ${order?.order_number}`);
      break;

    default:
      console.log(`Unhandled event type: ${event}`);
  }

  // Acknowledge receipt to Shipday
  return res.status(200).json({ received: true, event });
};
