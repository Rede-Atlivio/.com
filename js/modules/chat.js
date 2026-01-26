import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS ---
const tabChat = document.getElementById('tab-chat');
if (tabChat) {
    tabChat.addEventListener('click', () => {
        carregarPedidosAtivos();
    });
}

// Expõe globalmente para o HTML poder chamar
window.carregarChat = carregarPedidosAtivos;
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.finalizarServicoComToken = finalizarServicoComToken;
window.voltarParaListaPedidos = carregarPedidosAtivos;

// --- 1. LISTA DE PEDIDOS ATIVOS (DASHBOARD) ---
export async function carregarPedidosAtivos() {
    const container = document.getElementById('app-container'); // Injeta no container principal
    if (!container || !auth.currentUser) return;

    // Layout da Lista
    container.innerHTML = `
        <div id="painel-pedidos" class="p-4 pb-20 animate-fadeIn">
            <h2 class="text-xl font-black text-blue-900 mb-4 flex items-center gap-2">
                💬 Pedidos Ativos
                <span id="badge-total-pedidos" class="bg-red-500 text-white text-[10px] px-2 rounded-full hidden">0</span>
            </h2>
            <div id="lista-pedidos-render" class="space-y-3">
                <div class="loader mx-auto border-blue-200 border-t-blue-600"></div>
            </div>
        </div>
        <div id="painel-chat-individual" class="hidden h-screen fixed inset-0 z-50 bg-white">
            </div>
    `;

    const uid = auth.currentUser.uid;
    const listaRender = document.getElementById('lista-pedidos-render');

    // Busca inteligente: Procura pedidos onde sou Cliente OU onde sou Prestador
    // Status aceito ou em andamento
    const pedidosRef = collection(db, "orders");
    
    // Precisamos fazer 2 queries porque o Firestore não aceita "OR" complexo facilmente aqui
    // 1. Onde sou prestador
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), where("status", "==", "accepted"));
    // 2. Onde sou cliente
    const qClient = query(pedidosRef, where("client_id", "==", uid), where("status", "==", "accepted"));

    // Escuta ambos em tempo real
    let pedidosMap = new Map(); // Para evitar duplicatas

    const renderizar = () => {
        listaRender.innerHTML = "";
        if (pedidosMap.size === 0) {
            listaRender.innerHTML = `
                <div class="text-center py-10 opacity-50">
                    <div class="text-6xl mb-2">📭</div>
                    <p class="text-sm font-bold">Nenhum serviço em andamento.</p>
                    <p class="text-xs">Aceite solicitações no Radar ou contrate alguém.</p>
                </div>`;
            return;
        }

        pedidosMap.forEach((pedido) => {
            const isMeProvider = pedido.provider_id === uid;
            const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
            const tipoServico = "Serviço Agendado"; // Pode pegar do pedido se tiver
            
            listaRender.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-4 rounded-xl border-l-4 border-blue-600 shadow-sm hover:bg-gray-50 transition cursor-pointer relative overflow-hidden">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-gray-800">${outroNome}</h3>
                            <p class="text-xs text-blue-600 font-bold uppercase mt-1">R$ ${pedido.offer_value} • Em Andamento</p>
                            <p class="text-[10px] text-gray-400 mt-1">📅 ${pedido.service_date} às ${pedido.service_time}</p>
                        </div>
                        <div class="bg-blue-100 p-2 rounded-full text-blue-600">
                            💬
                        </div>
                    </div>
                    ${!isMeProvider ? `<div class="mt-2 bg-yellow-50 text-yellow-700 text-[10px] px-2 py-1 rounded border border-yellow-100 inline-block">🔑 Você tem o código de segurança</div>` : ''}
                </div>
            `;
        });
    };

    onSnapshot(qProvider, (snap) => {
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() }));
        renderizar();
    });
    onSnapshot(qClient, (snap) => {
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() }));
        renderizar();
    });
}

// --- 2. TELA DE CHAT INDIVIDUAL ---
export async function abrirChatPedido(orderId) {
    const painelChat = document.getElementById('painel-chat-individual');
    const painelLista = document.getElementById('painel-pedidos');
    
    if(!painelChat) return;

    painelLista.classList.add('hidden'); // Esconde lista
    painelChat.classList.remove('hidden'); // Mostra chat

    painelChat.innerHTML = `<div class="flex items-center justify-center h-full"><div class="loader border-blue-200 border-t-blue-600"></div></div>`;

    // Carrega dados do pedido
    const pedidoSnap = await getDoc(doc(db, "orders", orderId));
    if (!pedidoSnap.exists()) return carregarPedidosAtivos();

    const pedido = pedidoSnap.data();
    const isMeProvider = pedido.provider_id === auth.currentUser.uid;
    const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
    
    // --- GERAÇÃO/RECUPERAÇÃO DE TOKEN (SEGURANÇA) ---
    // Se não tiver token, cria um agora (fallback para pedidos antigos)
    let token = pedido.security_code;
    if (!token) {
        token = Math.floor(1000 + Math.random() * 9000).toString(); // Gera 4 dígitos
        await updateDoc(doc(db, "orders", orderId), { security_code: token });
    }

    // --- ÁREA DE SEGURANÇA (O DIFERENCIAL) ---
    let areaSeguranca = "";
    if (isMeProvider) {
        // VISÃO DO PRESTADOR: Campo para digitar
        areaSeguranca = `
            <div class="bg-slate-900 p-4 -mx-4 mb-4 shadow-inner">
                <p class="text-[10px] text-gray-400 uppercase font-bold mb-2 text-center">Finalizar Serviço</p>
                <div class="flex gap-2">
                    <input type="tel" id="input-token-final" placeholder="Peça o código ao cliente" maxlength="4" class="flex-1 bg-slate-800 text-white text-center text-lg font-bold tracking-widest rounded-lg border border-slate-700 focus:border-blue-500 outline-none p-2">
                    <button onclick="window.finalizarServicoComToken('${orderId}', '${token}')" class="bg-green-500 hover:bg-green-600 text-white font-bold px-4 rounded-lg text-xs uppercase shadow-lg">
                        CONCLUIR
                    </button>
                </div>
            </div>
        `;
    } else {
        // VISÃO DO CLIENTE: Mostra o código
        areaSeguranca = `
            <div class="bg-blue-600 p-4 -mx-4 mb-4 shadow-lg text-center">
                <p class="text-[10px] text-blue-100 uppercase font-bold mb-1">Seu Código de Segurança</p>
                <div class="text-4xl font-black text-white tracking-[0.5em] drop-shadow-md">${token}</div>
                <p class="text-[9px] text-blue-200 mt-1">Só informe ao prestador quando o serviço terminar.</p>
            </div>
        `;
    }

    // Renderiza Layout do Chat
    painelChat.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50">
            <div class="bg-white p-4 shadow-sm flex items-center gap-3 z-10">
                <button onclick="window.voltarParaListaPedidos()" class="text-gray-500 p-1">⬅</button>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-sm">${outroNome}</h3>
                    <p class="text-[10px] text-green-600 flex items-center gap-1"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Chat Ativo</p>
                </div>
                <a href="tel:${isMeProvider ? pedido.client_phone : pedido.provider_phone}" class="bg-gray-100 p-2 rounded-full text-gray-600">📞</a>
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3">
                ${areaSeguranca}
                <div class="text-center text-[9px] text-gray-400 my-4">--- Início da Conversa ---</div>
            </div>

            <div class="bg-white p-3 border-t border-gray-100 flex gap-2">
                <input type="text" id="chat-input-msg" placeholder="Digite sua mensagem..." class="flex-1 bg-gray-100 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                <button onclick="window.enviarMensagemChat('${orderId}')" class="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md">➤</button>
            </div>
        </div>
    `;

    // Escuta Mensagens
    const msgsQ = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(msgsQ, (snap) => {
        const divMsgs = document.getElementById('chat-messages');
        if(!divMsgs) return;
        
        // Limpa apenas as mensagens, mantendo o painel de segurança (que é o primeiro filho)
        // Truque: Removemos tudo que vem DEPOIS do painel de segurança
        while (divMsgs.children.length > 2) { 
             divMsgs.removeChild(divMsgs.lastChild); 
        }

        snap.forEach(d => {
            const msg = d.data();
            const souEu = msg.sender_id === auth.currentUser.uid;
            
            divMsgs.innerHTML += `
                <div class="flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                    <div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[80%] text-xs shadow-sm">
                        <p>${msg.text}</p>
                        <p class="text-[8px] ${souEu ? 'text-blue-200' : 'text-gray-400'} text-right mt-1 opacity-70">
                            ${msg.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '...'}
                        </p>
                    </div>
                </div>
            `;
        });
        
        // Auto scroll
        divMsgs.scrollTop = divMsgs.scrollHeight;
    });
}

// --- 3. ENVIAR MENSAGEM ---
export async function enviarMensagemChat(orderId) {
    const input = document.getElementById('chat-input-msg');
    const texto = input.value.trim();
    if(!texto) return;

    input.value = "";
    
    await addDoc(collection(db, `chats/${orderId}/messages`), {
        text: texto,
        sender_id: auth.currentUser.uid,
        timestamp: serverTimestamp()
    });
}

// --- 4. FINALIZAR SERVIÇO (TOKEN) ---
export async function finalizarServicoComToken(orderId, tokenCorreto) {
    const input = document.getElementById('input-token-final');
    const tokenDigitado = input.value.trim();

    if (tokenDigitado !== tokenCorreto) {
        input.classList.add('border-red-500', 'animate-shake');
        setTimeout(() => input.classList.remove('border-red-500', 'animate-shake'), 500);
        return alert("❌ Código incorreto! Peça o código de 4 números ao cliente.");
    }

    if (!confirm("Confirmar a conclusão do serviço? O valor será liberado.")) return;

    try {
        await updateDoc(doc(db, "orders", orderId), {
            status: 'completed',
            completed_at: serverTimestamp()
        });

        alert("✅ SERVIÇO CONCLUÍDO COM SUCESSO!\nParabéns pelo trabalho.");
        window.voltarParaListaPedidos();

    } catch (e) {
        alert("Erro: " + e.message);
    }
}
