// api/register.js - Wallet registration endpoint
import { query, withTransaction, validateSolanaAddress, generateReferralCode, formatDatabaseError } from './_db.js';

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
    const { wallet, walletType, sessionId, userAgent, referrer, utmSource, utmMedium, utmCampaign } = req.body;

    // Validate required fields
    if (!wallet || !walletType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: wallet and walletType',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate Solana address
    if (!validateSolanaAddress(wallet)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid Solana address format',
        code: 'INVALID_ADDRESS'
      });
    }

    // Validate wallet type
    const validWalletTypes = ['phantom', 'solflare', 'backpack'];
    if (!validWalletTypes.includes(walletType.toLowerCase())) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid wallet type',
        code: 'INVALID_WALLET_TYPE'
      });
    }

    // Check if wallet already exists
    const existingWallet = await query(
      'SELECT wallet_address, referral_code, tokens FROM participants WHERE wallet_address = $1',
      [wallet]
    );

    if (existingWallet.rows.length > 0) {
      // Wallet already registered - update last_active
      const participant = existingWallet.rows[0];
      
      try {
        await query(
          'UPDATE participants SET last_active = NOW(), session_id = $1 WHERE wallet_address = $2',
          [sessionId || null, wallet]
        );
      } catch (updateError) {
        console.error('Update last_active error:', updateError);
        // Not critical if this fails, continue with response
      }

      return res.status(200).json({
        success: true,
        data: {
          referralCode: participant.referral_code,
          tokens: participant.tokens,
          message: 'Wallet already registered',
          alreadyRegistered: true
        }
      });
    }

    // Register new wallet with atomic transaction
    const result = await withTransaction(async (client) => {
      // Generate unique referral code
      let referralCode = generateReferralCode(wallet);
      let attempts = 0;
      const maxAttempts = 5;

      // Ensure referral code is unique
      while (attempts < maxAttempts) {
        const existingCode = await client.query(
          'SELECT id FROM participants WHERE referral_code = $1',
          [referralCode]
        );

        if (existingCode.rows.length === 0) {
          break; // Code is unique
        }

        // Generate new code on collision
        const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
        referralCode = `REGRET-${randomSuffix}`;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Could not generate unique referral code after max attempts');
      }

      // Insert new participant
      await client.query(
        `INSERT INTO participants (
          wallet_address,
          wallet_type,
          referral_code,
          tokens,
          session_id,
          user_agent,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          registered_at,
          last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          wallet,
          walletType.toLowerCase(),
          referralCode,
          1000, // Initial tokens
          sessionId || null,
          userAgent || '',
          referrer || null,
          utmSource || null,
          utmMedium || null,
          utmCampaign || null
        ]
      );

      // Update global stats atomically
      await client.query(
        `UPDATE global_stats 
         SET total_participants = total_participants + 1,
             tokens_reserved = tokens_reserved + 1000,
             participants_today = participants_today + 1,
             updated_at = NOW()
         WHERE id = 1`,
        []
      );

      return {
        referralCode,
        tokens: 1000
      };
    });

    console.log(`✅ Registered wallet: ${wallet.substring(0, 8)}...`);

    return res.status(200).json({
      success: true,
      data: {
        referralCode: result.referralCode,
        tokens: result.tokens,
        message: 'Wallet registered successfully'
      }
    });

  } catch (error) {
    console.error('Registration error:', {
      error: error.message,
      code: error.code,
      wallet: req.body?.wallet?.substring(0, 8) + '...'
    });

    // Handle specific database errors
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'Wallet already registered',
        code: 'WALLET_EXISTS',
        statusCode: 409
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
