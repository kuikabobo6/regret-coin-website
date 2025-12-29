import { db } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const client = await db.connect();
    const today = new Date().toISOString().split('T')[0];

    // Check if already spun today
    const existingSpin = await client.sql`
      SELECT * FROM wheel_spins 
      WHERE wallet_address = ${wallet} 
      AND spin_date = ${today}
    `;

    if (existingSpin.rows.length > 0) {
      await client.release();
      return res.status(400).json({ 
        error: 'Already spun today. Come back tomorrow!' 
      });
    }

    // Get user's current tokens
    const userResult = await client.sql`
      SELECT tokens FROM participants WHERE wallet_address = ${wallet}
    `;

    if (userResult.rows.length === 0) {
      await client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTokens = userResult.rows[0].tokens || 1000;

    // Determine prize (weighted probabilities)
    const prizes = [
      { amount: 100, probability: 0.3 },   // 30%
      { amount: 250, probability: 0.25 },  // 25%
      { amount: 500, probability: 0.2 },   // 20%
      { amount: 750, probability: 0.15 },  // 15%
      { amount: 1000, probability: 0.07 }, // 7%
      { amount: 1500, probability: 0.03 }  // 3%
    ];

    let random = Math.random();
    let prizeAmount = 100;
    
    for (const prize of prizes) {
      if (random < prize.probability) {
        prizeAmount = prize.amount;
        break;
      }
      random -= prize.probability;
    }

    const totalTokens = currentTokens + prizeAmount;

    // Update user tokens
    await client.sql`
      UPDATE participants 
      SET tokens = ${totalTokens},
          total_spins = total_spins + 1,
          last_spin = NOW(),
          last_active = NOW()
      WHERE wallet_address = ${wallet}
    `;

    // Record spin
    await client.sql`
      INSERT INTO wheel_spins (wallet_address, prize_amount, spin_date)
      VALUES (${wallet}, ${prizeAmount}, ${today})
    `;

    // Update global tokens
    await client.sql`
      UPDATE global_stats 
      SET tokens_reserved = tokens_reserved + ${prizeAmount}
      WHERE id = 1
    `;

    await client.release();

    // Map prize to color
    const colorMap = {
      100: '#4A90E2',
      250: '#00CC88',
      500: '#FFD166',
      750: '#9D4EDD',
      1000: '#FF6B6B',
      1500: '#4ECDC4'
    };

    res.status(200).json({
      success: true,
      data: {
        prize: prizeAmount,
        color: colorMap[prizeAmount] || '#4A90E2',
        totalTokens,
        message: `You won ${prizeAmount} $REGRET!`,
        spinDate: today
      }
    });

  } catch (error) {
    console.error('Spin API error:', error);
    
    // Fallback: Return mock spin
    const prizes = [100, 250, 500, 750, 1000, 1500];
    const prizeAmount = prizes[Math.floor(Math.random() * prizes.length)];
    
    res.status(200).json({
      success: true,
      data: {
        prize: prizeAmount,
        color: '#4A90E2',
        totalTokens: 1000 + prizeAmount,
        message: `You won ${prizeAmount} $REGRET! (Fallback)`,
        fallback: true
      }
    });
  }
}