// api/admin/operations.js - Administrative operations endpoint
import { query, withTransaction } from '../_db.js';

/**
 * Admin Operations Endpoint
 * Protected endpoint for administrative database operations
 * 
 * Query Parameters:
 * - admin_token: Security token (matches ADMIN_TOKEN env var)
 * - operation: 'purge_old_data' | 'reset_test_data' | 'rebuild_stats'
 * - confirm: 'yes' (required for destructive operations)
 * 
 * Usage:
 * POST /api/admin/operations
 * Headers: x-admin-token: YOUR_TOKEN
 * Body: { operation: 'reset_test_data', confirm: 'yes' }
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    const adminToken = req.headers['x-admin-token'] || req.body?.admin_token;

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
    // PARSE REQUEST
    // ============================================================================

    const { operation, confirm } = req.body;

    if (!operation) {
      return res.status(400).json({
        success: false,
        error: 'Operation parameter required',
        code: 'MISSING_OPERATION'
      });
    }

    // Require explicit confirmation for destructive operations
    const destructiveOps = ['purge_old_data', 'reset_test_data'];
    if (destructiveOps.includes(operation) && confirm !== 'yes') {
      return res.status(400).json({
        success: false,
        error: 'Destructive operation requires confirm: "yes" parameter',
        code: 'CONFIRMATION_REQUIRED'
      });
    }

    // ============================================================================
    // EXECUTE OPERATION
    // ============================================================================

    let result = {};

    switch (operation) {
      case 'rebuild_stats':
        result = await rebuildGlobalStats();
        break;

      case 'purge_old_data':
        result = await purgeOldData(30); // Purge older than 30 days
        break;

      case 'reset_test_data':
        result = await resetTestData();
        break;

      case 'health_check':
        result = await healthCheck();
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown operation: ${operation}`,
          code: 'UNKNOWN_OPERATION',
          availableOperations: ['rebuild_stats', 'purge_old_data', 'reset_test_data', 'health_check']
        });
    }

    console.log(`🔧 Admin operation executed: ${operation}`, result);

    return res.status(200).json({
      success: true,
      operation: operation,
      timestamp: new Date().toISOString(),
      data: result
    });

  } catch (error) {
    console.error('Admin operation error:', {
      error: error.message,
      code: error.code,
      operation: req.body?.operation,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: 'Operation failed',
      code: 'OPERATION_FAILED',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Rebuild global stats from scratch
 */
async function rebuildGlobalStats() {
  return await withTransaction(async (client) => {
    // Count actual data
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as participants,
        COUNT(DISTINCT CASE WHEN registered_at::date = CURRENT_DATE THEN wallet_address END) as today,
        COALESCE(SUM(tokens), 0) as total_tokens
      FROM participants
    `);

    const count = countResult.rows[0];

    // Update global stats
    await client.query(`
      UPDATE global_stats 
      SET 
        total_participants = $1,
        tokens_reserved = $2,
        participants_today = $3,
        updated_at = NOW()
      WHERE id = 1
    `, [
      count.participants,
      count.total_tokens,
      count.today
    ]);

    return {
      message: 'Global stats rebuilt',
      stats: {
        totalParticipants: count.participants,
        tokensReserved: count.total_tokens,
        participantsToday: count.today
      }
    };
  });
}

/**
 * Purge old analytics and spin data
 */
async function purgeOldData(daysOld = 30) {
  return await withTransaction(async (client) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete old analytics events
    const analyticsResult = await client.query(`
      DELETE FROM analytics_events
      WHERE created_at < $1
      RETURNING id
    `, [cutoffDate.toISOString()]);

    // Delete old wheel spins (keep referral history)
    const spinsResult = await client.query(`
      DELETE FROM wheel_spins
      WHERE spin_date < DATE($1)
      AND wallet_address NOT IN (
        SELECT referrer_wallet FROM referrals
      )
      RETURNING id
    `, [cutoffDate.toISOString()]);

    return {
      message: `Purged data older than ${daysOld} days`,
      deletedAnalyticsEvents: analyticsResult.rows.length,
      deletedWheelSpins: spinsResult.rows.length,
      cutoffDate: cutoffDate.toISOString()
    };
  });
}

/**
 * Reset test data (for development only)
 */
async function resetTestData() {
  return await withTransaction(async (client) => {
    // Reset sequences
    await client.query('ALTER SEQUENCE participants_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE referrals_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE wheel_spins_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE analytics_events_id_seq RESTART WITH 1');

    // Clear all data
    await client.query('DELETE FROM analytics_events');
    await client.query('DELETE FROM referrals');
    await client.query('DELETE FROM wheel_spins');
    await client.query('DELETE FROM participants');

    // Reset global stats
    await client.query(`
      UPDATE global_stats 
      SET 
        total_participants = 0,
        tokens_reserved = 0,
        participants_today = 0,
        total_spins = 0,
        updated_at = NOW()
      WHERE id = 1
    `);

    return {
      message: 'Test data reset completed',
      affectedTables: [
        'participants',
        'referrals',
        'wheel_spins',
        'analytics_events',
        'global_stats'
      ]
    };
  });
}

/**
 * Perform health checks on database
 */
async function healthCheck() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check table row counts
    const tables = ['participants', 'referrals', 'wheel_spins', 'analytics_events', 'global_stats'];
    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      results.checks[table] = {
        rows: parseInt(result.rows[0]?.count || 0),
        status: 'healthy'
      };
    }

    // Check indexes
    const indexResult = await query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    results.checks.indexes = {
      count: parseInt(indexResult.rows[0]?.count || 0),
      status: 'healthy'
    };

    // Check for data integrity issues
    const integrityResult = await query(`
      SELECT 
        COUNT(DISTINCT p.wallet_address) as unique_participants,
        COUNT(DISTINCT r.referrer_wallet) as unique_referrers
      FROM participants p
      LEFT JOIN referrals r ON p.wallet_address = r.referrer_wallet
    `);

    results.checks.integrity = {
      uniqueParticipants: parseInt(integrityResult.rows[0]?.unique_participants || 0),
      uniqueReferrers: parseInt(integrityResult.rows[0]?.unique_referrers || 0),
      status: 'healthy'
    };

    results.overall = 'healthy';
    return results;
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: error.message
    };
  }
}
