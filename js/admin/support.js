import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentChatUid = null;
let unsubscribeChat = null;

// ============================================================================
// 1. INICIALIZAÇÃO DO MÓDULO
// ============================================================================
export async function init() {
    // 🔥 CORREÇÃO CRÍTICA: O ID correto no admin.html é 'view-support'
    const container = document.getElementById('view-support'); 
    
    if(!container) return console.error("❌ ERRO: Container 'view-support' não encontrado no HTML.");

    container.innerHTML = `
        <div class="flex h-[calc(100vh-140px)] gap-4 animate-fade">
            <div class="w-1/3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                <div class="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                    <h2 class="text-white font-bold flex items-center gap-2 text-sm">
                        📩 Tickets <span id="ticket-count" class="bg-blue-600 text-[10px] px-2 rounded-full">0</span>
                    </h2>
                    <button onclick="window.loadActiveTickets()" class="text-xs text-gray-400 hover:text-white">↻</button>
                </div>
                <div id="ticket-list" class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    <p class="text-gray-500 text-center text-xs mt-4 animate-pulse">Carregando...</p>
                </div>
            </div>

            <div class="w-2/3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative">
                <div id="chat-header" class="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center hidden">
                    <div>
                        <h3 id="chat-user-name" class="text-white font-bold text-sm">Selecione um ticket</h3>
                        <p id="chat-user-email" class="text-gray-400 text-[10px]">...</p>
                    </div>
                    <div class="text-[10px] text-gray-500 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                        UID: <span id="chat-user-uid">...</span>
                    </div>
                </div>

                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50 relative">
                    <div class="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
                        <i data-lucide="message-square" width="48" height="48" class="mb-2"></i>
                        <p class="text-sm font-bold">Central de Suporte</p>
                        <p class="text-xs">Selecione uma conversa ao lado</p>
                    </div>
                </div>

                <div id="chat-input-area" class="p-4 bg-slate-800 border-t border-slate-700 hidden">
                    <form onsubmit="event.preventDefault(); window.sendAdminMessage();" class="flex gap-2">
                        <input type="text" id="admin-msg-input" class="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none" placeholder="Escreva sua resposta (o usuário verá no app)...">
                        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-bold transition">ENVIAR ➤</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Recarrega ícones (caso use Lucide)
    if(window.lucide) window.lucide.createIcons();
    
    // Torna funções globais para o HTML acessar
    window.loadActiveTickets = loadActiveTickets;
    window.openAdminChat = openAdminChat;
    window.sendAdminMessage = sendAdminMessage;

    console.log("✅ Painel de Suporte Renderizado.");
    loadActiveTickets();
}

// ============================================================================
// 2. LISTAR CONVERSAS ATIVAS
// ============================================================================
async function loadActiveTickets() {
    const db = window.db;
    const listEl = document.getElementById('ticket-list');
    
    // Busca mensagens recentes para montar a lista de "Inbox"
    // OBS: Se der erro de índice no console, o Firebase vai gerar um link para criar o índice.
    const q = query(collection(db, "support_tickets"), orderBy("created_at", "desc"), limit(200));
    
    onSnapshot(q, async (snap) => {
        const uniqueSenders = new Map();
        
        snap.forEach(doc => {
            const data = doc.data();
            // Agrupa por UID do usuário
            if(!uniqueSenders.has(data.uid)) {
                uniqueSenders.set(data.uid, {
                    uid: data.uid,
                    lastMsg: data.message,
                    time: data.created_at,
                    email: data.user_email,
                    name: data.user_name,
                    read: data.read,
                    isSystem: data.sender === 'system'
                });
            }
        });

        listEl.innerHTML = "";
        document.getElementById('ticket-count').innerText = uniqueSenders.size;

        if(uniqueSenders.size === 0) {
            listEl.innerHTML = `<div class="text-center mt-10"><p class="text-2xl mb-2">📭</p><p class="text-gray-500 text-xs">Caixa de entrada vazia.</p></div>`;
            return;
        }

        // Renderiza a lista
        for (const [uid, info] of uniqueSenders) {
            // 🕵️‍♂️ CORREÇÃO DE NOMES (ITEM 26 ADIANTADO)
            let displayName = info.name || "Desconhecido";
            
            // Se o nome for genérico, tenta buscar no perfil do usuário
            if(displayName === "User" || displayName === "Usuário" || !displayName) {
                try {
                    const uSnap = await getDoc(doc(db, "usuarios", uid));
                    if(uSnap.exists()) {
                        const uData = uSnap.data();
                        displayName = uData.nome_profissional || uData.nome || uData.displayName || info.email || "User " + uid.substring(0,4);
                    }
                } catch(e) { console.warn("Erro ao buscar nome real:", e); }
            }

            const activeClass = currentChatUid === uid ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700';
            const timeStr = info.time?.toDate().toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) || "";
            const prefix = info.isSystem ? '<span class="text-yellow-500 mr-1">[SISTEMA]</span>' : '';

            listEl.innerHTML += `
                <div onclick="window.openAdminChat('${uid}', '${displayName}', '${info.email || ''}')" class="cursor-pointer p-3 rounded-lg border ${activeClass} transition relative group">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="text-white font-bold text-xs truncate w-2/3 flex items-center gap-1">
                            ${displayName}
                        </h4>
                        <span class="text-[9px] text-gray-500">${timeStr}</span>
                    </div>
                    <p class="text-gray-400 text-[10px] truncate group-hover:text-gray-300">${prefix}${info.lastMsg}</p>
                </div>
            `;
        }
    });
}

// ============================================================================
// 3. ABRIR CHAT ESPECÍFICO
// ============================================================================
async function openAdminChat(uid, name, email) {
    currentChatUid = uid;
    
    // UI Update
    document.getElementById('chat-header').classList.remove('hidden');
    document.getElementById('chat-input-area').classList.remove('hidden');
    document.getElementById('chat-user-name').innerText = name;
    document.getElementById('chat-user-email').innerText = email;
    document.getElementById('chat-user-uid').innerText = uid;
    
    // Remove "vazio"
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = `<div class="flex justify-center pt-10"><div class="loader border-t-blue-500 w-6 h-6 rounded-full animate-spin"></div></div>`;

    // Listener de Mensagens
    const db = window.db;
    const q = query(collection(db, "support_tickets"), where("uid", "==", uid), orderBy("created_at", "asc"));

    if(unsubscribeChat) unsubscribeChat();

    unsubscribeChat = onSnapshot(q, (snap) => {
        messagesDiv.innerHTML = "";
        
        if(snap.empty) {
            messagesDiv.innerHTML = `<p class="text-center text-gray-500 text-xs mt-10">Histórico vazio.</p>`;
            return;
        }

        snap.forEach(docSnap => {
            const msg = docSnap.data();
            const isAdmin = msg.sender === 'admin';
            const isSystem = msg.sender === 'system' || msg.system_msg; // Mensagens automáticas
            
            let html = '';

            if (isSystem) {
                html = `
                    <div class="flex justify-center my-4 animate-fade">
                        <span class="bg-slate-800 text-gray-400 text-[9px] font-bold px-3 py-1 rounded-full border border-slate-700 uppercase tracking-wider">
                            🤖 ${msg.message}
                        </span>
                    </div>
                `;
            } else {
                html = `
                    <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fade">
                        <div class="${isAdmin ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-gray-200 rounded-tl-none'} max-w-[80%] rounded-xl px-4 py-2 text-xs shadow-md border ${isAdmin ? 'border-blue-500' : 'border-slate-600'}">
                            <p>${msg.message}</p>
                            <p class="text-[9px] ${isAdmin ? 'text-blue-200' : 'text-gray-500'} text-right mt-1">
                                ${msg.created_at?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '...'}
                            </p>
                        </div>
                    </div>
                `;
            }
            messagesDiv.innerHTML += html;
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// ============================================================================
// 4. ENVIAR RESPOSTA
// ============================================================================
async function sendAdminMessage() {
    const input = document.getElementById('admin-msg-input');
    const txt = input.value.trim();
    if(!txt || !currentChatUid) return;

    input.value = "";
    input.focus();
    
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
}
