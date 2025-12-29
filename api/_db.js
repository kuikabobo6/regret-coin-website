// api/_db.js - Database configuration and utilities
import { createPool } from '@vercel/postgres';

// Validate environment variables
const requiredEnvVars = ['POSTGRES_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
  console.warn('Database operations will fail until these are configured in Vercel.');
}

// Database configuration
const dbConfig = {
  connectionString: process.env.POSTGRES_URL,
  max: 10, // Reduced for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
export const pool = createPool(dbConfig);

/**
 * Query helper for single operations (non-transactional)
 * Opens and closes a connection for each query
 * Use this for simple SELECT, UPDATE, INSERT that don't need atomicity
 * 
 * @param {string} sql - SQL statement
 * @param {array} params - Query parameters
 * @returns {Promise<QueryResult>}
 */
export async function query(sql, params = []) {
  const client = await pool.connect();

  try {
    const result = await client.query(sql, params);
    return result;
  } catch (error) {
    console.error('Database query error:', {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transaction wrapper for atomic operations
 * Use this for operations that must all succeed or all fail
 * Examples: INSERT + UPDATE, multiple related writes
 * 
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} - Return value from callback
 * 
 * @example
 * await withTransaction(async (client) => {
 *   await client.query('INSERT INTO participants ...');
 *   await client.query('UPDATE global_stats ...');
 * });
 */
export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError.message);
    }
    
    console.error('Transaction error:', {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    client.release();
  }
}

// Health check
export async function checkDatabaseHealth() {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize database tables
export async function initializeDatabase() {
  if (!process.env.POSTGRES_URL) {
    console.log('Skipping database initialization - POSTGRES_URL not configured');
    return false;
  }

  try {
    console.log('🔄 Initializing database...');

    // Check if tables exist
    const tablesExist = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'participants'
      )
    `);

    if (!tablesExist.rows[0].exists) {
      console.log('📊 Creating database tables...');
      await createTables();
    }

    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

async function createTables() {
  const createTablesSQL = `
    -- Participants table
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(44) UNIQUE NOT NULL,
      wallet_type VARCHAR(20) NOT NULL,
      referral_code VARCHAR(20) UNIQUE NOT NULL,
      tokens INTEGER DEFAULT 1000,
      total_spins INTEGER DEFAULT 0,
      last_spin TIMESTAMP,
      referral_count INTEGER DEFAULT 0,
      referral_earned INTEGER DEFAULT 0,
      session_id VARCHAR(50),
      user_agent TEXT,
      referrer TEXT,
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(100),
      registered_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Referrals table
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_wallet VARCHAR(44) NOT NULL,
      referred_wallet VARCHAR(44) UNIQUE NOT NULL,
      referral_code VARCHAR(20) NOT NULL,
      tokens_awarded INTEGER DEFAULT 500,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (referrer_wallet) REFERENCES participants(wallet_address) ON DELETE CASCADE
    );

    -- Wheel spins table
    CREATE TABLE IF NOT EXISTS wheel_spins (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(44) NOT NULL,
      prize_amount INTEGER NOT NULL,
      spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(wallet_address, spin_date),
      FOREIGN KEY (wallet_address) REFERENCES participants(wallet_address) ON DELETE CASCADE
    );

    -- Global stats table
    CREATE TABLE IF NOT EXISTS global_stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      total_participants INTEGER DEFAULT 1875,
      tokens_reserved INTEGER DEFAULT 3875000,
      participants_today INTEGER DEFAULT 42,
      total_spins INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Analytics events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id SERIAL PRIMARY KEY,
      event_name VARCHAR(100) NOT NULL,
      session_id VARCHAR(50),
      wallet_address VARCHAR(44),
      event_data JSONB,
      user_agent TEXT,
      referrer TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_participants_wallet ON participants(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_participants_referral ON participants(referral_code);
    CREATE INDEX IF NOT EXISTS idx_participants_active ON participants(last_active);
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
    CREATE INDEX IF NOT EXISTS idx_wheel_spins_wallet ON wheel_spins(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_wheel_spins_date ON wheel_spins(spin_date);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
  `;

  await query(createTablesSQL);

  // Insert initial global stats
  await query(`
    INSERT INTO global_stats (id, total_participants, tokens_reserved, participants_today)
    VALUES (1, 1875, 3875000, 42)
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('✅ Database tables created successfully');
}

// Utility functions

/**
 * Validate Solana address format
 * Solana addresses are 44 characters, base58 encoded
 * 
 * @param {string} address - Address to validate
 * @returns {boolean} - True if valid Solana address
 */
export function validateSolanaAddress(address) {
  return typeof address === 'string' &&
         address.length === 44 &&
         /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(address);
}

/**
 * Generate deterministic referral code from wallet address
 * Format: REGRET-{BASE64_HASH}
 * 
 * @param {string} walletAddress - Solana wallet address
 * @returns {string} - Referral code
 */
export function generateReferralCode(walletAddress) {
  const hash = Buffer.from(walletAddress).toString('base64')
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 8);
  return `REGRET-${hash}`;
}

/**
 * Sanitize user input
 * Removes leading/trailing whitespace and limits length
 * 
 * @param {any} input - Input to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 1000)
 * @returns {any} - Sanitized input
 */
export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return input;
  return input.trim().substring(0, maxLength);
}

/**
 * Format error response with proper PostgreSQL error code handling
 * 
 * @param {Error} error - Database error
 * @returns {object} - Formatted error object {code, message, statusCode}
 */
export function formatDatabaseError(error) {
  const errorMap = {
    '23505': { message: 'Duplicate entry', statusCode: 409 },
    '23503': { message: 'Referenced record not found', statusCode: 404 },
    '23502': { message: 'Missing required field', statusCode: 400 },
    '25P02': { message: 'Transaction aborted', statusCode: 500 }
  };

  const mapped = errorMap[error.code];
  return {
    code: error.code || 'UNKNOWN_ERROR',
    message: mapped?.message || error.message,
    statusCode: mapped?.statusCode || 500
  };
}
