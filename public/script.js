// Configuración
const API_BASE = '/api';
const CONFIG = {
    AIRDROP_BASE: 1000,
    REFERRAL_BONUS: 500,
    MAX_PARTICIPANTS: 5000
};

// Estado de la aplicación
let appState = {
    selectedWallet: null,
    walletConnected: false,
    walletAddress: null,
    userData: null,
    stats: null
};

// Mock API para desarrollo
const mockAPI = {
    async getStats() {
        return {
            totalParticipants: Math.floor(Math.random() * 1000) + 500,
            tokensReserved: Math.floor(Math.random() * 3000000) + 2000000,
            daysToLaunch: Math.floor(Math.random() * 30) + 1
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
        // Montos correspondientes a los colores
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
    initializeApp();
});

// Inicializar aplicación
async function initializeApp() {
    try {
        await loadStats();
        updateWalletAvailability();
        setupEventListeners();
        checkExistingConnection();
    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        showNotification('Error cargando la aplicación', 'error');
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        console.log('Cargando estadísticas...');
        
        let data;
        try {
            const response = await fetch(`${API_BASE}/stats`);
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API no disponible');
            }
        } catch (apiError) {
            console.log('Usando datos de prueba:', apiError.message);
            data = await mockAPI.getStats();
        }
        
        appState.stats = data;
        updateStatsUI();
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        appState.stats = {
            totalParticipants: 1250,
            tokensReserved: 3250000,
            daysToLaunch: 14
        };
        updateStatsUI();
    }
}

// Actualizar UI de estadísticas
function updateStatsUI() {
    if (appState.stats) {
        const TOTAL_TOKENS = 10000000;
        const participants = appState.stats.totalParticipants || 0;
        const tokensReserved = appState.stats.tokensReserved || 0;

        document.getElementById('totalParticipants').textContent = 
            participants.toLocaleString();

        let tokensReservedFormatted;
        if (tokensReserved >= 1000000) {
            tokensReservedFormatted = (tokensReserved / 1000000).toFixed(1) + 'M';
        } else if (tokensReserved >= 1000) {
            tokensReservedFormatted = (tokensReserved / 1000).toFixed(1) + 'K';
        } else {
            tokensReservedFormatted = tokensReserved.toLocaleString();
        }

        document.getElementById('tokensReserved').textContent = tokensReservedFormatted;
        document.getElementById('tokensAvailable').textContent = 
            `de ${(TOTAL_TOKENS/1000000).toFixed(0)}M total`;

        document.getElementById('daysToLaunch').textContent = 
            appState.stats.daysToLaunch || 14;

        const tokensRemaining = TOTAL_TOKENS - tokensReserved;
        document.getElementById('tokensRemaining').textContent = 
            tokensRemaining.toLocaleString();

        const progressParticipants = (participants / CONFIG.MAX_PARTICIPANTS) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(progressParticipants, 100)}%`;
        }

        const remainingSlots = CONFIG.MAX_PARTICIPANTS - participants;
        const remainingSlotsElement = document.getElementById('remainingSlots');
        if (remainingSlotsElement) {
            remainingSlotsElement.textContent = 
                `${remainingSlots.toLocaleString()} cupos disponibles`;
        }

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

// Actualizar disponibilidad de wallets (CORREGIDO BACKPACK)
function updateWalletAvailability() {
    console.log('🔍 Actualizando disponibilidad de wallets...');

    // Phantom
    const phantomStatus = document.getElementById('phantomStatus');
    if (phantomStatus) {
        if (window.solana && window.solana.isPhantom) {
            phantomStatus.classList.add('available');
            phantomStatus.classList.remove('unavailable');
            console.log('✅ Phantom disponible');
        } else {
            phantomStatus.classList.add('unavailable');
            phantomStatus.classList.remove('available');
            console.log('❌ Phantom no disponible');
        }
    }

    // Solflare
    const solflareStatus = document.getElementById('solflareStatus');
    if (solflareStatus) {
        if (window.solflare && window.solflare.isSolflare) {
            solflareStatus.classList.add('available');
            solflareStatus.classList.remove('unavailable');
            console.log('✅ Solflare disponible');
        } else {
            solflareStatus.classList.add('unavailable');
            solflareStatus.classList.remove('available');
            console.log('❌ Solflare no disponible');
        }
    }

    // Backpack - MEJORADO: verificar múltiples formas de detectar Backpack
    const backpackStatus = document.getElementById('backpackStatus');
    if (backpackStatus) {
        const isBackpackAvailable = window.backpack &&
            (window.backpack.isBackpack ||
             typeof window.backpack.connect === 'function' ||
             window.backpack.solana ||
             (window.backpack && typeof window.backpack === 'object' && Object.keys(window.backpack).length > 0));

        if (isBackpackAvailable) {
            backpackStatus.classList.add('available');
            backpackStatus.classList.remove('unavailable');
            console.log('✅ Backpack disponible');
        } else {
            backpackStatus.classList.add('unavailable');
            backpackStatus.classList.remove('available');
            console.log('❌ Backpack no disponible');
        }
    }

    // Uniswap (siempre disponible)
    const uniswapStatus = document.getElementById('uniswapStatus');
    if (uniswapStatus) {
        uniswapStatus.classList.add('available');
        uniswapStatus.classList.remove('unavailable');
    }
}

// Función para conectar wallet
async function connectToWallet(walletType) {
    console.log(`Intentando conectar ${walletType}...`);

    try {
        let publicKey = null;

        // Simulación para desarrollo
        if (!window.solana && !window.solflare && !window.backpack) {
            console.log('Modo desarrollo: Simulando conexión de wallet');
            
            const fakeAddress = 'SOL' + Math.random().toString(36).substr(2, 33).toUpperCase();
            
            switch(walletType) {
                case 'phantom':
                case 'solflare':
                case 'backpack':
                case 'uniswap':
                    publicKey = fakeAddress;
                    console.log(`✅ Dirección simulada: ${publicKey}`);
                    showNotification('Modo desarrollo: Wallet simulada', 'info');
                    break;
                default:
                    throw new Error('Tipo de wallet no soportado');
            }
            
            return publicKey;
        }

        // Código real para producción
        switch(walletType) {
            case 'phantom':
                if (window.solana && window.solana.isPhantom) {
                    const response = await window.solana.connect();
                    publicKey = response.publicKey.toString();
                    console.log(`✅ Phantom conectada: ${publicKey}`);
                } else {
                    throw new Error('Phantom no detectada. Instala la extensión.');
                }
                break;

            case 'solflare':
                if (window.solflare && window.solflare.isSolflare) {
                    const response = await window.solflare.connect();
                    publicKey = response.publicKey.toString();
                    console.log(`✅ Solflare conectada: ${publicKey}`);
                } else {
                    throw new Error('Solflare no detectada. Instala la extensión.');
                }
                break;

            case 'backpack':
                // CORREGIDO: Backpack puede no tener isBackpack, pero sí tiene connect
                if (window.backpack) {
                    try {
                        const response = await window.backpack.connect();
                        // Backpack puede devolver diferentes estructuras
                        if (response && response.publicKey) {
                            publicKey = response.publicKey.toString();
                        } else if (typeof response === 'string') {
                            publicKey = response;
                        } else if (response && response.toString) {
                            publicKey = response.toString();
                        }
                        console.log(`✅ Backpack conectada: ${publicKey}`);
                    } catch (backpackError) {
                        console.error('Error específico de Backpack:', backpackError);
                        throw new Error('Error conectando Backpack: ' + backpackError.message);
                    }
                } else {
                    throw new Error('Backpack no detectada. Instala la extensión.');
                }
                break;

            case 'uniswap':
                const address = prompt('Ingresa tu dirección de wallet Solana (44 caracteres):');
                if (address && address.length === 44 && /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(address)) {
                    publicKey = address;
                    console.log(`✅ Dirección manual: ${publicKey}`);
                } else {
                    throw new Error('Dirección de wallet inválida');
                }
                break;

            default:
                throw new Error('Tipo de wallet no soportado');
        }

        if (!publicKey) {
            throw new Error('No se pudo obtener la clave pública');
        }

        console.log(`🎉 Wallet conectada exitosamente: ${publicKey}`);
        return publicKey;

    } catch (error) {
        console.error(`💥 Error conectando wallet: ${error.message}`);
        
        if (error.message.includes('user rejected') || error.message.includes('canceló')) {
            showNotification('Conexión cancelada por el usuario', 'error');
        } else if (error.message.includes('not detected') || error.message.includes('no detectada')) {
            showNotification(`${walletType} no está instalada`, 'error');
            openWalletStore(walletType);
        } else {
            showNotification(`Error: ${error.message}`, 'error');
        }

        return null;
    }
}

// Función para abrir tienda de wallets
function openWalletStore(walletType) {
    const stores = {
        phantom: 'https://phantom.app/',
        solflare: 'https://solflare.com/',
        backpack: 'https://www.backpack.app/'
    };

    if (stores[walletType]) {
        window.open(stores[walletType], '_blank');
    }
}

// Registrar wallet en el airdrop
async function registerWallet(walletAddress) {
    try {
        let data;
        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: walletAddress,
                    walletType: appState.selectedWallet
                })
            });

            if (!response.ok) {
                throw new Error('API no disponible');
            }
            
            data = await response.json();
        } catch (apiError) {
            console.log('Usando mock API para registro:', apiError.message);
            data = await mockAPI.registerWallet(walletAddress, appState.selectedWallet);
        }

        if (!data.success) {
            throw new Error(data.error || 'Error registrando wallet');
        }

        return data;
    } catch (error) {
        console.error('Error registrando wallet:', error);
        throw error;
    }
}

// Girar ruleta (CORREGIDO: montos por colores)
async function spinWheel() {
    if (!appState.walletConnected || !appState.walletAddress) {
        showNotification('Conecta tu wallet primero', 'error');
        return;
    }

    try {
        const spinBtn = document.getElementById('spinBtn');
        const wheel = document.getElementById('wheel');
        const wheelResult = document.getElementById('wheelResult');
        
        // Deshabilitar botón
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<div class="spinner"></div> Girando...';

        let data;
        try {
            const response = await fetch(`${API_BASE}/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: appState.walletAddress })
            });

            if (!response.ok) {
                throw new Error('API no disponible');
            }
            
            data = await response.json();
        } catch (apiError) {
            console.log('Usando mock API para ruleta:', apiError.message);
            data = await mockAPI.spinWheel(appState.walletAddress);
        }

        if (!data.success) {
            throw new Error(data.error || 'Error girando ruleta');
        }

        // Animación de la rueda
        const spinDegrees = 1800 + Math.random() * 1800;
        wheel.style.transform = `rotate(${spinDegrees}deg)`;
        
        // Esperar animación
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Actualizar datos
        if (appState.userData) {
            appState.userData.tokens = data.totalTokens;
        }

        // Mostrar resultado con color correspondiente
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
            <p style="color: #888;">Total acumulado: ${data.totalTokens} $REGRET</p>
            <small style="color: #666;">Color: ${colorName}</small>
        `;

        // Deshabilitar botón por 24h (simulado)
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';

        showNotification(`¡Ganaste ${data.prize} $REGRET en la ruleta!`, 'success');
        createConfetti();

        // Habilitar después de 5 segundos (para prueba)
        setTimeout(() => {
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> GIRAR RULETA';
        }, 5000);

    } catch (error) {
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
        try {
            const response = await fetch(`${API_BASE}/referral?wallet=${appState.walletAddress}`);
            if (!response.ok) {
                throw new Error('API no disponible');
            }
            data = await response.json();
        } catch (apiError) {
            console.log('Usando mock API para referidos:', apiError.message);
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
        if (walletStatus) walletStatus.style.display = 'flex';
        if (walletAddress) {
            walletAddress.textContent = `${appState.walletAddress.slice(0, 6)}...${appState.walletAddress.slice(-4)}`;
        }

        const walletSelector = document.getElementById('walletSelector');
        const connectBtn = document.getElementById('connectBtn');
        if (walletSelector) walletSelector.style.display = 'none';
        if (connectBtn) connectBtn.style.display = 'none';

        updateReferralUI();

        const spinBtn = document.getElementById('spinBtn');
        const wheelResult = document.getElementById('wheelResult');
        if (spinBtn) spinBtn.disabled = false;
        if (wheelResult) {
            wheelResult.innerHTML = '<p><i class="fas fa-check-circle" style="color: #00CC88;"></i> ¡Listo para girar!</p>';
        }
    }
}

// Verificar conexión existente
async function checkExistingConnection() {
    const savedWallet = localStorage.getItem('regret_wallet');
    const savedWalletType = localStorage.getItem('regret_wallet_type');

    if (savedWallet && savedWalletType) {
        console.log('Wallet guardada detectada:', savedWallet);

        // Verificar si la wallet sigue conectada y funcional
        const isWalletStillValid = await verifyWalletConnection(savedWalletType);

        if (isWalletStillValid) {
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
        } else {
            // La wallet guardada ya no es válida, limpiamos los datos
            console.log('Wallet guardada expirada, limpiando datos...');
            localStorage.removeItem('regret_wallet');
            localStorage.removeItem('regret_wallet_type');
            showNotification('Sesión de wallet expirada. Conecta nuevamente.', 'info');
        }
    }
}

// Verificar si la wallet sigue conectada y funcional
async function verifyWalletConnection(walletType) {
    try {
        switch(walletType) {
            case 'phantom':
                if (window.solana && window.solana.isPhantom) {
                    // Intentar una operación simple para verificar conexión
                    const response = await window.solana.connect({ onlyIfTrusted: true });
                    return response && response.publicKey;
                }
                break;

            case 'solflare':
                if (window.solflare && window.solflare.isSolflare) {
                    // Verificar si hay una conexión activa
                    const isConnected = await window.solflare.isConnected?.() || false;
                    return isConnected;
                }
                break;

            case 'backpack':
                if (window.backpack) {
                    // Verificar si hay una conexión activa en Backpack
                    try {
                        // Intentar obtener la cuenta conectada sin solicitar nueva conexión
                        const accounts = await window.backpack.request({ method: 'getAccounts' });
                        return accounts && accounts.length > 0;
                    } catch (error) {
                        return false;
                    }
                }
                break;

            case 'uniswap':
                // Para dirección manual, siempre consideramos válida
                return true;
        }

        return false;
    } catch (error) {
        console.log(`Error verificando conexión de ${walletType}:`, error);
        return false;
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
            document.getElementById('walletSelector').style.display = 'grid';
            document.getElementById('connectBtn').style.display = 'block';
            document.getElementById('referralSection').style.display = 'none';

            document.getElementById('spinBtn').disabled = true;
            document.getElementById('wheelResult').innerHTML =
                '<p style="color: #888;"><i class="fas fa-info-circle"></i> Conecta tu wallet para girar la ruleta</p>';

            const wheel = document.getElementById('wheel');
            if (wheel) {
                wheel.style.transform = 'rotate(0deg)';
            }

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

    if (type === 'error') {
        notification.style.background = 'linear-gradient(45deg, #FF6B6B, #FF8E8E)';
    } else if (type === 'success') {
        notification.style.background = 'linear-gradient(45deg, #00CC88, #4A90E2)';
    } else {
        notification.style.background = 'linear-gradient(45deg, #6C63FF, #9D4EDD)';
    }

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

// Debug
window.appState = appState;
window.connectToWallet = connectToWallet;
window.showNotification = showNotification;

console.log('Script $REGRET cargado correctamente');