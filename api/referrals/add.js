// api/referrals/add.js - Add referral endpoint
import { query, withTransaction, validateSolanaAddress } from '../_db.js';

const REFERRAL_REWARD = 500; // Tokens awarded for successful referral

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
    const { referrerWallet, referredWallet, referralCode } = req.body;

    // Validate required fields
    if (!referrerWallet || !referredWallet || !referralCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: referrerWallet, referredWallet, referralCode',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate wallet addresses format
    if (!validateSolanaAddress(referrerWallet)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid referrer wallet address',
        code: 'INVALID_REFERRER_ADDRESS'
      });
    }

    if (!validateSolanaAddress(referredWallet)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid referred wallet address',
        code: 'INVALID_REFERRED_ADDRESS'
      });
    }

    // Prevent self-referral
    if (referrerWallet === referredWallet) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot refer yourself',
        code: 'SELF_REFERRAL'
      });
    }

    // Validate referral code format
    if (typeof referralCode !== 'string' || referralCode.length < 5 || referralCode.length > 20) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid referral code format',
        code: 'INVALID_CODE'
      });
    }

    // ============================================================================
    // PRE-VALIDATIONS (outside transaction for speed)
    // ============================================================================

    // Check if referrer exists
    const referrer = await query(
      'SELECT wallet_address, referral_code FROM participants WHERE wallet_address = $1',
      [referrerWallet]
    );

    if (referrer.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Referrer wallet not found. Referrer must be registered first.',
        code: 'REFERRER_NOT_FOUND'
      });
    }

    // Verify referral code matches referrer
    const referrerData = referrer.rows[0];
    if (referrerData.referral_code !== referralCode) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid referral code for this referrer',
        code: 'CODE_MISMATCH'
      });
    }

    // Check if referred wallet exists (must be registered to be referred)
    const referred = await query(
      'SELECT wallet_address FROM participants WHERE wallet_address = $1',
      [referredWallet]
    );

    if (referred.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Referred wallet not found. Referred wallet must be registered first.',
        code: 'REFERRED_NOT_FOUND'
      });
    }

    // Check if referred wallet is already in a referral relationship
    const existingReferral = await query(
      'SELECT id FROM referrals WHERE referred_wallet = $1',
      [referredWallet]
    );

    if (existingReferral.rows.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'This wallet has already been referred',
        code: 'ALREADY_REFERRED'
      });
    }

    // ============================================================================
    // ATOMIC TRANSACTION (all DB writes)
    // ============================================================================

    const result = await withTransaction(async (client) => {
      // Insert referral record (with unique constraint on referred_wallet)
      try {
        await client.query(
          `INSERT INTO referrals (
            referrer_wallet,
            referred_wallet,
            referral_code,
            tokens_awarded
          ) VALUES ($1, $2, $3, $4)`,
          [referrerWallet, referredWallet, referralCode, REFERRAL_REWARD]
        );
      } catch (insertError) {
        // Handle if someone else referred this wallet in parallel
        if (insertError.code === '23505') {
          throw new Error('ALREADY_REFERRED');
        }
        throw insertError;
      }

      // Award tokens to referrer
      const updateReferrer = await client.query(
        `UPDATE participants 
         SET tokens = tokens + $1,
             referral_count = referral_count + 1,
             referral_earned = referral_earned + $1,
             last_active = NOW()
         WHERE wallet_address = $2
         RETURNING tokens`,
        [REFERRAL_REWARD, referrerWallet]
      );

      if (updateReferrer.rows.length === 0) {
        throw new Error('REFERRER_UPDATE_FAILED');
      }

      const referrerNewTokens = updateReferrer.rows[0].tokens;

      // Update global stats
      await client.query(
        `UPDATE global_stats 
         SET tokens_reserved = tokens_reserved + $1,
             updated_at = NOW()
         WHERE id = 1`,
        [REFERRAL_REWARD]
      );

      return {
        referrerNewTokens,
        awardedTokens: REFERRAL_REWARD
      };
    });

    console.log(`✅ Referral successful: ${referrerWallet.substring(0, 8)}... referred ${referredWallet.substring(0, 8)}...`);

    return res.status(200).json({
      success: true,
      data: {
        message: `Referral added successfully! ${result.awardedTokens} $REGRET awarded.`,
        awardedTokens: result.awardedTokens,
        referrerNewTokens: result.referrerNewTokens
      }
    });

  } catch (error) {
    console.error('Add referral error:', {
      error: error.message,
      code: error.code,
      referrer: req.body?.referrerWallet?.substring(0, 8) + '...'
    });

    // Handle specific errors
    if (error.message === 'ALREADY_REFERRED' || error.code === '23505') {
      return res.status(409).json({ 
        success: false,
        error: 'This wallet has already been referred',
        code: 'ALREADY_REFERRED'
      });
    }

    if (error.message === 'REFERRER_UPDATE_FAILED') {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update referrer tokens',
        code: 'UPDATE_FAILED'
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
