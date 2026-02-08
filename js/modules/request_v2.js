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
    onSnapshot, 
    getDoc, 
    updateDoc, 
    deleteDoc 
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
    if (!parent) return null;

    // 1. Garante que o container existe
    let container = document.getElementById('radar-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'radar-container';
        container.className = "flex flex-col gap-3 w-full max-w-[400px] mx-auto z-[8000] relative py-2";
        parent.appendChild(container);
    }

    // 🔥 CORREÇÃO DO SUMIÇO: Remove a classe 'hidden' se ela existir
    container.classList.remove('hidden');

    // 2. Garante que o Estado Vazio (Antena) existe
    let emptyState = document.getElementById('radar-empty-state');
    if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.id = 'radar-empty-state';
        emptyState.className = "flex flex-col items-center justify-center py-20 animate-fadeIn";
        emptyState.innerHTML = `
            <div class="relative flex h-24 w-24 items-center justify-center mb-4">
                <div class="animate-ping absolute h-full w-full rounded-full bg-blue-500 opacity-20"></div>
                <div class="relative bg-white rounded-full p-6 shadow-xl border-4 border-blue-600 text-4xl">📡</div>
            </div>
            <p class="text-xs font-black text-blue-900 uppercase tracking-widest animate-pulse">Procurando clientes ao seu redor...</p>
        `;
        parent.appendChild(emptyState);
    }

    // 3. Remove a tela de "Dormindo" se ela ainda estiver lá (limpeza visual)
    const offlineState = document.getElementById('radar-offline-state');
    if(offlineState) offlineState.remove();

    // 4. Lógica Visual (Tem card? Esconde antena.)
    if (container && emptyState) {
        const temCards = container.querySelectorAll('.request-card').length > 0;
        if (temCards) {
            emptyState.classList.add('hidden');
        } else {
            emptyState.classList.remove('hidden');
        }
    }

    return container;
}
// ============================================================================
// 1. MODAL DE SOLICITAÇÃO (CLIENTE)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
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
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">Enviando... ⏳</span>`;
    }

    try {
        const dataServico = document.getElementById('req-date')?.value || "A combinar";
        const horaServico = document.getElementById('req-time')?.value || "A combinar";

        // 2. CRIA O PEDIDO NO BANCO (SEM TRAVA FINANCEIRA)
        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            provider_id: mem_ProviderId,
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
            let taxaBruta = parseFloat(data.porcentagem_reserva || data.taxa_plataforma || 0);
            if (taxaBruta > 1) taxaBruta = taxaBruta / 100;

            window.CONFIG_FINANCEIRA = {
                taxa: taxaBruta,
                limite: parseFloat(data.limite_divida || 0)
            };
            console.log("💰 [RADAR] Taxas sincronizadas:", (taxaBruta * 100) + "%");
        }
    });

    garantirContainerRadar();

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    
    radarUnsubscribe = onSnapshot(q, (snapshot) => {
        const toggle = document.getElementById('online-toggle');
        
        if (toggle && !toggle.checked) {
            window.pararRadarFisico();
            return;
        }

        window.radarIniciado = true; 
        garantirContainerRadar();

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") createRequestCard({ id: change.doc.id, ...change.doc.data() });
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
export function createRequestCard(pedido) {
    const container = document.getElementById('radar-container');
    if (!container || document.getElementById(`req-${pedido.id}`)) return;

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

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = "request-card relative mb-6 bg-slate-900 rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.6)] border border-blue-500/40 overflow-hidden animate-slideInDown";
    card.style.maxWidth = "100%";

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
            <div id="timer-${pedido.id}" class="h-full bg-gradient-to-r from-green-500 to-yellow-400 w-full transition-all duration-[30000ms] ease-linear"></div>
        </div>
    `;

    container.prepend(card);
    const antena = document.getElementById('radar-empty-state');
    if (antena) antena.classList.add('hidden');

    setTimeout(() => { 
        const t = document.getElementById(`timer-${pedido.id}`); 
        if(t) t.style.width = '0%'; 
    }, 100);

    setTimeout(() => { 
        if(document.getElementById(`req-${pedido.id}`)) removeRequestCard(pedido.id); 
    }, 30000);
}
// ============================================================================
// 4. LÓGICA DE ACEITE (COM REDIRECIONAMENTO CORRETO PARA CHAT)
// ============================================================================
export async function confirmarAcordo(orderId, aceitar) {
    if(!aceitar) return;
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);

    try {
        let vaiFecharAgora = false;
        
        await runTransaction(db, async (transaction) => {
            // === 1. LEITURAS (READS) ===
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw "Pedido não encontrado!";
            const freshOrder = freshOrderSnap.data();

            const clientRef = doc(db, "usuarios", freshOrder.client_id);
            const clientSnap = await transaction.get(clientRef);
            if (!clientSnap.exists()) throw "Perfil do cliente não encontrado.";
            
            // Busca Configurações do Admin
            const configRef = doc(db, "settings", "financeiro");
            const configSnap = await transaction.get(configRef);
            const configData = configSnap.exists() ? configSnap.data() : { porcentagem_reserva: 0, porcentagem_reserva_cliente: 0, limite_debito: 0 };

            // Identificadores
            const isMeClient = uid === freshOrder.client_id;
            const isMeProvider = uid === freshOrder.provider_id;

            // =================================================================
            // 🛡️ VALIDAÇÃO FINANCEIRA CLIENTE (NO FECHAMENTO)
            // =================================================================
            if (isMeClient) {
                const saldoCliente = parseFloat(clientSnap.data().wallet_balance || clientSnap.data().saldo_atual || 0);
                const valorAcordo = parseFloat(freshOrder.offer_value || 0);
                const limiteDebito = parseFloat(configData.limite_debito || 0);

                // 1. Validação de Limite Global (Se configurado)
                if (limiteDebito !== 0 && saldoCliente < limiteDebito) {
                    throw `Seu saldo (R$ ${saldoCliente.toFixed(2)}) atingiu o limite de débito permitido (R$ ${limiteDebito.toFixed(2)}). Recarregue para continuar.`;
                }

                // 2. Validação de Reserva de Segurança (CLIENTE)
                // Usa porcentagem_reserva_cliente. Se não existir, assume 0 (Liberado).
                const pctReservaCliente = parseFloat(configData.porcentagem_reserva_cliente || 0);
                
                if (pctReservaCliente > 0) {
                    const valorReserva = valorAcordo * (pctReservaCliente / 100);
                    if (saldoCliente < valorReserva) {
                        throw `Garantia necessária: Você precisa de R$ ${valorReserva.toFixed(2)} em conta (${pctReservaCliente}% do valor) para proteger este serviço.`;
                    }
                }
            }
            // =================================================================

            // === LÓGICA DE CONFIRMAÇÃO ===
            const campoUpdate = isMeProvider ? { provider_confirmed: true } : { client_confirmed: true };
            const oOutroJaConfirmou = isMeProvider ? freshOrder.client_confirmed : freshOrder.provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou;

            // === ESCRITAS (WRITES) ===
            transaction.update(orderRef, campoUpdate);

            // SE AMBOS ACEITARAM -> EXECUTA A CUSTÓDIA
            if (vaiFecharAgora) {
                // Reaplica cálculo para efetivar o débito da reserva (se houver)
                const pctFinal = parseFloat(configData.porcentagem_reserva_cliente || 0);
                const valorPedido = parseFloat(freshOrder.offer_value || 0);
                const valorCofre = valorPedido * (pctFinal / 100);

                if (valorCofre > 0) {
                    const saldoAtual = parseFloat(clientSnap.data().wallet_balance || 0);
                    const reservadoAtual = parseFloat(clientSnap.data().wallet_reserved || 0);
                    
                    // Nota: Se passou da validação acima, saldoAtual >= valorCofre (ou está dentro do limite)
                    transaction.update(clientRef, {
                        wallet_balance: saldoAtual - valorCofre,
                        wallet_reserved: reservadoAtual + valorCofre
                    });
                }

                // Atualiza status do pedido
                transaction.update(orderRef, { 
                    system_step: 3, 
                    status: 'confirmed_hold',
                    value_reserved: valorCofre,
                    confirmed_at: serverTimestamp()
                });

                // Mensagem no chat
                const msgRef = doc(collection(db, `chats/${orderId}/messages`));
                transaction.set(msgRef, {
                    text: `🔒 ACORDO FECHADO: ${valorCofre > 0 ? `R$ ${valorCofre.toFixed(2)} retidos em garantia.` : 'Garantia isenta.'} Contato liberado!`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });

        if(vaiFecharAgora) {
            alert("✅ Acordo Fechado! O serviço pode começar.");
        } else {
            alert("✅ Confirmado! Aguardando a outra parte aceitar.");
        }

    } catch(e) { 
        console.error("Erro no acordo:", e);
        // Exibe erro limpo para o usuário (ex: Saldo insuficiente)
        alert("⛔ NÃO FOI POSSÍVEL FECHAR O ACORDO\n\n" + e);
    }
}
export async function recusarPedidoReq(orderId) {
    removeRequestCard(orderId);
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
}

// ============================================================================
// EXPOSIÇÃO GLOBAL E LIMPEZA
// ============================================================================

// Bindings Globais
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.iniciarRadarPrestador = iniciarRadarPrestador;
// Corrigido: Aponta para a função única e correta
window.pararRadarFisico = window.pararRadarFisico; 

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
