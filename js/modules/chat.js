import { db, auth } from '../app.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const TAXA_PLATAFORMA = 0.20; // 20%

// --- GATILHOS ---
const tabChat = document.getElementById('tab-chat');
if (tabChat) {
    tabChat.addEventListener('click', () => {
        carregarPedidosAtivos();
    });
}

// Expõe globalmente
window.carregarChat = carregarPedidosAtivos;
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.iniciarServico = iniciarServico; // NOVA FUNÇÃO
window.finalizarServicoComToken = finalizarServicoComToken;
window.voltarParaListaPedidos = carregarPedidosAtivos;

// ============================================================================
// 1. LISTA DE PEDIDOS ATIVOS
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('app-container');
    if (!container || !auth.currentUser) return;

    container.innerHTML = `
        <div id="painel-pedidos" class="p-4 pb-24 animate-fadeIn">
            <h2 class="text-xl font-black text-blue-900 mb-4 flex items-center gap-2">💬 Pedidos & Chat</h2>
            <div id="lista-pedidos-render" class="space-y-3">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>
                <p class="text-center text-xs text-gray-400 mt-2">Buscando serviços...</p>
            </div>
        </div>
        <div id="painel-chat-individual" class="hidden h-screen fixed inset-0 z-[60] bg-white"></div>
    `;

    const uid = auth.currentUser.uid;
    const listaRender = document.getElementById('lista-pedidos-render');
    let pedidosMap = new Map(); 

    const renderizar = () => {
        listaRender.innerHTML = "";
        if (pedidosMap.size === 0) {
            listaRender.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-50">
                    <div class="text-6xl mb-4 grayscale">📭</div>
                    <p class="text-sm font-bold text-gray-600">Nenhum serviço ativo.</p>
                </div>`;
            return;
        }

        pedidosMap.forEach((pedido) => {
            const isMeProvider = pedido.provider_id === uid;
            const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
            
            // Lógica de Status Visual
            let statusTexto = "Aguardando";
            let statusCor = "text-gray-500 bg-gray-100";
            
            if(pedido.status === 'accepted') { statusTexto = "⏳ Pendente Início"; statusCor = "text-orange-600 bg-orange-100"; }
            if(pedido.status === 'in_progress') { statusTexto = "▶️ Em Andamento"; statusCor = "text-blue-600 bg-blue-100"; }
            if(pedido.status === 'completed') { statusTexto = "✅ Finalizado"; statusCor = "text-green-600 bg-green-100"; }

            listaRender.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${pedido.status === 'in_progress' ? 'bg-blue-600' : 'bg-gray-300'}"></div>
                    <div class="flex justify-between items-start pl-2">
                        <div>
                            <h3 class="font-bold text-gray-800 text-sm">${outroNome}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded">R$ ${pedido.offer_value}</span>
                                <span class="text-[9px] uppercase font-bold ${statusCor} px-2 py-0.5 rounded">${statusTexto}</span>
                            </div>
                        </div>
                        <div class="bg-blue-50 p-2.5 rounded-full text-blue-600">💬</div>
                    </div>
                </div>
            `;
        });
    };

    const pedidosRef = collection(db, "orders");
    // Busca aceitos E em andamento
    const statuses = ["accepted", "in_progress"];
    
    // Obs: Firestore "in" query limita a 10, mas serve para nós
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), where("status", "in", statuses));
    const qClient = query(pedidosRef, where("client_id", "==", uid), where("status", "in", statuses));

    onSnapshot(qProvider, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
    onSnapshot(qClient, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
}

// ============================================================================
// 2. TELA DE CHAT (LÓGICA FINANCEIRA VISUAL)
// ============================================================================
export async function abrirChatPedido(orderId) {
    const painelChat = document.getElementById('painel-chat-individual');
    const painelLista = document.getElementById('painel-pedidos');
    if(!painelChat) return;

    painelLista.classList.add('hidden');
    painelChat.classList.remove('hidden');
    painelChat.innerHTML = `<div class="flex items-center justify-center h-full bg-gray-50"><div class="loader border-blue-200 border-t-blue-600"></div></div>`;

    const pedidoSnap = await getDoc(doc(db, "orders", orderId));
    if (!pedidoSnap.exists()) return carregarPedidosAtivos();

    const pedido = pedidoSnap.data();
    const isMeProvider = pedido.provider_id === auth.currentUser.uid;
    const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
    const telefoneLink = isMeProvider ? pedido.client_phone : pedido.provider_phone;
    
    // Token Logic
    let token = pedido.security_code;
    if (!token) {
        token = Math.floor(1000 + Math.random() * 9000).toString(); 
        await updateDoc(doc(db, "orders", orderId), { security_code: token });
    }

    // --- BLOCO DE CONTROLE (A MÁGICA DOS BOTÕES) ---
    let areaControle = "";
    
    if (isMeProvider) {
        // --- VISÃO DO PRESTADOR ---
        if (pedido.status === 'accepted') {
            // ESTADO 1: ACEITOU, MAS NÃO COMEÇOU
            // Botão para INICIAR SERVIÇO (Sem cobrar ainda)
            areaControle = `
                <div class="bg-slate-800 p-6 -mx-4 mb-4 shadow-inner text-center">
                    <p class="text-white font-bold mb-2">Você chegou ao local?</p>
                    <button onclick="window.iniciarServico('${orderId}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase shadow-lg text-sm animate-pulse">
                        ▶️ INICIAR SERVIÇO
                    </button>
                    <p class="text-[10px] text-gray-400 mt-2">Clique apenas quando estiver pronto para trabalhar.</p>
                </div>
            `;
        } else if (pedido.status === 'in_progress') {
            // ESTADO 2: TRABALHANDO
            // Campo para DIGITAR O TOKEN (Cobra ao finalizar)
            areaControle = `
                <div class="bg-slate-900 p-4 -mx-4 mb-4 shadow-inner border-b border-slate-700">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-[10px] text-gray-400 uppercase font-bold">Finalizar e Receber</p>
                        <span class="text-[9px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded">A Receber: R$ ${pedido.offer_value}</span>
                    </div>
                    <div class="flex gap-2">
                        <input type="tel" id="input-token-final" placeholder="Código do Cliente" maxlength="4" class="w-full bg-slate-800 text-white text-center text-lg font-bold tracking-[0.3em] rounded-lg border border-slate-600 focus:border-blue-500 outline-none p-3">
                        <button onclick="window.finalizarServicoComToken('${orderId}', '${token}', ${pedido.offer_value})" class="bg-green-600 hover:bg-green-500 text-white font-bold px-4 rounded-lg text-xs uppercase shadow-lg">
                            CONCLUIR
                        </button>
                    </div>
                    <p class="text-[9px] text-slate-500 mt-2 text-center">Taxa de ${(TAXA_PLATAFORMA*100)}% será descontada do seu saldo agora.</p>
                </div>
            `;
        }
    } else {
        // --- VISÃO DO CLIENTE ---
        if (pedido.status === 'accepted') {
            areaControle = `
                <div class="bg-orange-500 p-4 -mx-4 mb-4 text-center text-white shadow-lg">
                    <p class="font-bold text-sm">O prestador está a caminho.</p>
                    <p class="text-[10px] opacity-80">O código aparecerá quando o serviço iniciar.</p>
                </div>
            `;
        } else if (pedido.status === 'in_progress') {
            areaControle = `
                <div class="bg-blue-600 p-6 -mx-4 mb-4 shadow-lg text-center relative overflow-hidden">
                    <p class="text-[10px] text-blue-100 uppercase font-bold mb-1 tracking-wider">Seu Código de Segurança</p>
                    <div class="text-5xl font-black text-white tracking-[0.3em] drop-shadow-md my-2">${token}</div>
                    <p class="text-[9px] text-blue-100 bg-blue-700/50 inline-block px-3 py-1 rounded-full">Entregue ao prestador para finalizar.</p>
                </div>
            `;
        }
    }

    painelChat.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50">
            <div class="bg-white p-3 shadow-sm flex items-center gap-3 z-20 border-b border-gray-100">
                <button onclick="window.voltarParaListaPedidos()" class="text-gray-500 p-2">⬅</button>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-sm line-clamp-1">${outroNome}</h3>
                    <p class="text-[10px] text-green-600 flex items-center gap-1 font-bold">Chat Ativo</p>
                </div>
                ${isMeProvider ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.location)}" target="_blank" class="bg-blue-100 text-blue-700 p-2 rounded-full">📍</a>` : ''}
                <a href="tel:${telefoneLink}" class="bg-green-100 text-green-700 p-2 rounded-full">📞</a>
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scroll-smooth">
                ${areaControle}
                <div class="flex justify-center my-4"><span class="text-[9px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Início da conversa</span></div>
            </div>

            <div class="bg-white p-3 border-t border-gray-200 flex gap-2 items-center pb-safe">
                <input type="text" id="chat-input-msg" placeholder="Mensagem..." class="flex-1 bg-gray-100 text-gray-800 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button onclick="window.enviarMensagemChat('${orderId}')" class="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg">➤</button>
            </div>
        </div>
    `;

    // Escuta Mensagens
    const msgsQ = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(msgsQ, (snap) => {
        const divMsgs = document.getElementById('chat-messages');
        if(!divMsgs) return;
        // Limpa mensagens antigas (mantendo o painel de controle)
        let bubbles = divMsgs.querySelectorAll('.msg-bubble-container');
        bubbles.forEach(el => el.remove());

        snap.forEach(d => {
            const msg = d.data();
            const souEu = msg.sender_id === auth.currentUser.uid;
            divMsgs.insertAdjacentHTML('beforeend', `
                <div class="msg-bubble-container flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                    <div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'} px-4 py-2.5 rounded-2xl max-w-[80%] text-sm shadow-sm">
                        <p>${msg.text}</p>
                        <p class="text-[8px] opacity-70 text-right mt-1">${msg.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '...'}</p>
                    </div>
                </div>
            `);
        });
        setTimeout(() => { divMsgs.scrollTop = divMsgs.scrollHeight; }, 100);
    });
}

// ============================================================================
// 3. AÇÕES DO PRESTADOR (INICIAR E FINALIZAR)
// ============================================================================

// NOVA: Muda status para 'in_progress'
export async function iniciarServico(orderId) {
    if(!confirm("Confirmar que você INICIOU o serviço?\nIsso liberará o código de segurança para o cliente.")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'in_progress',
            started_at: serverTimestamp()
        });
        // Recarrega o chat para mudar o painel visual
        window.abrirChatPedido(orderId);
    } catch(e) { alert("Erro: " + e.message); }
}

// ATUALIZADA: Cobra a taxa aqui!
export async function finalizarServicoComToken(orderId, tokenCorreto, valorServico) {
    const input = document.getElementById('input-token-final');
    const tokenDigitado = input.value.trim();

    if (tokenDigitado !== tokenCorreto) {
        input.classList.add('border-red-500', 'bg-red-50');
        setTimeout(() => input.classList.remove('border-red-500', 'bg-red-50'), 500);
        return alert("❌ Código incorreto!");
    }

    if (!confirm(`Confirmar finalização?\n\nA taxa de serviço será descontada do seu saldo agora.`)) return;

    try {
        const uid = auth.currentUser.uid;
        const userRef = doc(db, "usuarios", uid);
        const taxa = valorServico * TAXA_PLATAFORMA;

        // 1. Busca Saldo Atual
        const userSnap = await getDoc(userRef);
        const saldoAtual = userSnap.data().wallet_balance || 0;
        const novoSaldo = saldoAtual - taxa;

        // 2. Atualiza Saldo e Pedido (Idealmente seria transaction, mas aqui é MVP)
        await updateDoc(userRef, { wallet_balance: novoSaldo });
        
        await updateDoc(doc(db, "orders", orderId), {
            status: 'completed',
            completed_at: serverTimestamp()
        });

        alert(`✅ SERVIÇO CONCLUÍDO!\n\nTaxa descontada: R$ ${taxa.toFixed(2)}\nNovo Saldo: R$ ${novoSaldo.toFixed(2)}`);
        window.voltarParaListaPedidos();

    } catch (e) {
        alert("Erro ao processar pagamento: " + e.message);
    }
}

// Mantém envio de mensagem simples
export async function enviarMensagemChat(orderId) {
    const input = document.getElementById('chat-input-msg');
    const texto = input.value.trim();
    if(!texto) return;
    input.value = "";
    await addDoc(collection(db, `chats/${orderId}/messages`), { text: texto, sender_id: auth.currentUser.uid, timestamp: serverTimestamp() });
}
