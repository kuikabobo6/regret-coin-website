-- Tabla de participantes
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    tokens INTEGER DEFAULT 1000,
    referral_count INTEGER DEFAULT 0,
    referral_tokens INTEGER DEFAULT 0,
    wheel_tokens INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    ip_address VARCHAR(45),
    user_agent TEXT,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_spin TIMESTAMP,
    spins_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false
);

-- Tabla de referidos
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_wallet VARCHAR(44) NOT NULL,
    referred_wallet VARCHAR(44) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de spins (giros de ruleta)
CREATE TABLE IF NOT EXISTS spins (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    prize INTEGER NOT NULL,
    spun_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de estadísticas
CREATE TABLE IF NOT EXISTS stats (
    id SERIAL PRIMARY KEY,
    total_participants INTEGER DEFAULT 0,
    tokens_reserved INTEGER DEFAULT 0,
    total_spins INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar estadísticas iniciales
INSERT INTO stats (total_participants, tokens_reserved) 
VALUES (0, 0) 
ON CONFLICT (id) DO NOTHING;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_wallet ON participants(wallet_address);
CREATE INDEX IF NOT EXISTS idx_referral_code ON participants(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals ON referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_spins_date ON spins(spun_at DESC);