// 🛰️ IDENTIDADE ATLIVIO V60
// Garante que o navegador saiba exatamente qual versão do motor está rodando.
localStorage.setItem('atlivio_version', '2026_V60');
// 🔗 [V2026] RECEPTOR DE INDICAÇÃO BLINDADO
// 🔗 [V2026] RECEPTOR DE INDICAÇÃO BLINDADO (SOLDA DUPLA)
(function capturarPadrinhoURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refID = urlParams.get('ref');
    if (refID) {
        // Gil, salvamos nos dois para garantir que o Auth ache mesmo após recarregar
        sessionStorage.setItem('atlivio_ref', refID);
        localStorage.setItem('atlivio_ref_backup', refID); 
        console.log("%c🔗 [Indicação] Padrinho soldado com sucesso: " + refID, "color: #8b5cf6; font-weight: bold;");
    }
})();
// ============================================================================

// ============================================================================
// 🛰️ MOTOR DE SINCRONIZAÇÃO PWA (AUTO-UPDATE)
// ============================================================================
// 🛰️ MOTOR DE SINCRONIZAÇÃO DUPLO (PWA + NOTIFICAÇÕES)
// Essencial para escala de milhões: registra o cache e a antena separadamente.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // 1. Registro do Escudo (Cache e Offline)
            const regSw = await navigator.serviceWorker.register('./sw.js');
            console.log("🛡️ Escudo de Cache: Ativo");

            // 2. Registro da Antena (O rádio que ouve o Google FCM)
            // Sem esta linha, o Google dá o erro "Requested entity was not found"
            const regMsg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            console.log("📡 Antena de Notificações: Sintonizada");

            // ✨ SISTEMA ANTI-LOOP V26: Atualiza o App em segundo plano
            regSw.onupdatefound = () => {
                const worker = regSw.installing;
                worker.onstatechange = () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log("📥 Atlívio Atualizada: O novo motor será ativado no próximo login.");
                    }
                };
            };
        } catch (err) {
            console.error('❌ Falha Crítica no Motor PWA:', err);
        }
    });
}
// ============================================================================
import { app, auth, db, storage, provider } from './config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * 🛰️ MONITOR DE DEPLOY V26 (Blindado)
 * Esta função vigia ordens de limpeza global enviadas pelo Admin.
 * Encapsulada para evitar erros de permissão antes do login.
 */
window.iniciarMonitorDeploy = function() {
    onSnapshot(doc(db, "settings", "deploy"), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            const ultimaOrdem = data.force_reset_timestamp?.toMillis() || 0;
            const ordemLocal = localStorage.getItem('last_force_reset') || 0;

            if (ultimaOrdem > ordemLocal) {
                console.log("🧹 ORDEM DO ADMIN: Executando limpeza de cache...");
                localStorage.setItem('last_force_reset', ultimaOrdem);
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        for(let reg of regs) reg.unregister();
                    });
                }
                caches.keys().then(names => {
                    for (let name of names) caches.delete(name);
                }).then(() => {
                    location.reload(true);
                });
            }
        }
    }, (err) => console.warn("🛰️ Radar Deploy: Aguardando sinal do Admin..."));
};

// ============================================================================

// ============================================================================
// 4. CARREGAMENTO DOS MÓDULOS (Agora é seguro importar)
// ============================================================================
import './auth.js';
import './modules/auth_sms.js';
import './modules/services.js';
import './modules/jobs.js';
import './modules/missions.js'; // 🚀 NOVO: Suporte ao motor de Micro Tarefas e Atlas Vivo
import './modules/opportunities.js';
import './modules/chat.js';
import './modules/reviews.js';
import './modules/atlas_b2b.js'; // 🛰️ IMPORTANTE: Adiciona o Gerente da Inteligência Atlas
// Importa a carteira e extrai a função de monitoramento
import { iniciarMonitoramentoCarteira } from './modules/wallet.js';

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';
import './modules/user_notifications.js';
import './modules/products.js'; // 🚀 SOLDA V2026: Importando o motor da loja

window.abrirConfiguracoes = abrirConfiguracoes;

// 🛡️ MAESTRO V127: Flag de controle e Motor Universal de Engajamento
window.atlivioBootConcluido = false;

/**
 * 🛰️ MOTOR MAESTRO UNIVERSAL (V127)
 * Esta é a Torre de Controle que fala com o usuário baseado em quem ele é.
 * @param {string} origem - De onde vem o alerta (chat, jobs, missions, etc)
 * @param {object} dados - { id, type, msgPrestador, msgCliente, linkPrestador, linkCliente }
 */
window.maestroUniversal = function(origem, dados) {
    // 🛡️ Verifica se a função visual de balão existe para não quebrar o código
    if (!window.mostrarBarraNotificacao) return;

    // 🕵️ Identifica se o usuário atual é um Prestador (quem trabalha)
    const isP = window.userProfile?.is_provider === true;

    // 🏗️ Monta a configuração baseada na Identidade (Bipolaridade do Maestro)
    const configMaestro = {
        type: dados.type || 'marketing', // Ícone do balão (chat, alert, gift, etc)
        // Escolhe a mensagem certa para o público certo
        message: isP ? (dados.msgPrestador || dados.message) : (dados.msgCliente || dados.message),
        // Escolhe o destino certo baseado na aba que o usuário deve ir
        action: isP ? (dados.linkPrestador || dados.action) : (dados.linkCliente || dados.action)
    };

    // 🚀 Dispara o balão na tela com o ID único para evitar duplicação
    window.mostrarBarraNotificacao(dados.id || `maestro_${origem}_${Date.now()}`, configMaestro);
    
    console.log(`📡 [Maestro Universal] Disparo efetuado via: ${origem} | Alvo: ${isP ? 'Prestador' : 'Cliente'}`);
};
window.abaAtual = 'home';

// 🩹 POLYFILL IMEDIATO: Protege o sistema ANTES de carregar os módulos
window.addEventListener('userProfileLoaded', (e) => {
    window.userProfile = e.detail;
    // 🛡️ [V2026] Blindagem de Posse: Garante que o sistema não trave se o cofre estiver vazio
    if (window.userProfile && !window.userProfile.my_vault) {
        window.userProfile.my_vault = [];
    }
    if (window.userProfile) {
        Object.defineProperty(window.userProfile, 'saldo', {
            get: function() { return this.wallet_balance || 0; },
            configurable: true
        });
        console.log("✅ Polyfill de Saldo injetado via Evento.");
    }
});
// ============================================================================
// 5. SISTEMA DE NAVEGAÇÃO (TAB SYSTEM V10.0 - COM CONSCIÊNCIA CONTEXTUAL)
// ============================================================================
function switchTab(tabName, isAutoBoot = false) {
 // ✨ V153: Sincronia de Histórico - Abre o Sininho sem apagar as mensagens
    if (tabName === 'notificacoes') {
        // 🛰️ V157: Avisa ao banco e ao navegador que o usuário limpou o Sininho AGORA
    const badge = document.getElementById('badge-notificacao') || document.getElementById('notif-badge');
    if (badge) badge.classList.add('hidden');

    // Grava a hora da limpeza no Navegador e no Banco
    const agora = Date.now();
    localStorage.setItem('maestro_last_sync', agora);
    
    // Atualiza o perfil do usuário no Firestore para o Maestro saber que ele está "em dia"
    const { doc, updateDoc } = window.firebaseModules;
    updateDoc(doc(window.db, "usuarios", auth.currentUser.uid), {
        last_notif_read: agora // Nova trava de segurança no banco
    }).catch(e => console.warn("Erro ao atualizar trava de leitura."));
        // 2. Carrega as mensagens do histórico para o usuário ver
        if (typeof window.carregarHistoricoNotificacoes === 'function') {
            window.carregarHistoricoNotificacoes();
        } else {
            console.warn("⚠️ Motor de Histórico não carregado.");
        }
    }

    // 🛡️ TRAVA DE SEGURANÇA: Impede que processos automáticos (AutoBoot) atropelem o sistema.
    if (isAutoBoot && window.atlivioBootConcluido) return;

    // 🗺️ MAPA MAESTRO V30: Sincronia Total (Novo + Legado Admin)
    const mapa = { 
        'home': 'home',
        'servicos': 'servicos', 'services': 'servicos', 'contratar': 'servicos',
        'empregos': 'empregos', 'jobs': 'empregos', 'vaga': 'empregos',
        'extra': 'missoes', 'missoes': 'missoes', 'tarefas': 'missoes', // 🎯 Rota unificada para Atlas Vivo
        'oportunidades': 'oportunidades',
        'produtos': 'loja', 'loja': 'loja', 'marketing': 'loja',
        'chat': 'servicos', // 💬 Redireciona o chat para Serviços para evitar a tela branca da sec-chat
        'canal': 'canal', 'tutorials': 'canal',
        'wallet_balance': 'ganhar', 'wallet': 'ganhar', 'ganhar': 'ganhar'
    };

    const nomeLimpo = mapa[tabName] || tabName;
    const perfil = window.userProfile;
    const isPrestador = perfil?.is_provider || false;

    // 🛡️ TRAVA DE SEGURANÇA POR PERFIL (Baseado no seu novo mapa)
    const requerPrestador = ['servicos', 'empregos', 'missoes', 'extra'].includes(tabName) && !['contratar', 'vaga'].includes(tabName);
    // 🛍️ EXPLORAÇÃO LIVRE: 'loja' e 'produtos' foram removidos da trava para acesso universal
    const requerCliente = ['contratar', 'vaga'].includes(tabName);

   // 🛡️ NAVEGAÇÃO LIVRE: O Maestro agora permite a transição entre abas sem forçar troca de perfil.
    if ((requerPrestador && !isPrestador) || (requerCliente && isPrestador)) {
        console.log("ℹ️ [Maestro] Navegação cross-profile permitida.");
    }

    console.log("👉 [Navegação] Solicitada:", tabName, "──▶ Ativando:", nomeLimpo);
    // 📍 REGISTRO CONTEXTUAL FINAL: Memoriza a aba ativa saneada para o sistema de notificações
    window.abaAtual = nomeLimpo;

    // 🧹 LIMPEZA TOTAL
    document.querySelectorAll('main > section').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });

    const alvo = document.getElementById(`sec-${nomeLimpo}`);
    if(alvo) {
        alvo.classList.remove('hidden');
        alvo.style.display = 'block';
    } else {
        console.warn("⚠️ [Maestro] Seção não localizada: sec-" + nomeLimpo);
    }

    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tabName}`) || document.getElementById(`tab-${nomeLimpo}`);
    if(activeBtn) activeBtn.classList.add('active');

    window.registrarEventoMaestro({ tipo: "navegacao", aba: tabName });

    // ⚡ CARREGAMENTO DE MÓDULOS (Sincronizado com nomeLimpo)
    if(nomeLimpo === 'home') {
        const homeContent = document.getElementById('home-content');
        if(homeContent && homeContent.innerHTML.includes('Sincronizando')) {
            if(window.renderizarTourBoasVindas) window.renderizarTourBoasVindas();
        }
    }
    if(nomeLimpo === 'servicos') {
        if(window.carregarServicos) window.carregarServicos();
        if(tabName === 'contratar') setTimeout(() => { if(window.switchServiceSubTab) window.switchServiceSubTab('contratar'); }, 100);
    }
    if(nomeLimpo === 'empregos') {
        if(window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
    }
    if(nomeLimpo === 'loja' && window.carregarProdutos) window.carregarProdutos();
    if(nomeLimpo === 'ganhar') {
        if(window.carregarCarteira) window.carregarCarteira();
    }
    // 🌍 GATILHO ATLAS VIVO: Se o usuário entrar em Missões, ligamos o radar e o histórico
    if(nomeLimpo === 'missoes') {
        if(window.carregarMissoes) window.carregarMissoes(); 
        if(window.carregarMissoesRealizadas) window.carregarMissoesRealizadas(); // 🚀 Carrega os comprovantes
        console.log("🛰️ Atlas Vivo: Radar e Histórico sincronizados.");
    }
    if(nomeLimpo === 'oportunidades' && window.carregarOportunidades) window.carregarOportunidades();
    
    // 💼 GATILHO B2B: Se o destino for Gestão Atlas, ligamos o motor executivo
    if(nomeLimpo === 'b2b_gestao') {
        if(window.initB2B) {
            window.initB2B();
        } else {
            console.warn("⚠️ Motor B2B não carregado. Verifique o import no topo do app.js");
        }
    }

    if(nomeLimpo === 'canal') {
        // Apenas esconde o modal, sem disparar switchTab novamente
        const modal = document.getElementById('modal-trava-perfil');
        if (modal) modal.classList.add('hidden'); 
        
        import('./modules/canal.js?v=' + Date.now())
            .then(m => { if(m.init) m.init(); })
            .catch(e => console.error("Erro ao carregar módulo canal:", e));
         }
       }

function switchServiceSubTab(subTab) {
    console.log("🔍 Sub-aba Cliente:", subTab);
    
    // 🛡️ LISTA DE SEGURANÇA: Esconde tudo antes de mostrar a nova
    const views = ['contratar', 'andamento', 'historico'];
    const subContainers = ['meus-pedidos-andamento', 'meus-pedidos-historico'];

    views.forEach(t => {
        const el = document.getElementById(`view-${t}`);
        const btn = document.getElementById(`subtab-${t}-btn`);
        if(el) el.classList.add('hidden');
        if(btn) btn.classList.remove('active');
    });

    // Mostra apenas o alvo
    const target = document.getElementById(`view-${subTab}`);
    const targetBtn = document.getElementById(`subtab-${subTab}-btn`);
    if(target) target.classList.remove('hidden');
    if(targetBtn) targetBtn.classList.add('active');
    
    // 🧹 LIMPEZA DE VAZAMENTO: Se não for a aba dela, garante que o container interno suma
    subContainers.forEach(id => {
        const container = document.getElementById(id);
        if(container) {
            // Se a aba atual NÃO for a dona do container, esconde o conteúdo interno
            const dono = id.includes(subTab);
            container.style.display = dono ? 'block' : 'none';
        }
    });

    if(subTab === 'andamento' && window.carregarPedidosAtivos) window.carregarPedidosAtivos();
    if(subTab === 'historico' && window.carregarHistorico) window.carregarHistorico();
}

function switchProviderSubTab(subTab) {
    console.log("🔍 Sub-aba Prestador:", subTab);
    ['radar', 'ativos', 'historico'].forEach(t => {
        const el = document.getElementById(`pview-${t}`);
        const btn = document.getElementById(`ptab-${t}-btn`);
        if(el && t !== subTab) el.classList.add('hidden');
        if(btn) btn.classList.toggle('active', t === subTab);
    });
    const target = document.getElementById(`pview-${subTab}`);
    if(target) target.classList.remove('hidden');

    if(subTab === 'ativos' && window.carregarPedidosPrestador) window.carregarPedidosPrestador();
    if(subTab === 'historico' && window.carregarHistoricoPrestador) window.carregarHistoricoPrestador();
}
console.log("✅ App Carregado: Sistema Híbrido Online.");

// ============================================================================
// 6. MONITORAMENTO DE LOGIN E CONTROLE DO RADAR (CORREÇÃO VITAL)
// ============================================================================

async function carregarInterface(user) {
    // 🔥 Bloqueia se o Maestro já deu o sinal verde (Garante carga única e evita loops)
    if (window.atlivioBootConcluido) return;
    window.atlivioBootConcluido = true;

   console.log("🚀 [Maestro] Inicialização Única para:", user.uid);

    // 🛰️ V180: IGNIÇÃO FINAL DO RÁDIO (FCM)
    // Usamos o motor original com um delay estratégico para evitar conflitos de permissão.
    // A trava 'radioSoldado' impede que o sistema tente soldar o token várias vezes.
    if (!window.radioSoldadoNestaSessao) {
        window.radioSoldadoNestaSessao = true;
        setTimeout(() => {
            if (typeof window.capturarEnderecoNotificacao === 'function') {
                console.log("🛰️ [Antena] Solicitando endereço digital (FCM) via App Flow...");
                window.capturarEnderecoNotificacao(user.uid);
            }
        }, 7000); // 7 segundos garante que até celulares lentos já processaram o login
    }
    // Identifica perfil para o Guia Inteligente
    if (window.userProfile) window.userProfile.is_provider = !!document.getElementById('online-toggle');
    
    // 🚀 [Maestro] DESTRAVAMENTO VISUAL: Mata o loader e libera o container
    const loader = document.getElementById('loading-screen') || document.getElementById('sync-loader');
    if(loader) {
        loader.classList.add('hidden');
        loader.style.display = 'none';
    }

    document.getElementById('auth-container')?.classList.add('hidden');
    const mainApp = document.getElementById('app-container');
    if(mainApp) {
        mainApp.classList.remove('hidden');
        mainApp.style.display = 'block';
    }

    // --- 🛑 AQUI ESTAVA FALTANDO O LISTENER DO BOTÃO! ---
    const toggle = document.getElementById('online-toggle');
    if (toggle) {
        // Remove clones anteriores para evitar duplicação de eventos
        const novoToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(novoToggle, toggle);

        novoToggle.addEventListener('change', (e) => {
         if (e.target.checked) {
                console.log("🟢 [UI] Botão ativado manualmente. Iniciando Radar...");
                window.radarIniciado = false; 
                if (window.iniciarRadarPrestador) window.iniciarRadarPrestador(user.uid);
                if (window.garantirContainerRadar) window.garantirContainerRadar();
            } else {
                console.log("🔴 [UI] Botão desativado manualmente. Parando Radar...");
                if (window.pararRadarFisico) window.pararRadarFisico();
                if (window.garantirContainerRadar) window.garantirContainerRadar();
            }   
        });

       // 🚀 INICIALIZAÇÃO INTELIGENTE V23: Sem timeouts que atropelam o services.js
        if (novoToggle.checked && window.iniciarRadarPrestador) {
             window.iniciarRadarPrestador(user.uid);
        } else if (!novoToggle.checked && window.pararRadarFisico) {
            window.pararRadarFisico();
        }
    }

    // 🎨 MAESTRO GRID V62: Corrige o vazamento horizontal e organiza em cards (Mobile e PC)
    const styleFix = document.createElement('style');
    styleFix.innerHTML = `
        /* 📱 Mobile: Força uma única coluna e impede o transbordamento horizontal */
        #notif-list-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            max-width: 100%;
            overflow-x: hidden !important; /* Mata o carrossel quebrado */
            padding: 10px 5px;
        }

        /* 💻 Desktop (PC): Transforma em Grid de 2 colunas para aproveitar espaço */
        @media (min-width: 1024px) {
            #notif-list-container {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
        }

        /* ⚓ Scrollbar Industrial para a seção de notificações */
        #sec-notificacoes {
            max-height: 85vh;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding-bottom: 50px;
            scrollbar-width: thin;
            scrollbar-color: #3b82f6 #0f172a;
        }
        #sec-notificacoes::-webkit-scrollbar { width: 6px; }
        #sec-notificacoes::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
        
        /* Ajuste fino nos cards para não esticarem o layout */
       #notif-list-container > div {
            width: 100% !important;
            box-sizing: border-box;
        }

        /* 💡 EQUALIZAÇÃO NEON ATLIVIO V2026 */
        /* Gil, aqui acendemos as bordas neon sem mudar a cor do botão */
        #btn-contratar-home { filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3)); border-color: #60a5fa !important; }
        #btn-atlas-home { filter: drop-shadow(0 0 10px rgba(34, 211, 238, 0.4)); border-color: #22d3ee !important; }
        #btn-renda-home { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3)); border-color: #34d399 !important; }
        #btn-emprego-home { filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.3)); border-color: #fb923c !important; }
    `;
    document.head.appendChild(styleFix);

    // ============================================================================
    // 🎯 GATILHO MAESTRO V28: Inteligência de Boas-Vindas (CORRIGIDO)
    // ============================================================================
    if (window.switchTab) {
        console.log("🎯 [Maestro] Analisando intenção do usuário...");
        
        // ⏳ Aguarda o esqueleto da página e os dados do perfil estabilizarem
        setTimeout(() => {
            // 🛡️ PROTEÇÃO V26: Força o reset visual antes de qualquer redirecionamento
            window.switchTab('home', true); 

            const isToggling = sessionStorage.getItem('is_toggling_profile') === 'true';
            let userIntent = window.userProfile?.user_intent || "";
            if (userIntent === "home" || isToggling) userIntent = ""; 
            if (isToggling) sessionStorage.removeItem('is_toggling_profile');

            if (userIntent && userIntent !== "") {
                console.log(`🚀 [Maestro] Intenção detectada: ${userIntent}`);
                
               // ⏱️ DELAY DE SANEAMENTO (V61): Filtro de Identidade Atlivio
                setTimeout(() => {
                    const mapaFiel = {
                        'ganhar': 'missoes', 
                        'loja': 'loja',      
                        'produtos': 'loja', 
                        'servicos': 'servicos'
                    };
                    
                    let destinoOficial = mapaFiel[userIntent] || userIntent;
                    const isCliente = window.userProfile?.perfil === 'cliente';

                    // 🛡️ TRAVA DE DNA: Se for Cliente e o banco pedir 'missoes' ou 'extra', força a Home.
                    // Isso evita o vazamento visual e prepara para o Card de Gestão B2B na Home.
                    if (isCliente && (destinoOficial === 'missoes' || destinoOficial === 'extra')) {
                        console.log("🛡️ [Maestro] Cliente detectado em rota de prestador. Redirecionando para Home Segura.");
                        destinoOficial = 'home';
                    }

                    window.switchTab(destinoOficial);
                }, 800);
            } else {
                console.log("🆕 [Maestro] Iniciando fluxo de Onboarding.");
                window.switchTab('home');
                window.renderizarTourBoasVindas(); 
            }
        }, 600); // Fecha o setTimeout principal de 600ms
    }
} // ✅ CORREÇÃO VITAL: Fecha a "async function carregarInterface(user) {"
// 🎨 INTERFACE DO TOUR (Deve estar acessível globalmente)
// 🎨 INTERFACE HOME V50: Intenção (Topo) + Exploração (Base)
window.renderizarTourBoasVindas = function() {
    const container = document.getElementById('home-content');
    if (!container) return;

    container.innerHTML = `
        <div class="animate-fadeIn p-6 space-y-8 w-full max-w-sm mx-auto pb-20">
            <div class="space-y-2 text-center">
                <h2 class="text-4xl font-black text-blue-900 italic tracking-tighter uppercase">Atlívio</h2>
                <div class="h-1 w-20 bg-blue-600 mx-auto rounded-full"></div>
                <p class="text-gray-500 font-bold text-[10px] uppercase tracking-[0.2em] pt-2">O que você busca agora?</p>
            </div>

          <div class="grid gap-3">
                <button id="btn-contratar-home" onclick="window.finalizarTourMusculado('servicos', ['contratante'])" class="bg-white border-2 border-blue-100 p-4 rounded-3xl flex items-center gap-4 shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl">🛠️</div>
                    <div>
                        <p class="font-black text-blue-900 uppercase text-[11px]">Preciso Contratar</p>
                        <p class="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Encontre profissionais agora</p>
                    </div>
                </button>

               <button id="btn-atlas-home" onclick="document.getElementById('modal-marketing-b2b').classList.remove('hidden')" class="bg-white border-2 border-cyan-400 p-4 rounded-3xl flex items-center gap-4 shadow-md active:scale-95 group text-left transition-all hover:border-cyan-600">
                    <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-blue-100">
                        <span class="animate-spin-slow">🌍</span>
                    </div>
                    <div>
                        <p class="font-black text-black uppercase text-[11px]">Gestão Atlas</p> 
                        <p class="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Crie missões para sua empresa</p> 
                    </div>
                </button>

                <button id="btn-renda-home" onclick="window.finalizarTourMusculado('missoes', ['prestador'])" class="bg-white border-2 border-emerald-100 p-4 rounded-3xl flex items-center gap-4 shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl">⚡</div>
                    <div>
                        <p class="font-black text-emerald-700 uppercase text-[11px]">Renda Extra</p>
                        <p class="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Ganhe dinheiro com tarefas</p>
                    </div>
                </button>

                <button id="btn-emprego-home" onclick="window.finalizarTourMusculado('empregos', ['clt'])" class="bg-white border-2 border-orange-100 p-4 rounded-3xl flex items-center gap-4 shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl">💼</div>
                    <div>
                        <p class="font-black text-orange-700 uppercase text-[11px]">Buscar Emprego</p>
                        <p class="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Vagas locais e oportunidades</p>
                    </div>
                </button>
            </div>

            <div class="space-y-4 pt-4 border-t border-gray-100">
                <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest pl-1">🔎 Quer conhecer mais?</p>
                
                <div class="grid gap-2">
                    <button onclick="window.switchTab('canal')" class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition group text-left">
                        <span class="text-[11px] font-bold text-gray-600 uppercase">📺 Conheça a ATLIVIO</span>
                        <span class="text-blue-600 font-black">→</span>
                    </button>

                    <button onclick="window.switchTab('loja')" class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition group text-left">
                        <span class="text-[11px] font-bold text-gray-600 uppercase">🛍️ Ver Produtos e Benefícios</span>
                        <span class="text-emerald-600 font-black">→</span>
                    </button>

                    <button onclick="window.switchTab('oportunidades')" class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition group text-left">
                        <span class="text-[11px] font-bold text-gray-600 uppercase">🎯 Oportunidades em Alta</span>
                        <span class="text-orange-600 font-black">→</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};

// ⚡ FUNÇÃO DE FINALIZAÇÃO (Ponte entre UI e Ad-Engine)
window.finalizarTourMusculado = (escolha, tags) => {
    console.log("🎯 Finalizando Tour Musculado para:", escolha);
    window.registrarEventoMaestro({ 
        tipo: "tour_final", 
        escolha: escolha, 
        tags: tags 
    });
    window.switchTab(escolha);
};

// 🛰️ DISPATCHER AD-ENGINE V35 (CONTROLE DE ESCALA)
let lastEventTime = 0;
window.registrarEventoMaestro = async function(dadosEvento) {
    const agora = Date.now();
    if (agora - lastEventTime < 2000 && dadosEvento.tipo !== 'tour_final') return; 
    lastEventTime = agora;

    const uid = window.auth?.currentUser?.uid;
    if (!uid) return;

    try {
        const { doc, updateDoc, addDoc, collection, increment, arrayUnion } = window.firebaseModules;
        const userRef = doc(window.db, "usuarios", uid);
        let payload = { "updated_at": new Date() };

       if (dadosEvento.tipo === "navegacao") {
            payload[`behavior.${dadosEvento.aba}.visitas`] = increment(1);
            if (dadosEvento.aba !== "home") payload.user_intent = dadosEvento.aba;
        }

        if (dadosEvento.tipo === "tour_final") {
            payload.user_intent = dadosEvento.escolha;
            payload.tour_complete = true;
            payload.tags_interesse = arrayUnion(...dadosEvento.tags);
            // Inicializa scores básicos para o robô 47 não ver zeros
            payload[`behavior.${dadosEvento.escolha}.score`] = 10; 
            payload[`behavior.tags_count`] = dadosEvento.tags.length;
        }

        await updateDoc(userRef, payload);

        // LOG DE AUDITORIA (ROBÔ 47)
        await addDoc(collection(window.db, "events"), { 
            uid, 
            tipo: dadosEvento.tipo, 
            aba: dadosEvento.aba || dadosEvento.escolha, 
            timestamp: new Date() 
        });

    } catch (e) {
        console.warn("⚠️ Telemetria: Criando estrutura behavior...", e.message);
        // Se falhar o updateDoc por falta do campo behavior, o Ad-Engine cria via transação ou setDoc se necessário, 
        // mas o Firebase costuma aceitar Dot Notation para criar sub-campos.
    }
};

// Válvula de compatibilidade para o Tour
window.salvarIntencaoMaestro = (escolha) => {
    window.registrarEventoMaestro({ tipo: "tour_final", escolha });
    window.switchTab(escolha);
};
auth.onAuthStateChanged(async (user) => {
   if (user) {
        console.log("🔐 Autenticado com Sucesso V12");

        // 📢 SINCRONIA SEGURA: O app só lê as configurações globais após o login.
        // Isso resolve o erro de 'Missing Permissions' que aparecia no console.
        // 🎼 MAESTRO V27 (Sincronia Harmônica): 
        // Aguarda 2 segundos para o Firebase validar os tokens de segurança.
        // Isso silencia os erros de permissão no console e estabiliza o boot.
        setTimeout(() => {
            console.log("🎼 Maestro: Tokens validados. Iniciando motores de fundo...");
            if (window.carregarConfiguracoesIniciais) window.carregarConfiguracoesIniciais();
            if (window.IniciarAvisoGlobal) window.IniciarAvisoGlobal();
            if (window.iniciarMonitorDeploy) window.iniciarMonitorDeploy();
            if (window.ativarDespertadorLazarus) window.ativarDespertadorLazarus();
        }, 2000);
        /* 🛰️ OUVINTE MAESTRO: MARKETING EM MASSA ATIVADO V25 */
        /* 🤖 MOTOR DE AUTOMAÇÃO REATIVA ATLIVIO V25 */
        // Este bloco vigia o usuário e decide as ofertas sozinho, sem o Admin intervir.
       /* 🤖 MOTOR DE AUTOMAÇÃO REATIVA ATLIVIO V25 (AUTO-PILOTO) */
        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        // A. VIGIA DE REGRAS GLOBAIS (Configura uma vez, roda por meses)
        onSnapshot(doc(window.db, "settings", "financeiro"), (snap) => {
            if (snap.exists()) {
                const config = snap.data();
                // Se você ativar o aviso no Admin, o App mostra para todos automaticamente
                if (config.aviso_marketing_ativo) {
                    window.mostrarBarraNotificacao("campanha_mensal", {
                        type: 'gift',
                        action: config.aba_destino || 'ganhar',
                        message: config.texto_marketing || "Confira as novidades da Atlivio!"
                    });
                }
            }
        });

        // B. VIGIA DE COMPORTAMENTO (Sugere Missões se o usuário estiver parado na Home)
        setTimeout(() => {
            if (window.abaAtual === 'home' && window.mostrarBarraNotificacao) {
                window.mostrarBarraNotificacao("auto_ajuda", {
                    type: 'marketing',
                    action: 'missoes',
                    message: "Dica: Você sabia que pode começar a lucrar agora mesmo cumprindo micro-tarefas? ⚡"
                });
            }
        }, 300000); // Aparece após 5 minutos de inatividade na Home
        /* ---------------------------------------------------- */

        // 🛡️ Trava de Segurança Antecipada
        if (window.verificarSentenca) {
            const banido = await window.verificarSentenca(user.uid);
            if (banido) return; 
        }

       // 🔔 CRM DE NOTIFICAÇÕES V61: Inicia o sistema com trava de memória.
        if (typeof window.iniciarSistemaNotificacoes === 'function') {
            // Só ativa o motor se o boot ainda não foi concluído para evitar re-injeção de alertas antigos
            if (!window.atlivioBootConcluido) {
                window.iniciarSistemaNotificacoes();
            }
        }

        // 🎁 Fluxos de Boas-vindas
        if (typeof checkOnboarding === 'function') {
            checkOnboarding(user); 
        }
        
        // 💰 PRIORIDADE FINANCEIRA: Ativa o rastreador de PIX antes de montar a tela
        if (typeof iniciarMonitoramentoCarteira === 'function') {
            console.log("💰 [Maestro] Motor Financeiro: Ativando radar de saldo real-time...");
            iniciarMonitoramentoCarteira(); // Liga a escuta do banco de dados para o saldo
        }

        // 🖥️ BOOT DA INTERFACE: Chama a montagem visual apenas se o sistema ainda não subiu
        if (!window.atlivioBootConcluido) {
            window.carregarInterface(user); // Abre o App e fecha o Loader de carregamento
        }

    } else { // 🚪 Caso o usuário saia da conta ou não esteja logado:
        console.log("🚪 Usuário Desconectado.");
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
        
        // Desliga o Radar fisicamente
        if (window.pararRadarFisico) window.pararRadarFisico();
    }
});
// 🩹 Saneamento V2026: Exportações movidas para o final do arquivo para evitar conflitos.

// 🧭 NOVAS FUNÇÕES DO TOUR
if (typeof renderizarTourBoasVindas === 'function') {
    window.renderizarTourBoasVindas = renderizarTourBoasVindas;
}
// 🔒 PRIVACIDADE DE GANHOS (ESTILO BANCÁRIO)
window.togglePrivacyHome = () => {
    const elEarnings = document.getElementById('user-earnings-home');
    const elBalance = document.getElementById('user-balance-home');
    const eye = document.getElementById('eye-icon-home');
    const svg = document.getElementById('svg-eye');
    
    if (!elEarnings || !elBalance) return;
    const isHidden = elEarnings.getAttribute('data-hidden') === 'true';

    if (isHidden) {
        // ✨ Sincronia V63: Exibe os valores com a nova identidade ATLIX ao clicar no "olhinho"
        const ganhos = (window.userProfile?.wallet_earnings || 0).toFixed(2).replace('.', ',');
        const saldo = (window.userProfile?.wallet_total_power || 0).toFixed(2).replace('.', ',');
        
        // ✨ Sincronia V72: Ganhos em R$ e Saldo em Moeda Dourada ao revelar
        elEarnings.innerText = `R$ ${ganhos}`;
        elBalance.innerHTML = `${saldo} 🪙`;
        
        elEarnings.setAttribute('data-hidden', 'false');
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        eye.classList.remove('opacity-60');
    } else {
        // OCULTAR VALORES
        // 🔒 Mantém o padrão de segurança visual
        elEarnings.innerText = 'R$ ••••';
        elBalance.innerText = '🪙 ••••';
        
        elEarnings.setAttribute('data-hidden', 'true');
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        eye.classList.add('opacity-60');
    }
};
// --- FIM DO MAESTRO ---
// 🛡️ VIGILANTE DE CLIQUES ATLIVIO V3.0 TURBO (Escala Global)
let disjuntorVigilante = false; 

// Usamos window para garantir que a proteção seja soberana
window.addEventListener('click', (e) => {
    // ⚡ FILTRO ATÔMICO: Se o disjuntor estiver ativo, mata o clique na hora
    if (disjuntorVigilante) {
        e.stopImmediatePropagation(); // 🛑 Comando mais forte do JS: impede que qualquer outro script ouça o clique
        e.preventDefault();
        return;
    }

    // ⚡ LOCALIZADOR: Acha o botão de switchTab
    // 🕵️ O Vigilante agora vigia os dois tipos de botões de navegação do sistema
    const btn = e.target.closest('button[onclick*="switchTab"], button[onclick*="finalizarTourMusculado"]');
    if (!btn) return;

    // ⚡ ANALISADOR: Extrai a aba alvo
    const match = btn.getAttribute('onclick').match(/'([^']+)'/);
    if (!match) return;
    const abaAlvo = match[1];

    // ⚡ IDENTIFICADOR: Quem é o usuário?
    const isPrestador = window.userProfile?.is_provider === true;
    
    // Suas regras de negócio exatas:
    // 🏷️ Áreas exclusivas para quem quer TRABALHAR (Barra o Cliente nas Missões)
    const exclusivasPrestador = ['missoes', 'radar', 'ativos', 'extra', 'tarefas'];
    
    // 🏷️ Áreas exclusivas para quem quer CONTRATAR/COMPRAR (Barra o Prestador)
    // 🛡️ O Vigilante agora permite o clique em 'b2b_gestao' para que a Ponte B2B decida o acesso.
    const exclusivasCliente = ['loja', 'contratar', 'produtos', 'marketing'];
    // 🔍 Captura o texto do botão e o comando HTML para saber a intenção real
    const textoBotao = btn.innerText.toUpperCase();
    const comandoHtml = btn.getAttribute('onclick') || "";

    // 🧠 Lógica de Sentinela V3.1 (Alta Precisão):
    
    // 1. Bloqueia Cliente se tentar entrar em abas de trabalho (missoes, radar, ativos)
    const bloqueioCliente = (!isPrestador && exclusivasPrestador.includes(abaAlvo));
    
    // 2. Bloqueia Prestador se:
    // - A aba for Loja ou Contratar
    // - OU se o texto do botão contiver "CONTRATAR"
    // - OU se o botão disparar o Tour de 'contratante'
    const bloqueioPrestador = (isPrestador && (
        exclusivasCliente.includes(abaAlvo) || 
        textoBotao.includes("CONTRATAR") || 
        comandoHtml.includes("'contratante'")
    ));

    if (bloqueioCliente || bloqueioPrestador) {
        // ⛔ INTERCEPTAÇÃO SOBERANA
        e.stopImmediatePropagation(); // Garante que o Maestro nem saiba que houve um clique
        e.preventDefault();

        // 🏗️ DISPARO DO MODAL
        const modal = document.getElementById('modal-troca-identidade');
        const txt = document.getElementById('txt-perfil-atual');
        
        if (modal && txt) {
            // Só mexe no texto se o modal estiver fechado
            if (modal.classList.contains('hidden')) {
                txt.innerText = isPrestador ? "PRESTADOR para CLIENTE" : "CLIENTE para PRESTADOR";
                modal.classList.remove('hidden');
            }
        }

        // 🛡️ TRAVA ANTI-SPAM (400ms)
        disjuntorVigilante = true;
        setTimeout(() => { disjuntorVigilante = false; }, 400);
        
        console.warn(`[🛡️ Vigilante V3] Clique em ${abaAlvo} bloqueado com sucesso.`);
    }
}, { capture: true }); // O segredo da velocidade está no 'capture: true'

// ============================================================================
// 🛰️ MOTOR UNIVERSAL DE MÍDIA MAESTRO (V2026)
// ============================================================================

// 🌊 1. FUNÇÃO DE FECHAMENTO (O Faxineiro)
window.fecharModalMaestro = () => {
    const modal = document.getElementById('modal-video-maestro');
    const frame = document.getElementById('player-maestro-frame');
    
    if (frame) frame.src = ''; // Mata o vídeo
    
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
    console.log("🌊 [Maestro] Modal limpo e recolhido.");
};

// 🎯 2. CLIQUE NO FUNDO (Experiência Premium)
document.getElementById('modal-video-maestro')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-video-maestro') window.fecharModalMaestro();
});

// 🖼️ 3. VISUALIZADOR UNIVERSAL DE IMAGENS (O Projetor)
window.exibirImagemModal = (url, legenda = "Visualização Atlas") => {
    const modal = document.getElementById('modal-video-maestro');
    const container = modal?.querySelector('div.bg-black');
    
    if (!modal || !container) return console.error("❌ Modal Maestro não localizado.");

    container.innerHTML = `
        <button onclick="window.fecharModalMaestro()" 
                class="absolute top-6 right-6 z-[250] bg-red-600 text-white w-10 h-10 rounded-full font-black text-lg shadow-2xl border border-white/10 active:scale-90 transition-all">
            ×
        </button>
        <img src="${url}" class="w-full h-full object-contain rounded-[2.5rem] p-4 animate-fadeIn">
        <div class="absolute bottom-10 left-0 right-0 text-center px-4">
            <span class="bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest border border-white/10 shadow-2xl">
                ${legenda}
            </span>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
};

// 🔗 4. PONTES DE COMPATIBILIDADE
window.verModeloMissao = (url) => window.exibirImagemModal(url, "Modelo de Execução");

// 🛰️ 5. PONTE ATLAS B2B: Sincronizada com o DNA is_provider (V70)
window.abrirTrocaPerfilB2B = () => {
    document.getElementById('modal-marketing-b2b')?.classList.add('hidden');
    const isClienteReal = window.userProfile?.is_provider === false;

    if (isClienteReal) {
        window.switchTab('b2b_gestao');
        if (window.initB2B) window.initB2B(); 
    } else {
        const modalTroca = document.getElementById('modal-troca-identidade');
        const txtTroca = document.getElementById('txt-perfil-atual');
        if (modalTroca && txtTroca) {
            txtTroca.innerText = "PRESTADOR para CLIENTE";
            modalTroca.classList.remove('hidden');
        }
    }
};

// 🛰️ [V2026] MOTOR DE AUTO-CONTABILIZAÇÃO (AUTORIDADE MESTRE)
// Gil, esse código faz o SEU celular processar as indicações que o Firebase barrou nos outros.
window.processarMinhasIndicacoes = async (uid) => {
    const { collection, query, where, getDocs, doc, updateDoc, increment } = window.firebaseModules;
    
    try {
        // 1. Procura na "Caixa de Correio" se tem rastro seu que ainda não foi contado
        const q = query(collection(window.db, "referral_events"), 
                        where("padrinho_uid", "==", uid), 
                        where("processado", "==", false));
        
        const snap = await getDocs(q);
        if (snap.empty) return; // Nada novo? Sai fora.

        console.log(`🎁 [Maestro] Encontrei ${snap.size} indicações novas. Contabilizando...`);

        for (const eventoDoc of snap.docs) {
            // 2. VOCÊ (Dono) dá o +1 no seu próprio contador (O Firebase deixa!)
            await updateDoc(doc(window.db, "usuarios", uid), {
                referral_count: increment(1)
            });

            // 3. Marca o "bilhete" como lido para não contar duas vezes
            await updateDoc(doc(window.db, "referral_events", eventoDoc.id), {
                processado: true
            });
        }
        
        console.log("✅ [Sucesso] Contador atualizado com sua autoridade!");
        // Dá um toque no Perfil para ele ler o número novo na tela
        if(window.carregarDadosPerfil) window.carregarDadosPerfil();

    } catch (e) { console.warn("⚠️ Falha na autofaxina:", e); }
};

// 🛰️ [V2026] VIGILANTE REAL-TIME: Ouve a pasta de amigos sem precisar de F5
let unsubscribeReferral = null;

window.auth.onAuthStateChanged(user => {
    if (user) {
        if (unsubscribeReferral) unsubscribeReferral();

        // 🛠️ Aguarda módulos estarem prontos e liga o radar de indicações
        const checkRef = setInterval(() => {
            if (window.firebaseModules && window.db) {
                clearInterval(checkRef);
                const { collection, query, where, onSnapshot } = window.firebaseModules;
                
                const q = query(collection(window.db, "referral_events"), 
                                where("padrinho_uid", "==", user.uid), 
                                where("processado", "==", false));

                unsubscribeReferral = onSnapshot(q, (snap) => {
                    if (!snap.empty) {
                        console.log(`🎁 [Maestro] ${snap.size} novas indicações detectadas ao vivo!`);
                        window.processarMinhasIndicacoes(user.uid);
                    }
                });
            }
        }, 1000);
    } else {
        if (unsubscribeReferral) unsubscribeReferral();
    }
});

// ============================================================================
// 🛍️ MOTOR DE VENDAS E COFRE ATLIVIO (V2026)
// ============================================================================

/**
 * 💰 PROCESSAR COMPRA COM ATLIX
 * Conecta a vitrine à função pagarComAtlix do wallet.js
 */
window.comprarComAtlix = async (prodId, preco, tipo) => {
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return alert("Faça login para comprar.");

    // 1. Pergunta se o usuário tem certeza
    if (!confirm(`Confirmar desbloqueio por ${preco} ATLIX?`)) return;

    try {
        // 2. Chama o Motor Financeiro (wallet.js)
        // Gil, essa função pagarComAtlix já cuida de saldo real e bônus sozinha!
        const res = await window.pagarComAtlix(preco, "🛍️ COMPRA_LOJA", `Desbloqueio: ${prodId}`);

        if (res.success) {
            const { doc, updateDoc, arrayUnion, getDoc } = window.firebaseModules;
            
            // 3. Adiciona o ID do produto ao "Cofre" (my_vault) do usuário no Firebase
            await updateDoc(doc(window.db, "usuarios", uid), {
                my_vault: arrayUnion(prodId)
            });

            // 4. Atualiza o perfil local para refletir a posse na hora
            if(!window.userProfile.my_vault) window.userProfile.my_vault = [];
            window.userProfile.my_vault.push(prodId);

            alert("✅ Sucesso! Conteúdo liberado no seu Cofre.");
            
            // 5. Se for virtual, já abre o conteúdo direto para o usuário
            if (tipo === 'virtual') window.abrirCofreConteudo(prodId);
            else window.carregarProdutos(); // Recarrega a vitrine para mudar o botão

        } else {
            alert("❌ Falha: " + (res.error || "Saldo insuficiente ou erro no banco."));
        }
    } catch (e) {
        console.error("Erro na compra:", e);
        alert("Ocorreu um erro ao processar sua compra.");
    }
};

/**
 * 🔐 ABRIR COFRE DE CONTEÚDO
 * Renderiza o conteúdo exclusivo dentro da DIV que criamos no index.html
 */
window.abrirCofreConteudo = async (prodId) => {
    const modal = document.getElementById('modal-vault-content');
    const title = document.getElementById('vault-product-title');
    const videoCont = document.getElementById('vault-video-container');
    const iframe = document.getElementById('vault-iframe');
    const headline = document.getElementById('vault-main-headline');
    const bodyText = document.getElementById('vault-body-text');

    if (!modal) return;

    // 1. Mostra o modal e coloca o estado de "Carregando"
    modal.classList.remove('hidden');
    title.innerText = "Sincronizando Acesso...";
    headline.innerText = "Aguarde...";
    bodyText.innerHTML = "";
    videoCont.classList.add('hidden');

    try {
        const { doc, getDoc } = window.firebaseModules;
        
        // 2. Busca os detalhes do produto no banco
        const prodSnap = await getDoc(doc(window.db, "products", prodId));
        if (!prodSnap.exists()) throw "Produto não localizado.";

        const data = prodSnap.data();

        // 3. Alimenta o Cofre com os dados reais
        title.innerText = data.nome || "Conteúdo Exclusivo";
        headline.innerText = data.headline || data.nome;
        bodyText.innerHTML = data.texto_entrega || "Aproveite seu conteúdo!";

        // 4. Se tiver vídeo, liga o player
        if (data.url_video) {
            iframe.src = data.url_video; // Ex: https://www.youtube.com/embed/XXXX
            videoCont.classList.remove('hidden');
        }

    } catch (e) {
        console.error("Erro ao abrir cofre:", e);
        alert("Erro ao carregar conteúdo.");
        modal.classList.add('hidden');
    }
};

// ============================================================================
// 🛰️ MOTOR DE NAVEGAÇÃO E LIMPEZA V2026
// Resolve o erro do Botão de Ação e libera as Micro Tarefas
// ============================================================================

// 1. Faz o botão verde (Ação) funcionar e fechar o modal
window.navegarAba = (abaAlvo) => {
    console.log(`🚀 [Maestro] Navegando para: ${abaAlvo}`);
    
    // Fecha o modal antes de trocar a aba para não bugar a tela
    const modal = document.getElementById('modal-vault-content');
    if (modal) {
        modal.classList.add('hidden');
        const iframe = document.getElementById('vault-iframe');
        if (iframe) iframe.src = ''; // Cala o vídeo
    }

    if (typeof window.switchTab === 'function') {
        window.switchTab(abaAlvo);
    }
};

// 2. O "Limpa Trilhos" (Evita o ReferenceError quando você clica em Realizar Missão)
window.fecharModalMaestro = () => {
    const modal = document.getElementById('modal-vault-content');
    if (modal) {
        modal.classList.add('hidden');
        const iframe = document.getElementById('vault-iframe');
        if (iframe) iframe.src = '';
    }
    console.log("🌊 [Maestro] Tela liberada para novas tarefas.");
};

// 3. Ponte para abrir imagens usando o design do Cofre
window.exibirImagemModal = (url, legenda = "Visualização") => {
    const modal = document.getElementById('modal-vault-content');
    const body = document.getElementById('vault-body-text');
    const video = document.getElementById('vault-video-container');
    
    if (modal && body) {
        if (video) video.classList.add('hidden');
        body.innerHTML = `<img src="${url}" class="w-full rounded-2xl border border-white/10 shadow-2xl">`;
        document.getElementById('vault-product-title').innerText = "GALERIA";
        document.getElementById('vault-main-headline').innerText = legenda;
        modal.classList.remove('hidden');
    }
};

// ============================================================================
// 🛰️ SOLDA DE COMPATIBILIDADE V2026 (REGRAS DE OURO)
// Coloque isso na ÚLTIMA LINHA do seu app.js verdadeiro
// ============================================================================

window.navegarAba = (abaAlvo) => {
    // 1. Fecha o Cofre para liberar a visão
    window.fecharModalMaestro();
    // 2. Troca a aba
    if (typeof window.switchTab === 'function') {
        window.switchTab(abaAlvo);
    }
};

window.fecharModalMaestro = () => {
    const modal = document.getElementById('modal-vault-content');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        const iframe = document.getElementById('vault-iframe');
        if (iframe) iframe.src = ''; // Mata o som do vídeo
    }
    console.log("🌊 [Maestro] Tela liberada. Ocupação encerrada.");
};

window.exibirImagemModal = (url, legenda = "Visualização") => {
    const body = document.getElementById('vault-body-text');
    const modal = document.getElementById('modal-vault-content');
    if (modal && body) {
        body.innerHTML = `<img src="${url}" class="w-full rounded-2xl shadow-xl">`;
        document.getElementById('vault-main-headline').innerText = legenda;
        modal.classList.remove('hidden');
    }
};

// ============================================================================
// 🔐 SOLDAGEM GLOBAL FINAL V2026.PRO
// ============================================================================
window.switchTab = switchTab;
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.maestroUniversal = maestroUniversal;
window.registrarEventoMaestro = registrarEventoMaestro;
window.carregarInterface = carregarInterface;

console.log("🚀 [App.js] Sistema Nervoso Central Sincronizado e Online!");
