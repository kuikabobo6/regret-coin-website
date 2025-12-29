// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
    AIRDROP_BASE: 1000,
    REFERRAL_BONUS: 500,
    MAX_PARTICIPANTS: 5000,
    TOTAL_TOKENS: 10000000,
    API_BASE_URL: window.location.origin // Use same origin for API calls
};

// ============================================================================
// ESTADO Y ALMACENAMIENTO LOCAL
// ============================================================================

let AppState = {
    selectedWallet: null,
    walletConnected: false,
    walletAddress: null,
    userData: null,
    stats: null,
    isLoading: false
};

// ============================================================================
// API HELPER FUNCTIONS
// ============================================================================

/**
 * Make API request with error handling
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options (method, body, etc)
 * @returns {Promise<object>} - Parsed response
 */
async function apiCall(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `API Error: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

/**
 * Register wallet with backend API
 * @param {string} wallet - Solana wallet address
 * @param {string} walletType - Type of wallet (phantom, solflare, etc)
 * @returns {Promise<object>} - Registration response with referral code and tokens
 */
async function registerWalletAPI(wallet, walletType) {
    const userData = {
        wallet,
        walletType,
        sessionId: generateSessionId(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || null,
        utmSource: getURLParam('utm_source'),
        utmMedium: getURLParam('utm_medium'),
        utmCampaign: getURLParam('utm_campaign')
    };

    const response = await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify(userData)
    });

    if (!response.success) {
        throw new Error(response.error || 'Registration failed');
    }

    return response.data;
}

/**
 * Get global airdrop statistics from API
 * @returns {Promise<object>} - Stats object
 */
async function getStatsAPI() {
    try {
        const response = await apiCall('/api/stats');
        
        if (!response.success) {
            // Return fallback stats if API fails
            return getDefaultStats();
        }

        return response.data || getDefaultStats();
    } catch (error) {
        console.warn('Could not fetch stats from API:', error);
        return getDefaultStats();
    }
}

/**
 * Execute spin with backend API
 * @param {string} wallet - Solana wallet address
 * @returns {Promise<object>} - Spin result with prize amount
 */
async function spinWheelAPI(wallet) {
    const response = await apiCall('/api/spin', {
        method: 'POST',
        body: JSON.stringify({ wallet })
    });

    if (!response.success) {
        throw new Error(response.error || 'Spin failed');
    }

    return response.data;
}

/**
 * Add referral with backend API
 * @param {string} referrerWallet - Referrer's wallet
 * @param {string} referredWallet - Referred wallet
 * @param {string} referralCode - Referrer's referral code
 * @returns {Promise<object>} - Referral result
 */
async function addReferralAPI(referrerWallet, referredWallet, referralCode) {
    const response = await apiCall('/api/referrals/add', {
        method: 'POST',
        body: JSON.stringify({
            referrerWallet,
            referredWallet,
            referralCode
        })
    });

    if (!response.success) {
        throw new Error(response.error || 'Referral failed');
    }

    return response.data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateSessionId() {
    return 'session_' + Math.random().toString(36).substring(2, 15) + Date.now();
}

function getURLParam(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

function getDefaultStats() {
    return {
        totalParticipants: 1875,
        tokensReserved: 3800000,
        daysToLaunch: 14,
        participantsToday: 42
    };
}

// Obtener estadísticas del localStorage como fallback
function getStatsCached() {
    const stats = localStorage.getItem('regret_stats');
    if (stats) {
        return JSON.parse(stats);
    }
    return getDefaultStats();
}

// Actualizar estadísticas en cache local
function updateStatsCached(participantChange = 0) {
    const stats = getStatsCached();
    stats.totalParticipants += participantChange;
    stats.tokensReserved += participantChange > 0 ? CONFIG.AIRDROP_BASE : 0;
    
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
        AppState.stats = getStatsCached();
    }
    
    const totalParticipants = document.getElementById('totalParticipants');
    const tokensReserved = document.getElementById('tokensReserved');
    const tokensRemaining = document.getElementById('tokensRemaining');
    const daysToLaunch = document.getElementById('daysToLaunch');

    if (totalParticipants) totalParticipants.textContent = formatNumber(AppState.stats.totalParticipants);
    if (tokensReserved) tokensReserved.textContent = formatNumber(AppState.stats.tokensReserved);
    if (tokensRemaining) tokensRemaining.textContent = formatNumber(CONFIG.TOTAL_TOKENS - AppState.stats.tokensReserved);
    if (daysToLaunch) daysToLaunch.textContent = AppState.stats.daysToLaunch;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

function updateWalletUI() {
    const walletStatus = document.getElementById('walletStatus');
    const walletConnectContainer = document.getElementById('walletConnectContainer');
    const walletAddress = document.getElementById('walletAddress');
    const userTokens = document.getElementById('userTokens');
    const userReferrals = document.getElementById('userReferrals');
    const spinBtn = document.getElementById('spinBtn');
    const wheelResult = document.getElementById('wheelResult');
    const referralSection = document.getElementById('referralSection');
    const referralCode = document.getElementById('referralCode');
    const referralCount = document.getElementById('referralCount');
    const referralEarnings = document.getElementById('referralEarnings');
    
    if (AppState.walletConnected && AppState.userData) {
        if (walletStatus) walletStatus.style.display = 'block';
        if (walletConnectContainer) walletConnectContainer.style.display = 'none';
        
        // Mostrar dirección abreviada
        const address = AppState.walletAddress;
        const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        if (walletAddress) walletAddress.textContent = shortAddress;
        
        // Actualizar tokens
        if (userTokens) userTokens.textContent = `${formatNumber(AppState.userData.tokens)} $REGRET`;
        if (userReferrals) userReferrals.textContent = AppState.userData.referralCount || 0;
        
        // Habilitar ruleta
        if (spinBtn) {
            spinBtn.disabled = false;
            spinBtn.style.opacity = '1';
            spinBtn.style.cursor = 'pointer';
        }
        if (wheelResult) wheelResult.innerHTML = '<p style="color: #00CC88;"><i class="fas fa-check-circle"></i> ¡Conectado! Gira la ruleta.</p>';
        
        // Mostrar sección de referidos
        if (referralSection) referralSection.style.display = 'block';
        if (referralCode) referralCode.textContent = AppState.userData.referralCode;
        if (referralCount) referralCount.textContent = AppState.userData.referralCount || 0;
        if (referralEarnings) referralEarnings.textContent = `${(AppState.userData.referralCount || 0) * CONFIG.REFERRAL_BONUS} $REGRET`;
        
    } else {
        if (walletStatus) walletStatus.style.display = 'none';
        if (walletConnectContainer) walletConnectContainer.style.display = 'block';
        if (referralSection) referralSection.style.display = 'none';
        if (spinBtn) {
            spinBtn.disabled = true;
            spinBtn.style.opacity = '0.5';
        }
    }
}

// ============================================================================
// CONEXIÓN DE WALLET
// ============================================================================

function selectWallet(walletType) {
    const options = document.querySelectorAll('.wallet-option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    const selected = document.querySelector(`[data-wallet="${walletType}"]`);
    if (selected) {
        selected.classList.add('selected');
        AppState.selectedWallet = walletType;
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) connectBtn.disabled = false;
    }
}

async function connectWallet() {
    if (!AppState.selectedWallet) {
        showNotification('Selecciona una wallet primero', 'error');
        return;
    }
    
    if (AppState.isLoading) return;
    
    const connectBtn = document.getElementById('connectBtn');
    AppState.isLoading = true;
    
    try {
        if (connectBtn) {
            connectBtn.innerHTML = '<div class="spinner"></div> Conectando...';
            connectBtn.disabled = true;
        }
        
        // Try to connect to real wallet provider
        let walletAddress = null;
        
        // Attempt to use real wallet provider if available
        if (AppState.selectedWallet === 'phantom' && window.solana?.isPhantom) {
            try {
                const response = await window.solana.connect();
                walletAddress = response.publicKey.toString();
            } catch (err) {
                console.log('Phantom wallet not available, using demo mode');
            }
        }
        
        // Fallback to demo address
        if (!walletAddress) {
            walletAddress = generateDemoAddress();
        }
        
        // Register with API
        try {
            const regData = await registerWalletAPI(walletAddress, AppState.selectedWallet);
            
            AppState.userData = {
                wallet: walletAddress,
                walletType: AppState.selectedWallet,
                referralCode: regData.referralCode,
                tokens: regData.tokens,
                referralCount: 0,
                referralEarned: 0,
                registeredAt: new Date().toISOString()
            };
            
            // Save for session restoration
            localStorage.setItem('regret_last_wallet', walletAddress);
            localStorage.setItem(`regret_user_${walletAddress}`, JSON.stringify(AppState.userData));
            
            AppState.walletAddress = walletAddress;
            AppState.walletConnected = true;
            
            updateStatsCached(1); // Increment participant count in cache
            showNotification('¡Wallet conectada! 1,000 $REGRET acreditados.', 'success');
            
        } catch (apiError) {
            console.error('Registration error:', apiError);
            showNotification(`Error al registrar: ${apiError.message}`, 'error');
            AppState.walletConnected = false;
            AppState.walletAddress = null;
            AppState.userData = null;
        }
        
        updateWalletUI();
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showNotification('Error al conectar wallet', 'error');
    } finally {
        AppState.isLoading = false;
        if (connectBtn) {
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> CONECTAR WALLET';
            connectBtn.disabled = false;
        }
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
    
    if (AppState.isLoading) return;
    
    const spinBtn = document.getElementById('spinBtn');
    const wheelResult = document.getElementById('wheelResult');
    const wheel = document.getElementById('wheel');
    
    AppState.isLoading = true;
    
    try {
        if (spinBtn) {
            spinBtn.disabled = true;
            spinBtn.innerHTML = '<div class="spinner"></div> Girando...';
        }
        
        // Call API to spin
        const result = await spinWheelAPI(AppState.walletAddress);
        
        // Animate wheel
        const spinDegrees = 1800 + Math.random() * 1800;
        if (wheel) {
            wheel.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
            wheel.style.transform = `rotate(${spinDegrees}deg)`;
        }
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 3500));
        
        // Update local state
        AppState.userData.tokens = result.newBalance;
        localStorage.setItem(`regret_user_${AppState.walletAddress}`, JSON.stringify(AppState.userData));
        
        // Show result
        if (wheelResult) {
            wheelResult.innerHTML = `
                <div style="text-align: center;">
                    <h3 style="color: #00CC88; margin-bottom: 10px;">¡Ganaste ${result.prize} $REGRET!</h3>
                    <p style="color: #cccccc;">Total: ${formatNumber(result.newBalance)} $REGRET</p>
                </div>
            `;
        }
        
        // Update UI
        const userTokens = document.getElementById('userTokens');
        if (userTokens) userTokens.textContent = `${formatNumber(AppState.userData.tokens)} $REGRET`;
        
        showNotification(`🎉 ¡Ganaste ${result.prize} $REGRET en la ruleta!`, 'success');
        
        // Disable button for 24h
        if (spinBtn) {
            spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';
            spinBtn.disabled = true;
        }
        
    } catch (error) {
        console.error('Spin error:', error);
        showNotification(`Error al girar: ${error.message}`, 'error');
        
        if (spinBtn) {
            spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
            spinBtn.disabled = false;
        }
    } finally {
        AppState.isLoading = false;
    }
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
    // Generate a valid Solana address format (44 chars, base58)
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function detectWallets() {
    // Detectar Phantom
    if (window.solana?.isPhantom) {
        const phantomStatus = document.getElementById('phantomStatus');
        if (phantomStatus) phantomStatus.classList.add('available');
    } else {
        const phantomStatus = document.getElementById('phantomStatus');
        if (phantomStatus) phantomStatus.classList.add('unavailable');
    }
    
    // Detectar Solflare
    if (window.solflare) {
        const solflareStatus = document.getElementById('solflareStatus');
        if (solflareStatus) solflareStatus.classList.add('available');
    } else {
        const solflareStatus = document.getElementById('solflareStatus');
        if (solflareStatus) solflareStatus.classList.add('unavailable');
    }
    
    // Detectar Backpack
    if (window.backpack) {
        const backpackStatus = document.getElementById('backpackStatus');
        if (backpackStatus) backpackStatus.classList.add('available');
    } else {
        const backpackStatus = document.getElementById('backpackStatus');
        if (backpackStatus) backpackStatus.classList.add('unavailable');
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

document.addEventListener('DOMContentLoaded', async function() {
    console.log('$REGRET Airdrop inicializado - API Integrated');
    
    // 1. Detectar wallets disponibles
    detectWallets();
    
    // 2. Configurar event listeners
    document.querySelectorAll('.wallet-option').forEach(option => {
        option.addEventListener('click', () => {
            selectWallet(option.dataset.wallet);
        });
    });
    
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const spinBtn = document.getElementById('spinBtn');
    const copyReferralBtn = document.getElementById('copyReferralBtn');
    
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectWallet);
    if (spinBtn) spinBtn.addEventListener('click', spinWheel);
    if (copyReferralBtn) copyReferralBtn.addEventListener('click', copyReferralCode);
    
    // 3. Cargar estadísticas desde API
    try {
        AppState.stats = await getStatsAPI();
    } catch (error) {
        console.warn('Using cached stats:', error);
        AppState.stats = getStatsCached();
    }
    updateStatsUI();
    
    // 4. Verificar conexión previa
    setTimeout(checkExistingConnection, 1000);
    
    // 5. Mostrar notificación de bienvenida
    setTimeout(() => {
        showNotification('Bienvenido al Airdrop $REGRET. Conecta tu wallet para comenzar.', 'info');
    }, 2000);
});
