-- Tabla principal de participantes
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

-- Tabla de referidos
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_wallet VARCHAR(44) NOT NULL,
    referred_wallet VARCHAR(44) UNIQUE NOT NULL,
    referral_code VARCHAR(20) NOT NULL,
    tokens_awarded INTEGER DEFAULT 500,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de spins de ruleta
CREATE TABLE IF NOT EXISTS wheel_spins (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    prize_amount INTEGER NOT NULL,
    spin_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_address, spin_date)
);

-- Estadísticas globales
CREATE TABLE IF NOT EXISTS global_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_participants INTEGER DEFAULT 0,
    tokens_reserved INTEGER DEFAULT 0,
    participants_today INTEGER DEFAULT 0,
    total_spins INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Eventos de analytics
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

-- Sesiones de usuario
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(50) PRIMARY KEY,
    wallet_address VARCHAR(44),
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    page_views INTEGER DEFAULT 1
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_participants_wallet ON participants(wallet_address);
CREATE INDEX IF NOT EXISTS idx_participants_referral ON participants(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_wallet);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_wallet ON wheel_spins(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_date ON wheel_spins(spin_date);
CREATE INDEX IF NOT EXISTS idx_analytics_events ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

-- Insertar stats iniciales
INSERT INTO global_stats (id, total_participants, tokens_reserved, participants_today)
VALUES (1, 1875, 3875000, 42)
ON CONFLICT (id) DO NOTHING;