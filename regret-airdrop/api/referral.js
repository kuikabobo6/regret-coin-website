const { query } = require('../lib/database');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { wallet } = req.query;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet requerida' });
  }

  try {
    // Obtener datos del usuario
    const user = await query(
      `SELECT referral_code, referral_count, referral_tokens 
       FROM participants WHERE wallet_address = $1`,
      [wallet]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener lista de referidos
    const referrals = await query(
      `SELECT referred_wallet, created_at 
       FROM referrals 
       WHERE referrer_wallet = $1 
       ORDER BY created_at DESC`,
      [wallet]
    );

    res.status(200).json({
      referralCode: user.rows[0].referral_code,
      referralCount: user.rows[0].referral_count,
      referralTokens: user.rows[0].referral_tokens,
      referrals: referrals.rows
    });

  } catch (error) {
    console.error('Error obteniendo referidos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};