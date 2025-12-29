// api/admin/dashboard.js - Administrative dashboard endpoint
import { query } from '../_db.js';

/**
 * Admin Dashboard Endpoint
 * Protected endpoint for administrative statistics and monitoring
 * 
 * Query Parameters:
 * - admin_token: Security token (matches ADMIN_TOKEN env var)
 * - period: 'day' | 'week' | 'month' (default: 'day')
 * 
 * Usage:
 * GET /api/admin/dashboard?admin_token=YOUR_TOKEN&period=day
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    const adminToken = req.headers['x-admin-token'] || req.query.admin_token;

    if (!adminToken) {
      return res.status(401).json({
        success: false,
        error: 'Admin token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Simple token validation (in production, use JWT)
    if (adminToken !== process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN) {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin token',
        code: 'INVALID_TOKEN'
      });
    }

    // ============================================================================
    // PARAMETERS
    // ============================================================================

    const period = (req.query.period || 'day').toLowerCase();
    const validPeriods = ['day', 'week', 'month'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
        code: 'INVALID_PERIOD'
      });
    }

    const timeFilter = {
      day: "NOW() - INTERVAL '24 hours'",
      week: "NOW() - INTERVAL '7 days'",
      month: "NOW() - INTERVAL '30 days'"
    }[period];

    // ============================================================================
    // FETCH STATISTICS
    // ============================================================================

    // Global stats
    const globalStats = await query('SELECT * FROM global_stats WHERE id = 1');
    const global = globalStats.rows[0] || {};

    // User growth
    const userGrowth = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN registered_at >= ${timeFilter} THEN 1 END) as period,
        COUNT(CASE WHEN last_active >= ${timeFilter} THEN 1 END) as active
      FROM participants
    `);

    // Spin statistics
    const spinStats = await query(`
      SELECT
        COUNT(*) as total_spins,
        COUNT(CASE WHEN spin_date >= CURRENT_DATE - INTERVAL '${period}' THEN 1 END) as period_spins,
        AVG(prize_amount) as avg_prize,
        MIN(prize_amount) as min_prize,
        MAX(prize_amount) as max_prize,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prize_amount) as median_prize
      FROM wheel_spins
    `);

    // Referral statistics
    const referralStats = await query(`
      SELECT
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN created_at >= ${timeFilter} THEN 1 END) as period_referrals,
        SUM(tokens_awarded) as total_tokens_awarded,
        AVG(tokens_awarded) as avg_tokens_per_referral
      FROM referrals
    `);

    // Top performers
    const topPerformers = await query(`
      SELECT
        wallet_address,
        referral_count,
        referral_earned,
        tokens,
        registered_at
      FROM participants
      WHERE referral_count > 0
      ORDER BY referral_earned DESC
      LIMIT 10
    `);

    // Wallet distribution
    const walletDistribution = await query(`
      SELECT
        wallet_type,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM participants
      GROUP BY wallet_type
      ORDER BY count DESC
    `);

    // Recent registrations
    const recentRegistrations = await query(`
      SELECT
        wallet_address,
        wallet_type,
        referral_code,
        registered_at,
        utm_source,
        utm_medium,
        utm_campaign
      FROM participants
      ORDER BY registered_at DESC
      LIMIT 20
    `);

    // Active sessions
    const activeSessions = await query(`
      SELECT
        COUNT(DISTINCT session_id) as active_sessions,
        COUNT(DISTINCT wallet_address) as unique_users,
        MAX(last_active) as last_activity
      FROM participants
      WHERE last_active >= NOW() - INTERVAL '1 hour'
    `);

    // ============================================================================
    // BUILD RESPONSE
    // ============================================================================

    const dashboard = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        period: period,
        overview: {
          totalParticipants: parseInt(global.total_participants || 0),
          tokensReserved: parseInt(global.tokens_reserved || 0),
          participantsToday: parseInt(global.participants_today || 0),
          totalSpins: parseInt(global.total_spins || 0)
        },
        userMetrics: {
          total: parseInt(userGrowth.rows[0]?.total || 0),
          periodNew: parseInt(userGrowth.rows[0]?.period || 0),
          periodActive: parseInt(userGrowth.rows[0]?.active || 0),
          conversionRate: global.total_participants > 0 
            ? (parseInt(userGrowth.rows[0]?.active || 0) / parseInt(global.total_participants || 1) * 100).toFixed(2) 
            : '0.00'
        },
        spinMetrics: {
          totalSpins: parseInt(spinStats.rows[0]?.total_spins || 0),
          periodSpins: parseInt(spinStats.rows[0]?.period_spins || 0),
          averagePrize: parseFloat(spinStats.rows[0]?.avg_prize || 0).toFixed(0),
          medianPrize: parseFloat(spinStats.rows[0]?.median_prize || 0).toFixed(0),
          minPrize: parseInt(spinStats.rows[0]?.min_prize || 0),
          maxPrize: parseInt(spinStats.rows[0]?.max_prize || 0)
        },
        referralMetrics: {
          totalReferrals: parseInt(referralStats.rows[0]?.total_referrals || 0),
          periodReferrals: parseInt(referralStats.rows[0]?.period_referrals || 0),
          totalTokensAwarded: parseInt(referralStats.rows[0]?.total_tokens_awarded || 0),
          averagePerReferral: parseInt(referralStats.rows[0]?.avg_tokens_per_referral || 0)
        },
        topReferrers: topPerformers.rows.map(performer => ({
          wallet: performer.wallet_address.substring(0, 8) + '...' + performer.wallet_address.substring(36),
          referrals: performer.referral_count,
          earned: performer.referral_earned,
          totalTokens: performer.tokens,
          registeredAt: performer.registered_at
        })),
        walletDistribution: walletDistribution.rows.map(dist => ({
          type: dist.wallet_type,
          count: parseInt(dist.count),
          percentage: parseFloat(dist.percentage)
        })),
        recentRegistrations: recentRegistrations.rows.map(reg => ({
          wallet: reg.wallet_address.substring(0, 8) + '...' + reg.wallet_address.substring(36),
          walletType: reg.wallet_type,
          registeredAt: reg.registered_at,
          utmSource: reg.utm_source,
          utmMedium: reg.utm_medium,
          utmCampaign: reg.utm_campaign
        })),
        activeSessions: {
          activeSessions: parseInt(activeSessions.rows[0]?.active_sessions || 0),
          uniqueUsers: parseInt(activeSessions.rows[0]?.unique_users || 0),
          lastActivity: activeSessions.rows[0]?.last_activity
        }
      }
    };

    console.log(`📊 Admin dashboard accessed [${period}]`);

    return res.status(200).json(dashboard);

  } catch (error) {
    console.error('Admin dashboard error:', {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
}
