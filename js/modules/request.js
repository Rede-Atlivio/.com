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

// --- GATILHOS ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
    }
});

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
// 2. RADAR DO PRESTADOR (STACK + OFFLINE GUARD)
// ============================================================================
export async function iniciarRadarPrestador(uid) {
    const configRef = doc(db, "settings", "financeiro");
    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) window.configFinanceiroAtiva = docSnap.data();
    });

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") createRequestCard({ id: change.doc.id, ...change.doc.data() });
            if (change.type === "removed") removeRequestCard(change.doc.id);
        });
    });
}

function createRequestCard(pedido) {
    const container = document.getElementById('radar-container');
    if (!container) return;

    // ⛔ OFFLINE GUARD (Resolve o Problema 2)
    // Verifica se o botão "Online" está marcado no HTML
    const toggleOnline = document.getElementById('online-toggle');
    if (toggleOnline && !toggleOnline.checked) {
        console.log("🔕 Radar ignorou pedido pois usuário está OFFLINE.");
        return; 
    }

    // 1. Evita duplicidade
    if (document.getElementById(`req-${pedido.id}`)) return;

    // 2. Limite de Stack (5)
    if (container.children.length >= 5) {
        const oldest = container.firstElementChild;
        if (oldest) oldest.remove();
    }

    // 3. Som
    const audio = document.getElementById('notification-sound');
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }

    // Cálculos Financeiros Corretos
    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    // Usa config.porcentagem_reserva do Firebase ou padrão 20%
    const percentual = (config.porcentagem_reserva || 20) / 100;
    const taxa = valor * percentual;
    const lucro = valor - taxa;

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    
    // 🔥 VISUAL DARK MODE (Igual à Imagem)
    card.className = "bg-slate-900 border border-blue-900 rounded-2xl shadow-2xl p-0 mb-4 animate-slideInLeft relative overflow-hidden w-full max-w-md mx-auto";
    
    card.innerHTML = `
        <div class="relative z-10 p-5 text-center">
            <span class="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/50">
                Nova Solicitação
            </span>
            
            <h2 class="text-4xl font-black text-white mt-4 tracking-tighter drop-shadow-lg">
                R$ ${valor.toFixed(0)}
            </h2>
            
            <div class="flex justify-center gap-3 mt-2 text-[10px] font-bold uppercase">
                <span class="text-red-400">Taxa: -R$ ${taxa.toFixed(2)}</span>
                <span class="text-green-400">Seu Lucro: R$ ${lucro.toFixed(2)}</span>
            </div>
        </div>

        <div class="bg-slate-800/50 mx-4 p-4 rounded-xl border border-slate-700 backdrop-blur-sm">
            <div class="flex items-center gap-3 mb-3 border-b border-slate-700 pb-3">
                <div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                    ${(pedido.client_name || 'C')[0]}
                </div>
                <div>
                    <h3 class="text-white font-bold text-sm leading-tight">${pedido.client_name || 'Cliente Atlivio'}</h3>
                    <p class="text-[10px] text-gray-400 flex items-center gap-1">
                        Cliente 5.0 ★
                    </p>
                </div>
            </div>
            
            <div class="space-y-1">
                <p class="text-xs text-gray-300 font-medium flex items-center gap-2">
                    <span class="text-red-500">📍</span> ${pedido.location || 'Local a combinar'}
                </p>
                <p class="text-xs text-gray-300 font-medium flex items-center gap-2">
                    <span class="text-blue-400">📅</span> Data: ${new Date().toLocaleDateString()}
                </p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3 p-4 pt-4">
            <button onclick="window.recusarPedidoReq('${pedido.id}')" 
                class="bg-slate-700 text-gray-300 py-3 rounded-xl font-bold text-xs uppercase hover:bg-slate-600 transition flex items-center justify-center gap-2">
                ✖ Recusar
            </button>
            <button onclick="window.aceitarPedidoRadar('${pedido.id}')" 
                class="bg-green-600 text-white py-3 rounded-xl font-black text-xs uppercase hover:bg-green-500 transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2">
                ✔ Aceitar (-R$ ${taxa.toFixed(0)})
            </button>
        </div>
        
        <div class="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
        
        <div class="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
            <div class="h-full bg-gradient-to-r from-green-500 to-green-400 w-full transition-all duration-[30000ms] ease-linear" id="timer-${pedido.id}"></div>
        </div>
    `;

    // INSERE NO TOPO DA LISTA
    container.prepend(card);

    // ⏱️ TIMER
    setTimeout(() => {
        const timerBar = document.getElementById(`timer-${pedido.id}`);
        if(timerBar) timerBar.style.width = '0%';
    }, 100);

    // Auto-rejeição após 30s
    setTimeout(() => {
        if (document.getElementById(`req-${pedido.id}`)) {
             window.recusarPedidoReq(pedido.id);
        }
    }, 30000);
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
