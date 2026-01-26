import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS ---
// Tenta achar o botão de aba, se existir
const tabChat = document.getElementById('tab-chat');
if (tabChat) {
    tabChat.addEventListener('click', () => {
        carregarPedidosAtivos();
    });
}

// Expõe globalmente para o HTML poder chamar (Necessário pois é um módulo)
window.carregarChat = carregarPedidosAtivos;
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.finalizarServicoComToken = finalizarServicoComToken;
window.voltarParaListaPedidos = carregarPedidosAtivos;

// ============================================================================
// 1. LISTA DE PEDIDOS ATIVOS (DASHBOARD)
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('app-container'); // Injeta no container principal
    if (!container || !auth.currentUser) return;

    // Layout Base da Tela de Pedidos
    container.innerHTML = `
        <div id="painel-pedidos" class="p-4 pb-24 animate-fadeIn">
            <h2 class="text-xl font-black text-blue-900 mb-4 flex items-center gap-2">
                💬 Pedidos & Chat
            </h2>
            
            <div id="lista-pedidos-render" class="space-y-3">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>
                <p class="text-center text-xs text-gray-400 mt-2">Buscando serviços...</p>
            </div>
        </div>

        <div id="painel-chat-individual" class="hidden h-screen fixed inset-0 z-[60] bg-white">
            </div>
    `;

    const uid = auth.currentUser.uid;
    const listaRender = document.getElementById('lista-pedidos-render');

    // Mapeamento para evitar duplicatas na lista visual
    let pedidosMap = new Map(); 

    // Função para desenhar a lista na tela
    const renderizar = () => {
        listaRender.innerHTML = "";
        
        if (pedidosMap.size === 0) {
            listaRender.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-50">
                    <div class="text-6xl mb-4 grayscale">📭</div>
                    <p class="text-sm font-bold text-gray-600">Nenhum serviço ativo.</p>
                    <p class="text-xs text-gray-400 text-center max-w-[200px]">Seus pedidos em andamento aparecerão aqui.</p>
                </div>`;
            return;
        }

        // Ordena por data (opcional, aqui pega a ordem de chegada)
        pedidosMap.forEach((pedido) => {
            const isMeProvider = pedido.provider_id === uid;
            const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
            const statusColor = pedido.status === 'accepted' ? 'text-green-600' : 'text-gray-500';
            const statusTexto = pedido.status === 'accepted' ? 'Em Andamento' : 'Finalizado';

            // Card do Pedido
            listaRender.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                    
                    <div class="flex justify-between items-start pl-2">
                        <div>
                            <h3 class="font-bold text-gray-800 text-sm">${outroNome}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded">R$ ${pedido.offer_value}</span>
                                <span class="text-[10px] uppercase font-bold ${statusColor}">• ${statusTexto}</span>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                                📅 ${pedido.service_date || 'Data a combinar'} 
                                🕒 ${pedido.service_time || ''}
                            </p>
                        </div>
                        <div class="bg-blue-50 p-2.5 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                            💬
                        </div>
                    </div>
                    
                    ${!isMeProvider ? `<div class="mt-3 bg-yellow-50 text-yellow-700 text-[9px] font-bold px-2 py-1 rounded border border-yellow-100 inline-flex items-center gap-1">🔑 Você tem o código de segurança</div>` : ''}
                    ${isMeProvider ? `<div class="mt-3 bg-green-50 text-green-700 text-[9px] font-bold px-2 py-1 rounded border border-green-100 inline-flex items-center gap-1">🛠️ Serviço Aceito</div>` : ''}
                </div>
            `;
        });
    };

    // --- ESCUTAS EM TEMPO REAL (FIRESTORE) ---
    const pedidosRef = collection(db, "orders");
    
    // 1. Onde sou PRESTADOR e está aceito
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), where("status", "==", "accepted"));
    
    // 2. Onde sou CLIENTE e está aceito
    const qClient = query(pedidosRef, where("client_id", "==", uid), where("status", "==", "accepted"));

    onSnapshot(qProvider, (snap) => {
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() }));
        renderizar();
    });

    onSnapshot(qClient, (snap) => {
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() }));
        renderizar();
    });
}

// ============================================================================
// 2. TELA DE CHAT INDIVIDUAL (COM SEGURANÇA)
// ============================================================================
export async function abrirChatPedido(orderId) {
    const painelChat = document.getElementById('painel-chat-individual');
    const painelLista = document.getElementById('painel-pedidos');
    
    if(!painelChat) return;

    painelLista.classList.add('hidden'); // Esconde a lista
    painelChat.classList.remove('hidden'); // Mostra o chat full screen

    // Loading inicial
    painelChat.innerHTML = `<div class="flex items-center justify-center h-full bg-gray-50"><div class="loader border-blue-200 border-t-blue-600"></div></div>`;

    // Busca dados do pedido
    const pedidoSnap = await getDoc(doc(db, "orders", orderId));
    if (!pedidoSnap.exists()) return carregarPedidosAtivos();

    const pedido = pedidoSnap.data();
    const isMeProvider = pedido.provider_id === auth.currentUser.uid;
    const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
    const telefoneLink = isMeProvider ? pedido.client_phone : pedido.provider_phone;
    
    // --- SEGURANÇA: GARANTIR QUE O TOKEN EXISTA ---
    let token = pedido.security_code;
    if (!token) {
        // Se for um pedido antigo sem token, cria um agora
        token = Math.floor(1000 + Math.random() * 9000).toString(); 
        await updateDoc(doc(db, "orders", orderId), { security_code: token });
    }

    // --- BLOCO DE SEGURANÇA (O GRANDE DIFERENCIAL) ---
    let areaSeguranca = "";
    
    if (isMeProvider) {
        // PRESTADOR: Vê campo para digitar
        areaSeguranca = `
            <div class="bg-slate-800 p-4 -mx-4 mb-4 shadow-inner border-b border-slate-700">
                <div class="flex items-center justify-between mb-2">
                    <p class="text-[10px] text-gray-400 uppercase font-bold">Finalizar Serviço</p>
                    <span class="text-[9px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">Valor: R$ ${pedido.offer_value}</span>
                </div>
                <div class="flex gap-2">
                    <input type="tel" id="input-token-final" placeholder="Código do Cliente" maxlength="4" class="w-full bg-slate-900 text-white text-center text-lg font-bold tracking-[0.3em] rounded-lg border border-slate-600 focus:border-blue-500 outline-none p-3 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-slate-600 transition">
                    <button onclick="window.finalizarServicoComToken('${orderId}', '${token}')" class="bg-green-500 hover:bg-green-600 text-white font-bold px-4 rounded-lg text-xs uppercase shadow-lg active:scale-95 transition">
                        OK
                    </button>
                </div>
                <p class="text-[9px] text-slate-500 mt-2 text-center">Peça o código de 4 dígitos ao cliente após terminar o serviço.</p>
            </div>
        `;
    } else {
        // CLIENTE: Vê o número grande
        areaSeguranca = `
            <div class="bg-blue-600 p-6 -mx-4 mb-4 shadow-lg text-center relative overflow-hidden">
                <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                <p class="text-[10px] text-blue-100 uppercase font-bold mb-1 tracking-wider">Seu Código de Segurança</p>
                <div class="text-5xl font-black text-white tracking-[0.3em] drop-shadow-md my-2">${token}</div>
                <div class="bg-blue-700/50 inline-block px-3 py-1 rounded-full border border-blue-500/30">
                    <p class="text-[9px] text-blue-100">🔒 Só informe ao prestador quando o serviço acabar.</p>
                </div>
            </div>
        `;
    }

    // --- RENDERIZA O CHAT COMPLETO ---
    painelChat.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50">
            <div class="bg-white p-3 shadow-sm flex items-center gap-3 z-20 border-b border-gray-100">
                <button onclick="window.voltarParaListaPedidos()" class="text-gray-500 p-2 hover:bg-gray-100 rounded-full transition">⬅</button>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-sm line-clamp-1">${outroNome}</h3>
                    <p class="text-[10px] text-green-600 flex items-center gap-1 font-bold">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online agora
                    </p>
                </div>
                ${telefoneLink ? `<a href="tel:${telefoneLink}" class="bg-green-100 text-green-700 p-2 rounded-full hover:bg-green-200 transition">📞</a>` : ''}
                ${isMeProvider ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.location)}" target="_blank" class="bg-blue-100 text-blue-700 p-2 rounded-full hover:bg-blue-200 transition">📍</a>` : ''}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scroll-smooth">
                ${areaSeguranca}
                
                <div class="flex justify-center my-4">
                    <span class="text-[9px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Início da conversa</span>
                </div>
            </div>

            <div class="bg-white p-3 border-t border-gray-200 flex gap-2 items-center pb-safe">
                <input type="text" id="chat-input-msg" placeholder="Digite sua mensagem..." class="flex-1 bg-gray-100 text-gray-800 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-inner">
                <button onclick="window.enviarMensagemChat('${orderId}')" class="bg-blue-600 hover:bg-blue-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transform active:scale-90 transition">
                    ➤
                </button>
            </div>
        </div>
    `;

    // --- ESCUTA MENSAGENS EM TEMPO REAL ---
    const msgsQ = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    
    onSnapshot(msgsQ, (snap) => {
        const divMsgs = document.getElementById('chat-messages');
        if(!divMsgs) return;
        
        // Remove mensagens antigas para não duplicar, mas MANTÉM o painel de segurança (que é o primeiro filho)
        // Lógica: Se tem mais de 2 filhos (Segurança + Aviso de Início), remove os extras
        let mensagensExistentes = divMsgs.querySelectorAll('.msg-bubble-container');
        mensagensExistentes.forEach(el => el.remove());

        snap.forEach(d => {
            const msg = d.data();
            const souEu = msg.sender_id === auth.currentUser.uid;
            
            // Cria elemento HTML da mensagem
            const msgHtml = `
                <div class="msg-bubble-container flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                    <div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'} px-4 py-2.5 rounded-2xl max-w-[80%] text-sm shadow-sm relative group">
                        <p>${msg.text}</p>
                        <p class="text-[9px] ${souEu ? 'text-blue-200' : 'text-gray-400'} text-right mt-1 opacity-70">
                            ${msg.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '...'}
                        </p>
                    </div>
                </div>
            `;
            
            divMsgs.insertAdjacentHTML('beforeend', msgHtml);
        });
        
        // Rola para baixo suavemente
        setTimeout(() => {
            divMsgs.scrollTop = divMsgs.scrollHeight;
        }, 100);
    });

    // Enter para enviar
    const inputMsg = document.getElementById('chat-input-msg');
    if(inputMsg) {
        inputMsg.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.enviarMensagemChat(orderId);
        });
        // Foca no input ao abrir (se não for mobile para não abrir teclado na cara)
        if(window.innerWidth > 768) inputMsg.focus();
    }
}

// ============================================================================
// 3. ENVIAR MENSAGEM
// ============================================================================
export async function enviarMensagemChat(orderId) {
    const input = document.getElementById('chat-input-msg');
    const texto = input.value.trim();
    if(!texto) return;

    input.value = "";
    input.focus();
    
    try {
        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: texto,
            sender_id: auth.currentUser.uid,
            timestamp: serverTimestamp()
        });
    } catch(e) {
        console.error("Erro chat:", e);
        alert("Erro ao enviar. Verifique sua conexão.");
    }
}

// ============================================================================
// 4. FINALIZAR SERVIÇO (VALIDAÇÃO DE TOKEN)
// ============================================================================
export async function finalizarServicoComToken(orderId, tokenCorreto) {
    const input = document.getElementById('input-token-final');
    const tokenDigitado = input.value.trim();

    // Feedback visual de erro
    if (tokenDigitado !== tokenCorreto) {
        input.classList.add('border-red-500', 'bg-red-50', 'text-red-900');
        input.classList.add('animate-shake'); // Classe de animação se tiver no CSS, senão só cor
        setTimeout(() => {
            input.classList.remove('border-red-500', 'bg-red-50', 'text-red-900', 'animate-shake');
        }, 500);
        return alert("❌ Código Incorreto!\n\nPeça o código de 4 números que aparece na tela do cliente.");
    }

    if (!confirm("O cliente confirmou o fim do serviço?\n\nAo clicar em OK, o serviço será encerrado.")) return;

    try {
        // Atualiza status do pedido
        await updateDoc(doc(db, "orders", orderId), {
            status: 'completed',
            completed_at: serverTimestamp()
        });

        // Feedback de Sucesso
        alert("✅ SERVIÇO CONCLUÍDO!\n\nParabéns! O serviço foi registrado no seu histórico.");
        window.voltarParaListaPedidos();

    } catch (e) {
        alert("Erro ao finalizar: " + e.message);
    }
}
