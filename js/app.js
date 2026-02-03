import { app, auth, db, storage, provider } from './config.js';
// ============================================================================
// 4. CARREGAMENTO DOS MÓDULOS (Agora é seguro importar)
// ============================================================================
import './auth.js';
import './modules/auth_sms.js';
import './modules/services.js';
import './modules/jobs.js';
import './modules/opportunities.js';
import './modules/chat.js';
import './modules/reviews.js';

// Importa a carteira e extrai a função de monitoramento
import { iniciarMonitoramentoCarteira } from './modules/wallet.js';

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';
import './modules/user_notifications.js';

window.abrirConfiguracoes = abrirConfiguracoes;

console.log("✅ App Carregado: Sistema Híbrido Online.");

// Inicia CRM
if(iniciarSistemaNotificacoes) iniciarSistemaNotificacoes(); 

// 5. MONITORAMENTO DE LOGIN (O CÉREBRO BLINDADO)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // 🛡️ TRAVA DE SEGURANÇA: Verifica banimento antes de mostrar o app
        if (window.verificarSentenca) {
            const banido = await window.verificarSentenca(user.uid);
            if (banido) return; // Para tudo aqui se estiver banido
        }

        console.log("👤 Usuário online:", user.uid);
        
        // Inicia sistemas dependentes de usuário
        checkOnboarding(user); 
        
        // Inicia monitoramento da carteira
        if(iniciarMonitoramentoCarteira) iniciarMonitoramentoCarteira();
        
        // Alterna telas
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
        
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('hidden');
    }
});
