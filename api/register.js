import { db } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet, walletType, sessionId, userAgent, referrer, utmSource, utmMedium, utmCampaign } = req.body;

    if (!wallet || !walletType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate Solana address (44 characters, base58)
    if (wallet.length !== 44 || !/^[1-9A-HJ-NP-Za-km-z]{44}$/.test(wallet)) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }

    const client = await db.connect();

    // Check if wallet already exists
    const existingWallet = await client.sql`
      SELECT * FROM participants WHERE wallet_address = ${wallet}
    `;

    if (existingWallet.rows.length > 0) {
      await client.release();
      
      // Update last active
      await client.sql`
        UPDATE participants 
        SET last_active = NOW(), 
            session_id = ${sessionId || null}
        WHERE wallet_address = ${wallet}
      `;
      
      return res.status(200).json({
        success: true,
        data: {
          referralCode: existingWallet.rows[0].referral_code,
          tokens: existingWallet.rows[0].tokens,
          message: 'Wallet already registered',
          alreadyRegistered: true
        }
      });
    }

    // Generate unique referral code
    const referralCode = 'REGRET-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Check if referral code is unique
    let isUnique = false;
    let attempts = 0;
    let finalReferralCode = referralCode;
    
    while (!isUnique && attempts < 5) {
      const existingCode = await client.sql`
        SELECT * FROM participants WHERE referral_code = ${finalReferralCode}
      `;
      
      if (existingCode.rows.length === 0) {
        isUnique = true;
      } else {
        finalReferralCode = 'REGRET-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        attempts++;
      }
    }

    // Insert new participant
    await client.sql`
      INSERT INTO participants (
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
      ) VALUES (
        ${wallet},
        ${walletType},
        ${finalReferralCode},
        ${1000},
        ${sessionId || null},
        ${userAgent || ''},
        ${referrer || ''},
        ${utmSource || null},
        ${utmMedium || null},
        ${utmCampaign || null},
        NOW(),
        NOW()
      )
    `;

    // Update global stats
    await client.sql`
      UPDATE global_stats 
      SET total_participants = total_participants + 1,
          tokens_reserved = tokens_reserved + 1000,
          participants_today = participants_today + 1
      WHERE id = 1
    `;

    await client.release();

    return res.status(200).json({
      success: true,
      data: {
        referralCode: finalReferralCode,
        tokens: 1000,
        message: 'Wallet registered successfully'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Check for duplicate key error
    if (error.message.includes('duplicate key') || error.code === '23505') {
      return res.status(200).json({
        success: true,
        data: {
          referralCode: 'REGRET-' + wallet.substring(0, 8).toUpperCase(),
          tokens: 1000,
          message: 'Wallet already registered (race condition)',
          alreadyRegistered: true
        }
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}