// ============================================================================
// CONFIGURACIÓN PROFESIONAL $REGRET AIRDROP
// ============================================================================

const CONFIG = {
    AIRDROP_BASE: 1000,
    REFERRAL_BONUS: 500,
    MAX_PARTICIPANTS: 5000,
    TOTAL_TOKENS: 10000000,
    
    // API Configuration for Vercel
    API_BASE: window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname.includes('.local') ? 
              'http://localhost:3000/api' : '/api',
    
    // Network Configuration
    NETWORK: 'mainnet-beta',
    CLUSTER_API: 'https://api.mainnet-beta.solana.com',
    
    // App Settings
    APP_VERSION: '1.0.0',
    APP_NAME: '$REGRET Airdrop'
};

// ============================================================================
// APPLICATION STATE MANAGEMENT
// ============================================================================

const AppState = {
    selectedWallet: null,
    walletConnected: false,
    walletAddress: null,
    userData: null,
    stats: null,
    sessionId: generateSessionId(),
    isProduction: window.location.hostname !== 'localhost' && 
                  window.location.hostname !== '127.0.0.1',
    hasSpunToday: false,
    lastActivity: Date.now()
};

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// POSTGRES API SERVICE (Vercel Integration)
// ============================================================================

const PostgresApiService = {
    // ========== STATISTICS ==========
    async getStats() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/stats`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': AppState.sessionId,
                    'X-App-Version': CONFIG.APP_VERSION
                },
                cache: 'no-cache'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch stats');
            }

            const data = await response.json();
            
            // Validate response
            if (!data.success || !data.data) {
                throw new Error('Invalid API response');
            }

            return data;
        } catch (error) {
            console.error('Postgres API - Stats Error:', error);
            
            // Fallback to mock data with local storage
            const fallbackData = this.getFallbackStats();
            
            // Try to update with local data
            try {
                const localParticipants = localStorage.getItem('regret_local_participants');
                if (localParticipants) {
                    const participants = JSON.parse(localParticipants);
                    const participantCount = Object.keys(participants).length;
                    
                    if (participantCount > 0) {
                        fallbackData.data.totalParticipants = Math.max(
                            fallbackData.data.totalParticipants,
                            participantCount
                        );
                    }
                }
            } catch (e) {
                console.warn('Could not merge local data:', e);
            }

            return fallbackData;
        }
    },

    // ========== WALLET REGISTRATION ==========
    async registerWallet(walletAddress, walletType) {
        try {
            // Validate wallet address
            if (!this.validateSolanaAddress(walletAddress)) {
                throw new Error('Invalid Solana wallet address');
            }

            const payload = {
                wallet: walletAddress,
                walletType: walletType,
                userAgent: navigator.userAgent,
                referrer: document.referrer || 'direct',
                sessionId: AppState.sessionId,
                timestamp: new Date().toISOString(),
                utmSource: this.getUTMParameter('utm_source'),
                utmMedium: this.getUTMParameter('utm_medium'),
                utmCampaign: this.getUTMParameter('utm_campaign')
            };

            console.log('Registering wallet with payload:', {
                ...payload,
                wallet: walletAddress.substring(0, 8) + '...'
            });

            const response = await fetch(`${CONFIG.API_BASE}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': AppState.sessionId
                },
                body: JSON.stringify(payload)
            });

            const responseData = await response.json();

            if (!response.ok) {
                // Check if wallet already exists
                if (responseData.error && responseData.error.includes('already exists')) {
                    return {
                        success: true,
                        data: {
                            referralCode: responseData.referralCode || this.generateReferralCode(walletAddress),
                            tokens: responseData.tokens || CONFIG.AIRDROP_BASE,
                            message: 'Wallet already registered',
                            alreadyRegistered: true
                        }
                    };
                }
                throw new Error(responseData.error || 'Registration failed');
            }

            if (!responseData.success) {
                throw new Error(responseData.error || 'Registration failed');
            }

            // Store locally for backup
            this.storeLocalParticipant(walletAddress, walletType, responseData.data);

            return responseData;
        } catch (error) {
            console.error('Postgres API - Register Error:', error);
            
            // Fallback: Generate referral code and store locally
            const referralCode = this.generateReferralCode(walletAddress);
            
            this.storeLocalParticipant(walletAddress, walletType, {
                referralCode,
                tokens: CONFIG.AIRDROP_BASE
            });

            return {
                success: true,
                data: {
                    referralCode,
                    tokens: CONFIG.AIRDROP_BASE,
                    message: 'Registered locally (API unavailable)',
                    localFallback: true
                }
            };
        }
    },

    // ========== WHEEL SPIN ==========
    async spinWheel(walletAddress) {
        try {
            // Check if already spun today (local check)
            const lastSpinKey = `regret_last_spin_${walletAddress}`;
            const lastSpin = localStorage.getItem(lastSpinKey);
            
            if (lastSpin) {
                const lastSpinDate = new Date(lastSpin);
                const today = new Date();
                
                if (lastSpinDate.toDateString() === today.toDateString()) {
                    throw new Error('Already spun today. Come back tomorrow!');
                }
            }

            const payload = {
                wallet: walletAddress,
                sessionId: AppState.sessionId,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${CONFIG.API_BASE}/spin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': AppState.sessionId
                },
                body: JSON.stringify(payload)
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || 'Spin failed');
            }

            if (!responseData.success) {
                throw new Error(responseData.error || 'Spin failed');
            }

            // Store spin locally
            localStorage.setItem(lastSpinKey, new Date().toISOString());
            
            // Update local tokens
            if (AppState.userData) {
                AppState.userData.tokens = responseData.data.totalTokens;
                this.updateLocalParticipant(walletAddress, {
                    tokens: responseData.data.totalTokens
                });
            }

            return responseData;
        } catch (error) {
            console.error('Postgres API - Spin Error:', error);
            
            // Fallback: Mock spin with local storage
            const prize = this.getMockPrize();
            const currentTokens = AppState.userData?.tokens || CONFIG.AIRDROP_BASE;
            const totalTokens = currentTokens + prize;
            
            // Store locally
            localStorage.setItem(`regret_last_spin_${walletAddress}`, new Date().toISOString());
            
            if (AppState.userData) {
                AppState.userData.tokens = totalTokens;
                this.updateLocalParticipant(walletAddress, {
                    tokens: totalTokens
                });
            }

            return {
                success: true,
                data: {
                    prize: prize,
                    color: this.getColorForPrize(prize),
                    totalTokens: totalTokens,
                    message: `You won ${prize} $REGRET! (Local Fallback)`,
                    localFallback: true
                }
            };
        }
    },

    // ========== REFERRALS ==========
    async getReferrals(walletAddress) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/referrals/${walletAddress}`, {
                headers: {
                    'X-Session-ID': AppState.sessionId
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch referrals');
            }

            const responseData = await response.json();

            if (!responseData.success) {
                throw new Error('Invalid response');
            }

            return responseData;
        } catch (error) {
            console.error('Postgres API - Referrals Error:', error);
            
            // Fallback: Get local referrals
            const localData = this.getLocalReferrals(walletAddress);
            
            return {
                success: true,
                data: localData,
                localFallback: true
            };
        }
    },

    async addReferral(referrerWallet, referredWallet, referralCode) {
        try {
            const payload = {
                referrerWallet,
                referredWallet,
                referralCode,
                sessionId: AppState.sessionId,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${CONFIG.API_BASE}/referrals/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': AppState.sessionId
                },
                body: JSON.stringify(payload)
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to add referral');
            }

            return responseData;
        } catch (error) {
            console.error('Postgres API - Add Referral Error:', error);
            
            // Fallback: Store locally
            this.storeLocalReferral(referrerWallet, referredWallet, referralCode);
            
            return {
                success: true,
                data: { message: 'Referral stored locally' },
                localFallback: true
            };
        }
    },

    // ========== HELPER METHODS ==========
    validateSolanaAddress(address) {
        if (!address || typeof address !== 'string') return false;
        
        // Basic Solana address validation
        const trimmed = address.trim();
        if (trimmed.length !== 44) return false;
        
        // Solana addresses are base58 encoded
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{44}$/;
        return base58Regex.test(trimmed);
    },

    generateReferralCode(walletAddress) {
        const prefix = 'REGRET-';
        const hash = btoa(walletAddress).substring(0, 8).toUpperCase();
        return prefix + hash;
    },

    getUTMParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || null;
    },

    getMockPrize() {
        const prizes = [100, 250, 500, 750, 1000, 1500];
        return prizes[Math.floor(Math.random() * prizes.length)];
    },

    getColorForPrize(prize) {
        const colorMap = {
            100: '#4A90E2',
            250: '#00CC88',
            500: '#FFD166',
            750: '#9D4EDD',
            1000: '#FF6B6B',
            1500: '#4ECDC4'
        };
        return colorMap[prize] || '#4A90E2';
    },

    getFallbackStats() {
        // Try to get from localStorage first
        try {
            const localData = localStorage.getItem('regret_stats');
            if (localData) {
                const parsed = JSON.parse(localData);
                if (parsed.timestamp && Date.now() - new Date(parsed.timestamp).getTime() < 3600000) {
                    return {
                        success: true,
                        data: parsed.data
                    };
                }
            }
        } catch (e) {
            console.warn('Could not parse local stats:', e);
        }

        // Generate mock stats
        const totalParticipants = Math.floor(Math.random() * 1500) + 1000;
        const tokensReserved = totalParticipants * CONFIG.AIRDROP_BASE + 
                             Math.floor(totalParticipants * 0.3) * CONFIG.REFERRAL_BONUS;

        return {
            success: true,
            data: {
                totalParticipants,
                tokensReserved,
                daysToLaunch: Math.max(1, Math.floor(Math.random() * 30) + 1),
                participantsToday: Math.floor(Math.random() * 50) + 25,
                trend: 'up',
                timestamp: new Date().toISOString()
            }
        };
    },

    storeLocalParticipant(walletAddress, walletType, data) {
        try {
            const participants = JSON.parse(localStorage.getItem('regret_local_participants') || '{}');
            participants[walletAddress] = {
                walletType,
                referralCode: data.referralCode,
                tokens: data.tokens || CONFIG.AIRDROP_BASE,
                registeredAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            };
            localStorage.setItem('regret_local_participants', JSON.stringify(participants));
            
            // Update stats
            this.updateLocalStats();
        } catch (error) {
            console.error('Error storing local participant:', error);
        }
    },

    updateLocalParticipant(walletAddress, updates) {
        try {
            const participants = JSON.parse(localStorage.getItem('regret_local_participants') || '{}');
            if (participants[walletAddress]) {
                participants[walletAddress] = {
                    ...participants[walletAddress],
                    ...updates,
                    lastActive: new Date().toISOString()
                };
                localStorage.setItem('regret_local_participants', JSON.stringify(participants));
            }
        } catch (error) {
            console.error('Error updating local participant:', error);
        }
    },

    getLocalReferrals(walletAddress) {
        try {
            const referrals = JSON.parse(localStorage.getItem('regret_local_referrals') || '{}');
            const userReferrals = referrals[walletAddress] || [];
            
            return {
                referralCount: userReferrals.length,
                referrals: userReferrals,
                totalEarned: userReferrals.length * CONFIG.REFERRAL_BONUS
            };
        } catch (error) {
            console.error('Error getting local referrals:', error);
            return {
                referralCount: 0,
                referrals: [],
                totalEarned: 0
            };
        }
    },

    storeLocalReferral(referrerWallet, referredWallet, referralCode) {
        try {
            const referrals = JSON.parse(localStorage.getItem('regret_local_referrals') || '{}');
            
            if (!referrals[referrerWallet]) {
                referrals[referrerWallet] = [];
            }
            
            referrals[referrerWallet].push({
                wallet: referredWallet,
                referralCode,
                date: new Date().toISOString().split('T')[0]
            });
            
            localStorage.setItem('regret_local_referrals', JSON.stringify(referrals));
            
            // Update referrer's token count
            this.updateLocalParticipant(referrerWallet, {
                referralCount: referrals[referrerWallet].length,
                tokens: (AppState.userData?.tokens || CONFIG.AIRDROP_BASE) + CONFIG.REFERRAL_BONUS
            });
        } catch (error) {
            console.error('Error storing local referral:', error);
        }
    },

    updateLocalStats() {
        try {
            const participants = JSON.parse(localStorage.getItem('regret_local_participants') || '{}');
            const totalParticipants = Object.keys(participants).length;
            let totalTokens = 0;
            
            Object.values(participants).forEach(participant => {
                totalTokens += participant.tokens || 0;
            });
            
            const stats = {
                data: {
                    totalParticipants,
                    tokensReserved: totalTokens,
                    daysToLaunch: 14,
                    participantsToday: Math.floor(Math.random() * 20) + 5,
                    trend: 'up',
                    timestamp: new Date().toISOString()
                }
            };
            
            localStorage.setItem('regret_stats', JSON.stringify(stats));
        } catch (error) {
            console.error('Error updating local stats:', error);
        }
    },

    // ========== ANALYTICS ==========
    async trackEvent(eventName, eventData = {}) {
        try {
            const payload = {
                event: eventName,
                sessionId: AppState.sessionId,
                walletAddress: AppState.walletAddress,
                timestamp: new Date().toISOString(),
                ...eventData
            };

            // Send to analytics endpoint if available
            await fetch(`${CONFIG.API_BASE}/analytics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }).catch(() => {
                // Silently fail if analytics endpoint is not available
            });
        } catch (error) {
            // Analytics errors shouldn't break the app
            console.debug('Analytics error:', error);
        }
    }
};

// ============================================================================
// WALLET SERVICE (Enhanced for Production)
// ============================================================================

const WalletService = {
    async connect(walletType) {
        console.log(`🔗 Connecting to ${walletType}...`);
        
        try {
            let publicKey = null;
            let connectionMethod = '';
            
            switch(walletType) {
                case 'phantom':
                    const phantomResult = await this.connectPhantom();
                    publicKey = phantomResult.publicKey;
                    connectionMethod = phantomResult.method;
                    break;
                    
                case 'solflare':
                    const solflareResult = await this.connectSolflare();
                    publicKey = solflareResult.publicKey;
                    connectionMethod = solflareResult.method;
                    break;
                    
                case 'backpack':
                    const backpackResult = await this.connectBackpack();
                    publicKey = backpackResult.publicKey;
                    connectionMethod = backpackResult.method;
                    break;
                    
                case 'manual':
                    publicKey = await this.connectManual();
                    connectionMethod = 'manual_input';
                    break;
                    
                default:
                    throw new Error(`Unsupported wallet type: ${walletType}`);
            }

            if (!publicKey) {
                throw new Error('Could not retrieve public key');
            }

            // Validate the address
            if (!PostgresApiService.validateSolanaAddress(publicKey)) {
                throw new Error('Invalid Solana address received');
            }

            console.log(`✅ ${walletType} connected successfully`);
            console.log(`   Address: ${publicKey.substring(0, 8)}...${publicKey.substring(publicKey.length - 8)}`);
            console.log(`   Method: ${connectionMethod}`);
            
            // Track connection event
            await PostgresApiService.trackEvent('wallet_connected', {
                walletType,
                connectionMethod,
                addressHash: this.hashAddress(publicKey)
            });

            return publicKey;
        } catch (error) {
            console.error(`❌ ${walletType} connection failed:`, error);
            
            await PostgresApiService.trackEvent('wallet_connection_failed', {
                walletType,
                error: error.message
            });
            
            this.handleWalletError(walletType, error);
            return null;
        }
    },

    async connectPhantom() {
        if (!window.solana?.isPhantom) {
            throw new Error('Phantom wallet not detected. Please install the Phantom extension.');
        }

        try {
            // Try different connection methods
            let response;
            let method = 'default';
            
            // Method 1: Standard connect
            if (typeof window.solana.connect === 'function') {
                response = await window.solana.connect();
                method = 'connect';
            }
            // Method 2: Request method
            else if (typeof window.solana.request === 'function') {
                response = await window.solana.request({ method: 'connect' });
                method = 'request';
            }
            // Method 3: Legacy method
            else if (window.solana._phantom && window.solana._phantom.connect) {
                response = await window.solana._phantom.connect();
                method = 'legacy';
            } else {
                throw new Error('Phantom connection method not available');
            }

            if (!response || !response.publicKey) {
                throw new Error('No public key received from Phantom');
            }

            return {
                publicKey: response.publicKey.toString(),
                method
            };
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('Connection request was rejected by user');
            }
            throw error;
        }
    },

    async connectSolflare() {
        if (!window.solflare) {
            throw new Error('Solflare wallet not detected. Please install the Solflare extension.');
        }

        try {
            let response;
            let method = 'default';
            
            // Try different Solflare connection methods
            if (typeof window.solflare.connect === 'function') {
                response = await window.solflare.connect();
                method = 'connect';
            } else if (typeof window.solflare.request === 'function') {
                response = await window.solflare.request({ method: 'connect' });
                method = 'request';
            } else if (window.solflare.isSolflare) {
                // Modern Solflare
                response = await window.solflare.connect();
                method = 'modern';
            } else {
                throw new Error('Solflare connection method not available');
            }

            return {
                publicKey: this.extractPublicKey(response),
                method
            };
        } catch (error) {
            throw error;
        }
    },

    async connectBackpack() {
        if (!window.backpack) {
            throw new Error('Backpack wallet not detected. Please install the Backpack extension.');
        }

        try {
            let response;
            let method = 'default';
            
            if (typeof window.backpack.connect === 'function') {
                response = await window.backpack.connect();
                method = 'connect';
            } else if (window.backpack.solana?.connect) {
                response = await window.backpack.solana.connect();
                method = 'solana_api';
            } else if (typeof window.backpack.request === 'function') {
                response = await window.backpack.request({ method: 'connect' });
                method = 'request';
            } else {
                throw new Error('Backpack connection method not available');
            }

            return {
                publicKey: this.extractPublicKey(response),
                method
            };
        } catch (error) {
            throw error;
        }
    },

    async connectManual() {
        return new Promise((resolve, reject) => {
            // Create a professional-looking modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: var(--dark-bg);
                padding: 30px;
                border-radius: 15px;
                border: 1px solid var(--border-color);
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            `;
            
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 15px; color: var(--accent);">
                    <i class="fas fa-key"></i> Enter Solana Wallet Address
                </h3>
                <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem;">
                    Please enter your 44-character Solana wallet address.
                    This will be stored securely for token distribution.
                </p>
                <input type="text" id="manualWalletInput" 
                       placeholder="So1ABC123...XYZ" 
                       style="width: 100%; padding: 12px; margin-bottom: 15px;
                              background: rgba(255,255,255,0.1); border: 1px solid var(--border-color);
                              border-radius: 8px; color: white; font-family: monospace;">
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelManual" style="padding: 10px 20px; background: rgba(255,255,255,0.1);
                            border: 1px solid var(--border-color); border-radius: 8px; color: white; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="submitManual" style="padding: 10px 30px; background: var(--primary);
                            border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold;">
                        Connect
                    </button>
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            const input = modalContent.querySelector('#manualWalletInput');
            const cancelBtn = modalContent.querySelector('#cancelManual');
            const submitBtn = modalContent.querySelector('#submitManual');
            
            input.focus();
            
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                reject(new Error('Manual connection cancelled'));
            };
            
            submitBtn.onclick = () => {
                const address = input.value.trim();
                
                if (!address) {
                    alert('Please enter a wallet address');
                    return;
                }
                
                if (!PostgresApiService.validateSolanaAddress(address)) {
                    alert('Invalid Solana address. Please enter a valid 44-character address.');
                    return;
                }
                
                document.body.removeChild(modal);
                resolve(address);
            };
            
            // Allow Enter key to submit
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    submitBtn.click();
                }
            };
            
            // Close on Escape
            modal.onkeydown = (e) => {
                if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            };
            
            // Close on background click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cancelBtn.click();
                }
            };
        });
    },

    extractPublicKey(response) {
        if (!response) return null;
        
        if (response.publicKey) {
            return response.publicKey.toString();
        }
        if (typeof response === 'string' && response.length === 44) {
            return response;
        }
        if (Array.isArray(response) && response.length > 0) {
            return response[0];
        }
        if (response.result && response.result.publicKey) {
            return response.result.publicKey.toString();
        }
        
        return null;
    },

    hashAddress(address) {
        // Simple hash for analytics (not reversible)
        let hash = 0;
        for (let i = 0; i < address.length; i++) {
            const char = address.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    },

    handleWalletError(walletType, error) {
        let message = error.message || 'Unknown connection error';
        
        // User-friendly error messages
        const errorMessages = {
            'not detected': `Please install the ${walletType} extension.`,
            'rejected': 'Connection request was cancelled.',
            'already processing': 'Another connection request is in progress.',
            'invalid': 'Invalid wallet address provided.',
            'unavailable': 'Wallet is not available or not unlocked.',
            'network': 'Network error. Please check your connection.'
        };
        
        for (const [key, friendlyMessage] of Object.entries(errorMessages)) {
            if (message.toLowerCase().includes(key)) {
                message = friendlyMessage;
                break;
            }
        }
        
        UI.showNotification(`❌ ${message}`, 'error');
        
        // Offer installation link for missing wallets
        if (message.includes('install')) {
            this.offerInstallation(walletType);
        }
    },

    offerInstallation(walletType) {
        const installLinks = {
            phantom: 'https://phantom.app/download',
            solflare: 'https://solflare.com/download',
            backpack: 'https://backpack.app/download'
        };
        
        if (installLinks[walletType]) {
            setTimeout(() => {
                if (confirm(`Would you like to install ${walletType} now?`)) {
                    window.open(installLinks[walletType], '_blank', 'noopener,noreferrer');
                }
            }, 1500);
        }
    }
};

// ============================================================================
// UI SERVICE (Professional Interface)
// ============================================================================

const UI = {
    // ========== NOTIFICATIONS ==========
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (!notification || !notificationText) return;
        
        // Clear previous notifications
        notification.className = 'notification';
        
        // Set content
        notificationText.innerHTML = this.getNotificationIcon(type) + ' ' + message;
        notification.classList.add('show', type);
        
        // Auto-dismiss
        setTimeout(() => {
            notification.classList.remove('show');
        }, type === 'error' ? 6000 : 4000);
    },
    
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    },
    
    // ========== STATS DISPLAY ==========
    updateStats(data) {
        if (!data) return;
        
        const participants = data.totalParticipants || 0;
        const tokensReserved = data.tokensReserved || 0;
        const daysToLaunch = data.daysToLaunch || 14;
        const participantsToday = data.participantsToday || 0;
        const trend = data.trend || 'up';
        
        // Update counters with animation
        this.animateCounter('totalParticipants', participants);
        this.animateCounter('tokensReserved', tokensReserved);
        this.animateCounter('tokensRemaining', CONFIG.TOTAL_TOKENS - tokensReserved);
        
        document.getElementById('daysToLaunch').textContent = daysToLaunch;
        
        // Update trend
        const trendElement = document.getElementById('participantsTrend');
        if (trendElement) {
            const trendIcon = trend === 'up' ? '↗️' : '↘️';
            trendElement.innerHTML = `${trendIcon} <span>+${participantsToday} today</span>`;
        }
        
        // Update progress bars
        const reservedPercentage = Math.min((tokensReserved / CONFIG.TOTAL_TOKENS) * 100, 100);
        const participantsPercentage = Math.min((participants / CONFIG.MAX_PARTICIPANTS) * 100, 100);
        
        this.setStyle('reservedProgress', 'width', `${reservedPercentage}%`);
        this.setText('reservedPercentage', `${reservedPercentage.toFixed(1)}%`);
        this.setStyle('progressFill', 'width', `${participantsPercentage}%`);
        
        // Update remaining slots
        const remainingSlots = CONFIG.MAX_PARTICIPANTS - participants;
        this.setText('remainingSlots', `${remainingSlots.toLocaleString()} slots remaining`);
        
        // Show/hide limit warning
        this.updateLimitWarning(participantsPercentage);
    },
    
    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = this.parseNumber(element.textContent);
        const duration = 1000; // 1 second
        const startTime = Date.now();
        const startValue = currentValue;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
            
            element.textContent = this.formatNumber(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = this.formatNumber(targetValue);
            }
        };
        
        animate();
    },
    
    parseNumber(text) {
        const num = parseFloat(text.replace(/[^\d.]/g, ''));
        if (text.includes('M')) return num * 1000000;
        if (text.includes('K')) return num * 1000;
        return num || 0;
    },
    
    updateLimitWarning(percentage) {
        const limitElement = document.getElementById('airdropLimit');
        if (!limitElement) return;
        
        if (percentage >= 80) {
            limitElement.style.display = 'block';
            
            let warningText = '';
            let warningColor = '';
            
            if (percentage >= 95) {
                warningText = '🚨 FINAL SLOTS! Airdrop closing soon';
                warningColor = '#FF6B6B';
            } else if (percentage >= 90) {
                warningText = '⚠️ LIMITED SLOTS! Airdrop almost full';
                warningColor = '#FFD166';
            } else {
                warningText = '📢 Limited availability - Join now';
                warningColor = '#4A90E2';
            }
            
            document.getElementById('limitText').textContent = warningText;
            document.getElementById('limitText').style.color = warningColor;
        } else {
            limitElement.style.display = 'none';
        }
    },
    
    // ========== WALLET UI ==========
    updateWalletUI() {
        if (AppState.walletConnected && AppState.userData) {
            // Show connected state
            this.showElement('walletStatus');
            this.hideElement('walletConnectContainer');
            
            // Update wallet address display
            if (AppState.walletAddress) {
                const shortAddress = `${AppState.walletAddress.substring(0, 6)}...${AppState.walletAddress.substring(AppState.walletAddress.length - 4)}`;
                this.setText('walletAddress', shortAddress);
            }
            
            // Enable wheel
            const spinBtn = document.getElementById('spinBtn');
            if (spinBtn) {
                spinBtn.disabled = false;
                spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> SPIN WHEEL';
            }
            
            // Update wheel result message
            const wheelResult = document.getElementById('wheelResult');
            if (wheelResult) {
                wheelResult.innerHTML = `
                    <p style="color: var(--success);">
                        <i class="fas fa-check-circle"></i> Wallet connected! Spin to win tokens.
                    </p>
                `;
            }
            
            // Show referral section
            this.showElement('referralSection');
            
            // Update referral UI
            this.updateReferralUI();
            
            // Show user stats
            this.updateUserStats();
        }
    },
    
    updateUserStats() {
        if (!AppState.userData) return;
        
        // Update token balance
        const tokensElement = document.getElementById('userTokens');
        if (tokensElement) {
            tokensElement.textContent = `${this.formatNumber(AppState.userData.tokens || 1000)} $REGRET`;
        }
        
        // Update referral count
        const referralsElement = document.getElementById('referralCount');
        if (referralsElement) {
            referralsElement.textContent = AppState.userData.referralCount || 0;
        }
        
        // Update earnings
        const earningsElement = document.getElementById('referralEarnings');
        if (earningsElement) {
            const earnings = (AppState.userData.referralCount || 0) * CONFIG.REFERRAL_BONUS;
            earningsElement.textContent = `${this.formatNumber(earnings)} $REGRET`;
        }
    },
    
    updateReferralUI() {
        if (!AppState.userData) return;
        
        const referralSection = document.getElementById('referralSection');
        if (!referralSection) return;
        
        // Generate referral code if needed
        if (!AppState.userData.referralCode) {
            AppState.userData.referralCode = PostgresApiService.generateReferralCode(AppState.walletAddress);
        }
        
        // Update UI
        this.setText('referralCode', AppState.userData.referralCode);
        this.setText('referralCount', AppState.userData.referralCount || 0);
        
        // Update share link
        const shareLink = document.getElementById('shareLink');
        if (shareLink) {
            shareLink.value = `${window.location.origin}?ref=${AppState.userData.referralCode}`;
        }
        
        referralSection.style.display = 'block';
    },
    
    updateWheelResult(prize, color, totalTokens) {
        const wheelResult = document.getElementById('wheelResult');
        if (!wheelResult) return;
        
        const colorMap = {
            '#4A90E2': 'Blue',
            '#00CC88': 'Green',
            '#FFD166': 'Yellow',
            '#9D4EDD': 'Purple',
            '#FF6B6B': 'Red',
            '#4ECDC4': 'Teal'
        };
        
        const colorName = colorMap[color] || '';
        
        wheelResult.innerHTML = `
            <div style="text-align: center;">
                <h3 style="color: ${color}; margin-bottom: 10px; font-size: 1.3rem;">
                    🎉 You won ${this.formatNumber(prize)} $REGRET!
                </h3>
                <p style="color: var(--text-muted); margin-bottom: 5px;">
                    Total balance: <strong>${this.formatNumber(totalTokens)} $REGRET</strong>
                </p>
                ${colorName ? `<small style="color: #888;">Prize color: ${colorName}</small>` : ''}
            </div>
        `;
    },
    
    // ========== UTILITY METHODS ==========
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    },
    
    setText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    },
    
    setStyle(elementId, property, value) {
        const element = document.getElementById(elementId);
        if (element) element.style[property] = value;
    },
    
    showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'block';
    },
    
    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'none';
    },
    
    showSpinner(buttonId, text = 'Processing...') {
        const button = document.getElementById(buttonId);
        if (button) {
            const originalHTML = button.innerHTML;
            button.setAttribute('data-original-html', originalHTML);
            button.innerHTML = `<div class="spinner"></div> ${text}`;
            button.disabled = true;
        }
    },
    
    resetButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            const originalHTML = button.getAttribute('data-original-html') || 
                                button.innerHTML.replace(`<div class="spinner"></div> `, '');
            button.innerHTML = originalHTML;
            button.disabled = false;
        }
    },
    
    createConfetti() {
        const container = document.getElementById('confettiContainer');
        if (!container) return;
        
        const colors = ['#FFD166', '#00CC88', '#4A90E2', '#9D4EDD', '#FF6B6B'];
        const confettiCount = 150;
        
        // Clear previous confetti
        container.innerHTML = '';
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}vw;
                top: -20px;
                width: ${Math.random() * 12 + 6}px;
                height: ${Math.random() * 12 + 6}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confettiRain ${1 + Math.random() * 2}s linear forwards;
                z-index: 9999;
                opacity: ${0.7 + Math.random() * 0.3};
                transform: rotate(${Math.random() * 360}deg);
            `;
            
            container.appendChild(confetti);
            
            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode === container) {
                    container.removeChild(confetti);
                }
            }, 3000);
        }
    }
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

class RegretAirdropApp {
    constructor() {
        this.isInitialized = false;
        this.init();
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing $REGRET Airdrop Professional Edition');
        console.log('📱 Version:', CONFIG.APP_VERSION);
        console.log('🌐 Environment:', AppState.isProduction ? 'Production' : 'Development');
        console.log('🔗 API Base:', CONFIG.API_BASE);
        console.log('💾 Session ID:', AppState.sessionId);
        
        try {
            // Load initial stats
            await this.loadStats();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check for existing connection
            this.checkExistingConnection();
            
            // Setup auto-refresh for stats
            if (AppState.isProduction) {
                setInterval(() => this.loadStats(), 30000); // Every 30 seconds
            }
            
            // Setup activity tracker
            this.setupActivityTracker();
            
            this.isInitialized = true;
            console.log('✅ Application initialized successfully');
            
            // Show welcome notification
            setTimeout(() => {
                UI.showNotification('Welcome to $REGRET Airdrop! Connect your wallet to start.', 'info');
            }, 1000);
            
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            UI.showNotification('Failed to initialize application. Please refresh the page.', 'error');
        }
    }
    
    async loadStats() {
        try {
            const response = await PostgresApiService.getStats();
            
            if (response.success) {
                AppState.stats = response.data;
                UI.updateStats(AppState.stats);
                
                // Store stats locally for offline use
                if (response.localFallback) {
                    console.log('📊 Using local fallback stats');
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    setupEventListeners() {
        // Wallet selection
        document.querySelectorAll('.wallet-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectWallet(option);
            });
            
            option.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.selectWallet(option);
                }
            });
        });
        
        // Connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleWalletConnect();
            });
        }
        
        // Disconnect button
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleWalletDisconnect();
            });
        }
        
        // Spin button
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleWheelSpin();
            });
        }
        
        // Copy referral button
        const copyBtn = document.getElementById('copyReferralBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCopyReferral();
            });
        }
        
        // Share link copy
        const shareBtn = document.querySelector('.share-link button');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCopyShareLink();
            });
        }
    }
    
    selectWallet(option) {
        const walletType = option.dataset.wallet;
        console.log('Selecting wallet:', walletType);
        
        // Update UI
        document.querySelectorAll('.wallet-option').forEach(el => {
            el.classList.remove('selected');
        });
        option.classList.add('selected');
        AppState.selectedWallet = walletType;
        
        // Enable connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.disabled = false;
        }
        
        // Show notification
        UI.showNotification(`Selected: ${walletType.charAt(0).toUpperCase() + walletType.slice(1)}`, 'info');
    }
    
    async handleWalletConnect() {
        if (!AppState.selectedWallet) {
            UI.showNotification('Please select a wallet type first', 'error');
            return;
        }
        
        const connectBtn = document.getElementById('connectBtn');
        UI.showSpinner('connectBtn', 'Connecting...');
        
        try {
            // Connect to wallet
            const walletAddress = await WalletService.connect(AppState.selectedWallet);
            
            if (!walletAddress) {
                throw new Error('Failed to connect wallet');
            }
            
            // Register wallet with Postgres API
            UI.showNotification('Registering wallet...', 'info');
            const registerResult = await PostgresApiService.registerWallet(walletAddress, AppState.selectedWallet);
            
            if (!registerResult.success) {
                throw new Error(registerResult.error || 'Registration failed');
            }
            
            // Update app state
            AppState.walletAddress = walletAddress;
            AppState.walletConnected = true;
            AppState.userData = {
                wallet: walletAddress,
                walletType: AppState.selectedWallet,
                referralCode: registerResult.data.referralCode,
                tokens: registerResult.data.tokens,
                referralCount: 0
            };
            
            // Store in localStorage for auto-reconnect
            localStorage.setItem('regret_wallet', walletAddress);
            localStorage.setItem('regret_wallet_type', AppState.selectedWallet);
            localStorage.setItem('regret_user_data', JSON.stringify(AppState.userData));
            localStorage.setItem('regret_last_connection', new Date().toISOString());
            
            // Load referrals data
            await this.loadReferralsData();
            
            // Update UI
            UI.updateWalletUI();
            
            // Reload stats to reflect new user
            await this.loadStats();
            
            // Show success
            let message = registerResult.data.alreadyRegistered ? 
                'Welcome back! Wallet reconnected.' : 
                '🎉 Wallet connected! You received 1,000 $REGRET.';
                
            UI.showNotification(message, 'success');
            UI.createConfetti();
            
            // Track successful connection
            await PostgresApiService.trackEvent('user_registered', {
                walletType: AppState.selectedWallet,
                referralCode: registerResult.data.referralCode,
                isNewUser: !registerResult.data.alreadyRegistered
            });
            
            console.log('✅ Wallet connected and registered successfully');
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            UI.showNotification(error.message || 'Failed to connect wallet', 'error');
            
            // Track failed connection
            await PostgresApiService.trackEvent('connection_failed', {
                walletType: AppState.selectedWallet,
                error: error.message
            });
            
        } finally {
            UI.resetButton('connectBtn');
        }
    }
    
    async handleWheelSpin() {
        if (!AppState.walletConnected || !AppState.walletAddress) {
            UI.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        const spinBtn = document.getElementById('spinBtn');
        const wheel = document.getElementById('wheel');
        
        UI.showSpinner('spinBtn', 'Spinning...');
        
        try {
            // Call Postgres API to spin wheel
            const spinResult = await PostgresApiService.spinWheel(AppState.walletAddress);
            
            if (!spinResult.success) {
                throw new Error(spinResult.error || 'Spin failed');
            }
            
            // Animate wheel
            if (wheel) {
                const spinDegrees = 1800 + Math.random() * 1800;
                wheel.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
                wheel.style.transform = `rotate(${spinDegrees}deg)`;
            }
            
            // Wait for animation
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Update user data
            if (AppState.userData) {
                AppState.userData.tokens = spinResult.data.totalTokens;
                localStorage.setItem('regret_user_data', JSON.stringify(AppState.userData));
            }
            
            // Update UI
            UI.updateWheelResult(spinResult.data.prize, spinResult.data.color, spinResult.data.totalTokens);
            UI.updateUserStats();
            
            // Show success
            UI.showNotification(`🎊 You won ${spinResult.data.prize} $REGRET!`, 'success');
            UI.createConfetti();
            
            // Disable spin button for 24 hours
            spinBtn.disabled = true;
            spinBtn.innerHTML = '<i class="fas fa-clock"></i> COME BACK TOMORROW';
            
            // Re-enable after 10 seconds (for demo) - in production this would be 24 hours
            setTimeout(() => {
                spinBtn.disabled = false;
                spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> SPIN WHEEL';
            }, 10000);
            
            // Track spin
            await PostgresApiService.trackEvent('wheel_spin', {
                prize: spinResult.data.prize,
                totalTokens: spinResult.data.totalTokens
            });
            
        } catch (error) {
            console.error('Wheel spin error:', error);
            UI.showNotification(error.message || 'Failed to spin wheel', 'error');
            UI.resetButton('spinBtn');
        }
    }
    
    async loadReferralsData() {
        if (!AppState.walletAddress) return;
        
        try {
            const referralsResult = await PostgresApiService.getReferrals(AppState.walletAddress);
            
            if (referralsResult.success && AppState.userData) {
                AppState.userData.referralCount = referralsResult.data.referralCount || 0;
                AppState.userData.referrals = referralsResult.data.referrals || [];
                AppState.userData.referralEarned = referralsResult.data.totalEarned || 0;
                
                UI.updateReferralUI();
                UI.updateUserStats();
            }
        } catch (error) {
            console.error('Error loading referrals:', error);
        }
    }
    
    handleCopyReferral() {
        if (!AppState.userData?.referralCode) {
            UI.showNotification('No referral code available', 'error');
            return;
        }
        
        navigator.clipboard.writeText(AppState.userData.referralCode)
            .then(() => {
                UI.showNotification('Referral code copied to clipboard!', 'success');
                
                // Track copy event
                PostgresApiService.trackEvent('referral_code_copied', {
                    referralCode: AppState.userData.referralCode
                });
            })
            .catch(err => {
                console.error('Copy failed:', err);
                UI.showNotification('Failed to copy. Please copy manually.', 'error');
            });
    }
    
    handleCopyShareLink() {
        const shareLink = document.getElementById('shareLink');
        if (!shareLink) return;
        
        shareLink.select();
        document.execCommand('copy');
        
        UI.showNotification('Share link copied to clipboard!', 'success');
        
        // Track share event
        PostgresApiService.trackEvent('share_link_copied');
    }
    
    handleWalletDisconnect() {
        console.log('Disconnecting wallet...');
        
        // Clear app state
        AppState.walletConnected = false;
        AppState.walletAddress = null;
        AppState.userData = null;
        AppState.selectedWallet = null;
        
        // Clear localStorage
        localStorage.removeItem('regret_wallet');
        localStorage.removeItem('regret_wallet_type');
        localStorage.removeItem('regret_last_connection');
        
        // Update UI
        UI.hideElement('walletStatus');
        UI.showElement('walletConnectContainer');
        UI.hideElement('referralSection');
        
        // Reset wallet selection
        document.querySelectorAll('.wallet-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Disable connect button
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.disabled = true;
        }
        
        // Reset wheel
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.disabled = true;
            spinBtn.innerHTML = '<i class="fas fa-redo-alt"></i> SPIN WHEEL';
        }
        
        const wheelResult = document.getElementById('wheelResult');
        if (wheelResult) {
            wheelResult.innerHTML = '<p style="color: var(--text-muted);"><i class="fas fa-info-circle"></i> Connect your wallet to spin the wheel</p>';
        }
        
        const wheel = document.getElementById('wheel');
        if (wheel) {
            wheel.style.transition = 'none';
            wheel.style.transform = 'rotate(0deg)';
        }
        
        UI.showNotification('Wallet disconnected', 'info');
        
        // Track disconnect
        PostgresApiService.trackEvent('wallet_disconnected');
    }
    
    checkExistingConnection() {
        const savedWallet = localStorage.getItem('regret_wallet');
        const savedWalletType = localStorage.getItem('regret_wallet_type');
        const savedUserData = localStorage.getItem('regret_user_data');
        const lastConnection = localStorage.getItem('regret_last_connection');
        
        if (savedWallet && savedWalletType && savedUserData && lastConnection) {
            try {
                // Check if connection is recent (within 7 days)
                const lastConnectionDate = new Date(lastConnection);
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                
                if (lastConnectionDate > sevenDaysAgo) {
                    console.log('Restoring previous session...');
                    
                    AppState.walletAddress = savedWallet;
                    AppState.selectedWallet = savedWalletType;
                    AppState.walletConnected = true;
                    AppState.userData = JSON.parse(savedUserData);
                    
                    UI.updateWalletUI();
                    UI.showNotification('Welcome back! Session restored.', 'success');
                    
                    // Load fresh data
                    this.loadReferralsData();
                    this.loadStats();
                } else {
                    console.log('Session expired, clearing...');
                    this.handleWalletDisconnect();
                }
            } catch (error) {
                console.error('Error restoring session:', error);
                this.handleWalletDisconnect();
            }
        }
    }
    
    setupActivityTracker() {
        // Track user activity
        ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
            window.addEventListener(event, () => {
                AppState.lastActivity = Date.now();
            });
        });
        
        // Check for inactivity every minute
        setInterval(() => {
            const inactiveTime = Date.now() - AppState.lastActivity;
            const fifteenMinutes = 15 * 60 * 1000;
            
            if (inactiveTime > fifteenMinutes && AppState.walletConnected) {
                console.log('User inactive for 15 minutes');
                // Could add auto-logout here if needed
            }
        }, 60000);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    
    // Initialize app
    window.regretApp = new RegretAirdropApp();
    
    // Export for debugging
    window.AppState = AppState;
    window.PostgresApiService = PostgresApiService;
    window.WalletService = WalletService;
    window.UI = UI;
    
    console.log('🎮 App ready. Open console for debugging.');
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Don't show error notifications for minor errors
    if (!event.error.message.includes('ResizeObserver') && 
        !event.error.message.includes('fetch')) {
        UI.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

// Network status monitoring
window.addEventListener('online', () => {
    console.log('🌐 Network connection restored');
    UI.showNotification('Back online!', 'success');
});

window.addEventListener('offline', () => {
    console.log('🌐 Network connection lost');
    UI.showNotification('You are offline. Some features may not work.', 'warning');
});

// Service Worker registration (for PWA)
if ('serviceWorker' in navigator && AppState.isProduction) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('ServiceWorker registration failed:', err);
        });
    });
}

// Export debug function
window.debugApp = () => {
    console.log('=== DEBUG INFO ===');
    console.log('AppState:', AppState);
    console.log('Local Storage:', {
        wallet: localStorage.getItem('regret_wallet'),
        userData: localStorage.getItem('regret_user_data'),
        lastConnection: localStorage.getItem('regret_last_connection')
    });
    console.log('Wallets:', {
        phantom: window.solana?.isPhantom,
        solflare: !!window.solflare,
        backpack: !!window.backpack
    });
    console.log('==================');
};