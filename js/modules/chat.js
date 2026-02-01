import { db, auth } from '../app.js';
import { processarCobrancaTaxa } from './wallet.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO ---
window.irParaChat = () => {
    const tab = document.getElementById('tab-chat');
    if(tab) tab.click();
    carregarPedidosAtivos();
    window.scrollTo(0,0);
};

window.carregarChat = carregarPedidosAtivos;
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.confirmarAcordo = confirmarAcordo;
window.voltarParaListaPedidos = () => {
    document.getElementById('painel-chat-individual')?.classList.add('hidden');
    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.remove('hidden');
};

// ============================================================================
// 1. LISTA DE PEDIDOS ATIVOS
// ============================================================================
export async function carregarPedidosAtivos() {
    const container = document.getElementById('sec-chat');
    if (!container || !auth.currentUser) return;

    container.innerHTML = `
        <div id="painel-pedidos" class="pb-24 animate-fadeIn">
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <h2 class="text-lg font-black text-blue-900">💬 Negociações em Curso</h2>
                <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Intermediação Ativa ATLIVIO</p>
            </div>
            <div id="lista-pedidos-render" class="space-y-3">
                <div class="loader mx-auto border-blue-200 border-t-blue-600 mt-10"></div>
            </div>
        </div>
    `;

    const uid = auth.currentUser.uid;
    const listaRender = document.getElementById('lista-pedidos-render');
    let pedidosMap = new Map(); 

    const renderizar = () => {
        listaRender.innerHTML = "";
        if (pedidosMap.size === 0) {
            listaRender.innerHTML = `<p class="text-center text-xs text-gray-400 py-10">Nenhuma negociação ativa.</p>`;
            return;
        }

        pedidosMap.forEach((pedido) => {
            const isMeProvider = pedido.provider_id === uid;
            const outroNome = isMeProvider ? pedido.client_name : pedido.provider_name || "Prestador";
            const step = pedido.system_step || 1;
            
            let statusBadge = `<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Etapa ${step}: Acordo</span>`;
            if(step >= 3) statusBadge = `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Etapa 3: Confirmado</span>`;
            if(pedido.status === 'completed') statusBadge = `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Finalizado</span>`;

            listaRender.innerHTML += `
                <div onclick="window.abrirChatPedido('${pedido.id}')" class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 active:scale-95 transition">
                    <div class="bg-slate-100 h-12 w-12 rounded-full flex items-center justify-center text-xl">👤</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-gray-800 text-sm">${outroNome}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1">Serviço de ${pedido.service_category || 'Geral'}</p>
                    </div>
                </div>`;
        });
    };

    const pedidosRef = collection(db, "orders");
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), orderBy("created_at", "desc"), limit(10));
    const qClient = query(pedidosRef, where("client_id", "==", uid), orderBy("created_at", "desc"), limit(10));

    onSnapshot(qProvider, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
    onSnapshot(qClient, (snap) => { snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); renderizar(); });
}

// ============================================================================
// 2. TELA DE CHAT INTERMEDIADA
// ============================================================================
export async function abrirChatPedido(orderId) {
    let painelChat = document.getElementById('painel-chat-individual');
    if (!painelChat || painelChat.parentElement !== document.body) {
        if(painelChat) painelChat.remove();
        painelChat = document.createElement('div');
        painelChat.id = 'painel-chat-individual';
        painelChat.className = "fixed inset-0 z-[9999] bg-white flex flex-col h-full w-full hidden";
        document.body.appendChild(painelChat);
    }

    document.getElementById('painel-pedidos')?.classList.add('hidden');
    painelChat.classList.remove('hidden');
    painelChat.innerHTML = `<div class="flex items-center justify-center h-full"><div class="loader border-blue-600"></div></div>`;

    const pedidoRef = doc(db, "orders", orderId);
    
    onSnapshot(pedidoRef, (snap) => {
        if (!snap.exists()) return;
        const pedido = snap.data();
        const uid = auth.currentUser.uid;
        const isProvider = pedido.provider_id === uid;
        const step = pedido.system_step || 1;

        renderizarEstruturaChat(painelChat, pedido, isProvider, orderId, step);
    });
}

function renderizarEstruturaChat(container, pedido, isProvider, orderId, step) {
    const outroNome = isProvider ? pedido.client_name : pedido.provider_name;
    const contatoLiberado = step >= 3;

    container.innerHTML = `
        <div class="flex flex-col h-full bg-slate-50">
            <div class="bg-white p-3 shadow-sm flex items-center gap-3 z-30 border-b">
                <button onclick="window.voltarParaListaPedidos()" class="text-gray-400 p-2">⬅</button>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-xs">${outroNome}</h3>
                    <p class="text-[9px] font-black text-blue-600">ACORDO: R$ ${pedido.offer_value}</p>
                </div>
                ${contatoLiberado ? `<a href="tel:${isProvider ? pedido.client_phone : pedido.provider_phone}" class="bg-green-500 text-white p-2 rounded-full text-xs">📞</a>` : 
                `<div class="bg-gray-100 text-gray-400 p-2 rounded-full text-[8px] font-bold">🔒 PRIVADO</div>`}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                <div id="bubbles-area"></div>
            </div>

            ${pedido.status !== 'completed' ? `
            <div class="bg-white p-3 border-t fixed bottom-0 w-full max-w-2xl flex gap-2 items-center">
                <input type="text" id="chat-input-msg" placeholder="${step < 3 ? '🔒 Combine valor e detalhes aqui...' : 'Digite sua mensagem...'}" 
                    class="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none">
                <button onclick="window.enviarMensagemChat('${orderId}', ${step})" class="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg">➤</button>
            </div>` : ''}
        </div>
    `;

    escutarMensagens(orderId);
}

function gerarBannerEtapa(step, isProvider, pedido, orderId) {
    if (step === 1 || step === 2) {
        const jaConfirmei = isProvider ? pedido.provider_confirmed : pedido.client_confirmed;
        if (jaConfirmei) {
            return `<div class="bg-blue-600 p-4 rounded-2xl text-white text-center animate-pulse mb-4">
                <p class="text-xs font-bold italic">Aguardando confirmação da outra parte...</p>
                <p class="text-[9px] opacity-80 mt-1">O contato será liberado após o aceite mútuo.</p>
            </div>`;
        }
        return `<div class="bg-slate-900 p-5 rounded-2xl text-white shadow-2xl mb-4 border-b-4 border-blue-600">
            <p class="text-xs font-bold mb-3 text-center">🤝 Confirmar este acordo?</p>
            <div class="flex gap-2">
                <button onclick="window.confirmarAcordo('${orderId}', true)" class="flex-1 bg-blue-600 py-3 rounded-xl text-[10px] font-black uppercase">✅ ACEITAR</button>
                <button onclick="window.confirmarAcordo('${orderId}', false)" class="bg-slate-700 px-4 rounded-xl text-[10px]">❌</button>
            </div>
            <p class="text-[8px] text-gray-400 mt-3 text-center uppercase tracking-tighter text-balance">R$ 20,00 de crédito serão reservados como garantia.</p>
        </div>`;
    }
    if (step === 3) {
        return `<div class="bg-green-600 p-4 rounded-2xl text-white text-center mb-4 shadow-lg">
            <p class="text-xs font-black italic">✨ ACORDO FECHADO! ✨</p>
            <p class="text-[9px] mt-1">Contato liberado no ícone acima.</p>
        </div>`;
    }
    return "";
}

// ============================================================================
// 3. AÇÕES DE INTERMEDIAÇÃO E FILTRO (PADRÃO 99)
// ============================================================================
export async function confirmarAcordo(orderId, aceitar) {
    if(!aceitar) return alert("Negociação continua. Use o chat.");
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    const pedido = orderSnap.data();

    const updates = uid === pedido.provider_id ? { provider_confirmed: true } : { client_confirmed: true };

    try {
        await updateDoc(orderRef, updates);
        const updatedSnap = await getDoc(orderRef);
        const p = updatedSnap.data();
        
        if (p.client_confirmed && p.provider_confirmed) {
            await updateDoc(orderRef, { 
                system_step: 3, 
                address_visible: true, 
                contact_visible: true,
                status: 'confirmed_hold' 
            });
            
            await addDoc(collection(db, `chats/${orderId}/messages`), {
                text: "🔒 RESERVA CONFIRMADA: O contato direto foi liberado. Use o botão no topo.",
                sender_id: "system",
                timestamp: serverTimestamp()
            });
        }
    } catch(e) { console.error(e); }
}

export async function enviarMensagemChat(orderId, step) {
    const input = document.getElementById('chat-input-msg');
    let texto = input.value.trim();
    if(!texto) return;

    if (step < 3) {
        const textoNormalizado = texto.toLowerCase().replace(/[.\-_ @310]/g, (char) => {
            return {'.':'','-':'','_':'',' ':'','@':'a','3':'e','1':'i','0':'o'}[char] || '';
        });

        const proibidas = ["whatsapp","whats","wpp","zap","telefone","contato","celular","instagram","insta","meuchama","porfora","diretocomigo","seunumber"];
        const encontrouPalavra = proibidas.some(p => textoNormalizado.includes(p));

        const regexTelefone = /(?:\d[\s.\-_()]*){8,}/g;
        const regexExtenso = /(zero|um|dois|tres|três|quatro|cinco|seis|sete|oito|nove)/gi;
        const contagemExtenso = (texto.match(regexExtenso) || []).length;

        if (encontrouPalavra || regexTelefone.test(texto) || contagemExtenso >= 3) {
            alert("🚫 Por segurança, troca de contatos é bloqueada nesta etapa.\n\nConfirme o acordo para liberar os dados oficiais.");
            input.value = ""; 
            return;
        }
    }

    input.value = "";
    await addDoc(collection(db, `chats/${orderId}/messages`), { 
        text: texto, 
        sender_id: auth.currentUser.uid, 
        timestamp: serverTimestamp() 
    });
}

function escutarMensagens(orderId) {
    const q = query(collection(db, `chats/${orderId}/messages`), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        const area = document.getElementById('bubbles-area');
        if(!area) return;
        area.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            const souEu = m.sender_id === auth.currentUser.uid;
            const isSystem = m.sender_id === 'system';

            if(isSystem) {
                area.innerHTML += `<div class="flex justify-center my-2"><span class="text-[8px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 font-bold">${m.text}</span></div>`;
            } else {
                area.innerHTML += `
                    <div class="flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn">
                        <div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[85%] text-xs shadow-sm">
                            <p>${m.text}</p>
                        </div>
                    </div>`;
            }
        });
        const divMsgs = document.getElementById('chat-messages');
        if(divMsgs) divMsgs.scrollTop = divMsgs.scrollHeight;
    });
}
