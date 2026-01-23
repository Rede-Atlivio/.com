import { db, auth } from './app.js';
import { userProfile } from './auth.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let activeChatId = null;

export function carregarMeusChats() {
    const container = document.getElementById('lista-chats');
    if(!container || !userProfile) return;

    let q = userProfile.role === 'admin' 
        ? query(collection(db, "chats"), orderBy("updated_at", "desc"))
        : query(collection(db, "chats"), where("participants", "array-contains", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        if(snap.empty) container.innerHTML = "<p class='text-center text-xs text-gray-400 py-10'>Sem mensagens.</p>";
        else {
            snap.forEach(d => {
                const chat = d.data();
                container.innerHTML += `<div onclick="abrirChat('${d.id}', '${chat.mission_title}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center cursor-pointer mb-2"><div><p class="font-bold text-xs text-blue-900 uppercase italic">${chat.mission_title}</p><p class="text-[10px] text-gray-500 truncate w-48">${chat.last_message}</p></div><span class="text-xl">💬</span></div>`;
            });
        }
    });
}

window.abrirChat = (chatId, title) => {
    activeChatId = chatId;
    document.getElementById('chat-modal').classList.remove('hidden');
    document.getElementById('chat-mission-title').innerText = title;
    carregarMensagens(chatId);
};

window.fecharChat = () => {
    document.getElementById('chat-modal').classList.add('hidden');
    activeChatId = null;
};

function carregarMensagens(chatId) {
    const container = document.getElementById('chat-messages');
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.sender_id === auth.currentUser.uid;
            const bubbleClass = isMe ? "chat-bubble-me" : "chat-bubble-them";
            container.innerHTML += `<div class="flex w-full"><div class="p-3 text-[11px] max-w-[80%] ${bubbleClass} shadow-sm mb-2">${msg.text}</div></div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- SANITIZADOR INTELIGENTE (ANTI-GAMBIARRA) ---
function contemContato(texto) {
    // 1. Normaliza: minúsculas e remove acentos
    let limpo = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 2. Mapa de conversão (palavra -> número)
    const mapa = {
        'zero': '0', 'um': '1', 'dois': '2', 'tres': '3', 'quatro': '4',
        'cinco': '5', 'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9',
        'zap': '9', 'whats': '9', 'contato': '9', 'ligar': '9'
    };

    // 3. Substitui palavras por números
    Object.keys(mapa).forEach(key => {
        limpo = limpo.replaceAll(key, mapa[key]);
    });

    // 4. Remove tudo que NÃO é número
    const soNumeros = limpo.replace(/\D/g, "");

    // 5. Verifica padrões proibidos
    // - Sequência de 8 ou mais dígitos (telefone)
    // - Email (@)
    // - Links (.com)
    if (soNumeros.length >= 8) return true;
    if (texto.includes('@') || texto.includes('.com') || texto.includes('.br')) return true;

    return false;
}

window.enviarMensagem = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !activeChatId) return;

    // APLICA O FILTRO AVANÇADO
    if(contemContato(text)) {
        alert("🚫 BLOQUEADO PELO SISTEMA\n\nTentativa de burlar a plataforma detectada.\nNão é permitido enviar contatos, telefones ou links.");
        input.value = ""; // Limpa a tentativa
        return;
    }

    await addDoc(collection(db, `chats/${activeChatId}/messages`), { text: text, sender_id: auth.currentUser.uid, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "chats", activeChatId), { last_message: text, updated_at: serverTimestamp() });
    input.value = "";
};
