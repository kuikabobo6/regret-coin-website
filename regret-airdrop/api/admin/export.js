const jwt = require('jsonwebtoken');
const { query } = require('../../lib/database');
const { Parser } = require('json2csv');

module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const participants = await query(
      `SELECT wallet_address as "Wallet",
              referral_code as "Código Referido",
              tokens as "Tokens Totales",
              referral_count as "Referidos",
              wheel_tokens as "Tokens Ruleta",
              referral_tokens as "Tokens Referidos",
              registered_at as "Fecha Registro",
              last_spin as "Último Giro",
              spins_count as "Total Giros"
       FROM participants 
       ORDER BY registered_at DESC`
    );

    const fields = [
      'Wallet',
      'Código Referido',
      'Tokens Totales',
      'Referidos',
      'Tokens Ruleta',
      'Tokens Referidos',
      'Fecha Registro',
      'Último Giro',
      'Total Giros'
    ];

    const json2csv = new Parser({ fields, delimiter: ',' });
    const csv = json2csv.parse(participants.rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=participantes_regret.csv');
    res.status(200).send(csv);

  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};