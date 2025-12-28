const { query } = require('../lib/database');

const PRIZES = [100, 250, 500, 750, 1000, 1500];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { wallet } = req.body;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet requerida' });
    }

    // Verificar si el usuario existe
    const user = await query(
      'SELECT * FROM participants WHERE wallet_address = $1',
      [wallet]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet no registrada' });
    }

    // Verificar cooldown de 24 horas
    const lastSpin = user.rows[0].last_spin;
    if (lastSpin) {
      const hoursSinceLastSpin = (Date.now() - new Date(lastSpin).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSpin < 24) {
        const nextSpin = new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000);
        return res.status(400).json({
          error: `Ya giraste hoy. Próximo giro: ${nextSpin.toLocaleTimeString()}`,
          nextSpin: nextSpin.toISOString()
        });
      }
    }

    // Seleccionar premio aleatorio
    const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)];

    // Iniciar transacción
    await query('BEGIN');

    // Registrar giro
    await query(
      'INSERT INTO spins (wallet_address, prize) VALUES ($1, $2)',
      [wallet, prize]
    );

    // Actualizar usuario
    await query(
      `UPDATE participants 
       SET wheel_tokens = wheel_tokens + $1,
           tokens = tokens + $1,
           last_spin = CURRENT_TIMESTAMP,
           spins_count = spins_count + 1
       WHERE wallet_address = $2`,
      [prize, wallet]
    );

    // Actualizar estadísticas
    await query(
      `UPDATE stats 
       SET tokens_reserved = tokens_reserved + $1,
           total_spins = total_spins + 1
       WHERE id = 1`,
      [prize]
    );

    await query('COMMIT');

    res.status(200).json({
      success: true,
      prize,
      totalTokens: user.rows[0].tokens + prize,
      nextSpin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Error en ruleta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};