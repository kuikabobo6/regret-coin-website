import { db } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { referrerWallet, referredWallet, referralCode } = req.body;

    if (!referrerWallet || !referredWallet || !referralCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent self-referral
    if (referrerWallet === referredWallet) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    const client = await db.connect();

    // Check if referrer exists
    const referrerExists = await client.sql`
      SELECT * FROM participants WHERE wallet_address = ${referrerWallet}
    `;

    if (referrerExists.rows.length === 0) {
      await client.release();
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // Check if referred wallet already referred
    const alreadyReferred = await client.sql`
      SELECT * FROM referrals WHERE referred_wallet = ${referredWallet}
    `;

    if (alreadyReferred.rows.length > 0) {
      await client.release();
      return res.status(400).json({ error: 'Wallet already referred' });
    }

    // Check if referral code matches
    const codeMatches = await client.sql`
      SELECT * FROM participants 
      WHERE wallet_address = ${referrerWallet} 
      AND referral_code = ${referralCode}
    `;

    if (codeMatches.rows.length === 0) {
      await client.release();
      return res.status(400).json({ error: 'Invalid referral code' });
    }

    // Add referral
    await client.sql`
      INSERT INTO referrals (referrer_wallet, referred_wallet, referral_code, tokens_awarded)
      VALUES (${referrerWallet}, ${referredWallet}, ${referralCode}, 500)
    `;

    // Award tokens to referrer
    await client.sql`
      UPDATE participants 
      SET tokens = tokens + 500,
          referral_count = referral_count + 1,
          referral_earned = referral_earned + 500
      WHERE wallet_address = ${referrerWallet}
    `;

    // Update global stats
    await client.sql`
      UPDATE global_stats 
      SET tokens_reserved = tokens_reserved + 500
      WHERE id = 1
    `;

    await client.release();

    res.status(200).json({
      success: true,
      data: {
        message: 'Referral added successfully! 500 $REGRET awarded.',
        awardedTokens: 500
      }
    });

  } catch (error) {
    console.error('Add referral error:', error);
    
    // Check for duplicate
    if (error.message.includes('duplicate') || error.code === '23505') {
      return res.status(400).json({ error: 'Referral already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}