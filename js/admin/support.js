import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentChatUid = null;
let unsubscribeChat = null;

// ============================================================================
// 1. INICIALIZAÇÃO DO MÓDULO
// ============================================================================
export async function init() {
    const container = document.getElementById('main-content'); // Ou o container principal do seu admin
    if(!container) return console.error("Container principal não encontrado.");

    container.innerHTML = `
        <div class="flex h-[calc(100vh-100px)] gap-4 animate-fade">
            <div class="w-1/3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                <div class="p-4 border-b border-slate-700 bg-slate-800">
                    <h2 class="text-white font-bold flex items-center gap-2">
                        📩 Tickets <span id="ticket-count" class="bg-blue-600 text-[10px] px-2 rounded-full">0</span>
                    </h2>
                </div>
                <div id="ticket-list" class="flex-1 overflow-y-auto p-2 space-y-2">
                    <p class="text-gray-500 text-center text-xs mt-4">Carregando...</p>
                </div>
            </div>

            <div class="w-2/3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative">
                <div id="chat-header" class="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center hidden">
                    <div>
                        <h3 id="chat-user-name" class="text-white font-bold text-sm">Selecione um ticket</h3>
                        <p id="chat-user-email" class="text-gray-400 text-[10px]">...</p>
                    </div>
                    <div id="chat-user-status"></div>
                </div>

                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
                    <div class="h-full flex flex-col items-center justify-center opacity-30">
                        <span class="text-4xl mb-2">💬</span>
                        <p class="text-sm">Selecione uma conversa ao lado</p>
                    </div>
                </div>

                <div id="chat-input-area" class="p-4 bg-slate-800 border-t border-slate-700 hidden">
                    <form onsubmit="event.preventDefault(); window.sendAdminMessage();" class="flex gap-2">
                        <input type="text" id="admin-msg-input" class="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" placeholder="Escreva sua resposta...">
                        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold">➤</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    console.log("✅ Módulo Suporte Carregado.");
    loadActiveTickets();
}

// ============================================================================
// 2. LISTAR CONVERSAS ATIVAS
// ============================================================================
async function loadActiveTickets() {
    const db = window.db;
    const listEl = document.getElementById('ticket-list');
    
    // Estratégia: Buscar mensagens recentes e agrupar por UID (Client-side grouping para MVP)
    // Em produção ideal, teríamos uma coleção 'chats' separada.
    const q = query(collection(db, "support_tickets"), orderBy("created_at", "desc"), limit(100));
    
    onSnapshot(q, async (snap) => {
        const uniqueSenders = new Map();
        
        snap.forEach(doc => {
            const data = doc.data();
            if(!uniqueSenders.has(data.uid)) {
                uniqueSenders.set(data.uid, {
                    uid: data.uid,
                    lastMsg: data.message,
                    time: data.created_at,
                    email: data.user_email,
                    name: data.user_name,
                    read: data.read
                });
            }
        });

        listEl.innerHTML = "";
        document.getElementById('ticket-count').innerText = uniqueSenders.size;

        if(uniqueSenders.size === 0) {
            listEl.innerHTML = `<p class="text-gray-500 text-center text-xs mt-10">Nenhum ticket aberto.</p>`;
            return;
        }

        // Renderiza a lista
        for (const [uid, info] of uniqueSenders) {
            // Tenta buscar nome atualizado se estiver como "User" ou "Usuário"
            let displayName = info.name;
            if(!displayName || displayName === "User" || displayName === "Usuário") {
                // Pequena correção do Item 26 aqui
                try {
                    const uSnap = await getDoc(doc(db, "usuarios", uid));
                    if(uSnap.exists()) {
                        const uData = uSnap.data();
                        displayName = uData.nome_profissional || uData.nome || uData.displayName || info.email;
                    }
                } catch(e) {}
            }

            const activeClass = currentChatUid === uid ? 'bg-blue-900/40 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700';
            const timeStr = info.time?.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) || "";

            listEl.innerHTML += `
                <div onclick="window.openAdminChat('${uid}', '${displayName}', '${info.email}')" class="cursor-pointer p-3 rounded-lg border ${activeClass} transition relative">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="text-white font-bold text-xs truncate w-2/3">${displayName}</h4>
                        <span class="text-[9px] text-gray-500">${timeStr}</span>
                    </div>
                    <p class="text-gray-400 text-[10px] truncate">${info.lastMsg}</p>
                </div>
            `;
        }
    });
}

// ============================================================================
// 3. ABRIR CHAT ESPECÍFICO
// ============================================================================
window.openAdminChat = (uid, name, email) => {
    currentChatUid = uid;
    
    // UI Update
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-input-area').classList.remove('hidden');
    document.getElementById('chat-user-name').innerText = name;
    document.getElementById('chat-user-email').innerText = email;
    
    // Highlight na lista
    loadActiveTickets(); // Recarrega para atualizar a seleção visual

    // Listener de Mensagens
    const container = document.getElementById('chat-messages');
    const db = window.db;
    const q = query(collection(db, "support_tickets"), where("uid", "==", uid), orderBy("created_at", "asc"));

    if(unsubscribeChat) unsubscribeChat();

    unsubscribeChat = onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(doc => {
            const msg = doc.data();
            const isAdmin = msg.sender === 'admin';
            
            container.innerHTML += `
                <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fade">
                    <div class="${isAdmin ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-200'} max-w-[80%] rounded-xl px-4 py-2 text-xs shadow-md">
                        <p>${msg.message}</p>
                        <p class="text-[9px] ${isAdmin ? 'text-blue-200' : 'text-gray-500'} text-right mt-1">
                            ${msg.created_at?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '...'}
                        </p>
                    </div>
                </div>
            `;
        });
        container.scrollTop = container.scrollHeight;
    });
};

// ============================================================================
// 4. ENVIAR RESPOSTA
// ============================================================================
window.sendAdminMessage = async () => {
    const input = document.getElementById('admin-msg-input');
    const txt = input.value.trim();
    if(!txt || !currentChatUid) return;

    input.value = "";
    
    try {
        await addDoc(collection(window.db, "support_tickets"), {
            uid: currentChatUid,
            sender: 'admin',
            message: txt,
            created_at: serverTimestamp(),
            read: false
        });
        // O snapshot já atualiza a tela
    } catch(e) {
        alert("Erro ao enviar: " + e.message);
    }
};
