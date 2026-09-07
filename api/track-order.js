const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { orderNumber } = req.query;

  if (!orderNumber) {
    return res.status(400).json({ error: 'Missing orderNumber query parameter' });
  }

  try {
    const response = await axios({
      url: `https://api.shipday.com/orders/eta/${orderNumber}`,
      method: 'get',
      headers: {
        'Authorization': `Basic ${process.env.SHIPDAY_API_KEY || 'Hrcn6bfSIb.NiYWSN3WQYDeGmWEN7aD'}`
      }
    });

    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch ETA data from Shipday',
      details: error.response ? error.response.data : error.message
    });
  }
};
