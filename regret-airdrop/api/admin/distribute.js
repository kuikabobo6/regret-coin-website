const jwt = require('jsonwebtoken');
const { query } = require('../../lib/database');

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

    // Obtener todos los participantes con sus tokens
    const participants = await query(
      `SELECT wallet_address, tokens 
       FROM participants 
       WHERE tokens > 0 
       ORDER BY wallet_address`
    );

    // Generar archivo CSV para bulk sending
    const csvData = participants.rows.map(p => ({
      wallet: p.wallet_address,
      amount: p.tokens,
      tokenAddress: 'TOKEN_ADDRESS_HERE', // Reemplazar con el token address real
      decimals: 9
    }));

    // También generar JSON para otras herramientas
    const jsonData = participants.rows.map(p => ({
      receiver: p.wallet_address,
      amount: p.tokens,
      memo: `Airdrop $REGRET - ${new Date().toISOString().split('T')[0]}`
    }));

    res.status(200).json({
      success: true,
      totalWallets: participants.rows.length,
      totalTokens: participants.rows.reduce((sum, p) => sum + p.tokens, 0),
      csv: csvData,
      json: jsonData,
      instructions: [
        '1. Crea el token $REGRET en pump.fun o Raydium',
        '2. Actualiza tokenAddress en este archivo',
        '3. Usa una herramienta de bulk sending como:',
        '   - Solana CLI con spl-token transfer',
        '   - Step Finance Bulk Token Sender',
        '   - Solflare Portfolio Bulk Send',
        '4. Asegúrate de tener suficiente SOL para fees'
      ]
    });

  } catch (error) {
    console.error('Error preparando distribución:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};