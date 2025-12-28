const jwt = require('jsonwebtoken');
const { query } = require('../../lib/database');

module.exports = async (req, res) => {
  // Verificar token
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que sea admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE wallet_address ILIKE $3 OR referral_code ILIKE $3';
      params = [limit, offset, `%${search}%`];
    } else {
      params = [limit, offset];
    }

    const participants = await query(
      `SELECT wallet_address, referral_code, tokens, 
              referral_count, wheel_tokens, referral_tokens,
              registered_at, last_spin, spins_count
       FROM participants 
       ${whereClause}
       ORDER BY registered_at DESC 
       LIMIT $1 OFFSET $2`,
      params
    );

    const total = await query('SELECT COUNT(*) as count FROM participants');

    res.status(200).json({
      participants: participants.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Error obteniendo participantes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};