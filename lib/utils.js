// Utilidades compartidas

// Verificar wallet de Solana
function verifyWallet(wallet) {
    if (!wallet || typeof wallet !== 'string') return false;
    if (wallet.length !== 44) return false;
    if (!wallet.startsWith('solana:')) {
        // Asegurar que sea base58 válida
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        return base58Regex.test(wallet);
    }
    return true;
}

// Validar firma de mensaje (simplificada para desarrollo)
function verifySignature(wallet, signature, message) {
    // En producción, implementar verificación real con @solana/web3.js
    // Por ahora, retornamos true para desarrollo
    return true;
}

// Formatear números
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Rate limiting básico
const rateLimit = new Map();

function checkRateLimit(ip, maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    
    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, { count: 1, startTime: now });
        return true;
    }
    
    const data = rateLimit.get(ip);
    
    if (now - data.startTime > windowMs) {
        data.count = 1;
        data.startTime = now;
        return true;
    }
    
    if (data.count >= maxRequests) {
        return false;
    }
    
    data.count++;
    return true;
}

// Limpiar rate limit viejo
setInterval(() => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    
    for (const [ip, data] of rateLimit.entries()) {
        if (now - data.startTime > windowMs * 2) {
            rateLimit.delete(ip);
        }
    }
}, 5 * 60 * 1000);

module.exports = {
    verifyWallet,
    verifySignature,
    formatNumber,
    checkRateLimit
};