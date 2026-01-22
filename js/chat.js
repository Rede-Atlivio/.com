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

window.enviarMensagem = async () => {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !activeChatId) return;

    // BLINDAGEM (REGEX)
    const proibidos = [/\b\d{8,}\b/, /\b\d{2}\s\d{4,}\b/, /@/, /zap/i, /whatsapp/i, /\.com/i, /\.br/i];
    let bloqueado = false;
    proibidos.forEach(regex => { if(regex.test(text)) bloqueado = true; });

    if(bloqueado) {
        alert("⚠️ Bloqueado: Troca de contatos externos não é permitida.");
        return;
    }

    await addDoc(collection(db, `chats/${activeChatId}/messages`), { text: text, sender_id: auth.currentUser.uid, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "chats", activeChatId), { last_message: text, updated_at: serverTimestamp() });
    input.value = "";
};
