// api/spin.js - Wheel spin endpoint
import { query, withTransaction, validateSolanaAddress } from './_db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { wallet } = req.body;

    // Validate required fields
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
        code: 'MISSING_WALLET'
      });
    }

    // Validate wallet address format
    if (!validateSolanaAddress(wallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    // ============================================================================
    // PRE-VALIDATION (outside transaction for speed)
    // ============================================================================

    // Check if wallet is registered
    const participant = await query(
      'SELECT tokens, last_spin FROM participants WHERE wallet_address = $1',
      [wallet]
    );

    if (participant.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not registered. Please register first.',
        code: 'WALLET_NOT_FOUND'
      });
    }

    const userData = participant.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastSpinDate = userData.last_spin 
      ? new Date(userData.last_spin).toISOString().split('T')[0] 
      : null;

    // Check if already spun today (early exit)
    if (lastSpinDate === today) {
      return res.status(429).json({
        success: false,
        error: 'Already spun today. Come back tomorrow!',
        code: 'ALREADY_SPUN_TODAY',
        nextSpin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Check in wheel_spins table for today's spin
    const todaySpin = await query(
      'SELECT id FROM wheel_spins WHERE wallet_address = $1 AND spin_date = CURRENT_DATE',
      [wallet]
    );

    if (todaySpin.rows.length > 0) {
      return res.status(429).json({
        success: false,
        error: 'Already spun today. Come back tomorrow!',
        code: 'ALREADY_SPUN_TODAY',
        nextSpin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // ============================================================================
    // PRIZE SELECTION (outside transaction - no DB access)
    // ============================================================================

    // Prize probabilities (weighted random)
    const prizes = [
      { amount: 100, weight: 30 },   // 30% chance
      { amount: 250, weight: 25 },   // 25% chance
      { amount: 500, weight: 20 },   // 20% chance
      { amount: 750, weight: 15 },   // 15% chance
      { amount: 1000, weight: 8 },   // 8% chance
      { amount: 1500, weight: 2 }    // 2% chance
    ];

    // Weighted random selection
    const totalWeight = prizes.reduce((sum, prize) => sum + prize.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
      random -= prize.weight;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }

    const prizeAmount = selectedPrize.amount;

    // ============================================================================
    // ATOMIC TRANSACTION (all DB operations here)
    // ============================================================================

    const result = await withTransaction(async (client) => {
      // Record the spin with unique constraint handling
      try {
        await client.query(
          'INSERT INTO wheel_spins (wallet_address, prize_amount, spin_date) VALUES ($1, $2, CURRENT_DATE)',
          [wallet, prizeAmount]
        );
      } catch (spinError) {
        // Unique constraint violation - someone spun between our checks
        if (spinError.code === '23505') {
          throw new Error('DUPLICATE_SPIN');
        }
        throw spinError;
      }

      // Update participant tokens and spin count (atomically)
      await client.query(
        `UPDATE participants
         SET tokens = tokens + $1,
             total_spins = total_spins + 1,
             last_spin = CURRENT_DATE,
             last_active = NOW()
         WHERE wallet_address = $2`,
        [prizeAmount, wallet]
      );

      // Update global stats
      await client.query(
        `UPDATE global_stats
         SET total_spins = total_spins + 1,
             updated_at = NOW()
         WHERE id = 1`,
        []
      );

      return { prizeAmount, newTokens: userData.tokens + prizeAmount };
    });

    console.log(`🎰 Spin successful: ${wallet.substring(0, 8)}... won ${result.prizeAmount} $REGRET`);

    return res.status(200).json({
      success: true,
      data: {
        prize: result.prizeAmount,
        newBalance: result.newTokens,
        message: `¡Felicitaciones! Ganaste ${result.prizeAmount} $REGRET`,
        nextSpin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Spin error:', {
      error: error.message,
      code: error.code,
      wallet: req.body?.wallet?.substring(0, 8) + '...'
    });

    // Handle specific errors
    if (error.message === 'DUPLICATE_SPIN' || error.code === '23505') {
      return res.status(429).json({
        success: false,
        error: 'Already spun today (race condition detected)',
        code: 'ALREADY_SPUN_TODAY'
      });
    }

    if (error.code === '25P02') { // Transaction aborted
      return res.status(500).json({
        success: false,
        error: 'Transaction failed - database might be unavailable',
        code: 'TRANSACTION_FAILED'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}
