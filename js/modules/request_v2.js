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
// 0. FUNÇÃO DE AUTO-CURA DO HTML (O SEGREDO)
// ============================================================================
function garantirContainerRadar() {
    let container = document.getElementById('radar-container');
    const parent = document.getElementById('pview-radar');
    const emptyState = document.getElementById('radar-empty-state');

    // Se o container sumiu mas o pai existe, recria o container
    if (!container && parent) {
        container = document.createElement('div');
        container.id = 'radar-container';
        container.className = "flex flex-col gap-3 w-full max-w-[400px] mx-auto z-[8000] relative py-2";
        parent.prepend(container); 
    }

    // Gerencia a visibilidade do estado vazio (📡)
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

export async function enviarPropostaAgora() {
    const user = auth.currentUser;
    const config = window.configFinanceiroAtiva || { valor_minimo: 20, valor_maximo: 500 };
    
    if (mem_CurrentOffer < config.valor_minimo || mem_CurrentOffer > config.valor_maximo) {
        return alert(`⛔ Valor fora do permitido (R$ ${config.valor_minimo} - R$ ${config.valor_maximo})`);
    }

    try {
        const dataServico = document.getElementById('req-date')?.value || "A combinar";
        const horaServico = document.getElementById('req-time')?.value || "A combinar";

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

        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp()
        });

        alert("✅ SOLICITAÇÃO ENVIADA! Redirecionando para o chat...");
        const modal = document.getElementById('request-modal');
        if(modal) modal.classList.add('hidden');

        if(window.switchTab) {
            window.switchTab('chat');
            setTimeout(() => {
                if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
            }, 600);
        }

    } catch (e) { 
        console.error("Erro ao enviar:", e);
        alert("Erro: " + e.message); 
    }
}

// ============================================================================
// 2. LÓGICA DE INTERRUPÇAO FÍSICA DO RADAR
// ============================================================================
let radarUnsubscribe = null;

export async function iniciarRadarPrestador(uidManual = null) {
    const uid = uidManual || auth.currentUser?.uid;
    if (!uid) return;

    if (radarUnsubscribe) radarUnsubscribe();

    // Sincroniza configurações financeiras do banco para o cálculo de taxas do card
    const configRef = doc(db, "settings", "financeiro");
    getDoc(configRef).then(s => { 
        if(s.exists()) window.CONFIG_FINANCEIRA = s.data(); 
    });

    // Certifica-se de que o container existe antes de começar a ouvir o banco
    garantirContainerRadar();

    // Escuta a coleção 'orders' (Certifique-se que o cliente está gravando em 'orders')
    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    
    radarUnsubscribe = onSnapshot(q, (snapshot) => {
        const toggle = document.getElementById('online-toggle');
        
        // Se o prestador desligar o botão, para o radar
        if (toggle && !toggle.checked) {
            window.pararRadarFisico();
            return;
        }

        // Auto-cura do DOM em cada mudança do banco
        garantirContainerRadar();

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                createRequestCard({ id: change.doc.id, ...change.doc.data() });
            }
            if (change.type === "removed") {
                removeRequestCard(change.doc.id);
            }
        });

        // Atualiza o Empty State após processar as mudanças
        garantirContainerRadar();
    });
}

window.pararRadarFisico = () => {
    if (radarUnsubscribe) {
        radarUnsubscribe();
        radarUnsubscribe = null;
    }
    // ✅ CORREÇÃO DO ERRO 'NULL': Só limpa se existir
    const container = document.getElementById('radar-container');
    if (container) container.innerHTML = "";
};

auth.onAuthStateChanged(user => {
    if (user) {
        const toggle = document.getElementById('online-toggle');
        if(toggle && toggle.checked) iniciarRadarPrestador(user.uid);
    }
});

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

function createRequestCard(pedido) {
    const container = garantirContainerRadar();
    if (document.getElementById(`req-${pedido.id}`)) return;

    // 🛡️ Filtro de Rejeição Local: Se o prestador já rejeitou este pedido nesta sessão, não mostra
    if (window.REJEITADOS_SESSAO && window.REJEITADOS_SESSAO.has(pedido.id)) return;

    if (container.children.length >= 5) {
        const oldest = container.lastElementChild;
        if (oldest) oldest.remove();
    }

    const audio = document.getElementById('notification-sound');
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }

    const regrasAtivas = window.CONFIG_FINANCEIRA || { taxa: 0.20, limite: 0 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * regrasAtivas.taxa; 
    const lucro = valor - taxa;
    const saldo = window.userProfile?.wallet_balance || 0;
    const temSaldoParaTaxa = (saldo - taxa) >= regrasAtivas.limite;

    const cardBg = temSaldoParaTaxa ? "bg-[#0f172a]" : "bg-red-700 animate-pulse";
    const statusTag = temSaldoParaTaxa ? "bg-blue-600" : "bg-white text-red-700 shadow-lg";

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = `request-card ${cardBg} p-0 animate-slideInDown relative overflow-hidden w-full transition-all duration-300 rounded-2xl shadow-2xl border border-white/10`;
    
    card.innerHTML = `
        <button onclick="window.rejeitarPermanente('${pedido.id}')" 
            class="absolute top-3 left-3 z-[101] text-white/50 bg-white/10 rounded-full w-6 h-6 flex items-center justify-center font-bold hover:bg-red-600 hover:text-white transition shadow-sm"
            title="Não tenho interesse">
            &times;
        </button>

        <button id="btn-min-${pedido.id}" onclick="window.alternarMinimizacao('${pedido.id}')" 
            class="absolute top-3 right-3 z-[100] text-white bg-black/20 rounded-full w-8 h-8 flex items-center justify-center font-bold border border-white/10 shadow-lg hover:bg-black/40 transition">
            &minus;
        </button>

        <div class="p-5 text-center">
            <span class="${statusTag} text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-fade">
                ${temSaldoParaTaxa ? "Nova Solicitação" : "⚠️ SALDO INSUFICIENTE"}
            </span>
            <h2 class="text-white text-5xl font-black mt-4 tracking-tighter">R$ ${valor.toFixed(0)}</h2>
            <div class="flex justify-center gap-3 mt-2 text-[10px] font-bold uppercase opacity-80 text-white">
                <span class="text-red-300">Taxa: -R$ ${taxa.toFixed(2)}</span>
                <span class="text-green-300">Lucro: R$ ${lucro.toFixed(2)}</span>
            </div>
        </div>

        <div id="detalhes-${pedido.id}" class="pb-4 transition-all duration-500">
            <div class="bg-black/20 mx-4 p-4 rounded-xl border border-white/5 text-white">
                <p class="text-xs font-bold mb-1 flex items-center gap-2">👤 ${pedido.client_name || 'Cliente'}</p>
                <p class="text-[11px] opacity-70 mb-1 flex items-center gap-2">📍 ${pedido.location || 'A combinar'}</p>
                <p class="text-[11px] text-yellow-400 font-mono flex items-center gap-2">🕒 Expira em: <span id="countdown-${pedido.id}">30s</span></p>
            </div>
            
            <div class="p-4 text-center">
                ${temSaldoParaTaxa ? `
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="window.rejeitarPermanente('${pedido.id}')" class="bg-white/10 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-red-600 transition">Pular</button>
                        <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-500 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg transform active:scale-95 transition">✔ ACEITAR</button>
                    </div>
                ` : `
                    <button onclick="window.switchTab('ganhar')" class="w-full bg-white text-red-700 py-4 rounded-xl font-black text-xs uppercase shadow-2xl animate-bounce">
                        💰 RECARREGAR E ACEITAR
                    </button>
                `}
            </div>
        </div>
        
        <div class="absolute bottom-0 left-0 h-1 bg-black/20 w-full">
            <div class="h-full bg-green-400 w-full transition-all duration-[30000ms] ease-linear" id="timer-${pedido.id}"></div>
        </div>
    `;

    container.prepend(card);

    // Lógica de expiração original mantida
    setTimeout(() => { 
        if(document.getElementById(`timer-${pedido.id}`)) document.getElementById(`timer-${pedido.id}`).style.width = '0%';
    }, 100);

    setTimeout(() => { if(document.getElementById(`req-${pedido.id}`)) removeRequestCard(pedido.id); }, 30000);
}

function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) {
        card.classList.add('removing');
        setTimeout(() => card.remove(), 300);
    }
}

export async function aceitarPedidoRadar(orderId) {
    const orderRef = doc(db, "orders", orderId);
    
    try {
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
            removeRequestCard(orderId);
            return alert("Este pedido expirou ou foi cancelado.");
        }

        const pedidoData = orderSnap.data();
        const valorServico = parseFloat(pedidoData.offer_value || 0);

        // 🛡️ UNIFICAÇÃO DE VARIÁVEIS: Usa a mesma regra do visual (wallet.js)
        const regrasAtivas = window.CONFIG_FINANCEIRA || { taxa: 0, limite: 0 };
        const taxaCalculada = valorServico * regrasAtivas.taxa;

        // 🛑 Trava de Segurança V12: Usa a taxa calculada dinamicamente
        if (typeof window.podeTrabalhar === 'function') {
            if (!window.podeTrabalhar(taxaCalculada)) {
                // Não remove o card aqui para dar chance ao usuário de recarregar e tentar de novo
                console.warn("⚠️ Aceite impedido por falta de saldo/limite.");
                return;
            }
        }

        // ✅ Aceite Seguro (Etapa 1)
        await updateDoc(orderRef, { 
            status: 'accepted', 
            accepted_at: serverTimestamp(),
            system_step: 1,
            timer_initialized: false 
        });
        
        await setDoc(doc(db, "chats", orderId), { 
            status: 'active', 
            updated_at: serverTimestamp(),
            participants: [auth.currentUser.uid, pedidoData.client_id]
        }, { merge: true });

        removeRequestCard(orderId);
        
        if(window.switchTab) {
            window.switchTab('servicos'); 
            setTimeout(() => {
                 if(window.switchServiceSubTab) window.switchServiceSubTab('andamento');
            }, 500);
        }

    } catch (e) { 
        console.error("❌ Erro fatal no aceite unificado:", e);
        alert("Erro técnico ao aceitar. Tente novamente."); 
    }
}

export async function recusarPedidoReq(orderId) {
    removeRequestCard(orderId);
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
}

// ============================================================================
// EXPOSIÇÃO GLOBAL
// ============================================================================
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.iniciarRadarPrestador = iniciarRadarPrestador;

if(typeof createRequestCard !== 'undefined') window.createRequestCard = createRequestCard;
if(typeof alternarMinimizacao !== 'undefined') window.alternarMinimizacao = alternarMinimizacao;
window.pararRadarFisico = window.pararRadarFisico; // Fix para garantir acesso
/** * 🛡️ BLINDAGEM CONTRA SCRIPT FANTASMA
 * Neutraliza funções obsoletas que possam estar presas no cache do navegador.
 */
window.atualizarRadar = function() { 
    console.warn("🛡️ Uma função fantasma (atualizarRadar) tentou rodar e foi bloqueada pela V12.");
    return false; 
};
/**
 * 🛠️ RECUPERAÇÃO DE PEDIDO (AÇÃO AUDITORIA)
 * Permite que o prestador veja um pedido que "sumiu" mas ainda está pendente.
 */
window.recuperarPedidoRadar = async (orderId) => {
    const orderSnap = await getDoc(doc(db, "orders", orderId));
    if (orderSnap.exists()) {
        createRequestCard({ id: orderId, ...orderSnap.data() });
        console.log("✅ Pedido recuperado para o Radar.");
    }
};

/**
 * ⚖️ MAPEAMENTO DE ETAPAS DO SISTEMA
 * 1. Negociação (Chat Aberto)
 * 2. Garantia (Aguardando Reserva de Saldo)
 * 3. Execução (Cronômetro Rodando)
 * 4. Concluído (Pagamento Liberado)
 */
