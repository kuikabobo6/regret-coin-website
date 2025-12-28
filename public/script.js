
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
    isProduction: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
};

// Mock API para desarrollo
const mockAPI = {
    async getStats() {
        // Datos más realistas para desarrollo
        const totalParticipants = Math.floor(Math.random() * 1500) + 1000;
        const tokensReserved = Math.floor(totalParticipants * 1000) + 
                              Math.floor(totalParticipants * 0.3 * 500) + // Referidos
                              Math.floor(totalParticipants * 2 * 500); // Ruletas diarias
        
        return {
            totalParticipants: totalParticipants,
            tokensReserved: tokensReserved,
            daysToLaunch: Math.max(1, Math.floor(Math.random() * 30) + 1),
            participantsToday: Math.floor(Math.random() * 50) + 25,
            trend: Math.random() > 0.5 ? 'up' : 'up' // Siempre positivo para motivar
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
    console.log('Modo:', appState.isProduction ? 'PRODUCCIÓN' : 'DESARROLLO');
    initializeApp();
});

// Inicializar aplicación
async function initializeApp() {
    try {
        await loadStats();
        updateWalletAvailability();
        setupEventListeners();
        checkExistingConnection();
        
        // Actualizar automáticamente cada 30 segundos en producción
        if (appState.isProduction) {
            setInterval(loadStats, 30000);
        }
    } catch (error) {
        console.error('Error inicializando aplicación:', error);
        showNotification('Error cargando la aplicación', 'error');
    }
}

// Cargar estadísticas - MEJORADO para producción
async function loadStats() {
    try {
        console.log('Cargando estadísticas...');
        
        let data;
        
        if (appState.isProduction) {
            // En producción, intentar API real primero
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
                    console.log('✅ Estadísticas cargadas desde API');
                } else {
                    throw new Error(`API error: ${response.status}`);
                }
            } catch (apiError) {
                console.error('Error API producción:', apiError.message);
                // En producción, usar datos por defecto si API falla
                data = {
                    totalParticipants: 1875,
                    tokensReserved: 3875000,
                    daysToLaunch: 14,
                    participantsToday: 42,
                    trend: 'up'
                };
            }
        } else {
            // En desarrollo, usar mock
            data = await mockAPI.getStats();
            console.log('🛠️ Usando datos de desarrollo');
        }
        
        appState.stats = data;
        updateStatsUI();
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        // Datos de respaldo robustos
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

// Actualizar UI de estadísticas - COMPLETAMENTE MEJORADA
function updateStatsUI() {
    if (appState.stats) {
        const participants = appState.stats.totalParticipants || 0;
        const tokensReserved = appState.stats.tokensReserved || 0;
        const daysToLaunch = appState.stats.daysToLaunch || 14;
        const participantsToday = appState.stats.participantsToday || 0;
        const trend = appState.stats.trend || 'up';

        // 1. Total de participantes
        document.getElementById('totalParticipants').textContent = 
            formatNumber(participants);
        
        // Trend de participantes
        const trendElement = document.getElementById('participantsTrend');
        if (trendElement) {
            const trendIcon = trend === 'up' ? 'fa-arrow-up' : 'fa-arrow-down';
            const trendColor = trend === 'up' ? 'var(--trend-up)' : 'var(--trend-down)';
            trendElement.innerHTML = `<i class="fas ${trendIcon}"></i> <span>+${participantsToday} hoy</span>`;
            trendElement.style.color = trendColor;
            trendElement.style.background = trend === 'up' ? 'rgba(0, 204, 136, 0.1)' : 'rgba(255, 107, 107, 0.1)';
        }

        // 2. Tokens reservados
        document.getElementById('tokensReserved').textContent = 
            formatNumber(tokensReserved);
        
        // Progreso de tokens reservados
        const reservedPercentage = Math.min((tokensReserved / CONFIG.TOTAL_TOKENS) * 100, 100);
        const reservedProgress = document.getElementById('reservedProgress');
        const reservedPercentageElement = document.getElementById('reservedPercentage');
        
        if (reservedProgress) {
            reservedProgress.style.width = `${reservedPercentage}%`;
        }
        if (reservedPercentageElement) {
            reservedPercentageElement.textContent = `${reservedPercentage.toFixed(1)}%`;
        }

        // 3. Días para lanzamiento
        document.getElementById('daysToLaunch').textContent = daysToLaunch;

        // 4. Tokens disponibles
        const tokensRemaining = CONFIG.TOTAL_TOKENS - tokensReserved;
        document.getElementById('tokensRemaining').textContent = 
            formatNumber(tokensRemaining);

        // 5. Info de tokens
        const tokensInfo = document.getElementById('tokensInfo');
        if (tokensInfo) {
            tokensInfo.textContent = `de ${formatNumber(CONFIG.TOTAL_TOKENS)} total`;
        }

        // Barra de progreso del airdrop
        const progressParticipants = (participants / CONFIG.MAX_PARTICIPANTS) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${Math.min(progressParticipants, 100)}%`;
        }

        // Actualizar límites
        const remainingSlots = CONFIG.MAX_PARTICIPANTS - participants;
        const remainingSlotsElement = document.getElementById('remainingSlots');
        if (remainingSlotsElement) {
            remainingSlotsElement.textContent = 
                `${remainingSlots.toLocaleString()} cupos disponibles`;
        }

        // Mostrar advertencias
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

// Función para formatear números - MEJORADA
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toLocaleString();
    }
}

// Actualizar disponibilidad de wallets - MEJORADO
async function updateWalletAvailability() {
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

    // Solflare - DETECCIÓN MEJORADA
    const solflareStatus = document.getElementById('solflareStatus');
    if (solflareStatus) {
        let isSolflareAvailable = false;
        
        if (window.solflare) {
            console.log('🌞 Solflare detectado:', window.solflare);
            
            // Verificar diferentes formas de detección
            if (window.solflare.isSolflare) {
                isSolflareAvailable = true;
                console.log('✅ Solflare detectado por isSolflare');
            } else if (typeof window.solflare.connect === 'function') {
                isSolflareAvailable = true;
                console.log('✅ Solflare detectado por connect function');
            } else if (typeof window.solflare.request === 'function') {
                isSolflareAvailable = true;
                console.log('✅ Solflare detectado por request function');
            } else if (typeof window.solflare === 'object') {
                // Verificar si tiene propiedades típicas de una wallet
                const walletProps = ['connect', 'disconnect', 'signMessage', 'signTransaction'];
                const hasWalletProps = walletProps.some(prop => typeof window.solflare[prop] === 'function');
                
                if (hasWalletProps) {
                    isSolflareAvailable = true;
                    console.log('✅ Solflare detectado por propiedades de wallet');
                }
            }
        }

        if (isSolflareAvailable) {
            solflareStatus.classList.add('available');
            solflareStatus.classList.remove('unavailable');
            console.log('✅ Solflare disponible');
        } else {
            solflareStatus.classList.add('unavailable');
            solflareStatus.classList.remove('available');
            console.log('❌ Solflare no disponible');
        }
    }

    // Backpack - DETECCIÓN MEJORADA
    const backpackStatus = document.getElementById('backpackStatus');
    if (backpackStatus) {
        let isBackpackAvailable = false;
        
        if (window.backpack) {
            console.log('🎒 Backpack detectado:', window.backpack);
            
            if (window.backpack.isBackpack) {
                isBackpackAvailable = true;
                console.log('✅ Backpack detectado por isBackpack');
            } else if (typeof window.backpack.connect === 'function') {
                isBackpackAvailable = true;
                console.log('✅ Backpack detectado por connect function');
            } else if (window.backpack.solana) {
                isBackpackAvailable = true;
                console.log('✅ Backpack detectado por solana object');
            } else if (typeof window.backpack === 'object' && Object.keys(window.backpack).length > 0) {
                isBackpackAvailable = true;
                console.log('✅ Backpack detectado por objeto no vacío');
            }
        }

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

// Función para conectar wallet - MEJORADO para Solflare
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
                if (window.solflare) {
                    console.log('🌞 Conectando con Solflare...');
                    
                    // Solflare puede tener diferentes APIs
                    let response;
                    
                    // Método 1: API moderna con connect()
                    if (typeof window.solflare.connect === 'function') {
                        try {
                            response = await window.solflare.connect();
                            console.log('Respuesta de Solflare connect():', response);
                            
                            if (response && response.publicKey) {
                                publicKey = response.publicKey.toString();
                            } else if (typeof response === 'string') {
                                publicKey = response;
                            } else {
                                // Si no obtenemos la clave directamente, intentamos obtener cuentas
                                const accounts = await window.solflare.request({ 
                                    method: 'getAccounts' 
                                });
                                
                                if (accounts && accounts.length > 0) {
                                    publicKey = accounts[0];
                                }
                            }
                        } catch (connectError) {
                            console.log('Connect() falló, intentando método alternativo:', connectError);
                        }
                    }
                    
                    // Método 2: Usar request() si connect() falló
                    if (!publicKey && typeof window.solflare.request === 'function') {
                        try {
                            response = await window.solflare.request({ 
                                method: 'connect' 
                            });
                            console.log('Respuesta de Solflare request(connect):', response);
                            
                            if (response && response.publicKey) {
                                publicKey = response.publicKey.toString();
                            } else if (Array.isArray(response) && response.length > 0) {
                                publicKey = response[0];
                            } else if (typeof response === 'string') {
                                publicKey = response;
                            }
                        } catch (requestError) {
                            console.log('Request(connect) falló:', requestError);
                        }
                    }
                    
                    // Método 3: Intentar obtener cuentas directamente
                    if (!publicKey && typeof window.solflare.request === 'function') {
                        try {
                            const accounts = await window.solflare.request({ 
                                method: 'getAccounts' 
                            });
                            
                            if (accounts && accounts.length > 0) {
                                publicKey = accounts[0];
                            }
                        } catch (accountsError) {
                            console.log('getAccounts falló:', accountsError);
                        }
                    }
                    
                    if (!publicKey) {
                        throw new Error('No se pudo obtener la dirección de Solflare. Por favor, acepta la conexión.');
                    }
                    
                    console.log(`✅ Solflare conectada: ${publicKey}`);
                } else {
                    throw new Error('Solflare no detectada. Instala la extensión.');
                }
                break;

            case 'backpack':
                if (window.backpack) {
                    try {
                        console.log('🎒 Intentando conectar Backpack...');
                        
                        let response;
                        
                        // Método 1: connect directo
                        if (typeof window.backpack.connect === 'function') {
                            response = await window.backpack.connect();
                        }
                        // Método 2: A través de solana object
                        else if (window.backpack.solana && window.backpack.solana.connect) {
                            response = await window.backpack.solana.connect();
                        }
                        // Método 3: Solicitud estándar
                        else if (typeof window.backpack.request === 'function') {
                            response = await window.backpack.request({ 
                                method: 'connect' 
                            });
                        } else {
                            throw new Error('Backpack API no reconocida');
                        }
                        
                        // Extraer la clave pública
                        if (response && response.publicKey) {
                            publicKey = response.publicKey.toString();
                        } else if (typeof response === 'string') {
                            publicKey = response;
                        } else if (response && response.toString) {
                            publicKey = response.toString();
                        } else if (response && response[0]) {
                            publicKey = response[0];
                        }
                        
                        if (!publicKey) {
                            const possibleKeys = Object.values(response || {}).filter(
                                val => typeof val === 'string' && val.length > 40
                            );
                            if (possibleKeys.length > 0) {
                                publicKey = possibleKeys[0];
                            }
                        }
                        
                        if (!publicKey) {
                            throw new Error('No se pudo extraer la clave pública de Backpack');
                        }
                        
                        console.log(`✅ Backpack conectada: ${publicKey}`);
                    } catch (backpackError) {
                        console.error('Error específico de Backpack:', backpackError);
                        throw new Error(`Backpack: ${backpackError.message || 'Error desconocido'}`);
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
        } else if (error.message.includes('Solflare') || error.message.includes('Backpack')) {
            showNotification(`${error.message}`, 'error');
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
        
        if (appState.isProduction) {
            // En producción, usar API real
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: walletAddress,
                    walletType: appState.selectedWallet,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                })
            });

            if (!response.ok) {
                throw new Error(`Error API: ${response.status}`);
            }
            
            data = await response.json();
        } else {
            // En desarrollo, usar mock
            console.log('🛠️ Usando mock API para registro');
            data = await mockAPI.registerWallet(walletAddress, appState.selectedWallet);
        }

        if (!data.success) {
            throw new Error(data.error || 'Error registrando wallet');
        }

        return data;
    } catch (error) {
        console.error('Error registrando wallet:', error);
        
        // En producción, ofrecer alternativa
        if (appState.isProduction) {
            showNotification('Error registrando wallet. Intenta nuevamente o contacta soporte.', 'error');
        }
        
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
        
        // Deshabilitar botón
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<div class="spinner"></div> Girando...';

        let data;
        
        if (appState.isProduction) {
            // En producción, usar API real
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
            // En desarrollo, usar mock
            console.log('🛠️ Usando mock API para ruleta');
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

        // Mostrar resultado
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

        // Deshabilitar botón por 24h
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';

        showNotification(`¡Ganaste ${data.prize} $REGRET en la ruleta!`, 'success');
        createConfetti();

        // Actualizar estadísticas después de girar
        setTimeout(() => {
            loadStats();
        }, 2000);

        // Habilitar después de 10 segundos (para prueba)
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
            console.log('🛠️ Usando mock API para referidos');
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
            // Ocultar la sección de wallets y botón
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
        
        // Actualizar estadísticas cuando se conecta
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

// Verificar si la wallet sigue conectada y funcional - MEJORADO para Solflare
async function verifyWalletConnection(walletType) {
    try {
        switch(walletType) {
            case 'phantom':
                if (window.solana && window.solana.isPhantom) {
                    const response = await window.solana.connect({ onlyIfTrusted: true });
                    return response && response.publicKey;
                }
                break;

            case 'solflare':
                if (window.solflare) {
                    try {
                        let isConnected = false;
                        
                        // Método 1: Propiedad isConnected
                        if (window.solflare.isConnected) {
                            isConnected = window.solflare.isConnected;
                        }
                        
                        // Método 2: Solicitar cuentas
                        if (!isConnected && typeof window.solflare.request === 'function') {
                            const accounts = await window.solflare.request({ method: 'getAccounts' });
                            isConnected = accounts && accounts.length > 0;
                        }
                        
                        return isConnected;
                    } catch (error) {
                        console.log('Error verificando Solflare:', error);
                        return false;
                    }
                }
                break;

            case 'backpack':
                if (window.backpack) {
                    try {
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
            document.getElementById('walletConnectContainer').style.display = 'flex';
            document.getElementById('referralSection').style.display = 'none';

            document.getElementById('spinBtn').disabled = true;
            document.getElementById('wheelResult').innerHTML =
                '<p style="color: var(--text-muted);"><i class="fas fa-info-circle"></i> Conecta tu wallet para girar la ruleta</p>';

            const wheel = document.getElementById('wheel');
            if (wheel) {
                wheel.style.transform = 'rotate(0deg)';
            }

            // Quitar selección de wallet
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
