import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

console.log("💼 Módulo de Chat de Vagas Iniciado (Modo Aditivo)");

// ============================================================================
// 1. INTERCEPTADOR (A Mágica para não mexer no chat.js)
// ============================================================================
// Salva a função original de serviços
const carregarServicosOriginal = window.carregarChat; 

// Cria uma nova função mestra que roda as duas
window.carregarChat = async () => {
    // 1. Roda a lógica original dos serviços (Protegida)
    if(carregarServicosOriginal) await carregarServicosOriginal();
    
    // 2. Roda a nossa lógica de vagas em seguida
    carregarChatVagas();
};

// ============================================================================
// 2. LISTA DE VAGAS (ANEXADA ABAIXO DOS SERVIÇOS)
// ============================================================================
async function carregarChatVagas() {
    const containerPrincipal = document.getElementById('sec-chat');
    if (!containerPrincipal || !auth.currentUser) return;

    // Cria nosso container específico se não existir
    let containerVagas = document.getElementById('painel-vagas');
    if (!containerVagas) {
        containerVagas = document.createElement('div');
        containerVagas.id = 'painel-vagas';
        containerVagas.className = "pb-24 animate-fadeIn mt-4 border-t border-gray-200 pt-4";
        containerPrincipal.appendChild(containerVagas);
    }

    containerVagas.innerHTML = `
        <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4 flex justify-between items-center">
            <div>
                <h2 class="text-lg font-black text-indigo-900">💼 Entrevistas</h2>
                <p class="text-[10px] text-gray-500">Candidaturas e Vagas</p>
            </div>
        </div>
        <div id="lista-vagas-render" class="space-y-3">
            <div class="loader mx-auto"></div>
        </div>
    `;

    const listaRender = document.getElementById('lista-vagas-render');
    
    // Busca conversas da coleção 'chats' (que usamos no jobs.js)
    const q = query(collection(db, "chats"), where("users", "array-contains", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        const chats = [];
        snap.forEach(d => {
            const data = d.data();
            // Filtra apenas chats que têm contexto de vaga (job_context)
            if(data.job_context) chats.push({ id: d.id, ...data });
        });

        // Ordena por data
        chats.sort((a, b) => (b.last_time?.seconds || 0) - (a.last_time?.seconds || 0));

        listaRender.innerHTML = "";
        
        if (chats.length === 0) {
            listaRender.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">Nenhuma entrevista ativa.</p>`;
            return;
        }

        chats.forEach(chat => {
            // Descobre o nome do outro
            const myIndex = chat.users.indexOf(auth.currentUser.uid);
            const otherIndex = myIndex === 0 ? 1 : 0;
            const otherName = chat.user_names ? chat.user_names[otherIndex] : "Recrutador/Candidato";
            
            const timeStr = chat.last_time ? chat.last_time.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

            listaRender.innerHTML += `
                <div onclick="window.abrirChatVaga('${chat.id}', '${otherName}')" class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-3">
                    <div class="bg-indigo-100 h-10 w-10 rounded-full flex items-center justify-center text-lg">👔</div>
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <h3 class="font-bold text-gray-800 text-xs">${otherName}</h3>
                            <span class="text-[9px] text-gray-400">${timeStr}</span>
                        </div>
                        <p class="text-[10px] text-gray-500 truncate">${chat.last_msg || 'Nova entrevista'}</p>
                    </div>
                </div>
            `;
        });
    });
}

// ============================================================================
// 3. TELA DE CHAT ESPECÍFICA PARA VAGAS (SIMPLES)
// ============================================================================
window.abrirChatVaga = function(chatId, otherName) {
    let painelChat = document.getElementById('painel-chat-vaga');
    
    // Cria o painel no body se não existir
    if (!painelChat) {
        painelChat = document.createElement('div');
        painelChat.id = 'painel-chat-vaga';
        painelChat.className = "fixed inset-0 z-[9999] bg-white flex flex-col h-full w-full hidden";
        document.body.appendChild(painelChat);
    }

    // Esconde a lista
    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.add('hidden');
    
    painelChat.classList.remove('hidden');
    
    // Renderiza Estrutura
    painelChat.innerHTML = `
        <div class="flex flex-col h-full bg-slate-50">
            <div class="bg-indigo-900 p-3 shadow-sm flex items-center gap-3 z-20 text-white">
                <button onclick="window.fecharChatVaga()" class="text-white p-2 text-xl">⬅</button>
                <div class="flex-1">
                    <h3 class="font-bold text-sm">${otherName}</h3>
                    <p class="text-[9px] text-indigo-300">Entrevista</p>
                </div>
            </div>

            <div id="chat-vaga-msgs" class="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                <div class="loader mx-auto"></div>
            </div>

            <div class="bg-white p-3 border-t border-gray-200 flex gap-2 items-center fixed bottom-0 w-full">
                <input type="text" id="input-msg-vaga" placeholder="Digite sua mensagem..." class="flex-1 bg-gray-100 text-gray-800 rounded-full px-5 py-3 text-sm outline-none">
                <button onclick="window.enviarMsgVaga('${chatId}')" class="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow hover:bg-indigo-500">➤</button>
            </div>
        </div>
    `;

    // Carrega Mensagens
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("created_at", "asc"));
    onSnapshot(q, (snap) => {
        const divMsgs = document.getElementById('chat-vaga-msgs');
        if(!divMsgs) return;
        
        divMsgs.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const souEu = msg.sender_uid === auth.currentUser.uid;
            
            divMsgs.innerHTML += `
                <div class="flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                    <div class="${souEu ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] text-sm shadow-sm">
                        <p>${msg.text}</p>
                        <p class="text-[8px] opacity-70 text-right mt-1">${msg.created_at?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '...'}</p>
                    </div>
                </div>
            `;
        });
        setTimeout(() => divMsgs.scrollTop = divMsgs.scrollHeight, 100);
    });
};

window.enviarMsgVaga = async function(chatId) {
    const input = document.getElementById('input-msg-vaga');
    const text = input.value.trim();
    if(!text) return;
    input.value = "";

    await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: text,
        sender_uid: auth.currentUser.uid,
        created_at: serverTimestamp()
    });

    await updateDoc(doc(db, "chats", chatId), {
        last_msg: text,
        last_time: serverTimestamp()
    });
};

window.fecharChatVaga = function() {
    document.getElementById('painel-chat-vaga').classList.add('hidden');
    // Restaura a lista principal se necessário
    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.remove('hidden');
    const painelVagas = document.getElementById('painel-vagas');
    if(painelVagas) painelVagas.classList.remove('hidden');
};

// Mapeamento de compatibilidade para o botão "Chamar para Entrevista"
window.abrirChatEspecifico = window.abrirChatVaga;
