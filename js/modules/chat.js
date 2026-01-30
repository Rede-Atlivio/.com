import { db, auth } from '../app.js';
import { processarCobrancaTaxa } from '../wallet.js'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO ---
const tabChat = document.getElementById('tab-chat');
if (tabChat) {
    tabChat.addEventListener('click', () => {
        carregarPedidosAtivos();
    });
}

// FUNÇÃO GLOBAL DE REDIRECIONAMENTO
window.irParaChat = () => {
    const tab = document.getElementById('tab-chat');
    if(tab) tab.click();
    carregarPedidosAtivos();
    window.scrollTo(0,0);
};

// Expõe globalmente
window.carregarChat = carregarPedidosAtivos;
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.iniciarServico = iniciarServico;
window.finalizarServicoComToken = finalizarServicoComToken;
window.voltarParaListaPedidos = carregarPedidosAtivos;
window.voltarAoInicio = () => location.reload();

// ============================================================================
// 1. LISTA DE PEDIDOS ATIVOS (ABA CHAT)
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('sec-chat'); // Renderiza DENTRO da section
    if (!container || !auth.currentUser) return;

    // Limpa e prepara a área
    container.innerHTML = `
        <div id="painel-pedidos" class="pb-24 animate-fadeIn">
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex justify-between items-center">
                <div>
                    <h2 class="text-lg font-black text-blue-900">💬 Conversas</h2>
                    <p class="text-[10px] text-gray-500">Negociações e Suporte</p>
                </div>
            </div>
            
            <div id="lista-pedidos-render" class="space-y-3">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>
                <p class="text-center text-xs text-gray-400 mt-2">Sincronizando...</p>
            </div>
        </div>
        
        <div id="painel-chat-individual" class="hidden fixed inset-0 z-[60] bg-white flex flex-col h-full w-full"></div>
    `;

    const uid = auth.currentUser.uid;
    const listaRender = document.getElementById('lista-pedidos-render');
    let pedidosMap = new Map(); 

    const renderizar = () => {
        listaRender.innerHTML = "";
        if (pedidosMap.size === 0) {
            listaRender.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-50">
                    <div class="text-4xl mb-2 grayscale">📂</div>
                    <p class="text-xs text-gray-400">Nenhuma conversa ativa.</p>
                </div>`;
            return;
        }

        pedidosMap.forEach((pedido) => {
            const isMeProvider = pedido.provider_id === uid;
            const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
            
            let statusLabel = "Ativo";
            if(pedido.status === 'pending') statusLabel = "Pendente";
            if(pedido.status === 'completed') statusLabel = "Finalizado";

            listaRender.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-3">
                    <div class="bg-gray-100 h-10 w-10 rounded-full flex items-center justify-center text-lg">👤</div>
                    <div class="flex-1">
                        <div class="flex justify-between">
                            <h3 class="font-bold text-gray-800 text-xs">${outroNome}</h3>
                            <span class="text-[9px] text-gray-400">${statusLabel}</span>
                        </div>
                        <p class="text-[10px] text-gray-500 truncate">Toque para abrir a conversa...</p>
                    </div>
                </div>
            `;
        });
    };

    const pedidosRef = collection(db, "orders");
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), orderBy("created_at", "desc"), limit(20));
    const qClient = query(pedidosRef, where("client_id", "==", uid), orderBy("created_at", "desc"), limit(20));

    onSnapshot(qProvider, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
    onSnapshot(qClient, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
}

// ============================================================================
// 2. TELA DE CHAT (COM CORREÇÃO DE REDIRECIONAMENTO)
// ============================================================================
export async function abrirChatPedido(orderId) {
    let painelChat = document.getElementById('painel-chat-individual');
    
    // 🚨 CORREÇÃO CRÍTICA: SE O PAINEL NÃO EXISTE, VAI PRA ABA CHAT PRIMEIRO
    if (!painelChat) {
        console.log("🔄 Redirecionando para aba Chat para renderizar estrutura...");
        const tabChat = document.getElementById('tab-chat');
        if(tabChat) {
            tabChat.click(); // Força a ida para a aba
            // SwitchTab do index.html esconde as outras sections e mostra sec-chat
        }
        
        // Aguarda 100ms para o HTML ser injetado pelo carregarPedidosAtivos
        await new Promise(r => setTimeout(r, 100));
        painelChat = document.getElementById('painel-chat-individual');
        
        if(!painelChat) {
            // Fallback de segurança: Se ainda não existe, tenta carregar na força
            await carregarPedidosAtivos();
            painelChat = document.getElementById('painel-chat-individual');
        }
    }

    if(!painelChat) return alert("Erro ao carregar chat. Tente novamente.");

    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.add('hidden');
    
    painelChat.classList.remove('hidden');
    painelChat.innerHTML = `<div class="flex items-center justify-center h-full bg-gray-50"><div class="loader border-blue-200 border-t-blue-600"></div></div>`;

    const pedidoSnap = await getDoc(doc(db, "orders", orderId));
    if (!pedidoSnap.exists()) {
        alert("Pedido não encontrado.");
        return painelChat.classList.add('hidden');
    }

    const pedido = pedidoSnap.data();
    const isMeProvider = pedido.provider_id === auth.currentUser.uid;
    const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
    const telefoneLink = isMeProvider ? pedido.client_phone : pedido.provider_phone;
    
    let token = pedido.security_code;
    if (!token) {
        token = Math.floor(1000 + Math.random() * 9000).toString(); 
        await updateDoc(doc(db, "orders", orderId), { security_code: token });
    }

    let areaControle = gerarAreaControle(pedido, isMeProvider, token, orderId);

    painelChat.innerHTML = `
        <div class="flex flex-col h-full bg-gray-50">
            <div class="bg-white p-3 shadow-sm flex items-center gap-3 z-20 border-b border-gray-100">
                <button onclick="window.voltarParaListaPedidos()" class="text-gray-500 p-2 hover:bg-gray-100 rounded-full transition">⬅ Voltar</button>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-sm line-clamp-1">${outroNome}</h3>
                    <p class="text-[10px] text-green-600 flex items-center gap-1 font-bold">R$ ${pedido.offer_value}</p>
                </div>
                <a href="tel:${telefoneLink}" class="bg-green-100 text-green-700 p-2 rounded-full">📞</a>
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scroll-smooth pb-20">
                ${areaControle}
                <div class="flex justify-center my-4"><span class="text-[9px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Início da conversa</span></div>
            </div>

            ${pedido.status !== 'completed' ? `
            <div class="bg-white p-3 border-t border-gray-200 flex gap-2 items-center fixed bottom-0 w-full max-w-2xl">
                <input type="text" id="chat-input-msg" placeholder="Digite uma mensagem..." class="flex-1 bg-gray-100 text-gray-800 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button onclick="window.enviarMensagemChat('${orderId}')" class="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg">➤</button>
            </div>` : ''}
        </div>
    `;

    // Listener de Mensagens
    const msgsQ = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(msgsQ, (snap) => {
        const divMsgs = document.getElementById('chat-messages');
        if(!divMsgs) return;
        
        // Remove bubbles antigas para não duplicar (estratégia simples)
        // Idealmente usaria docChanges, mas para MVP isso funciona
        const existingBubbles = divMsgs.querySelectorAll('.msg-bubble-container');
        // Mantém área de controle e avisa, remove só mensagens se for refresh total
        // Aqui vamos apendar apenas novas se a lógica for aprimorada, mas por hora overwrite simples:
        
        snap.docChanges().forEach((change) => {
            if(change.type === "added") {
                const msg = change.doc.data();
                const souEu = msg.sender_id === auth.currentUser.uid;
                divMsgs.insertAdjacentHTML('beforeend', `
                    <div class="msg-bubble-container flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                        <div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'} px-4 py-2.5 rounded-2xl max-w-[80%] text-sm shadow-sm">
                            <p>${msg.text}</p>
                            <p class="text-[8px] opacity-70 text-right mt-1">${msg.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '...'}</p>
                        </div>
                    </div>
                `);
            }
        });
        setTimeout(() => { divMsgs.scrollTop = divMsgs.scrollHeight; }, 100);
    });
}

// Helper para gerar HTML de controle
function gerarAreaControle(pedido, isMeProvider, token, orderId) {
    if (pedido.status === 'completed') {
        return `<div class="bg-green-100 p-4 rounded-xl text-center text-green-800 border border-green-200 mb-4"><p class="font-bold">✅ Serviço Finalizado</p></div>`;
    }

    if (isMeProvider) {
        if (pedido.status === 'accepted') {
            return `
                <div class="bg-slate-800 p-4 rounded-xl mb-4 text-center border-b-4 border-slate-900 shadow-lg">
                    <p class="text-white font-bold mb-2">🚗 Chegou ao local?</p>
                    <button onclick="window.iniciarServico('${orderId}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-lg uppercase shadow text-xs">▶️ INICIAR SERVIÇO</button>
                </div>`;
        } 
        if (pedido.status === 'in_progress') {
            return `
                <div class="bg-slate-900 p-4 rounded-xl mb-4 border border-slate-700">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Finalizar e Receber</p>
                    <div class="flex gap-2">
                        <input type="tel" id="input-token-final" placeholder="Código do Cliente" class="w-full bg-slate-800 text-white text-center font-bold tracking-widest rounded-lg border border-slate-600 p-2">
                        <button onclick="window.finalizarServicoComToken('${orderId}', '${token}', ${pedido.offer_value})" class="bg-green-600 text-white font-bold px-4 rounded-lg text-xs">VALIDAR</button>
                    </div>
                </div>`;
        }
    } else {
        if (pedido.status === 'in_progress') {
            return `
                <div class="bg-blue-600 p-6 rounded-xl mb-4 text-center shadow-lg">
                    <p class="text-[10px] text-blue-100 uppercase font-bold tracking-wider">Código de Segurança</p>
                    <div class="text-4xl font-black text-white tracking-[0.2em] my-2">${token}</div>
                    <p class="text-[10px] text-white/80">Entregue ao prestador ao final.</p>
                </div>`;
        }
    }
    return "";
}

// ============================================================================
// 3. AÇÕES
// ============================================================================
export async function iniciarServico(orderId) {
    if(!confirm("Iniciar contagem do serviço?")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { status: 'in_progress', started_at: serverTimestamp() });
        // Recarrega o chat para atualizar a UI
        window.abrirChatPedido(orderId);
    } catch(e) { alert("Erro: " + e.message); }
}

export async function finalizarServicoComToken(orderId, tokenCorreto, valorServico) {
    const input = document.getElementById('input-token-final');
    if (input.value.trim() !== tokenCorreto) return alert("❌ Código incorreto!");

    if (!confirm(`Finalizar e pagar taxa?`)) return;

    try {
        await processarCobrancaTaxa(orderId, valorServico);
        await updateDoc(doc(db, "orders", orderId), { status: 'completed', completed_at: serverTimestamp() });
        alert("✅ Serviço Finalizado!");
        window.voltarParaListaPedidos();
    } catch (e) { console.error(e); }
}

export async function enviarMensagemChat(orderId) {
    const input = document.getElementById('chat-input-msg');
    const texto = input.value.trim();
    if(!texto) return;
    input.value = "";
    await addDoc(collection(db, `chats/${orderId}/messages`), { text: texto, sender_id: auth.currentUser.uid, timestamp: serverTimestamp() });  
}
