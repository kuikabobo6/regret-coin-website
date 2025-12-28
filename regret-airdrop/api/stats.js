const { query } = require('../lib/database');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const stats = await query('SELECT * FROM stats WHERE id = 1');
    
    // Calcular días hasta lanzamiento (12 de enero)
    const launchDate = new Date('2024-01-12');
    const today = new Date();
    const daysToLaunch = Math.ceil((launchDate - today) / (1000 * 60 * 60 * 24));
    
    res.status(200).json({
      totalParticipants: stats.rows[0].total_participants,
      tokensReserved: stats.rows[0].tokens_reserved,
      daysToLaunch: daysToLaunch > 0 ? daysToLaunch : 0,
      maxParticipants: 5000,
      availableSlots: 5000 - stats.rows[0].total_participants
    });
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};