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
        // MODO OFFLINE ABSOLUTO
        if(offlineState) offlineState.classList.remove('hidden');
        if(container) container.classList.add('hidden');
        if(emptyState) emptyState.classList.add('hidden');
        return container;
    } 

    // MODO ONLINE INICIAL (Mata o ZZZ. O Snapshot decide o resto)
    if(offlineState) offlineState.classList.add('hidden');
    
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
            garantirContainerRadar(); // Força a volta da imagem ZZZ
            return;
        }

        window.radarIniciado = true; 
        garantirContainerRadar();

        // 🧠 MOTOR DE PRIORIDADE V25 (ESTUDO DE DUPLICAÇÃO)
        const todosPedidos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const pedidosVivos = todosPedidos.filter(p => !window.REJEITADOS_SESSAO.has(p.id));

        // 💾 CACHE DE SISTEMA: Alimenta o Robô de Maximização Instantânea
        window.ULTIMOS_PEDIDOS_CACHED = pedidosVivos;

        const ordenados = pedidosVivos.sort((a, b) => {
            // 1. PRIORIDADE MÁXIMA: Pedido bloqueado por falta de saldo (Trava o funil)
            if (a.is_blocked_by_wallet && !b.is_blocked_by_wallet) return -1;
            if (!a.is_blocked_by_wallet && b.is_blocked_by_wallet) return 1;
            
            // 2. PRIORIDADE FINANCEIRA: Maior valor de oferta
            return (parseFloat(b.offer_value) || 0) - (parseFloat(a.offer_value) || 0);
        });

        const container = document.getElementById('radar-container');
        if (container) {
            // ✅ LIMPEZA ABSOLUTA: Mata qualquer resíduo antes de começar
            while (container.firstChild) { container.removeChild(container.firstChild); }
            
            const quinzeMinutosMs = 15 * 60 * 1000;
            // ✅ RENDERIZAÇÃO DIRETA NO RADAR (Sem linha de Espera)
            if (ordenados.length > 0) {
                ordenados.forEach((pedido, index) => {
                    const isPendente = pedido.is_blocked_by_wallet === true;
                    const isMuitoAntigo = (Date.now() - (pedido.created_at?.seconds * 1000)) > quinzeMinutosMs;
                    
                    const isFoco = (index === 0 && !isPendente && !isMuitoAntigo);

                    // Desenha os cards ou pílulas jogando diretamente dentro do container principal
                    createRequestCard(pedido, isFoco, container);
                });
            }
        }
        
        // ✅ CORREÇÃO: O Empty State e o Container obedecem a lista real filtrada
        const emptyState = document.getElementById('radar-empty-state');
        const radarContainer = document.getElementById('radar-container');
        
        if (ordenados.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            if (radarContainer) radarContainer.classList.add('hidden'); // Mata a div vazia
        } else {
            if (emptyState) emptyState.classList.add('hidden');
            if (radarContainer) radarContainer.classList.remove('hidden'); // Exibe a div com os cards
        }
    }, (error) => {
        console.error("❌ Erro no Snapshot do Radar:", error);
        window.radarIniciado = false;
    });
}

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
export function createRequestCard(pedido, isFoco = true, targetContainer = null) {
    const container = targetContainer || document.getElementById('radar-container');
    if (!container) return;
    const existingCard = document.getElementById(`req-${pedido.id}`);
    if (existingCard) {
        // Se o card já está no estado certo (Foco ou Pílula), não mexe nele para não resetar áudio/animação
        const isJaEraFoco = existingCard.classList.contains('request-card') && !existingCard.classList.contains('atlivio-pill');
        if (isJaEraFoco === isFoco) return existingCard;
        existingCard.remove();
    }
    // 🔊 RESTAURAÇÃO DO SOM ORIGINAL (PROTEGIDO)
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 1.0;
        audio.play().catch(e => console.log("Áudio bloqueado pelo navegador (interaja primeiro)."));
    } catch(e) { console.warn("Erro ao tocar som"); }

    const regras = window.CONFIG_FINANCEIRA || { taxa: 0, limite: 0 };
    const valorTotal = parseFloat(pedido.offer_value || 0);
    const taxaValor = valorTotal * regras.taxa;
    const lucroLiquido = valorTotal - taxaValor;

    let dataDisplay = pedido.data && pedido.data !== "A combinar" ? pedido.data : "Hoje";
    let horaDisplay = pedido.hora && pedido.hora !== "A combinar" ? pedido.hora : "Agora";

    const isBlocked = pedido.is_blocked_by_wallet === true;
    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;

    // ✅ CORREÇÃO V25: Verifica se é FOCO (Grande). Independente se é azul ou vermelho.
    if (isFoco) {
        if (isBlocked) {
            // BLOCO B: CARD VERMELHO (DUPLICAÇÃO REAL)
            // ✅ z-50 coloca o card à frente de outros elementos; animate-fadeIn é mais suave e evita saltos visuais
            // ✅ FLUXO LIVRE: Adicionamos 'h-fit' para o card se ajustar ao texto e 'block' para ocupar espaço real
            card.className = "request-card is-red-alert relative mb-12 bg-red-950 rounded-3xl shadow-[0_0_60px_rgba(220,38,38,0.7)] border-2 border-red-500 z-50 animate-fadeIn block h-fit w-full overflow-visible";
            card.innerHTML = `
                <div class="p-6 text-center relative">
                    <div class="absolute top-0 left-0 w-full h-full bg-red-600/20 animate-pulse"></div>
                    <span class="relative z-10 bg-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest text-white shadow-lg border border-white/20">
                        ⚠️ OPORTUNIDADE EM RISCO
                    </span>
                    <h2 class="relative z-10 text-red-50 text-5xl font-black mt-3 tracking-tighter drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
                        R$ ${valorTotal.toFixed(0)}
                    </h2>
                    <p class="relative z-10 text-[10px] font-black text-red-200 uppercase mt-2 italic px-4 leading-tight">
                        ⚠️ OUTROS PROFISSIONAIS JÁ ESTÃO AVALIANDO ESTA SOLICITAÇÃO!
                    </p>
                </div>
               <div class="bg-white/5 p-4 mx-4 rounded-xl border border-white/5 backdrop-blur-sm flex justify-between items-center gap-4 relative">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start gap-3 mb-3">
                            <div class="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-xl shadow-lg border border-red-400">👤</div>
                            <div>
                                <p class="text-white text-sm font-bold leading-tight">${pedido.client_name || 'Cliente'}</p>
                                <p class="text-red-400 text-[10px] uppercase font-bold tracking-tighter">Status: Bloqueado por Saldo</p>
                            </div>
                        </div>
                        <div class="space-y-2 opacity-80">
                            <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">📍</span><p class="text-[10px] font-medium leading-tight">${pedido.location || 'Local a combinar'}</p></div>
                            <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">🛠️</span><p class="text-[10px] font-black text-red-300 uppercase">${pedido.service_title || 'Serviço Geral'}</p></div>
                        </div>
                    </div>
                    <div id="timer-container-${pedido.id}" class="w-1.5 h-16 bg-slate-900/80 rounded-full overflow-hidden relative border border-white/10 flex-shrink-0"></div>
                </div>
                <div class="p-4 relative">
                    <button onclick="window.switchTab('ganhar')" class="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-2xl border border-red-400/30 transition">
                        RECARREGUE AGORA E TRABALHE 💳
                    </button>
                </div>
            `;

        } else {
            // BLOCO A: CARD AZUL (CARD ORIGINAL)
            card.className = `request-card relative mb-10 bg-slate-900 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.6)] border border-blue-500/40 flex flex-col h-auto min-h-[460px] flex-shrink-0 animate-slideInDown`;
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
                        <p class="text-gray-400 text-[10px] uppercase font-bold tracking-tighter">⭐ Cliente Atlivio</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">📍</span><p class="text-[10px] font-medium leading-tight line-clamp-1">${pedido.location || 'Local a combinar'}</p></div>
                    <div class="flex items-center gap-2 text-gray-300"><span class="text-lg">🛠️</span><p class="text-[10px] font-black text-blue-300 uppercase">${pedido.service_title || 'Serviço Geral'}</p></div>
                </div>
            </div>
                        <div class="px-6 mt-4 relative z-10 w-full">
                <div id="timer-container-${pedido.id}" class="w-full h-1.5 bg-slate-900/80 rounded-full overflow-hidden relative border border-white/10"></div>
            </div>
            <div class="p-4 grid grid-cols-[1fr_2fr] gap-3 relative z-10">
                <button onclick="window.rejeitarPermanente('${pedido.id}')" class="bg-white/10 hover:bg-red-500/80 text-white py-4 rounded-xl font-bold text-xs uppercase transition border border-white/5">Ignorar</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg transform active:scale-95 transition flex items-center justify-center gap-2 border border-green-400/30">
                    <span>⚡</span> ACEITAR AGORA
                </button>
          </div>
        `;
        }
    } else {
        // BLOCO C: A PÍLULA DE CONVERSÃO (LAYOUT GRID V25)
        const classePilula = isBlocked ? "atlivio-pill is-red" : "atlivio-pill";
        card.className = `${classePilula} animate-fadeIn mb-2`;
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
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="btn-ver-pill bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-[10px] font-black shadow-lg shadow-green-900/20 transition-all active:scale-90">ACEITAR</button>
                <button onclick="window.rejeitarPermanente('${pedido.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-gray-500 hover:text-red-400 transition-colors">×</button>
            </div>
        `;
    }
    
    if (targetContainer || container) {
        (targetContainer || container).appendChild(card);
    }

    // --- MOTOR DE ESTACIONAMENTO V30 (CORREÇÃO LATERAL) ---
    if (isFoco || isBlocked) {
        // ✅ TRAVA DE SEGURANÇA: Garante 10 minutos (600.000ms) para Bloqueados
        const duracao = isBlocked ? 600000 : 30000;
        const cor = isBlocked ? 'bg-red-500 shadow-[0_0_10px_#ff0000]' : 'bg-blue-500';
        const tContainer = card.querySelector(`#timer-container-${pedido.id}`);

        if (tContainer) {
            // ✅ SINCRONIA TOTAL: O CSS recebe exatamente os 600.000ms
            const timerHtml = isBlocked 
                ? `<div id="timer-${pedido.id}" class="absolute top-0 left-0 w-full ${cor}" style="height: 100%; transition: height ${duracao}ms linear;"></div>`
                : `<div id="timer-${pedido.id}" class="h-full ${cor} w-full" style="transition: width ${duracao}ms linear;"></div>`;
            tContainer.innerHTML = timerHtml;
            
            setTimeout(() => {
                const t = document.getElementById(`timer-${pedido.id}`);
                if (t) isBlocked ? t.style.height = '0%' : t.style.width = '0%';
            }, 100);
        }

       // ✅ TRAVA DE 10 MINUTOS: O Card só será removido após o tempo definido em 'duracao' (600s para bloqueados)
        setTimeout(() => {
            const el = document.getElementById(`req-${pedido.id}`);
            if (el) {
                if (isBlocked) {
                    // ✅ PERSISTÊNCIA: Card vermelho só morre após os 10 minutos (600s)
                    removeRequestCard(pedido.id);
                } else if (!el.classList.contains('atlivio-pill') && !isFoco) {
                    el.remove();
                    window.ESTACIONADOS_SESSAO.add(pedido.id);
                    const target = document.getElementById('radar-container');
                    // Garante que o retorno visual seja pílula apenas se não for bloqueado
                    createRequestCard(pedido, false, target);
                }
            }
        }, duracao);
    }
    return card;
}
// ============================================================================
// 4. LÓGICA DE ACEITE (BLOQUEIO PRESTADOR: LIMITE + RESERVA ACEITE)
// ============================================================================
export async function aceitarPedidoRadar(orderId) {
    const orderRef = doc(db, "orders", orderId);
    
    try {
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

        //PONTO CRÍTICO SOLUÇÃO BÔNUS LINHAS ANTES 516 A 519 DEPOIS 517 A 520
        // 1. Bloqueio por Limite de Dívida (Considerando saldo total disponível)
       if (limiteDivida !== 0 && saldoTotalParaAceite < limiteDivida) {
            document.getElementById(`req-${orderId}`)?.remove();
            // ✅ CORREÇÃO: Passamos 'true' para nascer como Card Grande Vermelho
            createRequestCard({ ...pedidoData, id: orderId, is_blocked_by_wallet: true }, true);
            return alert(`⛔ OPERAÇÃO NEGADA\n\nSeu saldo total (R$ ${saldoTotalParaAceite.toFixed(2)}) atingiu o limite de dívida permitido.`);
        }
        //PONTO CRÍTICO SOLUÇÃO BÔNUS - LINHAS ANTES 521 A 527  DEPOIS 522 A 528
        // 2. Bloqueio por % Reserva Aceite (Usa o bônus primeiro como proteção)
        if (pctReservaPrestador > 0) {
            const valorReserva = valorServico * (pctReservaPrestador / 100);
            if (saldoTotalParaAceite < valorReserva) {
                document.getElementById(`req-${orderId}`)?.remove();
                // ✅ CORREÇÃO: Passamos 'true' para nascer como Card Grande Vermelho
                createRequestCard({ ...pedidoData, id: orderId, is_blocked_by_wallet: true }, true);
                return alert(`⛔ SALDO INSUFICIENTE\n\nReserva de Aceite necessária: R$ ${valorReserva.toFixed(2)}.`);
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
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
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
// ✅ NOVA: Guarda quem já cumpriu os 30s e não deve mais subir sozinho
window.ESTACIONADOS_SESSAO = new Set();

window.rejeitarPermanente = async (orderId) => {
    // 1. Remove visualmente da tela imediatamente
    removeRequestCard(orderId);
    
    // 2. Salva na memória da sessão
    window.REJEITADOS_SESSAO.add(orderId);

    // 3. Registra rejeição no banco
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
};

// 🛰️ EXPOSIÇÃO DE INTERFACE (Abertura de Escopo V28)
window.garantirContainerRadar = garantirContainerRadar;
window.pararRadarFisico = function() {
    if (radarUnsubscribe) {
        radarUnsubscribe();
        radarUnsubscribe = null;
        window.radarIniciado = false;
        console.log("🛑 [SISTEMA] Radar desligado fisicamente.");
    }
};
