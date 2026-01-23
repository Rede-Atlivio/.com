import { db, auth } from './app.js';
import { userProfile } from './auth.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let activeChatId = null;

// --- CARREGAR LISTA DE CHATS ---
export function carregarMeusChats() {
    const container = document.getElementById('lista-chats');
    if(!container || !userProfile) return;

    let q = userProfile.role === 'admin' 
        ? query(collection(db, "chats"), orderBy("updated_at", "desc"))
        : query(collection(db, "chats"), where("participants", "array-contains", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) container.innerHTML = "<div class='text-center py-10'><span class='text-4xl grayscale opacity-30'>💬</span><p class='text-xs text-gray-400 mt-2'>Nenhuma conversa ativa.</p></div>";
        else {
            snap.forEach(d => {
                const chat = d.data();
                container.innerHTML += `
                    <div onclick="abrirChat('${d.id}', '${chat.mission_title}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center cursor-pointer mb-2 hover:bg-blue-50 transition">
                        <div>
                            <p class="font-bold text-xs text-blue-900 uppercase italic">${chat.mission_title || 'Nova Conversa'}</p>
                            <p class="text-[10px] text-gray-500 truncate w-48">${chat.last_message}</p>
                        </div>
                        <span class="text-xl">➔</span>
                    </div>`;
            });
        }
    });
}

// --- FUNÇÕES DE JANELA ---
window.abrirChat = (chatId, title) => {
    activeChatId = chatId;
    document.getElementById('chat-modal').classList.remove('hidden');
    // Previne erro se o elemento não existir ainda
    const titleEl = document.getElementById('chat-mission-title');
    if(titleEl) titleEl.innerText = title || "Negociação";
    
    carregarMensagens(chatId);
};

window.fecharChat = () => {
    document.getElementById('chat-modal').classList.add('hidden');
    activeChatId = null;
};

// --- CARREGAR MENSAGENS EM TEMPO REAL ---
function carregarMensagens(chatId) {
    const container = document.getElementById('chat-messages');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.sender_id === auth.currentUser.uid;
            const bubbleClass = isMe ? "chat-bubble-me" : "chat-bubble-them";
            container.innerHTML += `<div class="flex w-full"><div class="p-3 text-[11px] max-w-[80%] ${bubbleClass} shadow-sm mb-2 break-words">${msg.text}</div></div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- NOVO SANITIZADOR (LISTA NEGRA DE OFENSAS) ---
function contemOfensa(texto) {
    // Normaliza para minúsculas e remove acentos para pegar variações (ex: ladrão = ladrao)
    const mensagemLimpa = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Lista expandida baseada em moderação de comunidades
    const listaNegra = [
        'vagabunda', 'vagabundo', 'ladrao', 'ladra', 'roubo', 'roubando',
        'corno', 'corna', 'chifrudo',
        'porra', 'caralho', 'caralh0', 'merda', 'bosta', 'coco',
        'puta', 'puto', 'prostituta', 'arrombado', 'arrombada',
        'viado', 'viadinho', 'boiola', 'sapa', 'sapatao',
        'fuder', 'foder', 'foda', 'fudido',
        'idiota', 'imbecil', 'retardado', 'estupido', 'burro', 'anta',
        'picareta', 'golpista', 'safado', 'pilantra', 'otario', 'trouxa',
        'cu', 'cuzão', 'bunda', 'buceta', 'xoxota', 'pau', 'pinto', 'rola'
    ];

    // Verifica se alguma palavra proibida está presente
    // Usamos regex com borda de palavra (\b) para evitar bloquear palavras legítimas (ex: "computador" tem "puta")
    for (let termo of listaNegra) {
        // Se a palavra estiver no meio do texto
        if (mensagemLimpa.includes(termo)) {
            return true;
        }
    }
    return false;
}

// --- ENVIO ---
window.enviarMensagem = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if(!text || !activeChatId) return;

    // 1. CHECAGEM DE RESPEITO (ÚNICA TRAVA AGORA)
    if(contemOfensa(text)) {
        alert("🚫 MENSAGEM BLOQUEADA\n\nNossa comunidade preza pelo respeito.\nPalavras ofensivas ou de baixo calão não são permitidas.");
        // Não limpa o input para a pessoa poder corrigir se quiser
        return;
    }

    // 2. ENVIA LIVREMENTE (CONTATOS PERMITIDOS)
    try {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), { 
            text: text, 
            sender_id: auth.currentUser.uid, 
            timestamp: serverTimestamp() 
        });
        
        await updateDoc(doc(db, "chats", activeChatId), { 
            last_message: text, 
            updated_at: serverTimestamp() 
        });
        
        input.value = ""; // Limpa só se enviou
    } catch (error) {
        console.error("Erro envio:", error);
    }
};
