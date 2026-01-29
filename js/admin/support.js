import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let unsubscribeList = null;
let unsubscribeChat = null;
let currentChatUser = null;

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export function init() {
    const container = document.getElementById('view-support');
    if(!container) return console.error("❌ Container 'view-support' não encontrado.");
    
    // Layout
    container.innerHTML = `
        <div class="flex h-[calc(100vh-140px)] gap-4 animate-fade">
            <div class="w-1/3 glass-panel p-0 flex flex-col overflow-hidden border-r border-gray-700">
                <div class="p-4 bg-slate-900/50 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2">📥 Entrada <span id="ticket-count" class="bg-blue-600 text-[10px] px-2 rounded-full">0</span></h3>
                    <button onclick="window.marcarTudoLido()" class="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-600 transition border border-slate-600">Marcar tudo lido</button>
                </div>
                <div id="support-users-list" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
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

    // Pega todas as mensagens para agrupar
    const q = query(collection(db, "support_tickets"), orderBy("created_at", "desc"));

    unsubscribeList = onSnapshot(q, (snap) => {
        const usersMap = new Map();

        snap.forEach(d => {
            const t = d.data();
            // Agrupa por UID
            if (!usersMap.has(t.uid)) {
                usersMap.set(t.uid, {
                    uid: t.uid,
                    name: t.user_name || "Usuário",
                    email: t.user_email,
                    lastMsg: t.message,
                    time: t.created_at,
                    unreadCount: 0,
                    lastSender: t.sender
                });
            }
            // Conta não lidos (só conta se foi o usuário que mandou)
            if (t.sender === 'user' && t.read === false) {
                usersMap.get(t.uid).unreadCount++;
            }
        });

        // Atualiza contador do título
        let totalPending = 0;
        usersMap.forEach(u => totalPending += u.unreadCount);
        const badgeEl = document.getElementById('ticket-count');
        if(badgeEl) {
            badgeEl.innerText = totalPending;
            badgeEl.className = totalPending > 0 ? "bg-red-500 text-[10px] px-2 rounded-full animate-pulse" : "bg-gray-600 text-[10px] px-2 rounded-full";
        }

        listContainer.innerHTML = "";
        if (usersMap.size === 0) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 text-xs mt-10">Nenhum chamado.</p>`;
            return;
        }

        usersMap.forEach(u => {
            const timeStr = u.time ? u.time.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
            const activeClass = (currentChatUser === u.uid) ? 'bg-blue-900/40 border-blue-500' : 'border-transparent hover:bg-slate-800';
            const badge = u.unreadCount > 0 ? `<span class="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">${u.unreadCount}</span>` : '';
            const prefix = u.lastSender === 'admin' ? '↪️ ' : '';

            listContainer.innerHTML += `
                <div onclick="window.abrirChatAdmin('${u.uid}', '${u.name}', '${u.email}')" class="p-3 rounded-lg border-l-4 ${activeClass} cursor-pointer transition flex justify-between items-start mb-1 bg-slate-900/50">
                    <div class="overflow-hidden w-full">
                        <div class="flex justify-between items-center w-full mb-1">
                            <h4 class="font-bold text-gray-200 text-xs truncate max-w-[70%]">${u.name}</h4>
                            ${badge}
                        </div>
                        <div class="flex justify-between items-end">
                            <p class="text-[10px] text-gray-400 truncate w-[70%]">${prefix}${u.lastMsg}</p>
                            <span class="text-[8px] text-gray-600 whitespace-nowrap">${timeStr}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

// ============================================================================
// 3. CHAT E LÓGICA DE LEITURA (A MÁGICA DA SECRETÁRIA)
// ============================================================================
window.abrirChatAdmin = async (uid, name, email) => {
    currentChatUser = uid;
    
    // UI
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-input-area').classList.remove('hidden');
    document.getElementById('chat-user-name').innerText = name;
    document.getElementById('chat-user-id').innerText = email || uid;
    carregarListaUsuarios(); // Atualiza visual da seleção

    const container = document.getElementById('chat-messages');
    const db = window.db;
    
    // 🔥 IMPORTANTE: Busca mensagens deste usuário
    const q = query(collection(db, "support_tickets"), where("uid", "==", uid), orderBy("created_at", "desc"));

    if(unsubscribeChat) unsubscribeChat();

    unsubscribeChat = onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        // 🧼 LÓGICA DE LIMPEZA: Marca mensagens como lidas
        const batch = writeBatch(db);
        let needsCommit = false;

        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.sender === 'system' || msg.sender === 'admin';
            
            // Visual
            container.innerHTML += `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 animate-fadeIn w-full">
                    <div class="${isMe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-200'} max-w-[80%] rounded-xl px-4 py-2 text-xs shadow-md break-words">
                        <p>${msg.message}</p>
                        <p class="text-[9px] opacity-50 text-right mt-1">${msg.created_at?.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) || '...'}</p>
                    </div>
                </div>
            `;

            // ✅ Se for mensagem do usuário e ainda estiver "read: false", marca como lida
            if (msg.sender === 'user' && msg.read === false) {
                const ref = doc(db, "support_tickets", d.id);
                batch.update(ref, { read: true });
                needsCommit = true;
            }
        });

        // Envia atualização pro banco (A Secretária vai ver isso e ficar feliz)
        if (needsCommit) {
            batch.commit().then(() => console.log("🧹 Tickets marcados como lidos. Secretária atualizada."));
        }
    });
};

// ============================================================================
// 4. AÇÕES (ENVIAR E LIMPAR TUDO)
// ============================================================================
window.enviarRespostaAdmin = async (e) => {
    e.preventDefault();
    const input = document.getElementById('admin-reply-input');
    const txt = input.value.trim();
    if(!txt || !currentChatUser) return;

    input.value = "";
    try {
        // Salva Ticket
        await addDoc(collection(window.db, "support_tickets"), {
            uid: currentChatUser,
            sender: 'admin',
            message: txt,
            created_at: serverTimestamp(),
            read: true // Admin já manda lido
        });
        
        // 🔔 Envia Notificação para o Usuário (Para ele saber que responderam)
        await addDoc(collection(window.db, "notifications"), {
            uid: currentChatUser,
            message: "💬 Suporte respondeu: " + txt,
            type: 'info',
            read: false,
            created_at: serverTimestamp()
        });

    } catch(err) { alert("Erro ao enviar."); }
};

window.marcarTudoLido = async () => {
    if(!confirm("Tem certeza? Isso vai zerar o contador da Secretária.")) return;
    const db = window.db;
    // Busca todas as mensagens não lidas de usuários
    const q = query(collection(db, "support_tickets"), where("read", "==", false), where("sender", "==", "user"));
    const snap = await getDocs(q);
    
    if(snap.empty) return alert("Nada para marcar.");

    const batch = writeBatch(db);
    snap.forEach(d => batch.update(d.ref, { read: true }));
    
    await batch.commit();
    alert("✅ Tudo limpo!");
};

window.fecharChat = () => {
    currentChatUser = null;
    if(unsubscribeChat) unsubscribeChat();
    document.getElementById('chat-header').classList.add('hidden');
    document.getElementById('chat-input-area').classList.add('hidden');
    document.getElementById('chat-messages').innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
            <span class="text-4xl mb-2">💬</span>
            <p class="text-sm font-bold">Central de Suporte</p>
            <p class="text-xs">Selecione uma conversa ao lado</p>
        </div>`;
    carregarListaUsuarios();
};
