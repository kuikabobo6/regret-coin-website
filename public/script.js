// Agrega esta función al inicio de script.js
function updateWalletAvailability() {
    const wallets = detectAvailableWallets();
    
    // Actualizar indicadores visuales
    const indicators = {
        phantom: document.getElementById('phantomStatus'),
        solflare: document.getElementById('solflareStatus'),
        backpack: document.getElementById('backpackStatus'),
        metamask: document.getElementById('metamaskStatus'),
        uniswap: document.getElementById('uniswapStatus')
    };
    
    // Phantom
    if (wallets.phantom) {
        indicators.phantom.className = 'wallet-status-indicator available';
    }
    
    // Solflare
    if (wallets.solflare) {
        indicators.solflare.className = 'wallet-status-indicator available';
    }
    
    // Backpack
    if (wallets.backpack) {
        indicators.backpack.className = 'wallet-status-indicator available';
    }
    
    // MetaMask (solo Ethereum, necesita snap para Solana)
    if (wallets.metamask) {
        indicators.metamask.className = 'wallet-status-indicator partial';
    }
    
    // Uniswap (siempre disponible vía manual)
    indicators.uniswap.className = 'wallet-status-indicator partial';
    
    // Deshabilitar opciones no disponibles
    document.querySelectorAll('.wallet-option').forEach(option => {
        const walletType = option.dataset.wallet;
        if (walletType !== 'uniswap' && !wallets[walletType]) {
            option.style.opacity = '0.5';
            option.style.cursor = 'not-allowed';
            option.title = `Instala ${walletType} para usar esta opción`;
        }
    });
}// Configuración
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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await loadStats();
    updateWalletAvailability();
    setupEventListeners();
    checkExistingConnection();
});

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const data = await response.json();
        appState.stats = data;
        updateStatsUI();
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Actualizar UI de estadísticas
function updateStatsUI() {
    if (appState.stats) {
        const TOTAL_TOKENS = 10000000; // 10 millones totales
        
        // Formatear números correctamente
        const participants = appState.stats.totalParticipants;
        const tokensReserved = appState.stats.tokensReserved;
        
        // Total de participantes
        document.getElementById('totalParticipants').textContent = 
            participants.toLocaleString();
        
        // Tokens reservados (formato: 1.5M)
        let tokensReservedFormatted;
        if (tokensReserved >= 1000000) {
            tokensReservedFormatted = (tokensReserved / 1000000).toFixed(1) + 'M';
        } else if (tokensReserved >= 1000) {
            tokensReservedFormatted = (tokensReserved / 1000).toFixed(1) + 'K';
        } else {
            tokensReservedFormatted = tokensReserved.toLocaleString();
        }
        
        document.getElementById('tokensReserved').textContent = tokensReservedFormatted;
        
        // Tokens disponibles
        const tokensRemaining = TOTAL_TOKENS - tokensReserved;
        let tokensRemainingFormatted;
        if (tokensRemaining >= 1000000) {
            tokensRemainingFormatted = (tokensRemaining / 1000000).toFixed(1) + 'M';
        } else if (tokensRemaining >= 1000) {
            tokensRemainingFormatted = (tokensRemaining / 1000).toFixed(1) + 'K';
        } else {
            tokensRemainingFormatted = tokensRemaining.toLocaleString();
        }
        
        document.getElementById('tokensRemaining').textContent = tokensRemainingFormatted;
        
        // Texto descriptivo
        document.getElementById('tokensAvailable').textContent = 
            `de ${(TOTAL_TOKENS/1000000).toFixed(0)}M total`;
        
        // Días para lanzamiento
        document.getElementById('daysToLaunch').textContent = 
            appState.stats.daysToLaunch;
        
        // Barra de progreso de participantes
        const progressParticipants = (participants / 5000) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progressParticipants}%`;
        }
        
        // Actualizar límites
        const remainingSlots = 5000 - participants;
        const remainingSlotsElement = document.getElementById('remainingSlots');
        if (remainingSlotsElement) {
            remainingSlotsElement.textContent = 
                `${remainingSlots.toLocaleString()} cupos disponibles`;
        }
        
        // Mostrar advertencias
        const airdropLimit = document.getElementById('airdropLimit');
        if (airdropLimit) {
            if (progressParticipants >= 90) {
                airdropLimit.style.display = 'block';
                const limitText = progressParticipants >= 95 ? 
                    '⚠️ ¡ÚLTIMOS CUPOS! El airdrop está por cerrarse' :
                    '⚠️ Airdrop limitado - Quedan pocos cupos';
                document.getElementById('limitText').textContent = limitText;
            }
        }
    }
}

// Detectar wallets disponibles
function detectAvailableWallets() {
    const wallets = {};

    // Detectar Phantom - Phantom inyecta window.solana
    if (window.solana && window.solana.isPhantom) {
        wallets.phantom = window.solana;
    }

    // Detectar Solflare
    if (window.solflare) {
        wallets.solflare = window.solflare;
    }

    // Detectar Backpack
    if (window.backpack) {
        wallets.backpack = window.backpack;
    }

    // MetaMask - No soportado para Solana (solo Ethereum)
    // Removido: era demasiado complejo y no funcionaba bien

    // Uniswap Wallet - conexión manual
    wallets.uniswap = true; // Siempre disponible para conexión manual

    console.log('Wallets detectadas:', Object.keys(wallets));
    return wallets;
}

// Conectar wallet
async function connectToWallet(walletType) {
    console.log(`Intentando conectar ${walletType}...`);
    
    try {
        let publicKey = null;
        
        switch(walletType) {
            case 'phantom':
                // Phantom - usa window.solana
                if (window.solana && window.solana.isPhantom) {
                    try {
                        const response = await window.solana.connect();
                        publicKey = response.publicKey.toString();
                    } catch (error) {
                        if (error.message.includes('User rejected')) {
                            throw new Error('Usuario canceló la conexión');
                        }
                        throw new Error('Error conectando Phantom');
                    }
                } else {
                    throw new Error('Phantom no detectada. Instala la extensión de Phantom.');
                }
                break;

            case 'solflare':
                // Solflare
                if (window.solflare) {
                    try {
                        const response = await window.solflare.connect();
                        publicKey = response.publicKey.toString();
                    } catch (error) {
                        if (error.message.includes('User rejected')) {
                            throw new Error('Usuario canceló la conexión');
                        }
                        throw new Error('Error conectando Solflare');
                    }
                } else {
                    throw new Error('Solflare no detectada. Instala la extensión de Solflare.');
                }
                break;

            case 'backpack':
                // Backpack
                if (window.backpack) {
                    try {
                        const response = await window.backpack.connect();
                        publicKey = response.publicKey.toString();
                    } catch (error) {
                        if (error.message.includes('User rejected')) {
                            throw new Error('Usuario canceló la conexión');
                        }
                        throw new Error('Error conectando Backpack');
                    }
                } else {
                    throw new Error('Backpack no detectada. Instala la extensión de Backpack.');
                }
                break;

            case 'uniswap':
                // Uniswap Wallet - conexión manual
                showNotification('Ingresa tu dirección de wallet Solana manualmente', 'info');
                const address = prompt('Ingresa tu dirección de wallet Solana (44 caracteres):');
                if (address && address.length === 44 && /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(address)) {
                    publicKey = address;
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
        
        console.log(`Wallet conectada: ${publicKey}`);
        return publicKey;
        
    } catch (error) {
        console.error('Error detallado en conexión:', error);
        
        // Mensajes específicos por error
        if (error.message.includes('user rejected')) {
            showNotification('Conexión cancelada por el usuario', 'error');
        } else if (error.message.includes('not detected')) {
            showNotification(`${walletType} no está instalada`, 'error');
            // Abrir tienda de extensiones según navegador
            if (walletType === 'phantom') {
                window.open('https://phantom.app/', '_blank');
            } else if (walletType === 'solflare') {
                window.open('https://solflare.com/', '_blank');
            } else if (walletType === 'backpack') {
                window.open('https://www.backpack.app/', '_blank');
            }
        } else {
            showNotification(`Error: ${error.message}`, 'error');
        }
        
        return null;
    }
}

// Registrar wallet en el airdrop
async function registerWallet(walletAddress) {
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                wallet: walletAddress,
                walletType: appState.selectedWallet
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error registrando wallet');
        }

        return data;
    } catch (error) {
        console.error('Error registrando wallet:', error);
        throw error;
    }
}

// Girar ruleta
async function spinWheel() {
    if (!appState.walletConnected) {
        showNotification('Conecta tu wallet primero', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/spin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet: appState.walletAddress })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error girando ruleta');
        }

        // Actualizar datos del usuario
        appState.userData.tokens = data.totalTokens;
        
        // Mostrar resultado
        document.getElementById('wheelResult').innerHTML = `
            <h3 style="color: var(--tear-yellow);">¡Ganaste ${data.prize} $REGRET!</h3>
            <p style="color: var(--text-muted);">Total acumulado: ${data.totalTokens} $REGRET</p>
        `;
        
        // Deshabilitar botón por 24h
        const spinBtn = document.getElementById('spinBtn');
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fas fa-clock"></i> VUELVE MAÑANA';
        
        showNotification(`¡Ganaste ${data.prize} $REGRET en la ruleta!`, 'success');
        createConfetti();
        
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Cargar datos de referidos
async function loadReferralData() {
    try {
        const response = await fetch(`${API_BASE}/referral?wallet=${appState.walletAddress}`);
        const data = await response.json();
        
        if (response.ok) {
            appState.userData.referralCount = data.referralCount;
            appState.userData.referrals = data.referrals;
            updateReferralUI();
        }
    } catch (error) {
        console.error('Error cargando referidos:', error);
    }
}

// Actualizar UI de referidos
function updateReferralUI() {
    document.getElementById('referralCode').textContent = appState.userData.referralCode;
    document.getElementById('referralCount').textContent = appState.userData.referralCount || 0;
    document.getElementById('referralSection').style.display = 'block';
}

// Actualizar UI completa
function updateUI() {
    if (appState.walletConnected && appState.userData) {
        // Mostrar estado de wallet
        const walletStatus = document.getElementById('walletStatus');
        const walletAddress = document.getElementById('walletAddress');
        if (walletStatus) walletStatus.style.display = 'flex';
        if (walletAddress) {
            walletAddress.textContent = `${appState.walletAddress.slice(0, 4)}...${appState.walletAddress.slice(-4)}`;
        }

        // Ocultar selector y botón principal
        const walletSelector = document.getElementById('walletSelector');
        const connectBtn = document.getElementById('connectBtn');
        if (walletSelector) walletSelector.style.display = 'none';
        if (connectBtn) connectBtn.style.display = 'none';

        // Mostrar sección de referidos
        updateReferralUI();

        // Activar ruleta
        const spinBtn = document.getElementById('spinBtn');
        const wheelResult = document.getElementById('wheelResult');
        if (spinBtn) spinBtn.disabled = false;
        if (wheelResult) {
            wheelResult.innerHTML = '<p><i class="fas fa-check-circle" style="color: var(--therapy-green);"></i> ¡Listo para girar!</p>';
        }
    }
}

// Verificar conexión existente (localStorage)
function checkExistingConnection() {
    const savedWallet = localStorage.getItem('regret_wallet');
    if (savedWallet) {
        // Podrías implementar reconexión automática aquí
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
    document.getElementById('connectBtn').addEventListener('click', async () => {
        if (!appState.selectedWallet) {
            showNotification('Selecciona una wallet primero', 'error');
            return;
        }

        const connectBtn = document.getElementById('connectBtn');
        connectBtn.innerHTML = '<div class="spinner"></div> Conectando...';
        connectBtn.disabled = true;

        // Conectar wallet
        const walletAddress = await connectToWallet(appState.selectedWallet);
        
        if (walletAddress) {
            appState.walletAddress = walletAddress;
            appState.walletConnected = true;
            
            // Registrar en el airdrop
            try {
                const result = await registerWallet(walletAddress);
                appState.userData = {
                    wallet: walletAddress,
                    referralCode: result.referralCode,
                    tokens: result.tokens
                };
                
                // Guardar en localStorage
                localStorage.setItem('regret_wallet', walletAddress);
                
                // Cargar datos de referidos
                await loadReferralData();
                
                // Actualizar UI
                updateUI();
                await loadStats(); // Recargar stats
                
                showNotification('¡Wallet conectada! Has reclamado 1,000 $REGRET', 'success');
                createConfetti();
                
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }

        connectBtn.innerHTML = '<i class="fas fa-plug"></i> CONECTAR WALLET Y RECLAMAR 1,000 $REGRET';
        connectBtn.disabled = false;
    });

    // Botón de desconexión
    document.getElementById('disconnectBtn').addEventListener('click', () => {
        appState.walletConnected = false;
        appState.walletAddress = null;
        appState.userData = null;
        
        localStorage.removeItem('regret_wallet');
        
        document.getElementById('walletStatus').style.display = 'none';
        document.getElementById('walletSelector').style.display = 'grid';
        document.getElementById('connectBtn').style.display = 'block';
        document.getElementById('referralSection').style.display = 'none';
        
        document.getElementById('spinBtn').disabled = true;
        document.getElementById('wheelResult').innerHTML = 
            '<p><i class="fas fa-info-circle"></i> Conecta tu wallet para girar la ruleta</p>';
        
        // Resetear ruleta
        const wheel = document.getElementById('wheel');
        wheel.style.transform = 'rotate(0deg)';
        
        showNotification('Wallet desconectada', 'info');
    });

    // Botón de girar ruleta
    document.getElementById('spinBtn').addEventListener('click', spinWheel);

    // Botón de copiar código de referido
    document.getElementById('copyReferralBtn').addEventListener('click', () => {
        if (appState.userData && appState.userData.referralCode) {
            navigator.clipboard.writeText(appState.userData.referralCode);
            showNotification('Código copiado al portapapeles', 'success');
        }
    });
}

// Función de notificaciones
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.className = 'notification';
    notification.classList.add('show');
    
    if (type === 'error') {
        notification.style.background = 'linear-gradient(45deg, var(--error-red), #FF8E8E)';
    } else if (type === 'success') {
        notification.style.background = 'linear-gradient(45deg, var(--therapy-green), var(--cry-blue))';
    }
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Función de confetti
function createConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#FFD166', '#00CC88', '#4A90E2', '#9D4EDD'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animation = `confettiRain ${1 + Math.random() * 2}s linear forwards`;
        container.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 3000);
    }
}

// Exportar funciones para debugging
window.appState = appState;
window.connectToWallet = connectToWallet;

window.showNotification = showNotification;




