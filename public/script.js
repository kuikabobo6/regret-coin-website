// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
    AIRDROP_BASE: 1000,
    REFERRAL_BONUS: 500,
    MAX_PARTICIPANTS: 5000,
    TOTAL_TOKENS: 10000000
};

// ============================================================================
// ESTADO Y ALMACENAMIENTO LOCAL
// ============================================================================

let AppState = {
    selectedWallet: null,
    walletConnected: false,
    walletAddress: null,
    userData: null,
    stats: null
};

// Obtener estadísticas del localStorage
function getStats() {
    const stats = localStorage.getItem('regret_stats');
    if (stats) {
        return JSON.parse(stats);
    }
    
    // Estadísticas por defecto
    const defaultStats = {
        totalParticipants: 1875,
        tokensReserved: 3800000,
        daysToLaunch: 14,
        participantsToday: 42
    };
    
    localStorage.setItem('regret_stats', JSON.stringify(defaultStats));
    return defaultStats;
}

// Actualizar estadísticas
function updateStats(participantChange = 1) {
    const stats = getStats();
    stats.totalParticipants += participantChange;
    stats.tokensReserved += CONFIG.AIRDROP_BASE;
    stats.participantsToday = Math.floor(Math.random() * 50) + 25;
    
    localStorage.setItem('regret_stats', JSON.stringify(stats));
    AppState.stats = stats;
    return stats;
}

// ============================================================================
// FUNCIONES DE UI
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (!notification || !notificationText) return;
    
    notification.className = 'notification';
    notificationText.textContent = message;
    notification.classList.add('show', type);
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

function updateStatsUI() {
    if (!AppState.stats) {
        AppState.stats = getStats();
    }
    
    document.getElementById('totalParticipants').textContent = 
        formatNumber(AppState.stats.totalParticipants);
    document.getElementById('tokensReserved').textContent = 
        formatNumber(AppState.stats.tokensReserved);
    document.getElementById('tokensRemaining').textContent = 
        formatNumber(CONFIG.TOTAL_TOKENS - AppState.stats.tokensReserved);
    document.getElementById('daysToLaunch').textContent = 
        AppState.stats.daysToLaunch;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

function updateWalletUI() {
    if (AppState.walletConnected && AppState.userData) {
        document.getElementById('walletStatus').style.display = 'block';
        document.getElementById('walletConnectContainer').style.display = 'none';
        
        // Mostrar dirección abreviada
        const address = AppState.walletAddress;
        const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        document.getElementById('walletAddress').textContent = shortAddress;
        
        // Actualizar tokens
        document.getElementById('userTokens').textContent = 
            `${formatNumber(AppState.userData.tokens)} $REGRET`;
        document.getElementById('userReferrals').textContent = 
            AppState.userData.referrals || 0;
        
        // Habilitar ruleta
        document.getElementById('spinBtn').disabled = false;
        document.getElementById('wheelResult').innerHTML = 
            '<p style="color: #00CC88;"><i class="fas fa-check-circle"></i> ¡Conectado! Gira la ruleta.</p>';
        
        // Mostrar sección de referidos
        document.getElementById('referralSection').style.display = 'block';
        document.getElementById('referralCode').textContent = AppState.userData.referralCode;
        document.getElementById('referralCount').textContent = AppState.userData.referrals || 0;
        document.getElementById('referralEarnings').textContent = 
            `${(AppState.userData.referrals || 0) * CONFIG.REFERRAL_BONUS} $REGRET`;
        
    } else {
        document.getElementById('walletStatus').style.display = 'none';
        document.getElementById('walletConnectContainer').style.display = 'block';
        document.getElementById('referralSection').style.display = 'none';
        document.getElementById('spinBtn').disabled = true;
    }
}

// ============================================================================
// CONEXIÓN DE WALLET (SIMPLIFICADA)
// ============================================================================

function selectWallet(walletType) {
    const options = document.querySelectorAll('.wallet-option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    const selected = document.querySelector(`[data-wallet="${walletType}"]`);
    if (selected) {
        selected.classList.add('selected');
        AppState.selectedWallet = walletType;
        document.getElementById('connectBtn').disabled = false;
    }
}

async function connectWallet() {
    if (!AppState.selectedWallet) {
        showNotification('Selecciona una wallet primero', 'error');
        return;
    }
    
    const connectBtn = document.getElementById('connectBtn');
    connectBtn.innerHTML = '<div class="spinner"></div> Conectando...';
    connectBtn.disabled = true;
    
    try {
        // Simulación de conexión (en producción usarías la wallet real)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generar dirección aleatoria para demo
        const walletAddress = generateDemoAddress();
        
        // Verificar si ya está registrado
        let userData = localStorage.getItem(`regret_user_${walletAddress}`);
        
        if (userData) {
            userData = JSON.parse(userData);
            showNotification('¡Bienvenido de nuevo!', 'success');
        } else {
            // Registrar nuevo usuario
            userData = {
                wallet: walletAddress,
                walletType: AppState.selectedWallet,
                referralCode: generateReferralCode(walletAddress),
                tokens: CONFIG.AIRDROP_BASE,
                referrals: 0,
                registeredAt: new Date().toISOString()
            };
            
            localStorage.setItem(`regret_user_${walletAddress}`, JSON.stringify(userData));
            updateStats(1);
            showNotification('¡Wallet conectada! 1,000 $REGRET acreditados.', 'success');
        }
        
        // Actualizar estado
        AppState.walletAddress = walletAddress;
        AppState.walletConnected = true;
        AppState.userData = userData;
        
        // Guardar para reconexión
        localStorage.setItem('regret_last_wallet', walletAddress);
        
        updateWalletUI();
        updateStatsUI();
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('Error al conectar wallet', 'error');
    } finally {
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> CONECTAR WALLET';
        connectBtn.disabled = false;
    }
}

function disconnectWallet() {
    AppState.walletConnected = false;
    AppState.walletAddress = null;
    AppState.userData = null;
    AppState.selectedWallet = null;
    
    localStorage.removeItem('regret_last_wallet');
    
    updateWalletUI();
    showNotification('Wallet desconectada', 'info');
}

// ============================================================================
// RULETA
// ============================================================================

async function spinWheel() {
    if (!AppState.walletConnected) {
        showNotification('Conecta tu wallet primero', 'error');
        return;
    }
    
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<div class="spinner"></div> Girando...';
    
    // Verificar si ya giró hoy
    const today = new Date().toDateString();
    const lastSpin = localStorage.getItem(`last_spin_${AppState.walletAddress}`);
    
    if (lastSpin === today) {
        showNotification('Ya giraste hoy. Vuelve mañana.', 'error');
        spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
        return;
    }
    
    // Premios disponibles
    const prizes = [100, 250, 500, 750, 1000, 1500];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    
    // Animar ruleta
    const wheel = document.getElementById('wheel');
    const spinDegrees = 1800 + Math.random() * 1800;
    wheel.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
    wheel.style.transform = `rotate(${spinDegrees}deg)`;
    
    // Esperar animación
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Actualizar tokens
    AppState.userData.tokens += prize;
    localStorage.setItem(`regret_user_${AppState.walletAddress}`, JSON.stringify(AppState.userData));
    
    // Guardar fecha del último giro
    localStorage.setItem(`last_spin_${AppState.walletAddress}`, today);
    
    // Mostrar resultado
    document.getElementById('wheelResult').innerHTML = `
        <div style="text-align: center;">
            <h3 style="color: #00CC88; margin-bottom: 10px;">¡Ganaste ${prize} $REGRET!</h3>
            <p style="color: #cccccc;">Total: ${formatNumber(AppState.userData.tokens)} $REGRET</p>
        </div>
    `;
    
    // Actualizar UI
    document.getElementById('userTokens').textContent = 
        `${formatNumber(AppState.userData.tokens)} $REGRET`;
    
    showNotification(`🎉 ¡Ganaste ${prize} $REGRET en la ruleta!`, 'success');
    
    // Deshabilitar botón por 24h (simulado)
    spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';
    setTimeout(() => {
        spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
        spinBtn.disabled = false;
    }, 5000); // Para demo, 5 segundos. En producción sería 24h
}

// ============================================================================
// REFERIDOS
// ============================================================================

function copyReferralCode() {
    if (!AppState.userData?.referralCode) {
        showNotification('No hay código de referido', 'error');
        return;
    }
    
    navigator.clipboard.writeText(AppState.userData.referralCode)
        .then(() => {
            showNotification('Código copiado al portapapeles', 'success');
        })
        .catch(err => {
            console.error('Error copying:', err);
            showNotification('Error al copiar', 'error');
        });
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function generateDemoAddress() {
    // Generar una dirección de Solana falsa para demo
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateReferralCode(walletAddress) {
    const prefix = 'REGRET';
    const hash = btoa(walletAddress).substring(0, 6).toUpperCase();
    return `${prefix}-${hash}`;
}

function detectWallets() {
    // Detectar Phantom
    if (window.solana?.isPhantom) {
        document.getElementById('phantomStatus').classList.add('available');
    } else {
        document.getElementById('phantomStatus').classList.add('unavailable');
    }
    
    // Detectar Solflare
    if (window.solflare) {
        document.getElementById('solflareStatus').classList.add('available');
    } else {
        document.getElementById('solflareStatus').classList.add('unavailable');
    }
    
    // Detectar Backpack
    if (window.backpack) {
        document.getElementById('backpackStatus').classList.add('available');
    } else {
        document.getElementById('backpackStatus').classList.add('unavailable');
    }
}

function checkExistingConnection() {
    const lastWallet = localStorage.getItem('regret_last_wallet');
    if (lastWallet) {
        const userData = localStorage.getItem(`regret_user_${lastWallet}`);
        if (userData) {
            AppState.walletAddress = lastWallet;
            AppState.walletConnected = true;
            AppState.userData = JSON.parse(userData);
            AppState.selectedWallet = AppState.userData.walletType;
            
            updateWalletUI();
            showNotification('Sesión restaurada', 'info');
        }
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('$REGRET Airdrop inicializado');
    
    // 1. Detectar wallets
    detectWallets();
    
    // 2. Configurar event listeners
    document.querySelectorAll('.wallet-option').forEach(option => {
        option.addEventListener('click', () => {
            selectWallet(option.dataset.wallet);
        });
    });
    
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);
    document.getElementById('spinBtn').addEventListener('click', spinWheel);
    document.getElementById('copyReferralBtn').addEventListener('click', copyReferralCode);
    
    // 3. Cargar estadísticas
    updateStatsUI();
    
    // 4. Verificar conexión previa
    setTimeout(checkExistingConnection, 1000);
    
    // 5. Mostrar notificación de bienvenida
    setTimeout(() => {
        showNotification('Bienvenido al Airdrop $REGRET. Conecta tu wallet para comenzar.', 'info');
    }, 2000);
});