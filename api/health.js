// api/health.js - Health check endpoint with real database connectivity test
import { checkDatabaseHealth } from './_db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Check database connectivity
    const dbHealth = await checkDatabaseHealth();
    
    const health = {
      success: true,
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: '$REGRET Airdrop API',
      version: '1.0.0',
      endpoints: {
        '/api/register': 'POST - Register wallet',
        '/api/spin': 'POST - Spin wheel',
        '/api/stats': 'GET - Get statistics',
        '/api/referrals/add': 'POST - Add referral',
        '/api/referrals/wallet': 'GET - Get referral stats',
        '/api/health': 'GET - Health check'
      },
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbHealth.status,
        version: dbHealth.version || 'unknown',
        timestamp: dbHealth.timestamp,
        configured: !!process.env.POSTGRES_URL
      },
      region: process.env.VERCEL_REGION || 'unknown',
      uptime: process.uptime()
    };

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    
    console.log(`🏥 Health check [${statusCode}]:`, {
      dbStatus: dbHealth.status,
      timestamp: new Date().toISOString()
    });

    return res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check error:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: '$REGRET Airdrop API',
      version: '1.0.0',
      error: 'Database connectivity check failed',
      code: 'DB_UNAVAILABLE',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'unknown'
    });
  }
}
