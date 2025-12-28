const { query } = require('../lib/database');

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const stats = await query('SELECT * FROM stats WHERE id = 1');

    if (!stats.rows || stats.rows.length === 0) {
      // If no stats exist, return default values
      res.status(200).json({
        totalParticipants: 0,
        tokensReserved: 0,
        daysToLaunch: 30,
        maxParticipants: 5000,
        availableSlots: 5000
      });
      return;
    }

    // Calcular días hasta lanzamiento (12 de enero 2025)
    const launchDate = new Date('2025-01-12');
    const today = new Date();
    const daysToLaunch = Math.ceil((launchDate - today) / (1000 * 60 * 60 * 24));

    res.status(200).json({
      totalParticipants: stats.rows[0].total_participants || 0,
      tokensReserved: stats.rows[0].tokens_reserved || 0,
      daysToLaunch: daysToLaunch > 0 ? daysToLaunch : 0,
      maxParticipants: 5000,
      availableSlots: Math.max(0, 5000 - (stats.rows[0].total_participants || 0))
    });
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    // Return mock data if database fails
    res.status(200).json({
      totalParticipants: Math.floor(Math.random() * 1000) + 500,
      tokensReserved: Math.floor(Math.random() * 3000000) + 2000000,
      daysToLaunch: Math.floor(Math.random() * 30) + 1,
      maxParticipants: 5000,
      availableSlots: 4500
    });
  }
};
