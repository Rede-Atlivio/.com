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
import { iniciarSistemaNotificacoes } from './modules/user_notifications.js';

window.abrirConfiguracoes = abrirConfiguracoes;

console.log("✅ App Carregado: Sistema Híbrido Online.");

// Inicia CRM
if(iniciarSistemaNotificacoes) iniciarSistemaNotificacoes(); 

// 5. MONITORAMENTO DE LOGIN (O CÉREBRO)
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário online:", user.uid);
        
        // Inicia sistemas dependentes de usuário
        checkOnboarding(user); 
        
        // ✅ AQUI é o lugar certo para iniciar a carteira
        if(iniciarMonitoramentoCarteira) iniciarMonitoramentoCarteira();
        
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
        
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('hidden');
    }
});
