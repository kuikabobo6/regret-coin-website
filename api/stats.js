// api/stats.js - Versión SIMPLE para test
export default async function handler(req, res) {
  console.log('📊 Stats API called');
  
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Respuesta simple SIN base de datos primero
    const stats = {
      totalParticipants: 1875,
      tokensReserved: 3875000,
      daysToLaunch: 14,
      participantsToday: 42,
      trend: 'up',
      timestamp: new Date().toISOString(),
      status: 'ok',
      message: 'API is working!'
    };
    
    console.log('✅ Returning stats:', stats);
    
    return res.status(200).json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Stats error:', error);
    
    return res.status(200).json({
      success: true,
      data: {
        totalParticipants: 1875,
        tokensReserved: 3875000,
        daysToLaunch: 14,
        participantsToday: 42,
        trend: 'up',
        fallback: true,
        error: error.message
      }
    });
  }
}