// Fix específico para Solflare
if (window.solflare && !window.solflare.connect) {
    console.log('Aplicando fix para Solflare legacy...');

    // Agregar método connect si no existe
    if (!window.solflare.connect) {
        window.solflare.connect = async () => {
            try {
                // Método alternativo para Solflare antiguo
                if (window.solflare._solflareWeb3 && window.solflare._solflareWeb3.connect) {
                    return await window.solflare._solflareWeb3.connect();
                }

                // Otro intento
                if (window.solflare.publicKey) {
                    return { publicKey: window.solflare.publicKey };
                }

                throw new Error('No se pudo conectar a Solflare');
            } catch (error) {
                console.error('Error en fix Solflare:', error);
                throw error;
            }
        };
    }
}

// Fix específico para Backpack
if (window.backpack && !window.backpack.connect) {
    console.log('Aplicando fix para Backpack legacy...');

    // Agregar método connect si no existe
    if (!window.backpack.connect) {
        window.backpack.connect = async () => {
            try {
                // Método alternativo para Backpack antiguo
                if (window.backpack._backpackWeb3 && window.backpack._backpackWeb3.connect) {
                    return await window.backpack._backpackWeb3.connect();
                }

                // Otro intento
                if (window.backpack.publicKey) {
                    return { publicKey: window.backpack.publicKey };
                }

                throw new Error('No se pudo conectar a Backpack');
            } catch (error) {
                console.error('Error en fix Backpack:', error);
                throw error;
            }
        };
    }
}

// Fix para MetaMask con Solana
if (window.ethereum?.isMetaMask) {
    // Verificar si tiene el snap de Solana
    window.checkSolanaSnap = async () => {
        try {
            const snaps = await window.ethereum.request({
                method: 'wallet_getSnaps'
            });
            
            if (snaps['npm:@solana/snap']?.enabled) {
                console.log('Snap de Solana disponible en MetaMask');
                return true;
            }
            return false;
        } catch (error) {
            console.log('Snap de Solana no disponible');
            return false;
        }
    };
}

// Detectar wallets automáticamente
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔍 Detección automática de wallets completada');
        
        // Verificar Phantom
        if (window.solana && window.solana.isPhantom) {
            console.log('✅ Phantom detectada');
        }
        
        // Verificar Solflare
        if (window.solflare) {
            console.log('✅ Solflare detectada');
        }
        
        // Verificar Backpack
        if (window.backpack) {
            console.log('✅ Backpack detectada');
        }
    }, 1000);
});