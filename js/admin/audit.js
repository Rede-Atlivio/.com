import { doc, getDoc, getDocs, collection, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-audit');
    
    // 1. Renderiza a Interface de Busca
    container.innerHTML = `
        <div class="glass-panel p-6 border-l-4 border-indigo-500 animate-fade">
            <h2 class="text-2xl font-black text-white italic mb-2">🔎 AUDITORIA & BACKUP</h2>
            <p class="text-sm text-gray-400 mb-6">Investigue pedidos, verifique o status financeiro (Hold) e leia históricos de chat.</p>
            
            <div class="flex gap-4 mb-8">
                <input type="text" id="audit-search-input" placeholder="Cole o ID do Pedido aqui..." class="flex-1 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm">
                <button onclick="window.buscarPedidoAuditoria()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 rounded-xl shadow-lg transition flex items-center gap-2">
                    🕵️ INVESTIGAR
                </button>
            </div>

            <div id="audit-result-area" class="hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-1 space-y-4">
                    <div id="audit-info-card" class="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                        </div>
                </div>

                <div class="lg:col-span-2">
                    <div class="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[600px]">
                        <div class="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                            <span class="font-bold text-gray-300 text-xs uppercase">Histórico de Conversa</span>
                            <span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Backup Permanente</span>
                        </div>
                        <div id="audit-chat-list" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            <p class="text-center text-gray-500 text-xs mt-10">Busque um pedido para ver o chat.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-8 glass-panel p-6">
            <h3 class="font-bold text-white text-sm mb-4">🕒 Últimos 10 Pedidos do Sistema</h3>
            <div id="audit-recent-list" class="space-y-2">
                <div class="loader w-6 h-6 border-indigo-500"></div>
            </div>
        </div>
    `;

    carregarRecentes();
}

// ============================================================================
// FUNÇÕES DE BUSCA
// ============================================================================
window.buscarPedidoAuditoria = async (idOpcional = null) => {
    const input = document.getElementById('audit-search-input');
    const orderId = idOpcional || input.value.trim();
    
    if(!orderId) return alert("Digite um ID de pedido.");
    input.value = orderId; // Reflete no input se veio de clique

    const area = document.getElementById('audit-result-area');
    const cardInfo = document.getElementById('audit-info-card');
    const chatList = document.getElementById('audit-chat-list');

    area.classList.remove('hidden');
    cardInfo.innerHTML = `<div class="loader w-6 h-6 border-indigo-500 mx-auto"></div>`;
    chatList.innerHTML = `<div class="loader w-6 h-6 border-indigo-500 mx-auto mt-10"></div>`;

    try {
        const db = window.db;
        
        // 1. Busca Dados do Pedido
        const docSnap = await getDoc(doc(db, "orders", orderId));
        
        if(!docSnap.exists()) {
            cardInfo.innerHTML = `<p class="text-red-400 font-bold text-center">Pedido não encontrado.</p>`;
            chatList.innerHTML = "";
            return;
        }

        const data = docSnap.data();
        renderizarInfoPedido(data, docSnap.id);
        renderizarChatBackup(docSnap.id, data.client_id, data.provider_id);

    } catch(e) {
        console.error(e);
        alert("Erro na auditoria: " + e.message);
    }
};

function renderizarInfoPedido(data, id) {
    const card = document.getElementById('audit-info-card');
    
    // Status Color Logic
    let statusColor = "text-gray-400";
    let statusText = data.status.toUpperCase();
    
    if(data.status === 'confirmed_hold') { statusColor = "text-blue-400"; statusText = "🔒 RESERVADO (HOLD)"; }
    if(data.status === 'completed') { statusColor = "text-green-400"; statusText = "✅ FINALIZADO (PAGO)"; }
    if(data.status === 'cancelled') { statusColor = "text-red-400"; statusText = "❌ CANCELADO"; }

    card.innerHTML = `
        <div class="mb-4 border-b border-slate-700 pb-4">
            <p class="text-[10px] text-gray-500 uppercase font-bold">ID do Pedido</p>
            <p class="font-mono text-xs text-white select-all bg-black/20 p-1 rounded">${id}</p>
        </div>

        <div class="mb-4">
            <p class="text-[10px] text-gray-500 uppercase font-bold">Status Financeiro</p>
            <p class="font-black ${statusColor} text-lg">${statusText}</p>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="bg-slate-900/50 p-2 rounded">
                <p class="text-[9px] text-indigo-400 font-bold">VALOR OFERTA</p>
                <p class="text-white font-bold">R$ ${data.offer_value}</p>
            </div>
            <div class="bg-slate-900/50 p-2 rounded">
                <p class="text-[9px] text-emerald-400 font-bold">TAXA PLATAFORMA</p>
                <p class="text-emerald-300 font-bold">R$ ${(data.offer_value * 0.20).toFixed(2)}</p>
            </div>
        </div>

        <div class="space-y-3 text-xs">
            <div>
                <span class="block text-[9px] text-gray-500 uppercase">Cliente (Pagador)</span>
                <span class="text-white font-bold">${data.client_name}</span>
                <span class="block text-[9px] text-gray-600 font-mono">${data.client_id}</span>
            </div>
            <div>
                <span class="block text-[9px] text-gray-500 uppercase">Prestador (Recebedor)</span>
                <span class="text-white font-bold">${data.provider_name}</span>
                <span class="block text-[9px] text-gray-600 font-mono">${data.provider_id}</span>
            </div>
        </div>
        
        <div class="mt-6 pt-4 border-t border-slate-700">
             <p class="text-[9px] text-gray-500 uppercase mb-1">Dados Sensíveis</p>
             <p class="text-gray-300 text-xs">📍 ${data.location || 'Oculto'}</p>
             <p class="text-gray-300 text-xs">📅 ${data.service_date} - ${data.service_time}</p>
        </div>
    `;
}

async function renderizarChatBackup(orderId, clientId, providerId) {
    const list = document.getElementById('audit-chat-list');
    list.innerHTML = "";

    const db = window.db;
    const q = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);

    if(snap.empty) {
        list.innerHTML = `<p class="text-center text-gray-500 text-xs mt-4">Nenhuma mensagem trocada.</p>`;
        return;
    }

    snap.forEach(doc => {
        const msg = doc.data();
        const isClient = msg.sender_id === clientId;
        const time = msg.timestamp ? msg.timestamp.toDate().toLocaleString() : '...';
        
        let label = isClient ? "👤 CLIENTE" : "🛠️ PRESTADOR";
        let align = isClient ? "items-start" : "items-end";
        let bubbleColor = isClient ? "bg-slate-700 text-gray-200" : "bg-indigo-900/50 text-indigo-100 border border-indigo-500/30";

        list.innerHTML += `
            <div class="flex flex-col ${align} w-full animate-fadeIn">
                <span class="text-[9px] text-gray-500 mb-0.5 px-1">${label} • ${time}</span>
                <div class="${bubbleColor} px-3 py-2 rounded-lg max-w-[85%] text-xs shadow-sm">
                    ${msg.text}
                </div>
            </div>
        `;
    });
}

async function carregarRecentes() {
    const container = document.getElementById('audit-recent-list');
    try {
        const q = query(collection(window.db, "orders"), orderBy("created_at", "desc"), limit(10));
        const snap = await getDocs(q);
        
        container.innerHTML = "";
        
        if(snap.empty) { container.innerHTML = "<p class='text-gray-500 text-xs'>Sem pedidos recentes.</p>"; return; }

        snap.forEach(doc => {
            const d = doc.data();
            let statusBadge = `<span class="bg-gray-700 text-gray-300 text-[9px] px-1.5 py-0.5 rounded">PENDENTE</span>`;
            if(d.status === 'confirmed_hold') statusBadge = `<span class="bg-blue-900 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-bold">RESERVADO</span>`;
            if(d.status === 'completed') statusBadge = `<span class="bg-green-900 text-green-300 text-[9px] px-1.5 py-0.5 rounded font-bold">PAGO</span>`;

            container.innerHTML += `
                <div onclick="window.buscarPedidoAuditoria('${doc.id}')" class="flex justify-between items-center p-3 bg-slate-800/30 hover:bg-slate-700 border border-slate-700/50 rounded cursor-pointer transition group">
                    <div>
                        <p class="text-xs font-bold text-white group-hover:text-indigo-400 transition">${d.client_name} ➝ ${d.provider_name}</p>
                        <p class="text-[10px] text-gray-500 font-mono">${doc.id}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-white">R$ ${d.offer_value}</p>
                        ${statusBadge}
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error(e);
        container.innerHTML = "<p class='text-red-500 text-xs'>Erro ao carregar recentes.</p>";
    }
}
