import { doc, getDoc, getDocs, collection, query, orderBy, limit, where, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ESTADO LOCAL
let auditViewMode = 'inbox'; // 'inbox' ou 'trash'
let selectedAuditItems = new Set();

export async function init() {
    renderizarInterface();
    carregarRecentes();
}

function renderizarInterface() {
    const container = document.getElementById('view-audit');
    
    container.innerHTML = `
        <div class="glass-panel p-6 border-l-4 border-indigo-500 animate-fade">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-2xl font-black text-white italic mb-2">🔎 AUDITORIA & BACKUP</h2>
                    <p class="text-sm text-gray-400">Investigue pedidos, verifique o status financeiro (Hold) e leia históricos de chat.</p>
                </div>
                
                <div class="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button onclick="window.audit_alternarModo('inbox')" id="btn-audit-inbox" class="px-4 py-2 rounded text-xs font-bold bg-indigo-600 text-white transition shadow-lg">📋 LISTA</button>
                    <button onclick="window.audit_alternarModo('trash')" id="btn-audit-trash" class="px-4 py-2 rounded text-xs font-bold text-gray-400 hover:text-white transition">🗑️ LIXEIRA</button>
                </div>
            </div>
            
            <div class="flex gap-4 mb-8">
                <input type="text" id="audit-search-input" placeholder="Cole o ID do Pedido aqui..." class="flex-1 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-sm">
                <button onclick="window.buscarPedidoAuditoria()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 rounded-xl shadow-lg transition flex items-center gap-2">
                    🕵️ INVESTIGAR
                </button>
            </div>

            <div id="audit-result-area" class="hidden grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div class="lg:col-span-1 space-y-4">
                    <div id="audit-info-card" class="bg-slate-800/50 p-5 rounded-xl border border-slate-700"></div>
                </div>
                <div class="lg:col-span-2">
                    <div class="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[500px]">
                        <div class="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                            <span class="font-bold text-gray-300 text-xs uppercase">Histórico de Conversa</span>
                            <span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Backup Permanente</span>
                        </div>
                        <div id="audit-chat-list" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 glass-panel p-0 overflow-hidden border border-slate-700">
            <div class="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white select-none">
                        <input type="checkbox" onchange="window.audit_toggleSelecionarTudo(this)" class="chk-audit-master chk-custom rounded border-gray-600 bg-slate-900">
                        <span class="font-bold uppercase tracking-wider">Selecionar Tudo</span>
                    </label>
                    <span id="audit-count-badge" class="bg-slate-700 text-[10px] px-2 rounded text-gray-300">0</span>
                </div>
                
                <div id="audit-bulk-toolbar" class="hidden flex gap-2 animate-fade">
                    </div>
            </div>
            
            <div id="audit-recent-list" class="divide-y divide-slate-800">
                <div class="p-8 text-center"><div class="loader w-6 h-6 border-indigo-500 mx-auto"></div></div>
            </div>
        </div>
    `;
}

// ============================================================================
// GESTÃO DE ESTADO & LIXEIRA
// ============================================================================
window.audit_alternarModo = (mode) => {
    auditViewMode = mode;
    selectedAuditItems.clear();
    atualizarToolbarAudit();
    
    const btnIn = document.getElementById('btn-audit-inbox');
    const btnTr = document.getElementById('btn-audit-trash');
    
    if(mode === 'inbox') {
        btnIn.className = "px-4 py-2 rounded text-xs font-bold bg-indigo-600 text-white transition shadow-lg";
        btnTr.className = "px-4 py-2 rounded text-xs font-bold text-gray-400 hover:text-white transition";
    } else {
        btnIn.className = "px-4 py-2 rounded text-xs font-bold text-gray-400 hover:text-white transition";
        btnTr.className = "px-4 py-2 rounded text-xs font-bold bg-red-600 text-white transition shadow-lg";
    }
    
    carregarRecentes();
};

window.audit_toggleSelecao = (chk) => {
    if (chk.checked) selectedAuditItems.add(chk.value);
    else selectedAuditItems.delete(chk.value);
    atualizarToolbarAudit();
};

window.audit_toggleSelecionarTudo = (chkMaster) => {
    const checkboxes = document.querySelectorAll('.chk-audit-item');
    checkboxes.forEach(chk => {
        chk.checked = chkMaster.checked;
        if(chkMaster.checked) selectedAuditItems.add(chk.value);
        else selectedAuditItems.delete(chk.value);
    });
    atualizarToolbarAudit();
};

function atualizarToolbarAudit() {
    const toolbar = document.getElementById('audit-bulk-toolbar');
    const badge = document.getElementById('audit-count-badge');
    
    if(badge) badge.innerText = selectedAuditItems.size;
    
    if(selectedAuditItems.size > 0) {
        toolbar.classList.remove('hidden');
        
        // AQUI ESTÁ A LÓGICA DOS BOTÕES
        if (auditViewMode === 'inbox') {
            toolbar.innerHTML = `
                <button onclick="window.audit_executarAcaoMassa('soft_delete')" class="text-xs bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded font-bold uppercase transition shadow-lg flex items-center gap-2">
                    🗑️ MOVER PARA LIXEIRA
                </button>
            `;
        } else {
            toolbar.innerHTML = `
                <button onclick="window.audit_executarAcaoMassa('restore')" class="text-xs bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded font-bold uppercase transition shadow-lg flex items-center gap-2">
                    ♻️ RESTAURAR
                </button>
                <button onclick="window.audit_executarAcaoMassa('hard_delete')" class="text-xs bg-red-900 hover:bg-red-800 text-red-200 border border-red-700 px-4 py-1.5 rounded font-bold uppercase transition shadow-lg flex items-center gap-2">
                    🔥 EXCLUIR DE VEZ
                </button>
            `;
        }
    } else {
        toolbar.classList.add('hidden');
    }
}

window.audit_executarAcaoMassa = async (acao) => {
    if(selectedAuditItems.size === 0) return;
    const db = window.db;
    const batch = writeBatch(db);
    const ids = Array.from(selectedAuditItems);
    
    let msg = "";
    if(acao === 'soft_delete') msg = `Mover ${ids.length} pedidos para a lixeira?`;
    if(acao === 'restore') msg = `Restaurar ${ids.length} pedidos?`;
    if(acao === 'hard_delete') msg = `⚠️ ATENÇÃO: Excluir PERMANENTEMENTE ${ids.length} pedidos? Essa ação não pode ser desfeita.`;

    if(!confirm(msg)) return;

    for (const id of ids) {
        if (acao === 'soft_delete') {
            // Inbox -> Lixeira
            const docRef = doc(db, "orders", id);
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()) {
                const data = docSnap.data();
                const trashRef = doc(collection(db, "recycle_bin"));
                batch.set(trashRef, { 
                    ...data, 
                    original_id: id,
                    origin_collection: "orders",
                    deleted_at: serverTimestamp() 
                });
                batch.delete(docRef);
            }
        } 
        else if (acao === 'restore') {
            // Lixeira -> Inbox
            const trashRef = doc(db, "recycle_bin", id); // ID da lixeira
            const trashSnap = await getDoc(trashRef);
            if(trashSnap.exists()) {
                const data = trashSnap.data();
                const originalId = data.original_id || id;
                const restoreRef = doc(db, "orders", originalId);
                
                const { deleted_at, origin_collection, original_id: oid, ...restoredData } = data;
                batch.set(restoreRef, restoredData);
                batch.delete(trashRef);
            }
        }
        else if (acao === 'hard_delete') {
            // Lixeira -> Além
            const trashRef = doc(db, "recycle_bin", id);
            batch.delete(trashRef);
        }
    }

    try {
        await batch.commit();
        alert("✅ Ação concluída com sucesso!");
        selectedAuditItems.clear();
        atualizarToolbarAudit();
        carregarRecentes();
    } catch(e) {
        alert("Erro: " + e.message);
    }
};

// ============================================================================
// CARREGAMENTO DA LISTA
// ============================================================================
async function carregarRecentes() {
    const container = document.getElementById('audit-recent-list');
    container.innerHTML = `<div class="p-8 text-center"><div class="loader w-6 h-6 border-indigo-500 mx-auto"></div></div>`;
    
    try {
        const db = window.db;
        let q;

        if (auditViewMode === 'inbox') {
            q = query(collection(db, "orders"), orderBy("created_at", "desc"), limit(20));
        } else {
            q = query(collection(db, "recycle_bin"), where("origin_collection", "==", "orders"), orderBy("deleted_at", "desc"), limit(20));
        }

        const snap = await getDocs(q);
        
        container.innerHTML = "";
        
        if(snap.empty) { 
            container.innerHTML = `
                <div class="p-8 text-center opacity-50">
                    <p class="text-sm font-bold text-gray-500">${auditViewMode === 'inbox' ? 'Nenhum pedido recente.' : 'Lixeira vazia.'}</p>
                </div>`; 
            return; 
        }

       snap.forEach(docSnap => {
            const d = docSnap.data();
            const docId = docSnap.id;
            
            let statusBadge = `<span class="bg-gray-700 text-gray-300 text-[9px] px-1.5 py-0.5 rounded">PENDENTE</span>`;
            if(d.status === 'confirmed_hold') statusBadge = `<span class="bg-blue-900 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-bold">RESERVADO</span>`;
            if(d.status === 'completed') statusBadge = `<span class="bg-green-900 text-green-300 text-[9px] px-1.5 py-0.5 rounded font-bold">PAGO</span>`;
            if(d.status === 'cancelled') statusBadge = `<span class="bg-red-900 text-red-300 text-[9px] px-1.5 py-0.5 rounded font-bold">CANCELADO</span>`;

            const dateDisplay = auditViewMode === 'inbox' 
                ? (d.created_at?.toDate().toLocaleDateString() || 'Data N/A')
                : `🗑️ ${d.deleted_at?.toDate().toLocaleDateString() || 'N/A'}`;

            container.innerHTML += `
                <div class="flex items-center hover:bg-slate-800/50 transition border-l-2 border-transparent hover:border-indigo-500 pl-4 py-3">
                    <div class="mr-4">
                        <input type="checkbox" value="${docId}" onchange="window.audit_toggleSelecao(this)" class="chk-audit-item chk-custom rounded border-gray-600 bg-slate-900">
                    </div>
                    
                    <div class="flex-1 cursor-pointer" onclick="window.buscarPedidoAuditoria('${d.original_id || docId}')">
                        <div class="flex justify-between items-center mb-1">
                            <p class="text-xs font-bold text-white hover:text-indigo-400 transition flex items-center gap-2">
                                ${d.client_name || 'Cliente'} ➝ ${d.provider_name || 'Prestador'}
                            </p>
                            <p class="text-[10px] text-gray-500 font-mono bg-black/20 px-1 rounded">${d.original_id || docId}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[10px] text-gray-400">${dateDisplay}</p>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-mono text-white font-bold">R$ ${d.offer_value || '0.00'}</span>
                                ${statusBadge}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch(e) {
        console.error(e);
        container.innerHTML = `<p class="p-4 text-red-500 text-xs text-center">Erro ao carregar lista: ${e.message}</p>`;
    }
}

// ============================================================================
// FUNÇÕES DE BUSCA
// ============================================================================
export async function buscarPedidoAuditoria(idOpcional = null) {
    const input = document.getElementById('audit-search-input');
    const orderId = idOpcional || input.value.trim();
    if(!orderId) return alert("Digite um ID.");
    input.value = orderId;

    const area = document.getElementById('audit-result-area');
    const cardInfo = document.getElementById('audit-info-card');
    const chatList = document.getElementById('audit-chat-list');

    area.classList.remove('hidden');
    cardInfo.innerHTML = `<div class="loader w-6 h-6 border-indigo-500 mx-auto"></div>`;
    chatList.innerHTML = `<div class="loader w-6 h-6 border-indigo-500 mx-auto mt-10"></div>`;

    try {
        const db = window.db;
        let docSnap = await getDoc(doc(db, "orders", orderId));
        
        if(!docSnap.exists()) {
            const qTrash = query(collection(db, "recycle_bin"), where("original_id", "==", orderId), limit(1));
            const snapTrash = await getDocs(qTrash);
            if(!snapTrash.empty) {
                docSnap = snapTrash.docs[0];
                alert("⚠️ Aviso: Este pedido está na LIXEIRA.");
            } else {
                cardInfo.innerHTML = `<p class="text-red-400 font-bold text-center">Pedido não encontrado.</p>`;
                chatList.innerHTML = "";
                return;
            }
        }

        const data = docSnap.data();
        renderizarInfoPedido(data, data.original_id || docSnap.id);
        renderizarChatBackup(data.original_id || docSnap.id, data.client_id, data.provider_id, data.client_name, data.provider_name);

    } catch(e) {
        console.error(e);
        alert("Erro: " + e.message);
    }
};

function renderizarInfoPedido(data, id) {
    const card = document.getElementById('audit-info-card');
    let statusColor = "text-gray-400";
    let statusText = (data.status || 'unknown').toUpperCase();
    
    if(data.status === 'confirmed_hold') { statusColor = "text-blue-400"; statusText = "🔒 RESERVADO"; }
    if(data.status === 'completed') { statusColor = "text-green-400"; statusText = "✅ PAGO"; }
    
    card.innerHTML = `
        <div class="mb-4 border-b border-slate-700 pb-4 flex justify-between items-center">
            <div>
                <p class="text-[10px] text-gray-500 uppercase font-bold">ID do Pedido</p>
                <p class="font-mono text-xs text-white select-all bg-black/20 p-1 rounded">${id}</p>
            </div>
            <button onclick="window.exportarChatPDF('${id}')" class="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg title="Exportar Log">📥</button>
        </div>
        <div class="mb-4">
            <p class="text-[10px] text-gray-500 uppercase font-bold">Status</p>
            <p class="font-black ${statusColor} text-lg">${statusText}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="bg-slate-900/50 p-2 rounded">
                <p class="text-[9px] text-indigo-400 font-bold">VALOR</p>
                <p class="text-white font-bold">R$ ${data.offer_value}</p>
            </div>
            <div class="bg-slate-900/50 p-2 rounded">
                <p class="text-[9px] text-emerald-400 font-bold">LUCRO ATLIVIO</p>
                <p class="text-emerald-300 font-bold">R$ ${((data.lucro_atlivio_prestador || 0) + (data.lucro_atlivio_cliente || 0)).toFixed(2)}</p>
            </div>
        </div>
        <div class="space-y-3 text-xs">
            <div>
                <span class="block text-[9px] text-gray-500 uppercase">Cliente</span>
                <span class="text-white font-bold">${data.client_name}</span>
            </div>
            <div>
                <span class="block text-[9px] text-gray-500 uppercase">Prestador</span>
                <span class="text-white font-bold">${data.provider_name}</span>
            </div>
        </div>
    `;
}

async function renderizarChatBackup(orderId, clientId, providerId, clientName, providerName) {
    const list = document.getElementById('audit-chat-list');
    list.innerHTML = "";
    const db = window.db;
    const q = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);

    if(snap.empty) {
        list.innerHTML = `<p class="text-center text-gray-500 text-xs mt-4">Nenhuma mensagem.</p>`;
        return;
    }

    snap.forEach(docSnap => {
        const msg = docSnap.data();
        const isSystem = msg.sender_id === 'system';
        const isClient = msg.sender_id === clientId;
        let align = isClient ? "items-start" : "items-end";
        let bubbleColor = isClient ? "bg-slate-700 text-gray-200" : "bg-indigo-900/50 text-indigo-100 border border-indigo-500/30";
        let label = isClient ? (clientName || 'CLIENTE') : (providerName || 'PRESTADOR');

        if (isSystem) {
            align = "items-center";
            bubbleColor = "bg-amber-900/20 text-amber-200 border border-amber-500/20";
            label = "SISTEMA";
        }
        
        const hora = msg.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '--:--';
        list.innerHTML += `
            <div class="flex flex-col ${align} w-full animate-fadeIn mb-2">
                <div class="flex gap-2 items-center px-1">
                    <span class="text-[8px] font-bold text-gray-500 uppercase">${label}</span>
                    <span class="text-[8px] text-gray-600">${hora}</span>
                </div>
                <div class="${bubbleColor} px-3 py-2 rounded-lg max-w-[90%] text-xs shadow-sm">
                    <p class="leading-relaxed">${msg.text}</p>
                </div>
            </div>`;
    });
}
window.exportarChatPDF = async (orderId) => {
    const chatArea = document.getElementById('audit-chat-list');
    if (!chatArea || chatArea.innerText.includes("Nenhuma mensagem")) return alert("Sem mensagens para exportar.");
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>PROVA_ATLIVIO_${orderId}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { border-bottom: 2px solid #eee; margin-bottom: 20px; padding-bottom: 10px; }
                    .msg { margin-bottom: 15px; padding: 10px; border-left: 4px solid #ccc; }
                    .CLIENTE { border-color: #2563eb; background: #f8fafc; }
                    .PRESTADOR { border-color: #4f46e5; background: #f5f3ff; }
                    .SISTEMA { border-color: #d97706; font-style: italic; background: #fffbeb; }
                    .meta { font-size: 10px; font-weight: bold; color: #666; margin-bottom: 4px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Auditoria Atlivio</h1>
                    <p>ID do Pedido: <b>${orderId}</b></p>
                    <p>Data de Extração: ${new Date().toLocaleString()}</p>
                </div>
                ${chatArea.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};
// MAPEAMENTO GLOBAL PARA O PAINEL ADMIN
window.buscarPedidoAuditoria = buscarPedidoAuditoria;
window.audit_alternarModo = audit_alternarModo;
window.audit_toggleSelecao = audit_toggleSelecao;
window.audit_toggleSelecionarTudo = audit_toggleSelecionarTudo;
window.audit_executarAcaoMassa = audit_executarAcaoMassa;
