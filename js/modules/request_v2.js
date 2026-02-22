// ============================================================================
// js/modules/request.js - V22.0 (AUTO-CURA + SELF HEALING DOM)
// ============================================================================

import { db, auth } from '../config.js'; 
import { podeTrabalhar } from './wallet.js'; 
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    setDoc, 
    doc, 
    query, 
    where, 
    getDocs,
    onSnapshot, 
    getDoc,  
    updateDoc,  
    deleteDoc,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚡ GARANTIA DE ESCOPO GLOBAL: Evita erros de 'undefined' em execuções rápidas
if (typeof window.updateDoc === 'undefined') window.updateDoc = updateDoc;

// --- VARIÁVEIS DE MEMÓRIA ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;
let mem_SelectedServiceTitle = ""; 

// Memória de Sessão para Radar V22
window.ESTACIONADOS_SESSAO = new Set();
window.REJEITADOS_SESSAO = new Set();
// Gerenciador de Áudio Único (Estilo Uber)
window.audioRadarAtivo = null;
// Rastro de segurança para o Auto-Exterminador
window.HOUVE_BLOQUEIO_SESSAO = false;
// ☢️ PROTOCOLO AUTO-EXTERMINADOR (LIMPEZA AUTOMÁTICA DE CACHE CORROMPIDO)
window.executarLimpezaNuclear = async function() {
    console.log("☢️ STATUS CRÍTICO DETECTADO: INICIANDO AUTO-LIMPEZA...");
    if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let r of registrations) await r.unregister();
    }
    if (window.caches) {
        const keys = await caches.keys();
        for (let k of keys) await caches.delete(k);
    }
    window.location.reload(true);
};
// ============================================================================
// 0. FUNÇÃO DE AUTO-CURA DO HTML (CORRIGIDA V2 - FORÇA VISIBILIDADE)
// ============================================================================
function garantirContainerRadar() {
    const parent = document.getElementById('pview-radar');
    const container = document.getElementById('radar-container');
    const emptyState = document.getElementById('radar-empty-state');
    const offlineState = document.getElementById('radar-offline-state');
    const toggle = document.getElementById('online-toggle');

    if (!parent || !container) return null;

    const isOnline = toggle ? toggle.checked : false;

    if (!isOnline) {
        // MODO OFFLINE
        if(offlineState) offlineState.classList.remove('hidden');
        container.classList.add('hidden');
        if(emptyState) emptyState.classList.add('hidden');
        return container;
    } 

    // MODO ONLINE
    if(offlineState) offlineState.classList.add('hidden');
    
    // 🔍 Captura real de cards (incluindo os que estão sendo criados)
    const temCards = container.querySelectorAll('.request-card, .atlivio-pill').length > 0;

    if (temCards) {
        // Se tem card, o container TEM que aparecer e o radar (empty) sumir
        container.classList.remove('hidden');
        container.style.display = "block"; 
        if(emptyState) emptyState.classList.add('hidden');
    } else {
        // Só esconde o container se ele estiver vazio de fato
        container.classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
    }
// 🔊 COMANDO MASTER PARA PARAR ÁUDIO
window.pararSomRadar = function() {
    if (window.audioRadarAtivo) {
        console.log("🔊 Áudio interrompido manualmente.");
        window.audioRadarAtivo.pause();
        window.audioRadarAtivo.currentTime = 0;
        window.audioRadarAtivo = null;
    }
};
    return container;
}
    
// ============================================================================
// 1. MODAL DE SOLICITAÇÃO (CLIENTE)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    // 🚀 RESET DE SEGURANÇA: Garante que o novo pedido não herde lixo do chat anterior
    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    mem_BasePrice = parseFloat(initialPrice) || 0;
    mem_CurrentOffer = mem_BasePrice;
    
    // Limpa o botão para não ficar travado em "Processando"
    const btnConfirm = document.getElementById('btn-confirm-req');
    if(btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.dataset.loading = "false";
        btnConfirm.innerText = "ENVIAR SOLICITAÇÃO 🚀";
    }

    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    try {
        const configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if (configSnap.exists()) window.configFinanceiroAtiva = configSnap.data();
    } catch (e) { console.error("Erro config:", e); }
    
    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    
    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        const containerServicos = document.getElementById('service-selection-container');
        
        try {
            if(containerServicos) containerServicos.innerHTML = `<div class="loader border-blue-500 mx-auto"></div>`;
            const docSnap = await getDoc(doc(db, "active_providers", providerId));
            let servicos = (docSnap.exists() && docSnap.data().services) ? docSnap.data().services : [];

            let htmlSelect = "";
            if (servicos.length > 0) {
                htmlSelect = `
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Escolha o Serviço:</label>
                    <select id="select-service-type" onchange="window.mudarServicoSelecionado(this)" class="w-full bg-blue-50 border border-blue-200 text-gray-800 text-sm rounded-lg p-3 font-bold mb-3 outline-none">
                        ${servicos.map((s) => `
                            <option value="${s.price}" data-title="${s.title || s.category}">
                                ${s.title || s.category} - R$ ${s.price}
                            </option>
                        `).join('')}
                    </select>
                `;
                mem_BasePrice = parseFloat(servicos[0].price);
                mem_SelectedServiceTitle = servicos[0].title || servicos[0].category;
            } else {
                htmlSelect = `<p class="text-sm font-bold text-gray-700 mb-2">Serviço Geral</p>`;
                mem_BasePrice = parseFloat(initialPrice);
                mem_SelectedServiceTitle = "Serviço Geral";
            }
            if(containerServicos) containerServicos.innerHTML = htmlSelect;
        } catch (e) {
            mem_BasePrice = parseFloat(initialPrice);
        }

        mem_CurrentOffer = mem_BasePrice;
        atualizarVisualModal();
        
        const grids = modal.querySelectorAll('.grid');
        grids.forEach(div => { 
            if(div.innerHTML.includes('%')) {
                div.className = "grid grid-cols-4 gap-2 mb-3"; 
                div.innerHTML = `
                    <button onclick="window.selecionarDesconto(-0.10)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-10%</button>
                    <button onclick="window.selecionarDesconto(-0.05)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-5%</button>
                    <button onclick="window.selecionarDesconto(0.10)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+10%</button>
                    <button onclick="window.selecionarDesconto(0.20)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+20%</button>
                `;
            }
        });

        const btn = document.getElementById('btn-confirm-req');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ENVIAR SOLICITAÇÃO 🚀"; 
            btn.onclick = enviarPropostaAgora; 
        } 
    }
}

window.mudarServicoSelecionado = (select) => {
    mem_BasePrice = parseFloat(select.value);
    mem_CurrentOffer = mem_BasePrice;
    mem_SelectedServiceTitle = select.options[select.selectedIndex].getAttribute('data-title');
    atualizarVisualModal();
};

window.selecionarDesconto = (percent) => {
    mem_CurrentOffer = mem_BasePrice + (mem_BasePrice * parseFloat(percent));
    atualizarVisualModal();
};

window.ativarInputPersonalizado = () => {
    const input = document.getElementById('req-value');
    if(input) { input.disabled = false; input.focus(); input.style.border = "2px solid #3b82f6"; }
};

window.validarOferta = (val) => {
    let offer = parseFloat(String(val).replace(',', '.'));
    const config = window.configFinanceiroAtiva || { valor_minimo: 20 };
    const input = document.getElementById('req-value');
    const btn = document.getElementById('btn-confirm-req');

    if (isNaN(offer) || offer < config.valor_minimo) {
        if(input) input.style.borderColor = "red";
        if(btn) btn.disabled = true;
    } else {
        if(input) input.style.borderColor = "#e5e7eb";
        if(btn) btn.disabled = false;
        mem_CurrentOffer = offer;
    }
};

function atualizarVisualModal() {
    const inputValor = document.getElementById('req-value');
    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const ofertaSegura = parseFloat(mem_CurrentOffer) || 0;

    if(inputValor) inputValor.value = ofertaSegura.toFixed(2); 
    
    const valorReserva = ofertaSegura * (config.porcentagem_reserva / 100);
    const elTotal = document.getElementById('calc-total-reserva');
    if(elTotal) { 
        elTotal.innerHTML = `
            <div class="flex flex-col items-center">
                <span class="text-lg font-black text-gray-800">R$ ${ofertaSegura.toFixed(2).replace('.', ',')}</span>
                <span class="text-[9px] text-blue-600 font-bold uppercase">Reserva: R$ ${valorReserva.toFixed(2).replace('.', ',')}</span>
            </div>
        `; 
    }
    window.validarOferta(ofertaSegura);
}

// ============================================================================
// NOVA LÓGICA DE ENVIO COM TELA DE SUCESSO (SEM REDIRECIONAMENTO AUTOMÁTICO)
// ============================================================================
export async function enviarPropostaAgora() {
    const user = auth.currentUser;
    // Config apenas para validar limites de INPUT (Min/Max valor), não saldo.
    const config = window.configFinanceiroAtiva || { valor_minimo: 20, valor_maximo: 2000 };
    
    // 1. VALIDAÇÃO DE INPUT (Regras de Interface APENAS)
    if (mem_CurrentOffer < config.valor_minimo || mem_CurrentOffer > config.valor_maximo) {
        return alert(`⛔ Valor fora do permitido (R$ ${config.valor_minimo} - R$ ${config.valor_maximo})`);
    }

    const btn = document.getElementById('btn-confirm-req');
    if(btn) {
        if(btn.dataset.loading === "true") return; // Bloqueio físico imediato
        btn.dataset.loading = "true";
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">PROCESSANDO... ⏳</span>`;
    }

    try {
       // 🛡️ TRAVA ANTI-RESSURREIÇÃO V3: Mata o vício de chats mortos
        const qCheck = query(
            collection(db, "orders"), 
            where("client_id", "==", user.uid), 
            where("provider_id", "==", mem_ProviderId)
        );
        const snapCheck = await getDocs(qCheck);

        // Verifica se entre os pedidos encontrados, algum está REALMENTE ativo
        const pedidoVivo = snapCheck.docs.find(d => 
            !['negotiation_closed', 'cancelled', 'completed', 'archived', 'rejected'].includes(d.data().status)
        );

        if (pedidoVivo) {
            console.log("📍 Pedido vivo encontrado:", pedidoVivo.id);
            alert("⚠️ Você já possui uma negociação ativa com este profissional.");
            return window.irParaChatComSucesso(pedidoVivo.id);
        }
        
        console.log("✨ Nenhum pedido vivo. Gerando ID totalmente novo...");

        const dataServico = document.getElementById('req-date')?.value || "A combinar";
        const horaServico = document.getElementById('req-time')?.value || "A combinar";

        // 2. CRIA O PEDIDO NO BANCO (ID TOTALMENTE NOVO com STEP 1)
        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            provider_id: mem_ProviderId,
            system_step: 1, // 🚀 ESSENCIAL: Garante que o Lazarus consiga ler o pedido
            chat_lifecycle_status: 'active', // 🚀 ESSENCIAL: Define estado inicial
            provider_name: mem_ProviderName,
            service_title: mem_SelectedServiceTitle,
            status: 'pending', 
            offer_value: mem_CurrentOffer,
            location: document.getElementById('req-local')?.value || "A combinar",
            data: dataServico,
            hora: horaServico,
            created_at: serverTimestamp()
        });

        // 3. CRIA O CHAT VINCULADO
        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp()
        });

        // 4. TELA DE SUCESSO (Visual V22)
        const modalContent = document.getElementById('request-modal').firstElementChild; 
        
        if(modalContent) {
            modalContent.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
                    <div class="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-5xl mb-4 shadow-sm">
                        ✔
                    </div>
                    <h2 class="text-2xl font-black text-gray-800 mb-2">Solicitação Enviada!</h2>
                    <p class="text-sm text-gray-500 mb-6 px-4">
                        O prestador <b>${mem_ProviderName}</b> recebeu seu pedido.<br>
                        Acesse o chat para negociar os detalhes.
                    </p>
                    
                    <button onclick="window.irParaChatComSucesso('${docRef.id}')" 
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg transform transition active:scale-95 flex items-center justify-center gap-2">
                        <span>💬</span> IR PARA O CHAT AGORA
                    </button>
                    
                    <button onclick="document.getElementById('request-modal').classList.add('hidden')" 
                        class="mt-4 text-gray-400 text-xs font-bold underline hover:text-gray-600">
                        Fechar e continuar vendo a vitrine
                    </button>
                </div>
            `;
        }
// 🧹 RESET DE MEMÓRIA GINA: Mata o vício no ID antigo
        mem_ProviderId = null;
        mem_BasePrice = 0;
        console.log("✅ Memória de solicitação limpa. Pronto para um novo pedido.");
    } catch (e) { 
        console.error("Erro ao enviar:", e);
        alert("Erro técnico: " + e.message); 
        if(btn) {
            btn.disabled = false;
            btn.innerText = "TENTAR NOVAMENTE";
        }
    }
}
// ============================================================================
// FUNÇÃO AUXILIAR GLOBAL (Para o botão de sucesso funcionar)
// ============================================================================
window.irParaChatComSucesso = (orderId) => {
    // 1. Fecha o modal
    document.getElementById('request-modal')?.classList.add('hidden');
    
    // 2. Troca de aba
    if(window.switchTab) window.switchTab('chat');
    
    // 3. Abre a conversa específica
    setTimeout(async () => {
        if(window.abrirChatPedido) {
            window.abrirChatPedido(orderId);
        } else {
            // Fallback de segurança se o chat.js não carregou
            const chatModule = await import('./chat.js');
            if(chatModule.abrirChatPedido) {
                window.abrirChatPedido = chatModule.abrirChatPedido;
                chatModule.abrirChatPedido(orderId);
            }
        }
    }, 500);
};
// ============================================================================
// 2. LÓGICA DE INTERRUPÇAO FÍSICA DO RADAR
// ============================================================================
// Controle de estado usando a window para permitir reset externo
window.radarIniciado = false;
let radarUnsubscribe = null;

export async function iniciarRadarPrestador(uidManual = null) {
    const uid = uidManual || auth.currentUser?.uid;
    if (!uid) return;

    // 🛡️ TRAVA DE SEGURANÇA V12.1 (Resetável via Window)
    if (window.radarIniciado) {
        console.log("🛰️ [SISTEMA] Radar já está operando.");
        return;
    }
  if (radarUnsubscribe) radarUnsubscribe();

    const configRef = doc(db, "settings", "financeiro");
    
    getDoc(configRef).then(s => { 
        if(s.exists()) {
            const data = s.data();
            let taxaPlataforma = parseFloat(data.taxa_plataforma || 0);
            if (taxaPlataforma > 1) taxaPlataforma = taxaPlataforma / 100;

            window.CONFIG_FINANCEIRA = {
                taxa: taxaPlataforma, // Taxa para exibição de lucro no card
                limite: parseFloat(data.limite_divida || 0)
            };
            console.log("💰 [RADAR] Configurações financeiras sincronizadas.");
        }
    });

    garantirContainerRadar();

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    
    radarUnsubscribe = onSnapshot(q, (snapshot) => {
        const toggle = document.getElementById('online-toggle');
        
       if (toggle && !toggle.checked) {
            window.pararRadarFisico();
            garantirContainerRadar();
            return;
        }

        window.radarIniciado = true; 
        garantirContainerRadar();

       // 1. Captura todos os pedidos pendentes do snapshot
        const pedidosVivos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => !window.REJEITADOS_SESSAO.has(p.id));

        // 2. MOTOR DE PRIORIDADE: Vermelhos (Bloqueados) no TOPO ABSOLUTO, depois valor.
        const ordenados = pedidosVivos.sort((a, b) => {
            const aBloqueado = a.is_blocked_by_wallet === true || a.status_bloqueio === 'active';
            const bBloqueado = b.is_blocked_by_wallet === true || b.status_bloqueio === 'active';

            if (aBloqueado && !bBloqueado) return -1;
            if (!aBloqueado && bBloqueado) return 1;
            return (parseFloat(b.offer_value) || 0) - (parseFloat(a.offer_value) || 0);
        });

        const container = document.getElementById('radar-container');
        const waitContainer = document.getElementById('radar-wait-list');

        // Limpa visualmente para reordenar (opcional, dependendo da sua frequência de atualização)
        // Se preferir manter os cards vivos, ignore a limpeza e use prepend/append inteligente
        
        ordenados.forEach((pedido, index) => {
            const isPendente = pedido.is_blocked_by_wallet === true;
            const jaEstacionou = window.ESTACIONADOS_SESSAO.has(pedido.id);
            
            // O FOCO (Card Grande Azul) é o primeiro que não estacionou e não é vermelho
            const isFoco = (index === 0 && !jaEstacionou && !isPendente);

            if (isPendente) {
                // 🚀 FORÇA: Card Vermelho sempre no Container Principal (Topo)
                createRequestCard(pedido, true, container);
            } else if (isFoco) {
                // Card Grande Azul (Destaque)
                createRequestCard(pedido, false, container);
            } else {
                // Pílulas (Lista de espera)
                createRequestCard(pedido, false, waitContainer || container);
            }
        });

        // 3. Trata remoções
        snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") removeRequestCard(change.doc.id);
        });

        const emptyState = document.getElementById('radar-empty-state');
        if (emptyState) {
            if (snapshot.empty) emptyState.classList.remove('hidden');
            else emptyState.classList.add('hidden');
        }
    }, (error) => {
        console.error("❌ Erro no Snapshot do Radar:", error);
        window.radarIniciado = false;
    });
}

window.alternarMinimizacao = (id) => {
    const card = document.getElementById(`req-${id}`);
    const detalhes = document.getElementById(`detalhes-${id}`);
    const btn = document.getElementById(`btn-min-${id}`);
    
    if (card && detalhes) {
        const agoraMinimizado = card.classList.toggle('minimized');
        detalhes.classList.toggle('hidden');
        if(btn) btn.innerHTML = agoraMinimizado ? "+" : "&minus;";
    }
};

// ============================================================================
// 3. CARD DE SOLICITAÇÃO (ESTILO UBER/99 - VERSÃO PREMIUM GLOW)
// ============================================================================

function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) {
        card.classList.add('removing');
        setTimeout(() => card.remove(), 300);
    }
}
// ============================================================================
// 3. CARD DE SOLICITAÇÃO (ESTILO UBER/99 - VERSÃO PREMIUM GLOW)
// ============================================================================
export function createRequestCard(pedido, forceRed = false, targetContainer = null) {
    const container = targetContainer || document.getElementById('radar-container');
    if (!container || document.getElementById(`req-${pedido.id}`)) return;

    const isBlocked = pedido.is_blocked_by_wallet === true || forceRed === true;
    
    // Se nasceu um card vermelho, o sistema "lembra" disso para a limpeza futura
    if (isBlocked) window.HOUVE_BLOQUEIO_SESSAO = true;

    // 🔓 DESTRAVA VISUAL: Garante que o container apareça antes do áudio ou do card
    container.classList.remove('hidden');
    container.style.display = "block";
    const emptyState = document.getElementById('radar-empty-state');
    if(emptyState) emptyState.classList.add('hidden');

    // 🔊 LÓGICA DE ÁUDIO ÚNICO EM LOOP (ESTILO UBER/99)
    try {
        // Só inicia se não houver nenhum som tocando agora
        if (!window.audioRadarAtivo || window.audioRadarAtivo.paused) {
            window.audioRadarAtivo = new Audio('https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg');
            window.audioRadarAtivo.loop = true; // Faz o áudio repetir enquanto houver card
            window.audioRadarAtivo.volume = 1.0;
            window.audioRadarAtivo.play().catch(e => console.log("🔊 Aguardando interação para liberar som..."));
        }
    } catch(e) { console.warn("Erro no motor de áudio"); }
    const regras = window.CONFIG_FINANCEIRA || { taxa: 0, limite: 0 };
    const valorTotal = parseFloat(pedido.offer_value || 0);
    const taxaValor = valorTotal * regras.taxa;
    const lucroLiquido = valorTotal - taxaValor;

    let dataDisplay = pedido.data && pedido.data !== "A combinar" ? pedido.data : "Hoje";
    let horaDisplay = pedido.hora && pedido.hora !== "A combinar" ? pedido.hora : "Agora";

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;

    if (window.ESTACIONADOS_SESSAO.has(pedido.id)) {
        const classePilula = isBlocked ? "atlivio-pill is-red" : "atlivio-pill";
        card.className = `${classePilula} animate-fadeIn mb-2 flex items-center gap-3 bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-lg`;
        card.innerHTML = `
            <div class="flex items-center justify-center w-9 h-9 rounded-full ${isBlocked ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.3)]'} border text-sm transition-all">
                ${isBlocked ? '🔴' : '💵'}
            </div>
            <div class="flex flex-col min-w-0 flex-1 leading-tight">
                <span class="text-[7px] text-orange-400 font-black uppercase tracking-widest animate-pulse">🔥 OPORTUNIDADE DISPUTADA</span>
                <span class="text-white font-black text-[11px] uppercase tracking-tighter truncate">R$ ${valorTotal.toFixed(0)} • ${pedido.client_name}</span>
                <span class="text-gray-400 text-[8px] uppercase font-bold italic truncate opacity-70">${pedido.service_title || 'Serviço Geral'} • ${horaDisplay}</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="hidden xs:flex flex-col items-end mr-1 text-[8px] font-bold text-green-400 uppercase leading-none">
                    <span>Lucro</span>
                    <span>R$ ${lucroLiquido.toFixed(2)}</span>
                </div>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-[10px] font-black text-white shadow-lg transition-all active:scale-95">
                    ACEITAR
                </button>
                <button onclick="window.rejeitarPermanente('${pedido.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-gray-500 hover:text-red-400 transition-colors">×</button>
            </div>
        `;
    } else if (isBlocked) {
        card.className = "request-card is-red-alert relative mb-6 bg-red-900 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.5)] border border-red-500/50 overflow-hidden animate-slideInDown";
        card.style.width = "100%";
        card.style.flexShrink = "0";
        card.innerHTML = `
            <div class="p-6 text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-full bg-red-600/20 animate-pulse z-0"></div>
                <span class="relative z-10 bg-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest text-white shadow-lg border border-white/20">
                    ⚠️ OPORTUNIDADE EM RISCO
                </span>
                <h2 class="relative z-10 text-white text-5xl font-black mt-3 tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    R$ ${valorTotal.toFixed(0)}
                </h2>
                <p class="relative z-10 text-[9px] font-bold text-red-200 uppercase mt-2 italic px-2">
                    OUTROS PROFISSIONAIS ESTÃO AVALIANDO! RECARREGUE AGORA.
                </p>
            </div>
            <div class="bg-white/5 p-4 mx-4 rounded-xl border border-white/5 backdrop-blur-sm relative z-10">
                <div class="flex items-start gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-xl shadow-lg border border-red-400">👤</div>
                    <div>
                        <p class="text-white text-sm font-bold leading-tight">${pedido.client_name || 'Cliente'}</p>
                        <p class="text-red-400 text-[10px] uppercase font-bold">Status: Bloqueado por Saldo</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">📍</span><p class="text-xs font-medium leading-tight line-clamp-2">${pedido.location || 'Local a combinar'}</p></div>
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">🛠️</span><p class="text-xs font-medium text-red-300 uppercase">${pedido.service_title || 'Serviço Geral'}</p></div>
                </div>
            </div>
            <div class="p-4 pt-1 relative z-10 flex flex-col">
                <div id="countdown-${pedido.id}" class="text-center text-white font-black text-xl mb-1 tracking-tighter drop-shadow-md animate-pulse">
                    10:00
                </div>
                <button onclick="window.switchTab('ganhar')" class="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-2xl animate-bounce-subtle border border-red-400/30 transition flex items-center justify-center gap-2">
                    RECARREGUE AGORA 💳
                </button>
                <button onclick="window.rejeitarPermanente('${pedido.id}')" class="w-full text-red-300/50 text-[10px] font-bold uppercase hover:text-red-300 transition underline">Ignorar pedido</button>
            </div>
            <div class="h-1.5 bg-slate-800 w-full relative z-10">
                <div id="timer-${pedido.id}" class="h-full bg-gradient-to-r from-orange-600 to-red-700 w-full transition-[width] duration-[600000ms] ease-linear"></div>
            </div>
        `;
    } else {
        card.className = "request-card relative mb-6 bg-slate-900 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.6)] border border-blue-500/40 overflow-hidden animate-slideInDown";
        card.style.width = "100%";
        card.style.flexShrink = "0";
        card.innerHTML = `
            <div class="p-6 text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-full bg-blue-600/30 animate-pulse z-0"></div>
                <span class="relative z-10 bg-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest text-white shadow-lg border border-white/20">
                    🚀 Nova Oportunidade
                </span>
                <h2 class="relative z-10 text-white text-5xl font-black mt-3 tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    R$ ${valorTotal.toFixed(0)}
                </h2>
                <div class="relative z-10 flex justify-center gap-3 mt-2 text-[10px] font-bold uppercase opacity-90 text-white">
                    <span class="bg-red-500/20 px-2 py-1 rounded text-red-300">Taxa: -R$ ${taxaValor.toFixed(2)}</span>
                    <span class="bg-green-500/20 px-2 py-1 rounded text-green-300">Seu Lucro: R$ ${lucroLiquido.toFixed(2)}</span>
                </div>
            </div>
            <div class="bg-white/5 p-4 mx-4 rounded-xl border border-white/5 backdrop-blur-sm relative z-10">
                <div class="flex items-start gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-xl shadow-lg border border-blue-400">👤</div>
                    <div>
                        <p class="text-white text-sm font-bold leading-tight">${pedido.client_name || 'Cliente'}</p>
                        <p class="text-gray-400 text-[10px] uppercase font-bold">⭐ Novo Cliente</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">📍</span><p class="text-xs font-medium leading-tight line-clamp-2">${pedido.location || 'Local a combinar'}</p></div>
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">📅</span><p class="text-xs font-medium">${dataDisplay} às ${horaDisplay}</p></div>
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">🛠️</span><p class="text-xs font-medium text-blue-300 uppercase">${pedido.service_title || 'Serviço Geral'}</p></div>
                </div>
            </div>
            <div class="p-4 grid grid-cols-[1fr_2fr] gap-3 relative z-10">
                <button onclick="window.rejeitarPermanente('${pedido.id}')" class="bg-white/10 hover:bg-red-500/80 text-white py-4 rounded-xl font-bold text-xs uppercase transition border border-white/5">Ignorar</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-[0_0_20px_rgba(34,197,94,0.4)] transform active:scale-95 transition flex items-center justify-center gap-2 border border-green-400/30">
                    <span>⚡</span> ACEITAR AGORA
                </button>
            </div>
            <div class="h-1.5 bg-slate-800 w-full relative z-10">
                <div id="timer-${pedido.id}" class="h-full bg-gradient-to-r from-orange-500 to-red-600 w-full transition-all duration-[30000ms] ease-linear"></div>
            </div>
        `;
    }

   // 🚀 RESTAURAÇÃO: Cards vermelhos ou novos pedidos sempre assumem o topo absoluto
    if (isBlocked || !targetContainer || targetContainer.id === 'radar-container') {
        container.prepend(card);
    } else {
        targetContainer.appendChild(card);
    }
    const antena = document.getElementById('radar-empty-state');
    if (antena) antena.classList.add('hidden');

    // Força os 10 minutos (600.000ms) se for um card vermelho/bloqueado
    const tempoExposicao = (pedido.is_blocked_by_wallet || forceRed) ? 600000 : 30000;

    setTimeout(() => { 
        const t = document.getElementById(`timer-${pedido.id}`); 
        if(t) t.style.width = '0%'; 
    }, 100);

    setTimeout(() => { 
        const el = document.getElementById(`req-${pedido.id}`);
        if(el) {
            if(!isBlocked && !el.classList.contains('atlivio-pill')) {
                // ESTACIONAMENTO: Remove do topo e marca para o motor colocar na wait-list
                el.classList.add('removing');
                setTimeout(() => {
                    el.remove();
                    window.ESTACIONADOS_SESSAO.add(pedido.id);
                    // O motor do onSnapshot cuidará de renderizar na pílula na próxima atualização
                    // ou forçamos a chamada aqui:
                    const waitList = document.getElementById('radar-wait-list');
                    createRequestCard(pedido, false, waitList || document.getElementById('radar-container'));
                }, 300);
            } else {
                removeRequestCard(pedido.id);
            }
        }
    }, tempoExposicao);

// 🤖 MOTOR DO RELÓGIO (SINCRONIZADO COM A BARRA) - PONTO CRTÍTICO MOTOR DO CRONOMETRO DO CARD VERMELHO
    if (isBlocked) {
        let segundosRestantes = 600; // 10 Minutos
        const timerTexto = document.getElementById(`countdown-${pedido.id}`);

        const cronometro = setInterval(() => {
            if (!document.getElementById(`req-${pedido.id}`)) {
                clearInterval(cronometro);
                return;
            }

            segundosRestantes--;
            const m = Math.floor(segundosRestantes / 60);
            const s = segundosRestantes % 60;
            
            if (timerTexto) {
                timerTexto.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }

            if (segundosRestantes <= 0) {
                clearInterval(cronometro);
                removeRequestCard(pedido.id);
            }
        }, 1000);
      }
    }
// ============================================================================
// 4. LÓGICA DE ACEITE (BLOQUEIO PRESTADOR: LIMITE + RESERVA ACEITE)
// ============================================================================
export async function aceitarPedidoRadar(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        // Se ele tentou aceitar, desarmamos o exterminador para esta ação
        window.HOUVE_BLOQUEIO_SESSAO = false;
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            removeRequestCard(orderId);
            return alert("Este pedido expirou ou foi cancelado.");
        }

        const pedidoData = orderSnap.data();
        const currentUser = auth.currentUser;
        const valorServico = parseFloat(pedidoData.offer_value || 0);

       // 🛡️ VALIDAÇÃO FINANCEIRA HÍBRIDA (Real + Bônus)
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (!userDoc.exists()) throw "Perfil do prestador não localizado.";
        const userData = userDoc.data();
        
        // 🎯 SINCRONIA V14: Soma o saldo real ao bônus
        const saldoReal = parseFloat(userData.wallet_balance || 0);
        const saldoBonus = parseFloat(userData.wallet_bonus || 0);
        const saldoTotalParaAceite = saldoReal + saldoBonus;
        const configSnap = await getDoc(doc(db, "settings", "financeiro"));
        const configData = configSnap.exists() ? configSnap.data() : { porcentagem_reserva: 0, limite_divida: 0 };
        
        // Lendo 'limite_divida' conforme imagem do Firestore
        const limiteDivida = parseFloat(configData.limite_divida || 0);
        const pctReservaPrestador = parseFloat(configData.porcentagem_reserva || 0);

        //PONTO CRÍTICO SOLUÇÃO BÔNUSLINHAS ANTES 516 A 519 DEPOIS 517 A 520
        // 1. Bloqueio por Limite de Dívida (Considerando saldo total disponível)
        if (limiteDivida !== 0 && saldoTotalParaAceite < limiteDivida) {
            return alert(`⛔ OPERAÇÃO NEGADA\n\nSeu saldo total (R$ ${saldoTotalParaAceite.toFixed(2)}) atingiu o limite de dívida permitido.`);
        }
        //PONTO CRÍTICO SOLUÇÃO BÔNUS - LINHAS ANTES 521 A 527  DEPOIS 522 A 528
        // 2. Bloqueio por % Reserva Aceite (Usa o bônus primeiro como proteção)
        if (pctReservaPrestador > 0) {
            const valorReserva = valorServico * (pctReservaPrestador / 100);
            if (saldoTotalParaAceite < valorReserva) {
                // 1. Limpeza física e de memória
                const cardAntigo = document.getElementById(`req-${orderId}`);
                if (cardAntigo) cardAntigo.remove();
                window.ESTACIONADOS_SESSAO.delete(orderId);

                // 2. CRIAÇÃO PRIORITÁRIA (Antes do alert)
                const containerAlvo = document.getElementById('radar-container');
                if (containerAlvo) {
                    containerAlvo.classList.remove('hidden');
                    containerAlvo.style.display = "block";
                }
                
                createRequestCard({ ...pedidoData, id: orderId, is_blocked_by_wallet: true }, true, containerAlvo);

                // 3. Notificação final
                setTimeout(() => {
                    alert(`⛔ SALDO INSUFICIENTE\n\nReserva de Aceite necessária: R$ ${valorReserva.toFixed(2)}.`);
                }, 100);
                return;
            }
        }
       // EXECUÇÃO DO ACEITE (Padronizado para Filtros Blindados)
        await updateDoc(orderRef, { 
            status: 'accepted', 
            accepted_at: serverTimestamp(),
            last_interaction_at: serverTimestamp(), // Reseta cronômetro Lazarus no aceite
            system_step: 1,
            chat_lifecycle_status: 'active',
            timer_initialized: false 
        });
        await setDoc(doc(db, "chats", orderId), { 
            status: 'active', 
            updated_at: serverTimestamp(), 
            participants: [currentUser.uid, pedidoData.client_id] 
        }, { merge: true });

        removeRequestCard(orderId);
        
        if(window.switchTab) {
            window.switchTab('chat'); 
            setTimeout(() => {
                 if(window.abrirChatPedido) window.abrirChatPedido(orderId);
            }, 500);
        }

    } catch (e) { 
        console.error("Erro no aceite:", e);
        alert("Erro técnico ao processar o aceite."); 
    }
}
export async function recusarPedidoReq(orderId) {
    removeRequestCard(orderId);
    window.HOUVE_BLOQUEIO_SESSAO = true; 
    try { 
        await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true });
        // Se o radar estiver instável (bug do vazio), força cura
        setTimeout(() => garantirContainerRadar(), 500);
    } catch(e) { console.error(e); }
}

// ============================================================================
// EXPOSIÇÃO GLOBAL E LIMPEZA
// ============================================================================

// Bindings Globais (Sistema de Exposição V22)
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.iniciarRadarPrestador = iniciarRadarPrestador;
window.createRequestCard = createRequestCard;
window.irParaChatComSucesso = irParaChatComSucesso;

// Garantias de acesso
if(typeof createRequestCard !== 'undefined') window.createRequestCard = createRequestCard;
if(typeof alternarMinimizacao !== 'undefined') window.alternarMinimizacao = alternarMinimizacao;

/**
 * 🛠️ RECUPERAÇÃO DE PEDIDO (AÇÃO AUDITORIA)
 */
window.recuperarPedidoRadar = async (orderId) => {
    const orderSnap = await getDoc(doc(db, "orders", orderId));
    if (orderSnap.exists()) {
        createRequestCard({ id: orderId, ...orderSnap.data() });
        console.log("✅ Pedido recuperado para o Radar.");
    }
};

// Memória volátil para a sessão atual
window.REJEITADOS_SESSAO = new Set();

window.rejeitarPermanente = async (orderId) => {
    // 1. Remove visualmente da tela imediatamente
    removeRequestCard(orderId);
    
    // 2. Salva na memória da sessão
    window.REJEITADOS_SESSAO.add(orderId);

    // 3. Registra rejeição no banco e marca rastro para limpeza preventiva
    window.HOUVE_BLOQUEIO_SESSAO = true; 
    try {
        const orderRef = doc(db, "orders", orderId);
        const uid = auth.currentUser.uid;
        
        await updateDoc(orderRef, {
            [`rejeitado_por.${uid}`]: true,
            status_rejeicao: 'skipped'
        });
        
        console.log("🚫 Ordem marcada como 'sem interesse'.");
    } catch (e) {
        console.warn("Erro ao registrar rejeição:", e);
    }
    // 🚀 CHAMA AUTO-CURA IMEDIATA: Garante que o radar volte se este era o último card
    setTimeout(() => {
        if (typeof garantirContainerRadar === 'function') garantirContainerRadar();
    }, 400);
};

// 🛰️ EXPOSIÇÃO DE INTERFACE (Abertura de Escopo V28)
window.garantirContainerRadar = garantirContainerRadar;
window.pararRadarFisico = function() {
    if (radarUnsubscribe) {
        // 🚀 GATILHO MESTRE: Checa se houve bloqueio na memória OU se o card ainda está na tela
        const precisaLimpar = window.HOUVE_BLOQUEIO_SESSAO || document.querySelector('.is-red-alert') || document.querySelector('.is-red');
        
        radarUnsubscribe();
        radarUnsubscribe = null;
        window.radarIniciado = false;
        console.log("🛑 [SISTEMA] Radar desligado fisicamente.");

        if (precisaLimpar) {
            console.warn("⚠️ Rastro de bloqueio detectado. Executando auto-limpeza nuclear...");
            setTimeout(() => {
                if(typeof window.executarLimpezaNuclear === 'function') {
                    window.executarLimpezaNuclear();
                }
            }, 500);
        }
    }
};

// ☢️ ESCUTA DE LIMPEZA GLOBAL (Sincronizado com Admin)
(function() {
    const tempoAberturaApp = Date.now();
    setTimeout(() => {
        onSnapshot(doc(db, "settings", "deploy"), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const dataUpdate = data.force_reset_timestamp?.toDate().getTime();
                
                if (dataUpdate && dataUpdate > tempoAberturaApp) {
                    console.warn("☢️ ORDEM RECEBIDA: Limpando sistema por ordem do Admin...");
                    if (typeof window.executarLimpezaNuclear === 'function') {
                        window.executarLimpezaNuclear();
                    }
                }
            }
        });
    }, 5000); 
})();
