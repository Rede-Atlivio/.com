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

// 🛡️ MAESTRO V25: Flag de controle para impedir loops de inicialização
window.atlivioBootConcluido = false;
// 🧭 CONTEXTO V28: Rastreia a aba ativa para o Guia Inteligente não ser inconveniente
window.abaAtual = 'servicos';
// ============================================================================
// 5. SISTEMA DE NAVEGAÇÃO (TAB SYSTEM V10.0 - A PEÇA QUE FALTA)
// ============================================================================
function switchTab(tabName, isAutoBoot = false) {
    // ✋ Válvula de Retenção
    if (isAutoBoot && window.atlivioBootConcluido) return;

    console.log("👉 Trocando para aba:", tabName);
    window.abaAtual = tabName; 

    // 1. Esconde seções
    document.querySelectorAll('main > section').forEach(el => {
        el.classList.add('hidden');
    });

    // 2. Mostra alvo
    const alvo = document.getElementById(`sec-${tabName}`);
    if(alvo) alvo.classList.remove('hidden');

    // 3. Botões do Menu
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');

    // 4. Gatilhos
    if(tabName === 'servicos') {
        if(window.carregarServicos) window.carregarServicos();
        const toggle = document.getElementById('online-toggle');
        if(toggle?.checked && !window.radarIniciado && window.iniciarRadarPrestador) window.iniciarRadarPrestador();
    }
    if(tabName === 'empregos' && window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
    if(tabName === 'loja' && window.carregarProdutos) window.carregarProdutos();
    if(tabName === 'ganhar' && window.carregarCarteira) window.carregarCarteira();
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
        // 1. Força a limpeza visual do estado de "Sincronizando"
        window.switchTab('home', true);

        // 2. Busca a intenção (Prioriza o que veio do banco, mas aceita memória)
        const userIntent = window.userProfile?.user_intent || "";

        if (userIntent && userIntent !== "") {
            console.log(`🚀 Usuário recorrente: Direcionando para ${userIntent}`);
            
            // 🔄 Pequeno delay adicional para garantir que os módulos (jobs.js, services.js) 
            // já registraram suas funções de carregamento no objeto window.
            setTimeout(() => {
                window.switchTab(userIntent);
            }, 150); 

        } else {
            console.log("🆕 Novo usuário ou preferência zerada: Renderizando Tour.");
            window.renderizarTourBoasVindas(); 
        }
    }, 500); // Aumentado para 500ms para garantir estabilidade do Firestore
  }
}
// 🎨 INTERFACE DO TOUR (Deve estar acessível globalmente)
window.renderizarTourBoasVindas = function() {
    const container = document.getElementById('home-content');
    if (!container) return;

    container.innerHTML = `
        <div class="animate-fadeIn p-6 space-y-8 w-full max-w-sm mx-auto">
            <div class="space-y-2">
                <h2 class="text-3xl font-black text-blue-900 italic tracking-tighter uppercase">👋 Olá!</h2>
                <p class="text-gray-500 font-bold text-sm uppercase tracking-widest leading-tight">Escolha como quer usar a Atlivio hoje:</p>
            </div>

            <div class="grid gap-4">
                <button onclick="window.salvarIntencaoMaestro('servicos')" class="bg-white border-2 border-blue-100 p-5 rounded-3xl flex items-center gap-4 hover:border-blue-500 transition-all shadow-sm active:scale-95 group text-left">
                    <span class="text-3xl group-hover:scale-110 transition">🛠️</span>
                    <div>
                        <p class="font-black text-blue-900 uppercase text-xs">Contratar Serviço</p>
                        <p class="text-[9px] text-gray-400 font-bold">Preciso de um profissional agora</p>
                    </div>
                </button>

                <button onclick="window.salvarIntencaoMaestro('ganhar')" class="bg-white border-2 border-emerald-100 p-5 rounded-3xl flex items-center gap-4 hover:border-emerald-500 transition-all shadow-sm active:scale-95 group text-left">
                    <span class="text-3xl group-hover:scale-110 transition">⚡</span>
                    <div>
                        <p class="font-black text-emerald-700 uppercase text-xs">Ganhar Renda Extra</p>
                        <p class="text-[9px] text-gray-400 font-bold">Quero trabalhar e cumprir missões</p>
                    </div>
                </button>

                <button onclick="window.salvarIntencaoMaestro('empregos')" class="bg-white border-2 border-orange-100 p-5 rounded-3xl flex items-center gap-4 hover:border-orange-500 transition-all shadow-sm active:scale-95 group text-left">
                    <span class="text-3xl group-hover:scale-110 transition">💼</span>
                    <div>
                        <p class="font-black text-orange-700 uppercase text-xs">Procurar Emprego</p>
                        <p class="text-[9px] text-gray-400 font-bold">Vagas fixas e oportunidades CLT</p>
                    </div>
                </button>

                <button onclick="window.switchTab('servicos')" class="text-[10px] font-black text-gray-400 uppercase underline mt-4 hover:text-blue-500 transition">Só dar uma olhada por enquanto</button>
            </div>
        </div>
    `;
};

// 💾 SALVAMENTO DE INTENÇÃO (VERSÃO CORRIGIDA V30)
window.salvarIntencaoMaestro = async function(escolha) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        console.warn("❌ [Maestro] Nenhum usuário autenticado para salvar intenção.");
        return;
    }

    try {
        // Usa os módulos que você já preparou no config.js
        const { doc, updateDoc } = window.firebaseModules;
        
        if (!doc || !updateDoc) {
            throw new Error("Módulos do Firebase não encontrados no window.firebaseModules");
        }

        console.log(`📡 [Maestro] Tentando salvar intenção: ${escolha}...`);

        await updateDoc(doc(db, "usuarios", uid), {
            user_intent: escolha,
            tour_complete: true,
            last_access_at: new Date() 
        });
        
        console.log(`✅ [Maestro] Intenção '${escolha}' gravada com sucesso no Firestore!`);
        window.switchTab(escolha);

    } catch (e) {
        console.error("❌ [Maestro] Erro crítico ao salvar no Firestore:", e.message);
        // Mesmo se falhar o banco, ele troca a aba para não travar o usuário
        window.switchTab(escolha);
    }
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
// 🌍 EXPOSIÇÃO GLOBAL MAESTRO V28 (Garantia de Navegação)
window.switchTab = switchTab;
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
