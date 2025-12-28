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
        document.getElementById('totalParticipants').textContent = 
            appState.stats.totalParticipants.toLocaleString();
        
        document.getElementById('tokensReserved').textContent = 
            (appState.stats.tokensReserved / 1000).toFixed(0) + 'K';
        
        document.getElementById('daysToLaunch').textContent = 
            appState.stats.daysToLaunch;
        
        // Barra de progreso
        const progress = (appState.stats.totalParticipants / CONFIG.MAX_PARTICIPANTS) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        
        // Actualizar límites
        const remaining = CONFIG.MAX_PARTICIPANTS - appState.stats.totalParticipants;
        document.getElementById('remainingSlots').textContent = 
            `${remaining.toLocaleString()} cupos disponibles`;
        
        if (progress >= 90) {
            document.getElementById('airdropLimit').style.display = 'block';
            const limitText = progress >= 95 ? 
                '⚠️ ¡ÚLTIMOS CUPOS! El airdrop está por cerrarse' :
                '⚠️ Airdrop limitado - Quedan pocos cupos';
            document.getElementById('limitText').textContent = limitText;
        }
    }
}

// Detectar wallets disponibles
function detectAvailableWallets() {
    const wallets = {
        phantom: window.phantom?.solana || window.solana,
        solflare: window.solflare,
        backpack: window.backpack
    };
    return wallets;
}

// Conectar wallet
async function connectToWallet(walletType) {
    const wallets = detectAvailableWallets();
    const wallet = wallets[walletType];
    
    if (!wallet) {
        showNotification(`Instala la extensión de ${walletType} primero`, 'error');
        return null;
    }

    try {
        let publicKey;
        
        if (walletType === 'phantom' || walletType === 'solflare') {
            const response = await wallet.connect();
            publicKey = response.publicKey.toString();
        } else {
            await wallet.connect();
            publicKey = wallet.publicKey.toString();
        }
        
        return publicKey;
    } catch (error) {
        console.error('Error conectando wallet:', error);
        showNotification('Error al conectar la wallet', 'error');
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