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

// 5. MONITORAMENTO DE LOGIN (O CÉREBRO BLINDADO V10.0)

// Função Global para organizar o carregamento de dados (Mata o erro de undefined)
window.carregarInterface = async (user) => {
    // Alterna telas
    const loginScreen = document.getElementById('auth-container');
    if(loginScreen) loginScreen.classList.add('hidden');
    
    const appContainer = document.getElementById('app-container');
    if(appContainer) appContainer.classList.remove('hidden');

    // 🚀 Carregamento de Módulos de Dados
    // Carrega chats e pedidos ativos para o Prestador/Cliente
    if (typeof window.carregarChat === 'function') {
        window.carregarChat();
    }

    // Carrega o Radar de Pedidos Pendentes
    if (typeof window.atualizarRadar === 'function') {
        window.atualizarRadar();
    }
};

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // 🛡️ TRAVA DE SEGURANÇA: Verifica banimento antes de mostrar o app
        if (window.verificarSentenca) {
            const banido = await window.verificarSentenca(user.uid);
            if (banido) return; // Para tudo aqui se estiver banido
        }

        console.log("👤 Usuário online:", user.uid);

        // --- 🔔 ATIVAÇÃO DO CRM DE NOTIFICAÇÕES ---
        if (typeof window.iniciarSistemaNotificacoes === 'function') {
            try {
                window.iniciarSistemaNotificacoes();
            } catch (err) {
                console.error("Erro ao iniciar notificações:", err);
            }
        }
        // ------------------------------------------

        // Inicia sistemas dependentes de usuário
        checkOnboarding(user); 
        
        // Inicia monitoramento da carteira
        if(iniciarMonitoramentoCarteira) iniciarMonitoramentoCarteira();
        
        // Chama a interface unificada (Ação que resolve o seu problema)
        window.carregarInterface(user);
    } else {
        // Garantia de reset caso deslogue
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
    }
});
