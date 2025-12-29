// api/referrals/wallet.js - Nombre NORMAL, no [wallet].js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Obtener wallet del query string
  const { wallet } = req.query;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet parameter required' });
  }
  
  console.log('📋 Getting referrals for:', wallet.substring(0, 8) + '...');
  
  // Datos mock por ahora
  const mockData = {
    referralCount: 0,
    totalEarned: 0,
    referrals: [],
    message: 'API working (mock data)'
  };
  
  return res.status(200).json({
    success: true,
    data: mockData
  });
}