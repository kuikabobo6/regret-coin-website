// api/health.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: '$REGRET Airdrop API',
    version: '1.0.0',
    endpoints: {
      '/api/stats': 'GET - Get statistics',
      '/api/register': 'POST - Register wallet',
      '/api/spin': 'POST - Spin wheel',
      '/api/health': 'GET - Health check'
    },
    environment: process.env.NODE_ENV || 'development',
    postgres: process.env.POSTGRES_URL ? 'configured' : 'not configured',
    region: process.env.VERCEL_REGION || 'unknown'
  };
  
  console.log('🏥 Health check:', health);
  
  return res.status(200).json(health);
}