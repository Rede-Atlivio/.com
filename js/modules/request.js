// ============================================================================
// js/modules/request.js - V10.2 (ESTÁVEL + TRAVA ADMIN + STACK + OFFLINE)
// ============================================================================

import { db, auth } from '../config.js'; 
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE MEMÓRIA ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;
let mem_SelectedServiceTitle = ""; 

// --- GATILHOS INICIAIS ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
    }
});

// ============================================================================
// 1. MODAL DE SOLICITAÇÃO (FLUXO DO CLIENTE)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    // Sincroniza regras do Admin antes de abrir
    try {
        const configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if (configSnap.exists()) window.configFinanceiroAtiva = configSnap.data();
    } catch (e) { console.error("Erro ao carregar configs:", e); }
    
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

    if(inputValor) inputValor.value = ofertaSegura.toFixed(2).replace('.', ','); 
    
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
        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            provider_id: mem_ProviderId,
            provider_name: mem_ProviderName,
            service_title: mem_SelectedServiceTitle,
            status: 'pending', 
            offer_value: mem_CurrentOffer,
            location: document.getElementById('req-local')?.value || "A combinar",
            created_at: serverTimestamp()
        });

        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp()
        });

        alert("✅ SOLICITAÇÃO ENVIADA!");
        document.getElementById('request-modal')?.classList.add('hidden');
        if(window.switchTab) window.switchTab('chat');

    } catch (e) { 
        alert("Erro ao enviar: " + e.message); 
    }
}

// ============================================================================
// 2. RADAR DO PRESTADOR (LOGICA DE STACK + OFFLINE)
// ============================================================================
export async function iniciarRadarPrestador(uid) {
    const configRef = doc(db, "settings", "financeiro");
    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) window.configFinanceiroAtiva = docSnap.data();
    });

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") renderizarCardRadar({ id: change.doc.id, ...change.doc.data() });
            if (change.type === "removed") removeRequestCard(change.doc.id);
        });
    });
}

function renderizarCardRadar(pedido) {
    const container = document.getElementById('radar-container');
    if (!container) return;

    // OFFLINE GUARD
    const toggleOnline = document.getElementById('online-toggle');
    if (toggleOnline && !toggleOnline.checked) return;

    if (document.getElementById(`req-${pedido.id}`)) return;

    // Limite de Stack
    if (container.children.length >= 5) { container.firstElementChild.remove(); }

    const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
    audio.play().catch(() => {});

    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * (config.porcentagem_reserva / 100);

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = "request-card shadow-xl border border-gray-100 mb-3 bg-white rounded-2xl overflow-hidden transition-all duration-300"; 
    
    card.innerHTML = `
        <div class="card-details p-4">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-1 rounded-md uppercase">Novo Pedido</span>
                    <h3 class="text-lg font-black text-slate-800 mt-1">${pedido.service_title}</h3>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-black text-green-600">R$ ${valor.toFixed(0)}</h2>
                    <p class="text-[9px] text-gray-400 font-bold uppercase">Garantia: R$ ${taxa.toFixed(2)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 text-gray-500 text-xs mb-4 bg-gray-50 p-2 rounded-lg">
                <span>📍</span> <span class="font-bold truncate">${pedido.location || "A combinar"}</span>
            </div>
            <div class="grid grid-cols-4 gap-2">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="bg-red-50 text-red-500 rounded-xl font-bold py-2 hover:bg-red-100 transition">✖</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="col-span-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase py-2 hover:bg-blue-700 transition active:scale-95">ACEITAR AGORA</button>
                <button onclick="window.minimizarPedido('${pedido.id}')" class="bg-gray-100 text-gray-500 rounded-xl font-bold py-2 hover:bg-gray-200 transition">_</button>
            </div>
            <div class="h-1.5 w-full bg-gray-100 mt-3 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 w-full transition-all duration-[30000ms] ease-linear" id="timer-${pedido.id}"></div>
            </div>
        </div>
        <div class="card-summary hidden items-center justify-between p-3 bg-blue-50 border-l-4 border-blue-600" onclick="window.minimizarPedido('${pedido.id}')">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span class="text-xs font-bold text-slate-700 truncate">${pedido.service_title}</span>
            </div>
            <span class="text-xs font-black text-green-600">R$ ${valor.toFixed(0)}</span>
        </div>
    `;

    container.appendChild(card);
    setTimeout(() => { if(document.getElementById(`timer-${pedido.id}`)) document.getElementById(`timer-${pedido.id}`).style.width = '0%'; }, 100);
    setTimeout(() => { if(document.getElementById(`req-${pedido.id}`) && !document.getElementById(`req-${pedido.id}`).classList.contains('minimized')) window.minimizarPedido(pedido.id); }, 30000);
}

window.minimizarPedido = (orderId) => {
    const card = document.getElementById(`req-${orderId}`);
    if(!card) return;
    const details = card.querySelector('.card-details');
    const summary = card.querySelector('.card-summary');
    if(card.classList.contains('minimized')) {
        card.classList.remove('minimized');
        details.style.display = 'block';
        summary.classList.add('hidden');
    } else {
        card.classList.add('minimized');
        details.style.display = 'none';
        summary.classList.remove('hidden');
        summary.classList.add('flex');
    }
};

export async function aceitarPedidoRadar(orderId) {
    const btn = document.querySelector(`#req-${orderId} .btn-accept`) || document.querySelector(`#req-${orderId} button[onclick*="aceitar"]`);
    if(btn) { btn.disabled = true; btn.innerText = "⏳..."; }

    try {
        const userUid = auth.currentUser.uid;
        const [orderSnap, userSnap, configSnap] = await Promise.all([
            getDoc(doc(db, "orders", orderId)),
            getDoc(doc(db, "usuarios", userUid)),
            getDoc(doc(db, "settings", "financeiro"))
        ]);

        if (!orderSnap.exists()) { removeRequestCard(orderId); return alert("❌ Pedido Expirou."); }

        const config = configSnap.exists() ? configSnap.data() : { porcentagem_reserva: 10 };
        const taxaNecessaria = parseFloat(orderSnap.data().offer_value || 0) * (config.porcentagem_reserva / 100);
        const saldoAtual = parseFloat(userSnap.data().wallet_balance || 0);

        if (saldoAtual < taxaNecessaria) {
            alert(`⛔ SALDO INSUFICIENTE (Necessário: R$ ${taxaNecessaria.toFixed(2)})`);
            if(window.switchTab) window.switchTab('ganhar');
            if(btn) { btn.disabled = false; btn.innerText = "ACEITAR AGORA"; }
            return;
        }

        await setDoc(doc(db, "orders", orderId), { status: 'accepted', accepted_at: serverTimestamp(), provider_id: userUid }, { merge: true });
        await setDoc(doc(db, "chats", orderId), { status: 'active', updated_at: serverTimestamp() }, { merge: true });
        
        removeRequestCard(orderId);
        if(window.switchTab) window.switchTab('chat');
    } catch (e) { alert("Erro: " + e.message); }
}

export async function recusarPedidoReq(orderId) {
    removeRequestCard(orderId);
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
}

function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) { card.classList.add('opacity-0'); setTimeout(() => card.remove(), 300); }
}

// EXPOSIÇÃO GLOBAL
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.validarOferta = window.validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.minimizarPedido = minimizarPedido;
window.iniciarRadarPrestador = iniciarRadarPrestador;
