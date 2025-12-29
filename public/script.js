// Configuración
const API_BASE = '/api';
const CONFIG = {
    AIRDROP_BASE: 1000,
    REFERRAL_BONUS: 500,
    MAX_PARTICIPANTS: 5000,
    TOTAL_TOKENS: 10000000
};

// Estado de la aplicación
let appState = {
    selectedWallet: null,
    walletConnected: false,
    walletAddress: null,
    userData: null,
    stats: null,
    isProduction: !(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
};

// Mock API para desarrollo
const mockAPI = {
    async getStats() {
        const totalParticipants = Math.floor(Math.random() * 1500) + 1000;
        const tokensReserved = Math.floor(totalParticipants * 1000) + 
                              Math.floor(totalParticipants * 0.3 * 500) + 
                              Math.floor(totalParticipants * 2 * 500);
        
        return {
            totalParticipants: totalParticipants,
            tokensReserved: tokensReserved,
            daysToLaunch: Math.max(1, Math.floor(Math.random() * 30) + 1),
            participantsToday: Math.floor(Math.random() * 50) + 25,
            trend: 'up'
        };
    },
    
    async registerWallet(walletAddress, walletType) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            success: true,
            referralCode: `REGRET-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            tokens: 1000,
            message: "¡Wallet registrada exitosamente!"
        };
    },
    
    async spinWheel(walletAddress) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const prizeMap = [
            { color: '#4A90E2', amount: 100 },
            { color: '#00CC88', amount: 250 },
            { color: '#FFD166', amount: 500 },
            { color: '#9D4EDD', amount: 750 },
            { color: '#FF6B6B', amount: 1000 },
            { color: '#4ECDC4', amount: 1500 }
        ];
        
        const randomIndex = Math.floor(Math.random() * prizeMap.length);
        const prize = prizeMap[randomIndex].amount;
        const color = prizeMap[randomIndex].color;
        const totalTokens = (appState.userData?.tokens || 1000) + prize;
        
        return {
            success: true,
            prize: prize,
            color: color,
            totalTokens: totalTokens,
            message: `¡Ganaste ${prize} $REGRET!`
        };
    },
    
    async getReferrals(walletAddress) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return {
            referralCount: Math.floor(Math.random() * 10),
            referrals: Array.from({length: 5}, (_, i) => ({
                id: i + 1,
                wallet: `SOL${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
                date: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString().split('T')[0]
            })),
            totalEarned: Math.floor(Math.random() * 5000)
        };
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando aplicación $REGRET...');
    console.log('URL actual:', window.location.href);
    console.log('Hostname:', window.location.hostname);
    console.log('Modo producción?:', appState.isProduction);
    initializeApp();
});

// Inicializar aplicación
async function initializeApp() {
    try {
        await loadStats();
        setupEventListeners();
        checkExistingConnection();
        
        if (!appState.isProduction) {
            console.log('✅ Configurando actualización periódica de stats');
            setInterval(loadStats, 30000);
        }
    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        showNotification('Error cargando la aplicación', 'error');
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        let data;
        
        if (appState.isProduction) {
            try {
                const response = await fetch(`${API_BASE}/stats`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    data = await response.json();
                } else {
                    throw new Error(`API error: ${response.status}`);
                }
            } catch (apiError) {
                console.log('Usando datos predeterminados para stats:', apiError);
                data = {
                    totalParticipants: 1875,
                    tokensReserved: 3875000,
                    daysToLaunch: 14,
                    participantsToday: 42,
                    trend: 'up'
                };
            }
        } else {
            data = await mockAPI.getStats();
        }
        
        appState.stats = data;
        updateStatsUI();
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        appState.stats = {
            totalParticipants: 1875,
            tokensReserved: 3875000,
            daysToLaunch: 14,
            participantsToday: 32,
            trend: 'up'
        };
        updateStatsUI();
    }
}

// Actualizar UI de estadísticas
function updateStatsUI() {
    if (appState.stats) {
        const participants = appState.stats.totalParticipants || 0;
        const tokensReserved = appState.stats.tokensReserved || 0;
        const daysToLaunch = appState.stats.daysToLaunch || 14;
        const participantsToday = appState.stats.participantsToday || 0;
        const trend = appState.stats.trend || 'up';

        document.getElementById('totalParticipants').textContent = formatNumber(participants);
        
        const trendElement = document.getElementById('participantsTrend');
        if (trendElement) {
            trendElement.innerHTML = `<i class="fas fa-arrow-up"></i> <span>+${participantsToday} hoy</span>`;
        }

        document.getElementById('tokensReserved').textContent = formatNumber(tokensReserved);
        
        const reservedPercentage = Math.min((tokensReserved / CONFIG.TOTAL_TOKENS) * 100, 100);
        const reservedProgress = document.getElementById('reservedProgress');
        const reservedPercentageElement = document.getElementById('reservedPercentage');
        
        if (reservedProgress) reservedProgress.style.width = `${reservedPercentage}%`;
        if (reservedPercentageElement) reservedPercentageElement.textContent = `${reservedPercentage.toFixed(1)}%`;

        document.getElementById('daysToLaunch').textContent = daysToLaunch;

        const tokensRemaining = CONFIG.TOTAL_TOKENS - tokensReserved;
        document.getElementById('tokensRemaining').textContent = formatNumber(tokensRemaining);

        const tokensInfo = document.getElementById('tokensInfo');
        if (tokensInfo) tokensInfo.textContent = `de ${formatNumber(CONFIG.TOTAL_TOKENS)} total`;

        const progressParticipants = (participants / CONFIG.MAX_PARTICIPANTS) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) progressFill.style.width = `${Math.min(progressParticipants, 100)}%`;

        const remainingSlots = CONFIG.MAX_PARTICIPANTS - participants;
        const remainingSlotsElement = document.getElementById('remainingSlots');
        if (remainingSlotsElement) remainingSlotsElement.textContent = `${remainingSlots.toLocaleString()} cupos disponibles`;

        const airdropLimit = document.getElementById('airdropLimit');
        if (airdropLimit) {
            if (progressParticipants >= 80) {
                airdropLimit.style.display = 'block';
                const limitText = progressParticipants >= 90 ?
                    '⚠️ ¡ÚLTIMOS CUPOS! El airdrop está por cerrarse' :
                    '⚠️ Airdrop limitado - Quedan pocos cupos';
                document.getElementById('limitText').textContent = limitText;
            } else {
                airdropLimit.style.display = 'none';
            }
        }
    }
}

// Función para formatear números
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toLocaleString();
    }
}

// FUNCIÓN PRINCIPAL CORREGIDA PARA CONECTAR WALLETS
async function connectToWallet(walletType) {
    console.log(`Conectando ${walletType}...`);
    
    try {
        // Verificar si estamos en localhost usando la URL actual
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '';
        
        // En localhost, usar simulación
        if (isLocalhost) {
            console.log('🛠️ Modo desarrollo: Simulando conexión');
            const fakeAddress = generateFakeAddress();
            showNotification(`Modo desarrollo: ${walletType} simulada`, 'info');
            return fakeAddress;
        }
        
        // En producción, intentar conexión real
        let publicKey = null;
        let errorMessage = null;
        
        switch(walletType) {
            case 'phantom':
                if (window.solana && window.solana.isPhantom) {
                    try {
                        console.log('Phantom detectada, intentando conectar...');
                        const response = await window.solana.connect();
                        publicKey = response.publicKey.toString();
                        console.log(`✅ Phantom conectada: ${publicKey}`);
                    } catch (error) {
                        errorMessage = `Phantom: ${error.message || 'Error desconocido'}`;
                        console.error('Error Phantom:', error);
                    }
                } else {
                    errorMessage = 'Phantom no está instalada. Instala la extensión desde phantom.app';
                }
                break;
                
            case 'solflare':
                if (window.solflare) {
                    try {
                        console.log('Solflare detectada, intentando conectar...');
                        let response;
                        
                        // Método 1: connect() moderno
                        if (typeof window.solflare.connect === 'function') {
                            response = await window.solflare.connect();
                        }
                        // Método 2: request() API
                        else if (typeof window.solflare.request === 'function') {
                            response = await window.solflare.request({ method: 'connect' });
                        }
                        // Método 3: Versión antigua
                        else if (window.solflare._solflareWeb3 && window.solflare._solflareWeb3.connect) {
                            response = await window.solflare._solflareWeb3.connect();
                        }
                        
                        // Procesar respuesta
                        if (response) {
                            if (response.publicKey) {
                                publicKey = response.publicKey.toString();
                            } else if (Array.isArray(response) && response.length > 0) {
                                publicKey = response[0];
                            } else if (typeof response === 'string') {
                                publicKey = response;
                            }
                        }
                        
                        if (publicKey) {
                            console.log(`✅ Solflare conectada: ${publicKey}`);
                        } else {
                            errorMessage = 'Solflare: No se pudo obtener la dirección';
                        }
                    } catch (error) {
                        errorMessage = `Solflare: ${error.message || 'Error desconocido'}`;
                        console.error('Error Solflare:', error);
                    }
                } else {
                    errorMessage = 'Solflare no está instalada. Instala la extensión desde solflare.com';
                }
                break;
                
            case 'backpack':
                if (window.backpack) {
                    try {
                        console.log('Backpack detectada, intentando conectar...');
                        let response;
                        
                        // Intentar diferentes métodos
                        if (typeof window.backpack.connect === 'function') {
                            response = await window.backpack.connect();
                        } 
                        else if (window.backpack.solana && typeof window.backpack.solana.connect === 'function') {
                            response = await window.backpack.solana.connect();
                        } 
                        else if (typeof window.backpack.request === 'function') {
                            response = await window.backpack.request({ method: 'connect' });
                        }
                        else if (window.backpack._backpackWeb3 && window.backpack._backpackWeb3.connect) {
                            response = await window.backpack._backpackWeb3.connect();
                        }
                        
                        if (response) {
                            if (response.publicKey) {
                                publicKey = response.publicKey.toString();
                            } else if (typeof response === 'string') {
                                publicKey = response;
                            } else if (Array.isArray(response) && response.length > 0) {
                                publicKey = response[0];
                            }
                        }
                        
                        if (publicKey) {
                            console.log(`✅ Backpack conectada: ${publicKey}`);
                        } else {
                            errorMessage = 'Backpack: No se pudo obtener la dirección';
                        }
                    } catch (error) {
                        errorMessage = `Backpack: ${error.message || 'Error desconocido'}`;
                        console.error('Error Backpack:', error);
                    }
                } else {
                    errorMessage = 'Backpack no está instalada. Instala la extensión desde backpack.app';
                }
                break;
                
            case 'uniswap':
                try {
                    const address = prompt('Ingresa tu dirección de wallet Solana (44 caracteres):');
                    if (address) {
                        const trimmedAddress = address.trim();
                        // Validación básica de dirección Solana
                        if (trimmedAddress.length === 44 && /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmedAddress)) {
                            publicKey = trimmedAddress;
                            console.log(`✅ Dirección manual aceptada: ${publicKey}`);
                        } else {
                            errorMessage = 'Dirección de wallet inválida. Las direcciones Solana tienen 44 caracteres.';
                        }
                    } else {
                        errorMessage = 'Se requiere una dirección de wallet';
                    }
                } catch (error) {
                    errorMessage = `Error con entrada manual: ${error.message}`;
                }
                break;
                
            default:
                errorMessage = 'Tipo de wallet no soportado';
        }
        
        // Si hubo error, mostrar notificación
        if (errorMessage) {
            console.error(`Error conectando ${walletType}:`, errorMessage);
            showNotification(errorMessage, 'error');
            
            // Si es error de wallet no instalada, ofrecer instalarla
            if (errorMessage.includes('no está instalada')) {
                const stores = {
                    phantom: 'https://phantom.app/download',
                    solflare: 'https://solflare.com/download',
                    backpack: 'https://www.backpack.app/download'
                };
                
                if (stores[walletType]) {
                    const shouldInstall = confirm(`${walletType} no está instalada. ¿Quieres ir a la página de descarga?`);
                    if (shouldInstall) {
                        window.open(stores[walletType], '_blank');
                    }
                }
            }
            
            return null;
        }
        
        if (!publicKey) {
            showNotification('No se pudo obtener la dirección de la wallet', 'error');
            return null;
        }
        
        return publicKey;
        
    } catch (error) {
        console.error(`Error conectando ${walletType}:`, error);
        showNotification(`Error: ${error.message}`, 'error');
        return null;
    }
}

// Generar dirección falsa para desarrollo
function generateFakeAddress() {
    return 'So1' + Math.random().toString(36).substr(2, 43).toUpperCase();
}

// Registrar wallet en el airdrop
async function registerWallet(walletAddress) {
    try {
        let data;
        
        if (appState.isProduction) {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: walletAddress,
                    walletType: appState.selectedWallet,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Error API: ${response.status}`);
            }
            
            data = await response.json();
        } else {
            data = await mockAPI.registerWallet(walletAddress, appState.selectedWallet);
        }

        if (!data.success) {
            throw new Error(data.error || 'Error registrando wallet');
        }

        return data;
    } catch (error) {
        console.error('Error registrando wallet:', error);
        showNotification('Error registrando wallet. Intenta nuevamente.', 'error');
        throw error;
    }
}

// Girar ruleta
async function spinWheel() {
    if (!appState.walletConnected || !appState.walletAddress) {
        showNotification('Conecta tu wallet primero', 'error');
        return;
    }

    try {
        const spinBtn = document.getElementById('spinBtn');
        const wheel = document.getElementById('wheel');
        const wheelResult = document.getElementById('wheelResult');
        
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<div class="spinner"></div> Girando...';

        let data;
        
        if (appState.isProduction) {
            const response = await fetch(`${API_BASE}/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    wallet: appState.walletAddress,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Error API: ${response.status}`);
            }
            
            data = await response.json();
        } else {
            data = await mockAPI.spinWheel(appState.walletAddress);
        }

        if (!data.success) {
            throw new Error(data.error || 'Error girando ruleta');
        }

        // Animación de la rueda
        const spinDegrees = 1800 + Math.random() * 1800;
        wheel.style.transform = `rotate(${spinDegrees}deg)`;
        
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (appState.userData) {
            appState.userData.tokens = data.totalTokens;
        }

        const colorMap = {
            '#4A90E2': 'azul',
            '#00CC88': 'verde',
            '#FFD166': 'amarillo',
            '#9D4EDD': 'púrpura',
            '#FF6B6B': 'rojo',
            '#4ECDC4': 'turquesa'
        };
        
        const colorName = colorMap[data.color] || '';

        wheelResult.innerHTML = `
            <h3 style="color: ${data.color || '#FFD166'};">¡Ganaste ${data.prize} $REGRET!</h3>
            <p style="color: var(--text-muted);">Total acumulado: ${formatNumber(data.totalTokens)} $REGRET</p>
            <small style="color: #666;">${colorName ? `Color: ${colorName}` : ''}</small>
        `;

        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';

        showNotification(`¡Ganaste ${data.prize} $REGRET en la ruleta!`, 'success');
        createConfetti();

        setTimeout(() => {
            loadStats();
        }, 2000);

        setTimeout(() => {
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
        }, 10000);

    } catch (error) {
        console.error('Error girando ruleta:', error);
        showNotification(error.message, 'error');
        
        const spinBtn = document.getElementById('spinBtn');
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
    }
}

// Cargar datos de referidos
async function loadReferralData() {
    if (!appState.walletAddress) return;

    try {
        let data;
        
        if (appState.isProduction) {
            const response = await fetch(`${API_BASE}/referral?wallet=${appState.walletAddress}`);
            if (!response.ok) {
                throw new Error(`Error API: ${response.status}`);
            }
            data = await response.json();
        } else {
            data = await mockAPI.getReferrals(appState.walletAddress);
        }

        if (data) {
            if (!appState.userData) {
                appState.userData = {};
            }
            appState.userData.referralCount = data.referralCount || 0;
            appState.userData.referrals = data.referrals || [];
            appState.userData.referralEarned = data.totalEarned || 0;
            updateReferralUI();
        }
    } catch (error) {
        console.error('Error cargando referidos:', error);
    }
}

// Actualizar UI de referidos
function updateReferralUI() {
    if (!appState.userData) return;
    
    if (!appState.userData.referralCode) {
        appState.userData.referralCode = `REGRET-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    }
    
    document.getElementById('referralCode').textContent = appState.userData.referralCode;
    document.getElementById('referralCount').textContent = appState.userData.referralCount || 0;
    document.getElementById('referralSection').style.display = 'block';
}

// Actualizar UI completa
function updateUI() {
    if (appState.walletConnected && appState.userData) {
        const walletStatus = document.getElementById('walletStatus');
        const walletAddress = document.getElementById('walletAddress');
        
        if (walletStatus) {
            walletStatus.style.display = 'flex';
            document.getElementById('walletConnectContainer').style.display = 'none';
        }
        
        if (walletAddress) {
            walletAddress.textContent = `${appState.walletAddress.slice(0, 6)}...${appState.walletAddress.slice(-4)}`;
        }

        updateReferralUI();

        const spinBtn = document.getElementById('spinBtn');
        const wheelResult = document.getElementById('wheelResult');
        
        if (spinBtn) spinBtn.disabled = false;
        if (wheelResult) {
            wheelResult.innerHTML = '<p><i class="fas fa-check-circle" style="color: var(--secondary);"></i> ¡Listo para girar!</p>';
        }
        
        setTimeout(() => {
            loadStats();
        }, 1000);
    }
}

// Verificar conexión existente
async function checkExistingConnection() {
    const savedWallet = localStorage.getItem('regret_wallet');
    const savedWalletType = localStorage.getItem('regret_wallet_type');

    if (savedWallet && savedWalletType) {
        console.log('Wallet guardada detectada:', savedWallet);
        
        // Simplemente restaurar la sesión guardada
        appState.walletAddress = savedWallet;
        appState.selectedWallet = savedWalletType;
        appState.walletConnected = true;

        appState.userData = {
            wallet: savedWallet,
            referralCode: `REGRET-${savedWallet.slice(0, 8).toUpperCase()}`,
            tokens: 1000,
            referralCount: Math.floor(Math.random() * 5)
        };

        updateUI();
        showNotification('Wallet reconectada automáticamente', 'success');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Selección de wallet
    document.querySelectorAll('.wallet-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.wallet-option').forEach(el => {
                el.classList.remove('selected');
            });
            option.classList.add('selected');
            appState.selectedWallet = option.dataset.wallet;
            document.getElementById('connectBtn').disabled = false;
        });
    });

    // Botón de conexión principal
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            if (!appState.selectedWallet) {
                showNotification('Selecciona una wallet primero', 'error');
                return;
            }

            connectBtn.innerHTML = '<div class="spinner"></div> Conectando...';
            connectBtn.disabled = true;

            const walletAddress = await connectToWallet(appState.selectedWallet);

            if (walletAddress) {
                appState.walletAddress = walletAddress;
                appState.walletConnected = true;

                try {
                    const result = await registerWallet(walletAddress);
                    appState.userData = {
                        wallet: walletAddress,
                        referralCode: result.referralCode,
                        tokens: result.tokens || 1000,
                        referralCount: 0
                    };

                    localStorage.setItem('regret_wallet', walletAddress);
                    localStorage.setItem('regret_wallet_type', appState.selectedWallet);

                    await loadReferralData();

                    updateUI();
                    await loadStats();

                    showNotification('¡Wallet conectada! Has reclamado 1,000 $REGRET', 'success');
                    createConfetti();

                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }

            connectBtn.innerHTML = '<i class="fas fa-plug"></i> CONECTAR WALLET Y RECLAMAR 1,000 $REGRET';
            connectBtn.disabled = false;
        });
    }

    // Botón de desconexión
    const disconnectBtn = document.getElementById('disconnectBtn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
            appState.walletConnected = false;
            appState.walletAddress = null;
            appState.userData = null;

            localStorage.removeItem('regret_wallet');
            localStorage.removeItem('regret_wallet_type');

            document.getElementById('walletStatus').style.display = 'none';
            document.getElementById('walletConnectContainer').style.display = 'flex';
            document.getElementById('referralSection').style.display = 'none';

            document.getElementById('spinBtn').disabled = true;
            document.getElementById('wheelResult').innerHTML =
                '<p style="color: var(--text-muted);"><i class="fas fa-info-circle"></i> Conecta tu wallet para girar la ruleta</p>';

            const wheel = document.getElementById('wheel');
            if (wheel) wheel.style.transform = 'rotate(0deg)';

            document.querySelectorAll('.wallet-option').forEach(el => {
                el.classList.remove('selected');
            });
            appState.selectedWallet = null;
            document.getElementById('connectBtn').disabled = true;

            showNotification('Wallet desconectada', 'info');
        });
    }

    // Botón de girar ruleta
    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) {
        spinBtn.addEventListener('click', spinWheel);
    }

    // Botón de copiar código de referido
    const copyReferralBtn = document.getElementById('copyReferralBtn');
    if (copyReferralBtn) {
        copyReferralBtn.addEventListener('click', () => {
            if (appState.userData && appState.userData.referralCode) {
                navigator.clipboard.writeText(appState.userData.referralCode)
                    .then(() => {
                        showNotification('Código copiado al portapapeles', 'success');
                    })
                    .catch(err => {
                        console.error('Error copiando código:', err);
                        showNotification('Error copiando código', 'error');
                    });
            }
        });
    }
}

// Función de notificaciones
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');

    if (!notification || !notificationText) return;

    notificationText.textContent = message;
    notification.className = 'notification';
    notification.classList.add('show');
    notification.classList.add(type);

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Función de confetti
function createConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    const colors = ['#FFD166', '#00CC88', '#4A90E2', '#9D4EDD'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = Math.random() * 10 + 5 + 'px';
        confetti.style.height = Math.random() * 10 + 5 + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.animation = `confettiRain ${1 + Math.random() * 2}s linear forwards`;
        container.appendChild(confetti);

        setTimeout(() => {
            if (confetti.parentNode === container) {
                container.removeChild(confetti);
            }
        }, 3000);
    }
}

// Exportar para debugging
window.appState = appState;
window.connectToWallet = connectToWallet;
window.showNotification = showNotification;
window.loadStats = loadStats;

console.log('Script $REGRET cargado correctamente');