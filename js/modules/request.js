import { db, auth } from '../app.js';
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, orderBy, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis de Estado
let targetProviderId = null;
let targetProviderName = null;
let serviceBasePrice = 0;
let currentOffer = 0;

// --- AJUSTE FEITO: LIMITE OFICIAL DE -60 ---
const LIMITE_PARA_ACEITAR = -60.00; 

// --- INICIALIZAÇÃO DO RADAR ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
        carregarPedidosEmAndamento(); 
    }
});

// ============================================================================
// 1. RADAR DE NOVOS PEDIDOS (O EFEITO "UBER")
// ============================================================================
function iniciarRadarPrestador(uid) {
    const q = query(
        collection(db, "orders"), 
        where("provider_id", "==", uid), 
        where("status", "==", "pending")
    );

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const pedido = { id: change.doc.id, ...change.doc.data() };
                mostrarModalRadar(pedido);
                tocarSomAlerta();
            }
            if (change.type === "removed") {
                fecharModalRadar();
            }
        });
    });
}

function mostrarModalRadar(pedido) {
    let modalContainer = document.getElementById('modal-radar-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-radar-container';
        modalContainer.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4";
        document.body.appendChild(modalContainer);
    }

    modalContainer.classList.remove('hidden');

    const valor = parseFloat(pedido.offer_value);
    const taxa = valor * 0.20;
    const lucro = valor - taxa;

    modalContainer.innerHTML = `
        <div class="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-700 animate-bounce-in">
            <div class="bg-slate-800 p-4 text-center border-b border-slate-700">
                <span class="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-blue-900/50">Nova Solicitação</span>
            </div>

            <div class="text-center py-6 bg-slate-900 relative">
                <div class="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-3xl"></div>
                <h1 class="text-5xl font-black text-white mb-2 relative z-10">R$ ${valor.toFixed(0)}</h1>
                <div class="flex justify-center gap-3 text-[10px] font-bold relative z-10">
                    <span class="text-red-400">Taxa: -R$ ${taxa.toFixed(2)}</span>
                    <span class="text-green-400">Seu Lucro: R$ ${lucro.toFixed(2)}</span>
                </div>
            </div>

            <div class="mx-4 mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div class="flex items-center gap-3 mb-3 border-b border-slate-700 pb-3">
                    <div class="bg-purple-600/20 text-purple-400 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                        ${pedido.client_name.charAt(0)}
                    </div>
                    <div>
                        <h3 class="text-white font-bold text-sm">${pedido.client_name}</h3>
                        <p class="text-[10px] text-gray-400">Cliente 5.0 ★</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="text-red-500">📍</span>
                        <p class="text-gray-300 text-xs truncate">${pedido.location || "Local a combinar"}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-blue-400">🗓️</span>
                        <p class="text-gray-300 text-xs">${pedido.service_date || "Data a combinar"}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-0 border-t border-slate-700">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="bg-slate-800 hover:bg-slate-700 text-gray-400 font-bold py-5 text-sm uppercase transition border-r border-slate-700">
                    ✕ Recusar
                </button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-600 hover:bg-green-500 text-white font-black py-5 text-sm uppercase transition shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                    ✔ Aceitar
                </button>
            </div>
        </div>
    `;
}

function fecharModalRadar() {
    const el = document.getElementById('modal-radar-container');
    if (el) el.classList.add('hidden');
}

function tocarSomAlerta() {
    // Implementar som futuramente
}

// ============================================================================
// 2. LÓGICA DE ACEITE (DO RADAR -> PARA O CHAT)
// ============================================================================
export async function aceitarPedidoRadar(orderId) {
    fecharModalRadar(); 

    try {
        const uid = auth.currentUser.uid;
        
        // 1. Verifica Saldo (Trava de Segurança -60)
        const userDoc = await getDoc(doc(db, "usuarios", uid));
        const saldoAtual = userDoc.data()?.wallet_balance || 0;

        if (saldoAtual < LIMITE_PARA_ACEITAR) {
            alert(`⚠️ LIMITE ATINGIDO (R$ ${saldoAtual.toFixed(2)})\n\nSeu limite de crédito é R$ ${LIMITE_PARA_ACEITAR}. Por favor, recarregue sua carteira para aceitar novos serviços.`);
            return;
        }

        // 2. Aceita o Pedido
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'accepted',
            accepted_at: serverTimestamp()
        });

        // 3. Ativa o Chat
        await updateDoc(doc(db, "chats", orderId), { status: 'active' });

        // 4. Redireciona para o Chat
        if(window.abrirChatPedido) {
            setTimeout(() => {
                const tabChat = document.getElementById('tab-chat');
                if(tabChat) tabChat.click();
                window.abrirChatPedido(orderId);
            }, 500);
        } else {
            alert("✅ Aceito! Vá para a aba Chat.");
        }

    } catch (e) {
        console.error(e);
        alert("Erro ao aceitar: " + e.message);
    }
}

export async function recusarPedidoReq(orderId) {
    fecharModalRadar();
    if(!confirm("Recusar esta oportunidade?")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
    } catch(e) { console.error(e); }
}

// ============================================================================
// 3. LISTAGEM "EM ANDAMENTO" (BACKUP)
// ============================================================================
export async function carregarPedidosEmAndamento() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container || !auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const pedidosRef = collection(db, "orders");
    const statuses = ["accepted", "in_progress"];

    const qProvider = query(pedidosRef, where("provider_id", "==", uid), where("status", "in", statuses));
    
    onSnapshot(qProvider, (snap) => {
        container.innerHTML = "";
        if(snap.empty) {
            container.innerHTML = `<div class="text-center py-10 opacity-50"><p>Sem serviços em andamento.</p></div>`;
            return;
        }
        snap.forEach(d => {
            const p = d.data();
            container.innerHTML += `
                <div onclick="window.abrirChatPedido('${d.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 cursor-pointer">
                    <h3 class="font-bold text-gray-800">${p.client_name}</h3>
                    <p class="text-xs text-green-600 font-bold">R$ ${p.offer_value} • ${p.status === 'accepted' ? 'A iniciar' : 'Em andamento'}</p>
                </div>
            `;
        });
    });
}

// --- FUNÇÕES DE CRIAÇÃO (CLIENTE) ---
export function abrirModalSolicitacao(providerId, providerName, price) {
    if(!auth.currentUser) return alert("Faça login!");
    targetProviderId = providerId;
    targetProviderName = providerName;
    serviceBasePrice = parseFloat(price);
    currentOffer = serviceBasePrice;
    
    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.getElementById('target-provider-id').value = providerId;
        const input = document.getElementById('req-value');
        if(input) { input.value = price.toFixed(2); input.disabled=true; }
        const totalEl = document.getElementById('calc-total-reserva');
        if(totalEl) totalEl.innerText = `R$ ${currentOffer.toFixed(2)}`;
    }
}

export function selecionarDesconto(percent) {
    currentOffer = serviceBasePrice * (1 - percent);
    document.getElementById('req-value').value = currentOffer.toFixed(2);
    document.getElementById('calc-total-reserva').innerText = `R$ ${currentOffer.toFixed(2)}`;
}

export async function enviarPropostaAgora() {
    const btn = document.getElementById('btn-confirm-req');
    if(btn) { btn.innerText = "ENVIANDO..."; btn.disabled = true; }
    
    try {
        const docRef = await addDoc(collection(db, "orders"), {
            client_id: auth.currentUser.uid,
            client_name: auth.currentUser.displayName || "Cliente",
            provider_id: targetProviderId,
            provider_name: targetProviderName,
            status: 'pending', 
            base_price: serviceBasePrice,
            offer_value: currentOffer,
            service_date: document.getElementById('req-date')?.value || "A combinar",
            location: document.getElementById('req-local')?.value || "A combinar",
            created_at: serverTimestamp()
        });

        await setDoc(doc(db, "chats", docRef.id), {
            participants: [auth.currentUser.uid, targetProviderId],
            status: "pending_approval",
            updated_at: serverTimestamp()
        });

        alert("✅ Proposta Enviada!");
        document.getElementById('request-modal').classList.add('hidden');
    } catch(e) { alert("Erro: " + e.message); } 
    finally { if(btn) { btn.innerText = "ENVIAR PROPOSTA"; btn.disabled = false; } }
}

window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.enviarPropostaAgora = enviarPropostaAgora;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.iniciarRadarPrestador = iniciarRadarPrestador;
