// ============================================================================
// js/modules/request.js - V10.1 (STACK + OFFLINE GUARD + TIMER)
// ============================================================================

import { db, auth } from '../config.js'; 
import { podeTrabalhar } from './wallet.js'; 
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE MEMÓRIA ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;
let mem_SelectedServiceTitle = ""; 

// ============================================================================
// 1. MODAL DE SOLICITAÇÃO (CLIENTE)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    // Sincroniza regras
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
        
        // Injeta botões de desconto dinâmicos
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

    // CORREÇÃO: Input type="number" exige PONTO. Não use vírgula aqui.
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
        // Captura valores dos inputs
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
            data: dataServico, // ✅ NOVO: Salva a data
            hora: horaServico, // ✅ NOVO: Salva a hora
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

    const configRef = doc(db, "settings", "financeiro");
    getDoc(configRef).then(s => { if(s.exists()) window.configFinanceiroAtiva = s.data(); });

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    
    radarUnsubscribe = onSnapshot(q, (snapshot) => {
        const toggle = document.getElementById('online-toggle');
        if (toggle && !toggle.checked) {
            window.pararRadarFisico();
            return;
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") createRequestCard({ id: change.doc.id, ...change.doc.data() });
            if (change.type === "removed") removeRequestCard(change.doc.id);
        });
    });
}

window.pararRadarFisico = () => {
    if (radarUnsubscribe) {
        radarUnsubscribe();
        radarUnsubscribe = null;
        document.getElementById('radar-container').innerHTML = "";
    }
};

auth.onAuthStateChanged(user => {
    if (user) {
        const toggle = document.getElementById('online-toggle');
        if(toggle && toggle.checked) iniciarRadarPrestador(user.uid);
    }
});
// 👇 LÓGICA DE MINIMIZAR (COLE ANTES DA FUNÇÃO createRequestCard)
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
    const container = document.getElementById('radar-container');
    if (!container) return;

    if (document.getElementById(`req-${pedido.id}`)) return;

    if (container.children.length >= 5) {
        const oldest = container.lastElementChild;
        if (oldest) oldest.remove();
    }

    const audio = document.getElementById('notification-sound');
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }

    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 20 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * ((config.porcentagem_reserva || 20) / 100);
    const lucro = valor - taxa;

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = "request-card p-0 animate-slideInDown relative overflow-hidden w-full transition-all duration-300";
    
    card.innerHTML = `
        <button id="btn-min-${pedido.id}" onclick="window.alternarMinimizacao('${pedido.id}')" 
            class="absolute top-4 right-4 z-50 text-slate-400 hover:text-white bg-slate-800/80 rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl border border-slate-600 cursor-pointer">
            &minus;
        </button>

        <div class="p-5 text-center cursor-pointer" onclick="window.alternarMinimizacao('${pedido.id}')">
            <span class="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                Nova Solicitação
            </span>
            <h2 class="price-tag text-4xl font-black mt-4">R$ ${valor.toFixed(0)}</h2>
            <div class="flex justify-center gap-3 mt-2 text-[10px] font-bold uppercase">
                <span class="text-red-400">Taxa: -R$ ${taxa.toFixed(2)}</span>
                <span class="text-green-400">Lucro: R$ ${lucro.toFixed(2)}</span>
            </div>
        </div>

        <div id="detalhes-${pedido.id}" class="pb-4">
            <div class="bg-slate-800/50 mx-4 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-white font-bold mb-2">${pedido.client_name || 'Cliente Atlivio'}</p>
                <p class="text-[11px] text-gray-300"><span class="text-red-500">📍</span> ${pedido.location || 'Local a combinar'}</p>
            </div>
            <div class="grid grid-cols-2 gap-3 p-4">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="btn-reject py-3 rounded-xl font-bold text-xs uppercase transition">✖ Recusar</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="btn-accept py-3 rounded-xl font-black text-xs uppercase transition">✔ Aceitar</button>
            </div>
        </div>
        <div class="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
            <div class="h-full bg-green-500 w-full transition-all duration-[30000ms] ease-linear" id="timer-${pedido.id}"></div>
        </div>
    `;

    container.prepend(card);

    setTimeout(() => {
        const timerBar = document.getElementById(`timer-${pedido.id}`);
        if(timerBar) timerBar.style.width = '0%';
    }, 100);

    // 15 segundos: Encolhe automaticamente (Estilo Uber)
    setTimeout(() => {
        const c = document.getElementById(`req-${pedido.id}`);
        if (c && !c.classList.contains('minimized')) {
            window.alternarMinimizacao(pedido.id);
        }
    }, 15000);

    // 30 segundos: Remove da tela localmente
    setTimeout(() => {
        if (document.getElementById(`req-${pedido.id}`)) {
            removeRequestCard(pedido.id);
        }
    }, 30000);
}
function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) {
        card.classList.add('removing');
        setTimeout(() => card.remove(), 300);
    }
}

export async function aceitarPedidoRadar(orderId) {
    // 1. Verifica Saldo e Limite (Anti-Calote)
    // O podeTrabalhar agora está no wallet.js e lê do perfil global
    const orderSnap = await getDoc(doc(db, "orders", orderId));
    if (!orderSnap.exists()) {
        removeRequestCard(orderId);
        return alert("Este pedido não existe mais.");
    }

    const valorServico = parseFloat(orderSnap.data().offer_value || 0);
    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const taxaEstimada = valorServico * (config.porcentagem_reserva / 100);

    // A mágica: Pergunta ao wallet.js se tem dinheiro
    if (!podeTrabalhar(taxaEstimada)) {
        // Se não puder, o wallet.js já mandou o alert. A gente só fecha.
        removeRequestCard(orderId);
        return;
    }

    // 2. Se passou, processa o aceite
    try {
        await setDoc(doc(db, "orders", orderId), { 
            status: 'accepted', 
            accepted_at: serverTimestamp() 
        }, { merge: true });
        
        await setDoc(doc(db, "chats", orderId), { 
            status: 'active',
            updated_at: serverTimestamp()
        }, { merge: true });

        removeRequestCard(orderId);
        
        if(window.switchTab) {
            window.switchTab('chat');
            setTimeout(() => {
                 if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
            }, 500);
        }

    } catch (e) { 
        console.error("Erro no aceite:", e);
        alert("Erro: " + e.message); 
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
