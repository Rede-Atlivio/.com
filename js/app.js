// ============================================================================
// 🛰️ MOTOR DE SINCRONIZAÇÃO PWA (AUTO-UPDATE)
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('📡 Monitorando versões do sistema...');

            // Se o sistema detectar uma mudança no sw.js do servidor
            reg.addEventListener('updatefound', () => {
                const novoWorker = reg.installing;
                novoWorker.addEventListener('statechange', () => {
                    if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // 🚀 GATILHO DE ATUALIZAÇÃO IMEDIATA
                        console.log("✨ Nova versão detectada!");
                        if (confirm("🚀 Uma nova atualização da Atlivio está pronta. Atualizar agora para garantir o funcionamento?")) {
                            window.location.reload();
                        }
                    }
                });
            });
        }).catch(err => console.error('❌ Erro no Registro PWA:', err));
    });
}
// ============================================================================
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

// 🛡️ MAESTRO V25: Flag de controle
window.atlivioBootConcluido = false;
window.abaAtual = 'home';

// 🩹 POLYFILL IMEDIATO: Protege o sistema ANTES de carregar os módulos
window.addEventListener('userProfileLoaded', (e) => {
    window.userProfile = e.detail;
    if (window.userProfile) {
        Object.defineProperty(window.userProfile, 'saldo', {
            get: function() { return this.wallet_balance || 0; },
            configurable: true
        });
        console.log("✅ Polyfill de Saldo injetado via Evento.");
    }
});
// ============================================================================
// 5. SISTEMA DE NAVEGAÇÃO (TAB SYSTEM V10.0 - A PEÇA QUE FALTA)
// ============================================================================
function switchTab(tabName, isAutoBoot = false) {
    if (isAutoBoot && window.atlivioBootConcluido) return;

    // 🗺️ MAPA DE TRADUÇÃO: Garante que IDs antigos/duplicados caiam na seção certa
    const mapa = { 'ganhar': 'missoes', 'produtos': 'loja', 'loja': 'loja' };
    const nomeLimpo = mapa[tabName] || tabName;

    console.log("👉 [Navegação] Solicitada:", tabName, "──▶ Ativando:", nomeLimpo);
    window.abaAtual = nomeLimpo; 

    // 🧹 LIMPEZA TOTAL: Esconde todas as seções e mata duplicatas
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
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');

    // 🛰️ GATILHOS DE INTELIGÊNCIA (Ad-Engine)
    // Isso garante que cada troca de aba alimente o Score do Usuário
    window.registrarEventoMaestro({ tipo: "navegacao", aba: tabName });

    // ⚡ CARREGAMENTO ESPECÍFICO DE MÓDULOS
    if(tabName === 'servicos') {
        if(window.carregarServicos) window.carregarServicos();
    }
    if(tabName === 'empregos') {
        if(window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
    }
    if(tabName === 'loja') {
        // 🛒 Sincronia de ID: Mapeia para a seção 'loja' mas carrega o módulo 'produtos'
        if(window.carregarProdutos) window.carregarProdutos(); 
    }
    if(tabName === 'ganhar') {
        if(window.carregarCarteira) window.carregarCarteira();
        if(window.carregarMissoes) window.carregarMissoes(); // Chama missões/micro-tarefas
    }
    if(tabName === 'oportunidades') {
        if(window.carregarOportunidades) window.carregarOportunidades();
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
    // 🔥 Bloqueia se o Maestro já deu o sinal verde (Evita as 6 chamadas)
    if (window.atlivioBootConcluido) return;
    window.atlivioBootConcluido = true;

    console.log("🚀 [Maestro] Inicialização Única para:", user.uid);
    // Identifica perfil para o Guia Inteligente
    if (window.userProfile) window.userProfile.is_provider = !!document.getElementById('online-toggle');
    
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

// ============================================================================
// 🎯 GATILHO MAESTRO V28: Inteligência de Boas-Vindas (CORRIGIDO)
// ============================================================================
if (window.switchTab) {
    console.log("🎯 [Maestro] Analisando intenção do usuário...");
    
    // ⏳ Aguarda o esqueleto da página e os dados do perfil estabilizarem
 setTimeout(() => {
        // 🛡️ PROTEÇÃO V26: Força o reset visual antes de qualquer redirecionamento
        window.switchTab('home', true); 

        const userIntent = window.userProfile?.user_intent || "";

        if (userIntent && userIntent !== "") {
            console.log(`🚀 [Maestro] Intenção detectada: ${userIntent}`);
            
            // ⏱️ DELAY DE SANEAMENTO: 800ms para estabilizar o DOM duplicado
            setTimeout(() => {
                // 🗺️ MAPA DE TRADUÇÃO (Ignora IDs fantasmas e foca no aprovado)
                const mapaFiel = {
                    'ganhar': 'missoes', 
                    'loja': 'loja',      
                    'produtos': 'loja',  // Redireciona lixo para o ID oficial
                    'servicos': 'servicos'
                };
                
                const destinoOficial = mapaFiel[userIntent] || userIntent;
                window.switchTab(destinoOficial);
            }, 800); 

        } else {
        console.log("🆕 [Maestro] Iniciando fluxo de Onboarding.");
        // Se a intenção for vazia, limpamos o loader e mostramos o Tour
        document.querySelectorAll('main > section').forEach(el => el.classList.add('hidden'));
        const homeSec = document.getElementById('sec-home');
        if(homeSec) homeSec.classList.remove('hidden');
        
        window.renderizarTourBoasVindas(); 
    }
}, 600); // Tempo otimizado para o Firestore South America
  }
}
// 🎨 INTERFACE DO TOUR (Deve estar acessível globalmente)
window.renderizarTourBoasVindas = function() {
    const container = document.getElementById('home-content');
    if (!container) return;

    container.innerHTML = `
        <div class="animate-fadeIn p-6 space-y-8 w-full max-w-sm mx-auto">
            <div class="space-y-2 text-center">
                <h2 class="text-4xl font-black text-blue-900 italic tracking-tighter uppercase">Atlívio</h2>
                <div class="h-1 w-20 bg-blue-600 mx-auto rounded-full"></div>
                <p class="text-gray-500 font-bold text-[10px] uppercase tracking-[0.2em] pt-2">Ecossistema de Oportunidades</p>
            </div>

            <div class="grid gap-4">
                <button onclick="window.finalizarTourMusculado('servicos', ['cliente_final', 'contratante'])" class="bg-white border-2 border-blue-100 p-5 rounded-3xl flex items-center gap-4 hover:border-blue-600 transition-all shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition">🛠️</div>
                    <div>
                        <p class="font-black text-blue-900 uppercase text-xs">Preciso Contratar</p>
                        <p class="text-[9px] text-gray-400 font-bold">Serviços rápidos e profissionais</p>
                    </div>
                </button>

                <button onclick="window.finalizarTourMusculado('ganhar', ['prestador', 'renda_extra', 'micro_tarefas'])" class="bg-white border-2 border-emerald-100 p-5 rounded-3xl flex items-center gap-4 hover:border-emerald-600 transition-all shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition">⚡</div>
                    <div>
                        <p class="font-black text-emerald-700 uppercase text-xs">Quero Ganhar Renda</p>
                        <p class="text-[9px] text-gray-400 font-bold">Missões, tarefas e serviços</p>
                    </div>
                </button>

                <button onclick="window.finalizarTourMusculado('empregos', ['clt', 'carreira', 'vagas_fixas'])" class="bg-white border-2 border-orange-100 p-5 rounded-3xl flex items-center gap-4 hover:border-orange-600 transition-all shadow-md active:scale-95 group text-left">
                    <div class="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-orange-600 group-hover:text-white transition">💼</div>
                    <div>
                        <p class="font-black text-orange-700 uppercase text-xs">Buscar Emprego</p>
                        <p class="text-[9px] text-gray-400 font-bold">Vagas fixas e oportunidades CLT</p>
                    </div>
                </button>
            </div>

            <p class="text-[9px] text-center text-gray-400 font-bold px-4 uppercase leading-relaxed">
                Ao escolher, seu perfil será otimizado para os melhores anunciantes e vagas.
            </p>
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
            payload.user_intent = dadosEvento.aba;
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
        
       // 🖥️ Montagem da Interface (Chamada única controlada)
        if (!window.atlivioBootConcluido) {
            window.carregarInterface(user);
        }

    } else {
        console.log("🚪 Usuário Desconectado.");
        document.getElementById('auth-container')?.classList.remove('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
        
        // Desliga o Radar fisicamente
        if (window.pararRadarFisico) window.pararRadarFisico();
    }
});
// 🌍 EXPOSIÇÃO GLOBAL V24 (Garantia de Navegação)
// 🩹 POLYFILL DE COMPATIBILIDADE (Evita quebras em módulos reprovados para edição)
if (window.userProfile) {
    Object.defineProperty(window.userProfile, 'saldo', {
        get: function() { return this.wallet_balance || 0; }
    });
}
// 🌍 EXPOSIÇÃO GLOBAL MAESTRO V28 (Garantia de Navegação)
window.switchTab = switchTab;
window.registrarEventoMaestro = registrarEventoMaestro;
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.carregarInterface = carregarInterface;

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
        // MOSTRAR VALORES
        const ganhos = (window.userProfile?.wallet_earnings || 0).toFixed(2).replace('.', ',');
        const saldo = (window.userProfile?.wallet_total_power || 0).toFixed(2).replace('.', ',');
        
        elEarnings.innerText = `R$ ${ganhos}`;
        elBalance.innerText = `R$ ${saldo}`;
        
        elEarnings.setAttribute('data-hidden', 'false');
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        eye.classList.remove('opacity-60');
    } else {
        // OCULTAR VALORES
        elEarnings.innerText = 'R$ ••••';
        elBalance.innerText = 'R$ ••••';
        
        elEarnings.setAttribute('data-hidden', 'true');
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        eye.classList.add('opacity-60');
    }
};
