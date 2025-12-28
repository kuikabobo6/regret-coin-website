const { query } = require('../lib/database');
const { verifyWallet } = require('../lib/utils');

module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { wallet, referralCode, walletType } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Validar wallet
    if (!verifyWallet(wallet)) {
      return res.status(400).json({ error: 'Wallet inválida' });
    }

    // Verificar límite de participantes
    const stats = await query('SELECT * FROM stats WHERE id = 1');
    if (stats.rows[0].total_participants >= 5000) {
      return res.status(400).json({ 
        error: 'Airdrop completo. Ya hemos alcanzado el límite de 5,000 participantes.' 
      });
    }

    // Verificar si ya está registrado
    const existing = await query(
      'SELECT * FROM participants WHERE wallet_address = $1',
      [wallet]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Esta wallet ya está registrada' 
      });
    }

    // Generar código de referido único
    const generatedReferralCode = `REGRET${wallet.slice(0, 8).toUpperCase()}`;

    // Iniciar transacción
    await query('BEGIN');

    // Registrar participante
    await query(
      `INSERT INTO participants 
       (wallet_address, referral_code, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4)`,
      [wallet, generatedReferralCode, ip, userAgent]
    );

    // Procesar referido si existe
    if (referralCode && referralCode !== generatedReferralCode) {
      const referrer = await query(
        'SELECT * FROM participants WHERE referral_code = $1',
        [referralCode]
      );

      if (referrer.rows.length > 0) {
        // Registrar referido
        await query(
          `INSERT INTO referrals (referrer_wallet, referred_wallet)
           VALUES ($1, $2)`,
          [referrer.rows[0].wallet_address, wallet]
        );

        // Actualizar contador del referidor
        await query(
          `UPDATE participants 
           SET referral_count = referral_count + 1,
               referral_tokens = referral_tokens + 500,
               tokens = tokens + 500
           WHERE wallet_address = $1`,
          [referrer.rows[0].wallet_address]
        );
      }
    }

    // Actualizar estadísticas globales
    await query(
      `UPDATE stats 
       SET total_participants = total_participants + 1,
           tokens_reserved = tokens_reserved + 1000,
           last_updated = CURRENT_TIMESTAMP
       WHERE id = 1`
    );

    await query('COMMIT');

    res.status(200).json({
      success: true,
      message: '¡Registro exitoso! Has reclamado 1,000 $REGRET',
      referralCode: generatedReferralCode,
      tokens: 1000
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};