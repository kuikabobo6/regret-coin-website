// api/referrals/wallet.js - Get referrals by wallet endpoint
import { query, validateSolanaAddress } from '../_db.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowed: ['GET']
    });
  }

  try {
    const { wallet, limit = '100', offset = '0' } = req.query;

    // Validate wallet parameter
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required as query parameter',
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

    // Validate and sanitize pagination params
    const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500); // Max 500
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    // ============================================================================
    // Get participant stats
    // ============================================================================

    const participantQuery = await query(
      `SELECT 
        wallet_address,
        referral_code,
        referral_count,
        referral_earned,
        tokens,
        registered_at,
        last_active
       FROM participants
       WHERE wallet_address = $1`,
      [wallet]
    );

    if (participantQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found. Wallet must be registered first.',
        code: 'WALLET_NOT_FOUND'
      });
    }

    const participant = participantQuery.rows[0];

    // ============================================================================
    // Get detailed referral list with pagination
    // ============================================================================

    const referralsQuery = await query(
      `SELECT
        r.id,
        r.referred_wallet,
        r.tokens_awarded,
        r.created_at as referred_at,
        p.wallet_type,
        p.tokens as referred_tokens,
        p.total_spins as referred_total_spins
       FROM referrals r
       JOIN participants p ON r.referred_wallet = p.wallet_address
       WHERE r.referrer_wallet = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [wallet, safeLimit, safeOffset]
    );

    // Get total count for pagination
    const countQuery = await query(
      'SELECT COUNT(*) as total FROM referrals WHERE referrer_wallet = $1',
      [wallet]
    );

    const totalReferrals = parseInt(countQuery.rows[0]?.total || 0);

    // ============================================================================
    // Format response
    // ============================================================================

    const referrals = referralsQuery.rows.map(ref => ({
      referredWallet: ref.referred_wallet,
      tokensAwarded: ref.tokens_awarded,
      referredAt: ref.referred_at,
      referredWalletType: ref.wallet_type,
      referredCurrentTokens: ref.referred_tokens,
      referredTotalSpins: ref.referred_total_spins
    }));

    const response = {
      success: true,
      data: {
        wallet: wallet,
        referralCode: participant.referral_code,
        referralStats: {
          totalReferrals: participant.referral_count,
          successfulReferrals: totalReferrals,
          totalEarned: participant.referral_earned,
          currentTokens: participant.tokens,
          averageEarningsPerReferral: totalReferrals > 0 
            ? Math.round(participant.referral_earned / totalReferrals) 
            : 0
        },
        referrals: referrals,
        pagination: {
          limit: safeLimit,
          offset: safeOffset,
          total: totalReferrals,
          hasMore: safeOffset + safeLimit < totalReferrals,
          pages: Math.ceil(totalReferrals / safeLimit),
          currentPage: Math.floor(safeOffset / safeLimit) + 1
        },
        registeredAt: participant.registered_at,
        lastActive: participant.last_active,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📊 Referral stats retrieved: ${wallet.substring(0, 8)}... (${totalReferrals} referrals)`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Get referrals error:', {
      error: error.message,
      code: error.code,
      wallet: req.query?.wallet?.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}
