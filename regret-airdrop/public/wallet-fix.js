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
