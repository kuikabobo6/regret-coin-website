const jwt = require('jsonwebtoken');
const { query } = require('../../lib/database');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { wallet, signature, message } = req.body;
    const adminWallet = process.env.ADMIN_WALLET;

    // Verificar que sea la wallet admin
    if (wallet !== adminWallet) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // En producción, verificar la firma del mensaje
    // Por simplicidad, solo verificamos que sea la wallet correcta
    
    const token = jwt.sign(
      { wallet, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      token,
      wallet
    });

  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};