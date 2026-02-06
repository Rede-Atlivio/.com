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

// ============================================================================
// 5. SISTEMA DE NAVEGAÇÃO (TAB SYSTEM V10.0 - A PEÇA QUE FALTA)
// ============================================================================
window.switchTab = function(tabName) {
    console.log("👉 Trocando para aba:", tabName);

    // 1. Esconde todas as seções
    document.querySelectorAll('main > section').forEach(el => {
        el.classList.add('hidden');
    });

    // 2. Mostra a seção alvo
    const alvo = document.getElementById(`sec-${tabName}`);
    if(alvo) {
        alvo.classList.remove('hidden');
    }

    // 3. Atualiza os botões do menu (Visual)
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-900', 'active');
        btn.classList.add('border-transparent', 'text-gray-400');
    });

    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.add('border-blue-600', 'text-blue-900', 'active');
    }

    // 4. 🔥 GATILHOS DE CARREGAMENTO E PROTEÇÃO DO RADAR
    if(tabName === 'servicos') {
        if(window.carregarServicos) window.carregarServicos();
        
        // Se entrar na aba de serviços, garante que o Radar V12 não seja limpo por "lixo"
        const toggle = document.getElementById('online-toggle');
        if(toggle && toggle.checked && window.iniciarRadarPrestador) {
            window.iniciarRadarPrestador();
        }
    }
    
    if(tabName === 'empregos' && window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
    if(tabName === 'loja' && window.carregarProdutos) window.carregarProdutos();
    if(tabName === 'ganhar' && window.carregarCarteira) window.carregarCarteira();
    if(tabName === 'chat' && window.carregarChat) window.carregarChat();
};
window.switchServiceSubTab = function(subTab) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const el = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`subtab-${t}-btn`);
        if(el) el.classList.add('hidden');
        if(btn) btn.classList.remove('active');
    });
    const target = document.getElementById(`view-${subTab}`);
    const targetBtn = document.getElementById(`subtab-${subTab}-btn`);
    if(target) target.classList.remove('hidden');
    if(targetBtn) targetBtn.classList.add('active');
};

window.switchProviderSubTab = function(subTab) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const el = document.getElementById(`pview-${t}`);
        const btn = document.getElementById(`ptab-${t}-btn`);
        if(el) el.classList.add('hidden');
        if(btn) btn.classList.remove('active');
    });
    const target = document.getElementById(`pview-${subTab}`);
    const targetBtn = document.getElementById(`ptab-${subTab}-btn`);
    if(target) target.classList.remove('hidden');
    if(targetBtn) targetBtn.classList.add('active');
};

console.log("✅ App Carregado: Sistema Híbrido Online.");

// 6. MONITORAMENTO DE LOGIN (O CÉREBRO BLINDADO V10.0)

// Função Global para organizar o carregamento de dados (Mata o erro de undefined)
window.carregarInterface = async (user) => {
    console.log("🚀 Inicializando Interface V12 para:", user.uid);
    
    // Alterna visibilidade das telas principais
    document.getElementById('auth-container')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    // 1. Inicializa o Chat
    if (typeof window.carregarChat === 'function') {
        window.carregarChat();
    }

    // 2. Inicializa o Radar V12 (O Coração do Prestador)
    // Usamos setTimeout para garantir que o DOM do radar-container já foi montado
    setTimeout(() => {
        if (typeof window.iniciarRadarPrestador === 'function') {
            const toggle = document.getElementById('online-toggle');
            if (toggle && toggle.checked) {
                window.iniciarRadarPrestador(user.uid);
            }
        }
    }, 1000);
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
