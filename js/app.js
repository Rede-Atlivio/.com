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

    // 4. 🔥 GATILHOS DE CARREGAMENTO (Saneados)
    if(tabName === 'servicos') {
        if(window.carregarServicos) window.carregarServicos();
        
        // Proteção do Radar V12
        const toggle = document.getElementById('online-toggle');
        // Apenas religa se estiver marcado E a memória disser que está desligado
        if(toggle && toggle.checked && !window.radarIniciado && window.iniciarRadarPrestador) {
            window.iniciarRadarPrestador();
        }
    }
    
    if(tabName === 'empregos' && window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
    if(tabName === 'loja' && window.carregarProdutos) window.carregarProdutos();
    if(tabName === 'ganhar' && window.carregarCarteira) window.carregarCarteira();
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

// ============================================================================
// 6. MONITORAMENTO DE LOGIN E CONTROLE DO RADAR (CORREÇÃO VITAL)
// ============================================================================

window.carregarInterface = async (user) => {
    console.log("🚀 Inicializando Interface V12 para:", user.uid);
    
    // Alterna visibilidade das telas principais
    document.getElementById('auth-container')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    // --- 🛑 AQUI ESTAVA FALTANDO O LISTENER DO BOTÃO! ---
    const toggle = document.getElementById('online-toggle');
    if (toggle) {
        // Remove clones anteriores para evitar duplicação de eventos
        const novoToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(novoToggle, toggle);

        novoToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                console.log("🟢 [UI] Botão ativado manualmente. Iniciando Radar...");
                // Reseta a memória para garantir que a função rode
                window.radarIniciado = false; 
                if (window.iniciarRadarPrestador) window.iniciarRadarPrestador(user.uid);
          } else {
                console.log("🔴 [UI] Botão desativado manualmente. Parando Radar...");
                if (window.pararRadarFisico) window.pararRadarFisico();
                if (window.garantirContainerRadar) window.garantirContainerRadar();
            }  
        });

       // Inicializa estado atual
if (novoToggle.checked) {
    setTimeout(() => {
        if (window.iniciarRadarPrestador) window.iniciarRadarPrestador(user.uid);
    }, 1000);
} else {
    // 🔥 CORREÇÃO: Se nascer desligado, mostra a tela de "Dormindo" imediatamente
    setTimeout(() => {
        if (window.pararRadarFisico) window.pararRadarFisico();
    }, 500);
}
    }
    // ----------------------------------------------------
};

auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("🔐 Autenticado com Sucesso V12");

        // 🛡️ Trava de Segurança Antecipada
        if (window.verificarSentenca) {
            const banido = await window.verificarSentenca(user.uid);
            if (banido) return; 
        }

        // 🔔 CRM de Notificações
        if (typeof window.iniciarSistemaNotificacoes === 'function') {
            window.iniciarSistemaNotificacoes();
        }

        // 🎁 Fluxos de Boas-vindas
        if (typeof checkOnboarding === 'function') {
            checkOnboarding(user); 
        }
        
        // 💰 Monitoramento Financeiro
        if (typeof iniciarMonitoramentoCarteira === 'function') {
            iniciarMonitoramentoCarteira();
        }
        
        // 🖥️ Montagem da Interface
        window.carregarInterface(user);

    } else {
        console.log("🚪 Usuário Desconectado.");
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
        
        // Desliga o Radar fisicamente
        if (window.pararRadarFisico) window.pararRadarFisico();
    }
});
