#!/usr/bin/env node

/**
 * REGRET Airdrop - Admin CLI Tool
 * 
 * Administrative command-line interface for database operations
 * 
 * Usage:
 *   node scripts/admin-cli.js <command> [options]
 * 
 * Commands:
 *   stats                 - Show current statistics
 *   rebuild-stats         - Rebuild global statistics
 *   purge-old <days>      - Purge data older than N days
 *   reset-test-data       - Reset all test data (development only)
 *   health-check          - Check database health
 *   list-participants     - List all registered participants
 *   export-csv <table>    - Export table to CSV
 *   help                  - Show this help message
 */

import { pool } from '../api/_db.js';

// ============================================================================
// CLI COMMANDS
// ============================================================================

const commands = {
  async stats() {
    console.log('\n📊 Current Statistics\n');
    
    try {
      const result = await pool.query('SELECT * FROM global_stats WHERE id = 1');
      const stats = result.rows[0];
      
      console.log(`Total Participants: ${stats.total_participants}`);
      console.log(`Tokens Reserved: ${stats.tokens_reserved.toLocaleString()}`);
      console.log(`Participants Today: ${stats.participants_today}`);
      console.log(`Total Spins: ${stats.total_spins}`);
      console.log(`Last Updated: ${stats.updated_at}\n`);
      
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  async rebuildStats() {
    console.log('\n🔧 Rebuilding Global Statistics...\n');
    
    try {
      const countResult = await pool.query(`
        SELECT 
          COUNT(*) as participants,
          COUNT(DISTINCT CASE WHEN registered_at::date = CURRENT_DATE THEN wallet_address END) as today,
          COALESCE(SUM(tokens), 0) as total_tokens,
          COUNT(DISTINCT CASE WHEN last_active::date = CURRENT_DATE THEN wallet_address END) as active_today
        FROM participants
      `);
      
      const count = countResult.rows[0];
      
      await pool.query(`
        UPDATE global_stats 
        SET 
          total_participants = $1,
          tokens_reserved = $2,
          participants_today = $3,
          updated_at = NOW()
        WHERE id = 1
      `, [count.participants, count.total_tokens, count.today]);
      
      console.log('✅ Statistics rebuilt successfully');
      console.log(`   Participants: ${count.participants}`);
      console.log(`   Tokens Reserved: ${count.total_tokens.toLocaleString()}`);
      console.log(`   Active Today: ${count.active_today}\n`);
      
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  async purgeOld(days = 30) {
    console.log(`\n🗑️  Purging data older than ${days} days...\n`);
    
    if (!process.env.CONFIRM_PURGE) {
      console.error('⚠️  Set CONFIRM_PURGE=yes environment variable to confirm');
      return false;
    }
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const analyticsResult = await pool.query(`
        DELETE FROM analytics_events
        WHERE created_at < $1
        RETURNING id
      `, [cutoffDate.toISOString()]);
      
      const spinsResult = await pool.query(`
        DELETE FROM wheel_spins
        WHERE spin_date < DATE($1)
        RETURNING id
      `, [cutoffDate.toISOString()]);
      
      console.log('✅ Purge completed');
      console.log(`   Deleted Analytics Events: ${analyticsResult.rows.length}`);
      console.log(`   Deleted Wheel Spins: ${spinsResult.rows.length}`);
      console.log(`   Cutoff Date: ${cutoffDate.toLocaleDateString()}\n`);
      
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  async resetTestData() {
    console.log('\n⚠️  Resetting all test data...\n');
    
    if (!process.env.CONFIRM_RESET) {
      console.error('⚠️  Set CONFIRM_RESET=yes environment variable to confirm');
      console.error('⚠️  THIS WILL DELETE ALL DATA!\n');
      return false;
    }
    
    try {
      // Reset sequences
      await pool.query('ALTER SEQUENCE participants_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE referrals_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE wheel_spins_id_seq RESTART WITH 1');
      await pool.query('ALTER SEQUENCE analytics_events_id_seq RESTART WITH 1');
      
      // Clear data
      await pool.query('DELETE FROM analytics_events');
      await pool.query('DELETE FROM referrals');
      await pool.query('DELETE FROM wheel_spins');
      await pool.query('DELETE FROM participants');
      
      // Reset global stats
      await pool.query(`
        UPDATE global_stats 
        SET 
          total_participants = 0,
          tokens_reserved = 0,
          participants_today = 0,
          total_spins = 0,
          updated_at = NOW()
        WHERE id = 1
      `);
      
      console.log('✅ Test data reset completed\n');
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  async healthCheck() {
    console.log('\n🏥 Database Health Check\n');
    
    try {
      const tables = ['participants', 'referrals', 'wheel_spins', 'analytics_events'];
      
      for (const table of tables) {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0]?.count || 0);
        console.log(`✅ ${table}: ${count} rows`);
      }
      
      // Check indexes
      const indexResult = await pool.query(`
        SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public'
      `);
      console.log(`✅ Indexes: ${indexResult.rows[0]?.count || 0}`);
      
      console.log('\n✅ Database is healthy\n');
      return true;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  },

  async listParticipants(limit = 20) {
    console.log(`\n👥 Recent Participants (showing ${limit})\n`);
    
    try {
      const result = await pool.query(`
        SELECT
          wallet_address,
          wallet_type,
          tokens,
          referral_count,
          referral_earned,
          registered_at
        FROM participants
        ORDER BY registered_at DESC
        LIMIT $1
      `, [limit]);
      
      if (result.rows.length === 0) {
        console.log('No participants found\n');
        return true;
      }
      
      console.log('Wallet | Type | Tokens | Referrals | Earned | Registered');
      console.log('-------|------|--------|-----------|--------|----------------');
      
      result.rows.forEach(row => {
        const wallet = row.wallet_address.substring(0, 8) + '...' + row.wallet_address.substring(36);
        console.log(
          `${wallet} | ${row.wallet_type.padEnd(6)} | ${row.tokens.toString().padEnd(6)} | ${row.referral_count.toString().padEnd(9)} | ${row.referral_earned.toString().padEnd(6)} | ${new Date(row.registered_at).toLocaleDateString()}`
        );
      });
      
      console.log('');
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  async exportCsv(table) {
    console.log(`\n📥 Exporting ${table} to CSV\n`);
    
    if (!['participants', 'referrals', 'wheel_spins', 'analytics_events'].includes(table)) {
      console.error('Invalid table. Valid tables: participants, referrals, wheel_spins, analytics_events');
      return false;
    }
    
    try {
      const result = await pool.query(`SELECT * FROM ${table}`);
      
      if (result.rows.length === 0) {
        console.log(`Table ${table} is empty`);
        return true;
      }
      
      // Get column names
      const columns = Object.keys(result.rows[0]);
      
      // Print header
      console.log(columns.map(c => `"${c}"`).join(','));
      
      // Print rows
      result.rows.forEach(row => {
        console.log(columns.map(col => {
          const val = row[col];
          if (val === null) return '';
          if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
          return val;
        }).join(','));
      });
      
      console.log(`\n✅ Exported ${result.rows.length} rows\n`);
      return true;
    } catch (error) {
      console.error('Error:', error.message);
      return false;
    }
  },

  help() {
    console.log(`
REGRET Airdrop - Admin CLI Tool

Usage:
  node scripts/admin-cli.js <command> [options]

Commands:
  stats                 - Show current statistics
  rebuild-stats         - Rebuild global statistics
  purge-old <days>      - Purge data older than N days (default: 30)
  reset-test-data       - Reset all test data (requires CONFIRM_RESET=yes)
  health-check          - Check database health
  list-participants     - List recent participants
  export-csv <table>    - Export table to CSV
                         (valid tables: participants, referrals, wheel_spins, analytics_events)
  help                  - Show this message

Examples:
  node scripts/admin-cli.js stats
  node scripts/admin-cli.js health-check
  node scripts/admin-cli.js list-participants 50
  node scripts/admin-cli.js export-csv participants
  CONFIRM_PURGE=yes node scripts/admin-cli.js purge-old 30

Environment Variables:
  POSTGRES_URL          - Database connection string (required)
  CONFIRM_RESET         - Set to 'yes' to confirm reset-test-data
  CONFIRM_PURGE         - Set to 'yes' to confirm purge-old
    `);
    return true;
  }
};

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    commands.help();
    process.exit(0);
  }
  
  const command = args[0].replace(/[-_]/g, '');
  const commandFn = Object.entries(commands).find(
    ([key]) => key.replace(/[-_]/g, '') === command
  );
  
  if (!commandFn) {
    console.error(`Unknown command: ${args[0]}`);
    console.log('Run "node scripts/admin-cli.js help" for available commands');
    process.exit(1);
  }
  
  try {
    const success = await commandFn[1](args[1], args[2]);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
