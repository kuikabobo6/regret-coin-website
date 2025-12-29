// api/db.js - Conexión a PostgreSQL de Vercel
import { createPool } from '@vercel/postgres';

// Configuración para desarrollo y producción
const dbConfig = {
  // Vercel provee estas variables automáticamente
  connectionString: process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL,
  
  // Opciones de conexión
  max: 20, // máximo de conexiones
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Crear pool de conexiones
export const pool = createPool(dbConfig);

// Función helper para ejecutar queries
export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Verificar conexión a la base de datos
export async function checkDatabaseConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Inicializar tablas si no existen
export async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Verificar si las tablas existen
    const tablesExist = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'participants'
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
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Wheel spins table
    CREATE TABLE IF NOT EXISTS wheel_spins (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(44) NOT NULL,
      prize_amount INTEGER NOT NULL,
      spin_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(wallet_address, spin_date)
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

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_participants_wallet ON participants(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_participants_referral ON participants(referral_code);
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
    CREATE INDEX IF NOT EXISTS idx_wheel_spins_wallet ON wheel_spins(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_analytics_events ON analytics_events(created_at);
  `;
  
  await query(createTablesSQL);
  
  // Insert initial stats
  await query(`
    INSERT INTO global_stats (id, total_participants, tokens_reserved, participants_today)
    VALUES (1, 1875, 3875000, 42)
    ON CONFLICT (id) DO NOTHING
  `);
  
  console.log('✅ Database tables created successfully');
}