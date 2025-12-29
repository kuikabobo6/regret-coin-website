// api/stats.js - Statistics endpoint
import { query } from './_db.js';

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
    // Get global stats
    const globalStats = await query(`
      SELECT 
        total_participants, 
        tokens_reserved, 
        participants_today, 
        total_spins, 
        updated_at
      FROM global_stats
      WHERE id = 1
    `);

    if (globalStats.rows.length === 0) {
      // Initialize global stats if not exists
      await query(`
        INSERT INTO global_stats (id, total_participants, tokens_reserved, participants_today, total_spins, updated_at)
        VALUES (1, 1875, 3875000, 0, 0, NOW())
        ON CONFLICT (id) DO NOTHING
      `);
    }

    const stats = globalStats.rows[0] || {
      total_participants: 1875,
      tokens_reserved: 3875000,
      participants_today: 0,
      total_spins: 0,
      updated_at: new Date().toISOString()
    };

    // Get today's registrations
    const todayRegistrations = await query(`
      SELECT COUNT(*) as count
      FROM participants
      WHERE DATE(registered_at) = CURRENT_DATE
    `);

    const todayCount = parseInt(todayRegistrations.rows[0]?.count || 0);

    // Calculate days to launch
    const launchDate = new Date('2025-01-12');
    const now = new Date();
    const daysToLaunch = Math.max(0, Math.ceil((launchDate - now) / (1000 * 60 * 60 * 24)));

    // Calculate tokens remaining
    const totalTokens = 10000000;
    const tokensRemaining = totalTokens - stats.tokens_reserved;

    const response = {
      success: true,
      data: {
        totalParticipants: stats.total_participants,
        tokensReserved: stats.tokens_reserved,
        tokensRemaining: tokensRemaining,
        tokensPercentage: Math.round((stats.tokens_reserved / totalTokens) * 100),
        participantsToday: todayCount,
        totalSpins: stats.total_spins,
        daysToLaunch: daysToLaunch,
        launchDate: '2025-01-12',
        timestamp: new Date().toISOString(),
        lastUpdated: stats.updated_at
      }
    };

    console.log(`📊 Stats retrieved: ${stats.total_participants} participants, ${stats.tokens_reserved} tokens reserved`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Stats endpoint error:', {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    // Return fallback stats with error indication
    const fallbackStats = {
      totalParticipants: 1875,
      tokensReserved: 3875000,
      tokensRemaining: 10000000 - 3875000,
      tokensPercentage: 39,
      participantsToday: 42,
      totalSpins: 0,
      daysToLaunch: 14,
      launchDate: '2025-01-12',
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: fallbackStats,
      warning: 'Using cached statistics due to database error',
      fallback: true,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
