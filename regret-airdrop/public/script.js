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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await loadStats();
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
        
        document.getElementById('totalParticipants').textContent = 
            appState.stats.totalParticipants.toLocaleString();
        
        // Formatear tokens reservados
        const tokensReserved = appState.stats.tokensReserved;
        document.getElementById('tokensReserved').textContent = 
            (tokensReserved / 1000).toFixed(1) + 'K';
        
        // Calcular tokens restantes
        const tokensRemaining = TOTAL_TOKENS - tokensReserved;
        document.getElementById('tokensRemaining').textContent = 
            (tokensRemaining / 1000000).toFixed(1) + 'M';
        
        // Actualizar texto pequeño
        document.getElementById('tokensAvailable').textContent = 
            `de ${(TOTAL_TOKENS/1000000).toFixed(0)}M total`;
        
        document.getElementById('daysToLaunch').textContent = 
            appState.stats.daysToLaunch;
        
        // Barra de progreso (participantes)
        const progressParticipants = (appState.stats.totalParticipants / 5000) * 100;
        document.getElementById('progressFill').style.width = `${progressParticipants}%`;
        
        // Barra de progreso para tokens (opcional - añade en CSS si quieres)
        const progressTokens = (tokensReserved / TOTAL_TOKENS) * 100;
        
        // Actualizar límites
        const remaining = 5000 - appState.stats.totalParticipants;
        document.getElementById('remainingSlots').textContent = 
            `${remaining.toLocaleString()} cupos disponibles`;
        
        if (progressParticipants >= 90) {
            document.getElementById('airdropLimit').style.display = 'block';
            const limitText = progressParticipants >= 95 ? 
                '⚠️ ¡ÚLTIMOS CUPOS! El airdrop está por cerrarse' :
                '⚠️ Airdrop limitado - Quedan pocos cupos';
            document.getElementById('limitText').textContent = limitText;
        }
    }
}

// Detectar wallets disponibles
function detectAvailableWallets() {
    const wallets = {};
    
    // Detectar Phantom
    if (window.phantom?.solana || window.solana) {
        wallets.phantom = window.phantom?.solana || window.solana;
    }
    
    // Detectar Solflare (nuevo y viejo formato)
    if (window.solflare) {
        wallets.solflare = window.solflare;
    }
    
    // Detectar Backpack
    if (window.backpack) {
        wallets.backpack = window.backpack;
    }
    
    // Detectar MetaMask (para Ethereum, con snap de Solana)
    if (window.ethereum?.isMetaMask) {
        wallets.metamask = window.ethereum;
    }
    
    // Detectar si hay soporte para WalletConnect (Uniswap Wallet)
    wallets.uniswap = {
        connect: async () => {
            // Placeholder para WalletConnect
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ publicKey: { toString: () => 'demo_wallet_address' } });
                }, 1000);
            });
        }
    };
    
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
                // Phantom (estándar)
                if (window.phantom?.solana || window.solana) {
                    const phantom = window.phantom?.solana || window.solana;
                    const response = await phantom.connect();
                    publicKey = response.publicKey.toString();
                } else {
                    throw new Error('Phantom no detectada');
                }
                break;
                
            case 'solflare':
                // Solflare (nuevo estándar)
                if (window.solflare) {
                    try {
                        // Método moderno de Solflare
                        const response = await window.solflare.connect();
                        publicKey = response.publicKey.toString();
                    } catch (error) {
                        // Método legacy
                        await window.solflare.connect();
                        publicKey = window.solflare.publicKey.toString();
                    }
                } else {
                    throw new Error('Solflare no detectada');
                }
                break;
                
            case 'backpack':
                // Backpack
                if (window.backpack) {
                    const response = await window.backpack.connect();
                    publicKey = response.publicKey.toString();
                } else {
                    throw new Error('Backpack no detectada');
                }
                break;
                
            case 'metamask':
                // MetaMask para Solana (necesita snap)
                if (window.ethereum && window.ethereum.isMetaMask) {
                    try {
                        // Intentar conectar a Solana via snap
                        const result = await window.ethereum.request({
                            method: 'wallet_requestSnaps',
                            params: {
                                'npm:@solana/snap': {}
                            }
                        });
                        
                        if (result['npm:@solana/snap']?.enabled) {
                            const accounts = await window.ethereum.request({
                                method: 'eth_requestAccounts'
                            });
                            // Convertir dirección EVM a Solana (esto es simplificado)
                            // En producción necesitarías una librería de conversión
                            publicKey = accounts[0];
                            showNotification('MetaMask conectada (modo Ethereum)', 'info');
                        } else {
                            throw new Error('Instala el snap de Solana para MetaMask');
                        }
                    } catch (error) {
                        throw new Error('MetaMask Solana snap no disponible');
                    }
                } else {
                    throw new Error('MetaMask no detectada');
                }
                break;
                
            case 'uniswap':
                // Uniswap Wallet (WalletConnect)
                showNotification('Usa WalletConnect para conectar Uniswap Wallet', 'info');
                // Implementación simplificada - en producción usar WalletConnect
                const walletConnectModal = document.createElement('div');
                walletConnectModal.innerHTML = `
                    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 99999; display: flex; align-items: center; justify-content: center;">
                        <div style="background: var(--card-bg); padding: 2rem; border-radius: 20px; max-width: 400px; text-align: center;">
                            <h3 style="color: var(--tear-yellow); margin-bottom: 1rem;">Conectar Uniswap Wallet</h3>
                            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Escanea este código QR con la app Uniswap Wallet:</p>
                            <div id="qrCode" style="background: white; padding: 1rem; border-radius: 10px; margin: 1rem auto; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center;">
                                <div style="color: black; font-family: monospace;">QR Code Placeholder</div>
                            </div>
                            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem;">O copia tu dirección Solana manualmente</p>
                            <button id="manualConnect" style="background: var(--therapy-green); color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; margin-top: 1rem;">Conectar Manualmente</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(walletConnectModal);
                
                // Manejar conexión manual
                document.getElementById('manualConnect').addEventListener('click', () => {
                    const address = prompt('Ingresa tu dirección de wallet Solana:');
                    if (address && address.length === 44) {
                        publicKey = address;
                        document.body.removeChild(walletConnectModal);
                    } else {
                        showNotification('Dirección inválida', 'error');
                    }
                });
                
                await new Promise(resolve => {
                    // Simular espera para conexión
                    setTimeout(resolve, 10000);
                });
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
        document.getElementById('walletStatus').style.display = 'flex';
        document.getElementById('walletAddress').textContent = 
            `${appState.walletAddress.slice(0, 4)}...${appState.walletAddress.slice(-4)}`;
        
        // Ocultar selector y botón principal
        document.getElementById('walletSelector').style.display = 'none';
        document.getElementById('connectBtn').style.display = 'none';
        
        // Mostrar sección de referidos
        updateReferralUI();
        
        // Activar ruleta
        document.getElementById('spinBtn').disabled = false;
        document.getElementById('wheelResult').innerHTML = 
            '<p><i class="fas fa-check-circle" style="color: var(--therapy-green);"></i> ¡Listo para girar!</p>';
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

