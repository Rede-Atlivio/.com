import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, writeBatch, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let unsubscribeList = null;
let unsubscribeChat = null;
let currentChatUser = null;
let selectedTickets = new Set();
let viewMode = 'inbox'; // 'inbox' ou 'trash'

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export function init() {
    const container = document.getElementById('view-support');
    if(!container) return; 
    
    container.innerHTML = `
        <div class="flex h-[calc(100vh-140px)] gap-4 animate-fade">
            <div class="w-1/3 glass-panel p-0 flex flex-col overflow-hidden border-r border-gray-700 relative">
                
                <div class="p-4 bg-slate-900/50 border-b border-gray-700">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex gap-2">
                            <button onclick="window.alternarModoVisualizacao('inbox')" id="btn-mode-inbox" class="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-600 text-white transition">📥 ENTRADA</button>
                            <button onclick="window.alternarModoVisualizacao('trash')" id="btn-mode-trash" class="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-700 text-gray-400 hover:text-white transition">🗑️ LIXEIRA</button>
                        </div>
                        <span id="ticket-count" class="bg-gray-700 text-gray-300 text-[10px] px-2 rounded-full">0</span>
                    </div>

                    <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
                        <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white select-none">
                            <input type="checkbox" onchange="window.toggleSelecionarTudo(this)" class="chk-custom rounded border-gray-600 bg-slate-800">
                            Todos
                        </label>
                        <div id="bulk-toolbar" class="hidden flex gap-2">
                            <button onclick="window.executarAcaoMassa('lido')" class="text-[10px] bg-green-900/50 text-green-400 px-2 py-1 rounded border border-green-800 hover:bg-green-900">✅ Ler</button>
                            <button onclick="window.executarAcaoMassa('lixeira')" class="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-800 hover:bg-red-900" id="btn-trash-action">🗑️ Excluir</button>
                        </div>
                    </div>
                </div>

                <div id="support-users-list" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 relative">
                    <p class="text-center text-gray-500 text-xs mt-10">Carregando...</p>
                </div>
            </div>

            <div class="w-2/3 glass-panel p-0 flex flex-col overflow-hidden relative bg-slate-900/30">
                <div id="chat-header" class="p-4 border-b border-gray-700 bg-slate-800 hidden flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white" id="chat-user-name">Usuário</h3>
                        <p class="text-[10px] text-gray-400" id="chat-user-id">ID: ...</p>
                    </div>
                    <button onclick="window.fecharChat()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                
                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col-reverse bg-slate-900/50 relative">
                    <div class="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
                        <span class="text-4xl mb-2">💬</span>
                        <p class="text-sm font-bold">Central de Suporte</p>
                        <p class="text-xs">Selecione uma conversa ao lado</p>
                    </div>
                </div>

                <div id="chat-input-area" class="p-4 bg-slate-800 border-t border-gray-700 hidden">
                    <form onsubmit="window.enviarRespostaAdmin(event)" class="flex gap-2">
                        <input type="text" id="admin-reply-input" placeholder="Escreva sua resposta..." class="flex-1 bg-slate-900 border border-slate-600 rounded-full px-4 py-2 text-sm text-white focus:border-blue-500 outline-none">
                        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition transform active:scale-95">➤</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    carregarListaUsuarios();
}

// ============================================================================
// 2. LISTAGEM DE USUÁRIOS
// ============================================================================
function carregarListaUsuarios() {
    const listContainer = document.getElementById('support-users-list');
    const db = window.db;
    const collectionName = viewMode === 'inbox' ? 'support_tickets' : 'recycle_bin';

    // Se for lixeira, filtramos apenas items que vieram do suporte
    let q;
    if(viewMode === 'inbox') {
        q = query(collection(db, "support_tickets"), orderBy("created_at", "desc"));
    } else {
        q = query(collection(db, "recycle_bin"), where("origin_collection", "==", "support_tickets"), orderBy("deleted_at", "desc"));
    }

    if(unsubscribeList) unsubscribeList();

    unsubscribeList = onSnapshot(q, (snap) => {
        const usersMap = new Map();
        selectedTickets.clear(); // Reseta seleção ao atualizar
        atualizarToolbar();

        snap.forEach(d => {
            const t = d.data();
            // Agrupa por UID (para mostrar a última conversa)
            if (!usersMap.has(t.uid)) {
                usersMap.set(t.uid, {
                    docId: d.id, // ID do documento mais recente
                    uid: t.uid,
                    name: t.user_name || "Usuário",
                    email: t.user_email,
                    lastMsg: t.message,
                    time: viewMode === 'inbox' ? t.created_at : t.deleted_at,
                    unreadCount: 0,
                    lastSender: t.sender
                });
            }
            if (viewMode === 'inbox' && t.sender === 'user' && t.read === false) {
                usersMap.get(t.uid).unreadCount++;
            }
        });

        // Atualiza contador
        const badgeEl = document.getElementById('ticket-count');
        if(badgeEl) badgeEl.innerText = usersMap.size;

        listContainer.innerHTML = "";
        if (usersMap.size === 0) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 text-xs mt-10">Vazio.</p>`;
            return;
        }

        usersMap.forEach(u => {
            const timeStr = u.time ? u.time.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '';
            const activeClass = (currentChatUser === u.uid) ? 'bg-blue-900/40 border-blue-500' : 'border-transparent hover:bg-slate-800';
            const badge = u.unreadCount > 0 ? `<span class="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ml-2">${u.unreadCount}</span>` : '';
            const prefix = u.lastSender === 'admin' ? '↪️ ' : '';

            // Checkbox ID é o UID do usuário para agrupar conversas
            listContainer.innerHTML += `
                <div class="group flex items-center p-2 rounded-lg border-l-4 ${activeClass} mb-1 bg-slate-900/50 transition relative">
                    <div class="mr-3 flex items-center h-full">
                        <input type="checkbox" value="${u.uid}" onchange="window.toggleSelecao(this)" class="chk-item chk-custom rounded border-gray-600 bg-slate-800">
                    </div>

                    <div onclick="window.abrirChatAdmin('${u.uid}', '${u.name}', '${u.email}')" class="flex-1 cursor-pointer overflow-hidden">
                        <div class="flex justify-between items-center w-full mb-1">
                            <h4 class="font-bold text-gray-200 text-xs truncate flex items-center">${u.name} ${badge}</h4>
                            <span class="text-[8px] text-gray-600 whitespace-nowrap">${timeStr}</span>
                        </div>
                        <p class="text-[10px] text-gray-400 truncate w-[90%]">${prefix}${u.lastMsg}</p>
                    </div>
                </div>
            `;
        });
    });
}

// ============================================================================
// 3. GESTÃO DE SELEÇÃO E LIXEIRA
// ============================================================================
window.alternarModoVisualizacao = (mode) => {
    viewMode = mode;
    currentChatUser = null;
    window.fecharChat();
    
    // Atualiza botões
    const btnIn = document.getElementById('btn-mode-inbox');
    const btnTr = document.getElementById('btn-mode-trash');
    const btnAction = document.getElementById('btn-trash-action');
    
    if(mode === 'inbox') {
        btnIn.className = "text-[10px] font-bold px-3 py-1 rounded-full bg-blue-600 text-white transition shadow-lg";
        btnTr.className = "text-[10px] font-bold px-3 py-1 rounded-full bg-slate-700 text-gray-400 hover:text-white transition";
        if(btnAction) btnAction.innerHTML = "🗑️ Lixeira";
    } else {
        btnIn.className = "text-[10px] font-bold px-3 py-1 rounded-full bg-slate-700 text-gray-400 hover:text-white transition";
        btnTr.className = "text-[10px] font-bold px-3 py-1 rounded-full bg-red-600 text-white transition shadow-lg";
        if(btnAction) btnAction.innerHTML = "🔥 Excluir De Vez";
    }
    
    carregarListaUsuarios();
};

window.toggleSelecao = (chk) => {
    if (chk.checked) selectedTickets.add(chk.value);
    else selectedTickets.delete(chk.value);
    atualizarToolbar();
};

window.toggleSelecionarTudo = (chkMaster) => {
    const checkboxes = document.querySelectorAll('.chk-item');
    checkboxes.forEach(chk => {
        chk.checked = chkMaster.checked;
        if(chkMaster.checked) selectedTickets.add(chk.value);
        else selectedTickets.delete(chk.value);
    });
    atualizarToolbar();
};

function atualizarToolbar() {
    const toolbar = document.getElementById('bulk-toolbar');
    if(selectedTickets.size > 0) toolbar.classList.remove('hidden');
    else toolbar.classList.add('hidden');
}

window.executarAcaoMassa = async (acao) => {
    if(selectedTickets.size === 0) return;
    const db = window.db;
    const batch = writeBatch(db);
    const uids = Array.from(selectedTickets);
    
    const confirmMsg = acao === 'lixeira' 
        ? (viewMode === 'inbox' ? `Mover ${uids.length} conversas para Lixeira?` : `Excluir PERMANENTEMENTE ${uids.length} conversas?`)
        : `Marcar ${uids.length} conversas como lidas?`;

    if(!confirm(confirmMsg)) return;

    // Processa cada UID selecionado
    for (const uid of uids) {
        // Busca todas as mensagens desse usuário na coleção atual
        const colName = viewMode === 'inbox' ? "support_tickets" : "recycle_bin";
        const q = query(collection(db, colName), where("uid", "==", uid));
        const snap = await getDocs(q);

        snap.forEach(docSnap => {
            if (acao === 'lido') {
                batch.update(docSnap.ref, { read: true });
            } 
            else if (acao === 'lixeira') {
                if(viewMode === 'inbox') {
                    // MOVER PARA LIXEIRA (Copia -> Deleta)
                    const data = docSnap.data();
                    const trashRef = doc(collection(db, "recycle_bin"));
                    batch.set(trashRef, { ...data, deleted_at: serverTimestamp(), origin_collection: "support_tickets", original_id: docSnap.id });
                    batch.delete(docSnap.ref);
                } else {
                    // EXCLUIR DE VEZ (Hard Delete)
                    batch.delete(docSnap.ref);
                }
            }
        });
    }

    try {
        await batch.commit();
        alert("✅ Ação concluída!");
        selectedTickets.clear();
        atualizarToolbar();
    } catch(e) {
        alert("Erro: " + e.message);
    }
};

// ============================================================================
// 4. CHAT (MANTIDO DO ANTERIOR, SÓ CONECTADO)
// ============================================================================
window.abrirChatAdmin = async (uid, name, email) => {
    currentChatUser = uid;
    document.getElementById('chat-header').classList.remove('hidden');
    // Só mostra input se não estiver na lixeira
    if(viewMode === 'inbox') document.getElementById('chat-input-area').classList.remove('hidden');
    else document.getElementById('chat-input-area').classList.add('hidden');

    document.getElementById('chat-user-name').innerText = name;
    document.getElementById('chat-user-id').innerText = email || uid;

    const container = document.getElementById('chat-messages');
    const db = window.db;
    const colName = viewMode === 'inbox' ? "support_tickets" : "recycle_bin";
    
    // Na lixeira, ordenamos por 'deleted_at', no inbox por 'created_at'
    const orderField = viewMode === 'inbox' ? 'created_at' : 'deleted_at';
    const q = query(collection(db, colName), where("uid", "==", uid), orderBy(orderField, "desc"));

    if(unsubscribeChat) unsubscribeChat();

    unsubscribeChat = onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.sender === 'system' || msg.sender === 'admin';
            container.innerHTML += `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 animate-fadeIn w-full">
                    <div class="${isMe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-200'} max-w-[80%] rounded-xl px-4 py-2 text-xs shadow-md break-words">
                        <p>${msg.message}</p>
                        <p class="text-[9px] opacity-50 text-right mt-1">${msg.created_at?.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) || '...'}</p>
                    </div>
                </div>`;
        });
    });
};

window.enviarRespostaAdmin = async (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-reply-input');
    const txt = input.value.trim();
    if(!txt || !currentChatUser) return;
    input.value = "";
    try {
        await addDoc(collection(window.db, "support_tickets"), {
            uid: currentChatUser,
            sender: 'admin',
            message: txt,
            created_at: serverTimestamp(),
            read: true
        });
    } catch(err) { alert("Erro ao enviar."); }
};

window.fecharChat = () => {
    currentChatUser = null;
    if(unsubscribeChat) unsubscribeChat();
    document.getElementById('chat-header').classList.add('hidden');
    document.getElementById('chat-input-area').classList.add('hidden');
    document.getElementById('chat-messages').innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none"><span class="text-4xl mb-2">💬</span><p class="text-sm font-bold">Central de Suporte</p></div>`;
};
