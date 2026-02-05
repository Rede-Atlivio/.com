// ============================================================================
// js/modules/chat.js - ATUALIZAÇÃO V11.0 (SANEAMENTO E NOMENCLATURA)
// ============================================================================

import { db, auth } from '../config.js'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO GLOBAL ---
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
window.finalizarServicoPassoFinal = (id) => window.finalizarServicoPassoFinalAction(id);
window.voltarParaListaPedidos = () => {
    document.getElementById('painel-chat-individual')?.classList.add('hidden');
    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.remove('hidden');
};

window.sugerirDetalhe = (orderId, campo) => {
    const input = document.getElementById('chat-input-msg');
    if(!input) return;
    input.value = campo === 'Horário' ? "Qual o melhor horário para você?" : "Pode confirmar o local?";
    input.focus();
};

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

    const pedidoRef = doc(db, "orders", orderId);
    onSnapshot(pedidoRef, (snap) => {
        if (!snap.exists()) return;
        const pedido = snap.data();
        const isProvider = pedido.provider_id === auth.currentUser.uid;
        const step = pedido.system_step || 1;
        renderizarEstruturaChat(painelChat, pedido, isProvider, orderId, step);
    });
}

function renderizarEstruturaChat(container, pedido, isProvider, orderId, step) {
    const outroNome = isProvider ? pedido.client_name : pedido.provider_name;
    const contatoLiberado = step >= 3;
    
    const stepsHTML = `
        <div class="flex justify-between px-6 py-2 bg-white text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b">
            <span class="${step >= 1 ? 'text-blue-600' : ''}">1. Negociação</span>
            <span class="${step >= 2 ? 'text-blue-600' : ''}">2. Garantia</span>
            <span class="${step >= 3 ? 'text-green-600' : ''}">3. Contato</span>
        </div>
        <div class="h-1 w-full bg-gray-100">
            <div class="h-full ${step >= 3 ? 'bg-green-500' : 'bg-blue-600'} transition-all duration-500" style="width: ${step * 33.33}%"></div>
        </div>
    `;

    container.innerHTML = `
        <div class="flex flex-col h-full bg-slate-50">
            <div class="bg-white shadow-sm z-30">
                <div class="p-3 flex items-center gap-3 border-b">
                    <button onclick="window.voltarParaListaPedidos()" class="text-gray-400 p-2 hover:bg-gray-50 rounded-full">⬅</button>
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-800 text-xs uppercase">${outroNome}</h3>
                        <p class="text-[9px] font-black text-blue-600">OFERTA INICIAL: R$ ${pedido.offer_value}</p>
                    </div>
                    ${contatoLiberado ? 
                        `<a href="tel:${isProvider ? pedido.client_phone : pedido.provider_phone}" class="bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm animate-pulse">📞 LIGAR</a>` : 
                        `<div class="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[8px] font-bold flex items-center gap-1">🔒 <span>DADOS OCULTOS</span></div>`
                    }
                </div>
                ${stepsHTML}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 pb-48 custom-scrollbar">
                ${step < 3 ? `
                <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 text-center mx-auto max-w-xs">
                    <p class="text-[10px] text-blue-800 leading-relaxed">
                        💡 <strong>Dica:</strong> Use os botões abaixo para definir <strong>Valor</strong> e <strong>Detalhes</strong>. 
                        Negociações organizadas fecham 3x mais rápido.
                    </p>
                </div>` : ''}

                ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                <div id="bubbles-area"></div>
            </div>

            ${pedido.status !== 'completed' ? `
            <div class="bg-white border-t fixed bottom-0 w-full max-w-2xl z-40 pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div class="flex gap-2 p-3 overflow-x-auto whitespace-nowrap scrollbar-hide bg-gray-50/50">
                    ${step < 3 ? `
                        <button onclick="window.novoDescreverServico('${orderId}')" class="bg-white px-4 py-2 rounded-xl text-[10px] border border-blue-200 text-blue-700 font-black shadow-sm flex items-center gap-1 hover:bg-blue-50 transition">
                            📦 Descrever
                        </button>
                        <button onclick="window.novoEnviarProposta('${orderId}')" class="bg-blue-600 px-4 py-2 rounded-xl text-[10px] text-white font-black shadow-md flex items-center gap-1 hover:bg-blue-700 transition transform active:scale-95">
                            🎯 PROPOSTA FINAL
                        </button>
                    ` : ''}
                    
                    ${step >= 3 && !isProvider ? 
                        `<button onclick="window.finalizarServicoPassoFinal('${orderId}')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg uppercase tracking-wide w-full">
                            🏁 CONFIRMAR & PAGAR
                        </button>` : ''
                    }
                    
                    <button onclick="window.reportarProblema('${orderId}')" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-100 hover:bg-red-100">
                        ⚠️ Ajuda
                    </button>
                </div>

                <div class="px-3 pb-3 pt-1 flex gap-2 items-center">
                    <input type="text" id="chat-input-msg" placeholder="${step < 3 ? 'Use os botões para agilizar...' : 'Digite sua mensagem...'}" 
                        class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-200">
                    <button onclick="window.enviarMensagemChat('${orderId}', ${step})" class="bg-slate-900 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition">
                        ➤
                    </button>
                </div>
            </div>` : ''}
        </div>
    `;
    escutarMensagens(orderId);
}

function gerarBannerEtapa(step, isProvider, pedido, orderId) {
    if (step < 3) {
        const jaConfirmei = isProvider ? pedido.provider_confirmed : pedido.client_confirmed;
        if (jaConfirmei) return `<div class="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center animate-pulse mb-4 mx-4"><p class="text-xs font-bold text-blue-800">⏳ Aguardando a outra parte confirmar...</p></div>`;
        
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0 };
        const pct = isProvider ? config.porcentagem_reserva : config.porcentagem_reserva_cliente;
        const valorAcordo = parseFloat(pedido.offer_value) || 0;
        const reservaCalculada = valorAcordo * (pct / 100);

        return `<div class="bg-white border border-gray-100 p-5 rounded-2xl shadow-xl mb-4 mx-4 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <p class="text-sm font-black text-gray-800 mb-1">🤝 Fechar Acordo?</p>
            <p class="text-xs text-gray-500 mb-4">Confirme se o valor e os detalhes estão certos.</p>
            <div class="flex gap-3 mb-4">
                <button onclick="window.confirmarAcordo('${orderId}', true)" class="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase shadow-md hover:bg-blue-700 transition">✅ ACEITAR E FECHAR</button>
            </div>
            <div class="bg-amber-50 border border-amber-100 p-2 rounded-lg flex gap-2 items-start">
                <span class="text-amber-500 text-xs mt-0.5">🔒</span>
                <p class="text-amber-800 text-[9px] font-medium leading-tight">
                    <strong>SISTEMA ATLIVIO:</strong> Reserva de <strong>R$ ${reservaCalculada.toFixed(2)} (${pct}%)</strong> como garantia.
                </p>
            </div>
        </div>`;
    }
    if (step === 3) return `<div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center mb-4 mx-4 shadow-sm"><p class="text-sm font-black text-emerald-800 uppercase">✨ Acordo Confirmado!</p></div>`;
    return "";
}

export async function enviarMensagemChat(orderId, step) {
    const input = document.getElementById('chat-input-msg');
    let texto = input.value.trim();
    if(!texto) return;

    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
            const pedido = orderSnap.data();
            const souPrestador = auth.currentUser.uid === pedido.provider_id;
            if (souPrestador && pedido.status === 'pending') {
                alert("⛔ Você precisa ACEITAR a solicitação antes de enviar mensagens.");
                input.value = "";
                return;
            }
        }
    } catch(e) { console.error(e); }

    input.value = "";
    try {
        await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: texto, 
            sender_id: auth.currentUser.uid, 
            timestamp: serverTimestamp() 
        });
    } catch (e) { console.error(e); }
}

export async function confirmarAcordo(orderId, aceitar) {
    if(!aceitar) return;
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);

    try {
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0, limite_divida: -60.00 };
        const pedidoSnap = await getDoc(orderRef);
        const pedido = pedidoSnap.data();
        const valorPedido = parseFloat(String(pedido.offer_value).replace(',', '.')) || 0;
        const isMeProvider = uid === pedido.provider_id;
        
        const pctAplicada = isMeProvider ? (config.porcentagem_reserva ?? 0) : (config.porcentagem_reserva_cliente ?? 0);
        const valorReservaNecessaria = valorPedido * (pctAplicada / 100);

        if (valorReservaNecessaria > 0) {
            const userSnap = await getDoc(doc(db, "usuarios", uid));
            const saldoAtual = parseFloat(userSnap.data()?.wallet_balance || 0);
            if (isMeProvider && (saldoAtual - valorReservaNecessaria) < (config.limite_divida || -60)) {
                return alert("Saldo insuficiente para cobrir a taxa de reserva.");
            }
        }

        let vaiFecharAgora = false;
        await runTransaction(db, async (transaction) => {
            const freshOrderSnap = await transaction.get(orderRef);
            const freshOrder = freshOrderSnap.data();
            const clientRef = doc(db, "usuarios", freshOrder.client_id);
            const clientSnap = await transaction.get(clientRef);

            const campoUpdate = isMeProvider ? { provider_confirmed: true } : { client_confirmed: true };
            const oOutroJaConfirmou = isMeProvider ? freshOrder.client_confirmed : freshOrder.provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou;

            transaction.update(orderRef, campoUpdate);

            if (vaiFecharAgora) {
                const saldoClient = parseFloat(clientSnap.data()?.wallet_balance || 0);
                const taxaClienteAdmin = config.porcentagem_reserva_cliente ?? 0;
                const valorCofre = valorPedido * (taxaClienteAdmin / 100);

                if (valorCofre > 0) {
                    transaction.update(clientRef, {
                        wallet_balance: saldoClient - valorCofre,
                        wallet_reserved: (clientSnap.data()?.wallet_reserved || 0) + valorCofre,
                        saldo: saldoClient - valorCofre
                    });
                }

                transaction.update(orderRef, { 
                    system_step: 3, 
                    status: 'confirmed_hold',
                    value_reserved: valorCofre,
                    confirmed_at: serverTimestamp()
                });

                const msgRef = doc(collection(db, `chats/${orderId}/messages`));
                transaction.set(msgRef, {
                    text: `🔒 ACORDO FECHADO: Contato liberado!`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });
        alert(vaiFecharAgora ? "✅ Acordo Fechado!" : "✅ Confirmado! Aguardando o outro.");
    } catch(e) { console.error(e); }
}

export function escutarMensagens(orderId) {
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
                area.innerHTML += `<div class="flex justify-center my-2"><span class="text-[8px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold">${m.text}</span></div>`;
            } else {
                area.innerHTML += `<div class="flex ${souEu ? 'justify-end' : 'justify-start'} animate-fadeIn"><div class="${souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'} px-4 py-2 rounded-2xl max-w-[85%] text-xs shadow-sm"><p>${m.text}</p></div></div>`;
            }
        });
        const divMsgs = document.getElementById('chat-messages');
        if(divMsgs) divMsgs.scrollTop = divMsgs.scrollHeight;
    });
}

window.finalizarServicoPassoFinalAction = async (orderId) => {
    if(!confirm("Confirmar finalização?")) return;
    try {
        const configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
        const taxaPercent = configSnap.exists() ? parseFloat(configSnap.data().taxa_plataforma) : 0.20;

        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "orders", orderId);
            const orderSnap = await transaction.get(orderRef);
            const pedido = orderSnap.data();
            const clientRef = doc(db, "usuarios", pedido.client_id);
            const providerRef = doc(db, "usuarios", pedido.provider_id);

            const clientSnap = await transaction.get(clientRef);
            const providerSnap = await transaction.get(providerRef);

            const valorReservado = parseFloat(pedido.value_reserved || 0);
            const valorTotal = parseFloat(pedido.offer_value || 0);
            const valorLiquido = valorTotal - (valorTotal * taxaPercent);

            if (clientSnap.exists()) {
                transaction.update(clientRef, { wallet_reserved: Math.max(0, (clientSnap.data().wallet_reserved || 0) - valorReservado) });
            }
            if (providerSnap.exists()) {
                const newBal = (providerSnap.data().wallet_balance || 0) + valorLiquido;
                transaction.update(providerRef, { wallet_balance: newBal, saldo: newBal });
            }
            transaction.update(orderRef, { status: 'completed', completed_at: serverTimestamp() });
        });
        alert("✅ Concluído!");
        window.voltarParaListaPedidos();
    } catch(e) { console.error(e); }
};

window.reportarProblema = async (orderId) => {
    const motivo = prompt("Descreva o problema:");
    if(!motivo) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { status: 'dispute', dispute_reason: motivo, dispute_at: serverTimestamp() });
        alert("🚨 Suporte acionado.");
    } catch(e) { console.error(e); }
};

window.voltarParaListaPedidos = () => {
    const chatIndiv = document.getElementById('painel-chat-individual');
    const listaPed = document.getElementById('painel-pedidos');
    if(chatIndiv) chatIndiv.classList.add('hidden');
    if(listaPed) listaPed.classList.remove('hidden');
};

// --- MAPEAMENTO FINAL DE GATILHOS (FECHANDO O ARQUIVO) ---
window.executarDescricao = (id) => window.novoDescreverServico(id);
window.executarProposta = (id) => window.novoEnviarProposta(id);
