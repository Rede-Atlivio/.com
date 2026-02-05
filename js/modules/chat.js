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
            
            const isPending = pedido.status === 'pending';
            
            let statusBadge = `<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Etapa ${step}: Acordo</span>`;
            
            // 🚥 STATUS DE FINALIZAÇÃO E BLOQUEIO
            if(step >= 3) statusBadge = `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">Etapa 3: Confirmado</span>`;
            if(pedido.status === 'completed') statusBadge = `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">🏁 CONCLUÍDO</span>`;
            if(pedido.status === 'cancelled') statusBadge = `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">🚫 CANCELADO</span>`;
            if(pedido.status === 'negotiation_closed') statusBadge = `<span class="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">✋ ENCERRADO</span>`;

            // 🛠️ LOGICA DE RECUPERAÇÃO PARA O AUDITOR
            if (isPending && isMeProvider) {
                statusBadge = `<button onclick="window.recuperarPedidoRadar('${pedido.id}')" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase animate-pulse">AGUARDANDO ACEITE</button>`;
            }

            // 🛠️ LOGICA DE RECUPERAÇÃO E BADGE PARA O PRESTADOR (Exigência do Auditor)
            if (isPending && isMeProvider) {
                statusBadge = `<button onclick="window.recuperarPedidoRadar('${pedido.id}')" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase animate-pulse">AGUARDANDO ACEITE</button>`;
            }

            listaRender.innerHTML += `
                <div onclick="${isPending && isMeProvider ? '' : `window.abrirChatPedido('${pedido.id}')`}" class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 active:scale-95 transition">
                    <div class="bg-slate-100 h-12 w-12 rounded-full flex items-center justify-center text-xl">👤</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-gray-800 text-sm">${outroNome}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1">${pedido.service_title || 'Serviço Geral'}</p>
                    </div>
                </div>`;
        });
    };

    // 🔗 CONEXÕES FIREBASE (Escutando ordens como Cliente e Prestador)
    const pedidosRef = collection(db, "orders");
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), orderBy("created_at", "desc"), limit(10));
    const qClient = query(pedidosRef, where("client_id", "==", uid), orderBy("created_at", "desc"), limit(10));

    onSnapshot(qProvider, (snap) => { 
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); 
        renderizar(); 
    });
    onSnapshot(qClient, (snap) => { 
        snap.forEach(d => pedidosMap.set(d.id, { id: d.id, ...d.data() })); 
        renderizar(); 
    });
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
    
    // Barra de Progresso Visual
    const stepsHTML = `
        <div class="flex justify-between px-6 py-2 bg-white text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b">
            <span class="${step >= 1 ? 'text-blue-600' : ''}">1. Negociação</span>
            <span class="${step >= 2 ? 'text-blue-600' : ''}">2. Garantia</span>
            <span class="${step >= 3 ? 'text-green-600' : ''}">3. Execução</span>
        </div>
        <div class="h-1 w-full bg-gray-100">
            <div class="h-full ${step >= 3 ? 'bg-green-500' : 'bg-blue-600'} transition-all duration-500" style="width: ${step * 33.33}%"></div>
        </div>
    `;

    // 🕒 AÇÃO 10: O CÉREBRO DO TEMPO (Injeção do Painel)
    const timeHTML = gerarPainelTempo(pedido, isProvider, orderId);

    container.innerHTML = `
        <div class="flex flex-col h-full bg-slate-50">
            <div class="bg-white shadow-sm z-30">
                <div class="p-3 flex items-center gap-3 border-b">
                    <button onclick="window.voltarParaListaPedidos()" class="text-gray-400 p-2 hover:bg-gray-50 rounded-full">⬅</button>
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-800 text-xs uppercase">${outroNome}</h3>
                        <p class="text-[9px] font-black text-blue-600">OFERTA: R$ ${pedido.offer_value}</p>
                    </div>
                    ${contatoLiberado ? 
                        `<a href="tel:${isProvider ? pedido.client_phone : pedido.provider_phone}" class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">📞 Ligar</a>` : 
                        `<div class="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[8px] font-bold flex items-center gap-1">🔒 <span class="hidden sm:inline">Oculto</span></div>`
                    }
                </div>
                ${stepsHTML}
                
                ${timeHTML}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 pb-48 custom-scrollbar">
                ${step < 3 ? `
                <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 text-center mx-auto max-w-xs">
                    <p class="text-[10px] text-blue-800 leading-relaxed">
                        💡 <strong>Dica:</strong> Negocie valores e horários antes de aceitar.
                    </p>
                </div>` : ''}

                ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                <div id="bubbles-area"></div>
            </div>

            ${!['completed', 'cancelled', 'negotiation_closed'].includes(pedido.status) ? `
            <div class="bg-white border-t fixed bottom-0 w-full max-w-2xl z-40 pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div class="flex gap-2 p-3 overflow-x-auto whitespace-nowrap scrollbar-hide bg-gray-50/50">
                    ${step < 3 ? `
                        <button onclick="window.novoDescreverServico('${orderId}')" class="bg-white px-4 py-2 rounded-xl text-[10px] border border-blue-200 text-blue-700 font-black shadow-sm hover:bg-blue-50">📦 Descrever</button>
                        <button onclick="window.novoEnviarProposta('${orderId}')" class="bg-blue-600 px-4 py-2 rounded-xl text-[10px] text-white font-black shadow-md hover:bg-blue-700">🎯 PROPOSTA</button>
                    ` : ''}
                    
                   ${step >= 3 && !isProvider ? 
                        `<button onclick="window.finalizarServicoPassoFinal('${orderId}')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg uppercase tracking-wide w-full">
                            🏁 CONFIRMAR & PAGAR
                        </button>` : ''
                    }
                    
                    ${step < 3 ? 
                        `<button onclick="window.encerrarNegociacao('${orderId}')" class="bg-gray-50 text-gray-400 px-3 py-2 rounded-xl text-[10px] font-bold border border-gray-100 hover:bg-gray-200 hover:text-gray-600 transition">
                            ✋ Encerrar
                        </button>` : 
                        `<button onclick="window.cancelarServico('${orderId}')" class="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-100 hover:bg-red-100 transition">
                            🚫 Cancelar (Multa)
                        </button>`
                    }

                    <button onclick="window.reportarProblema('${orderId}')" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-100 hover:bg-red-100">
                        ⚠️ Ajuda
                    </button>
                </div>

                <div class="px-3 pb-3 pt-1 flex gap-2 items-center">
                    <input type="text" id="chat-input-msg" placeholder="Digite sua mensagem..." 
                        class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-200">
                    <button onclick="window.enviarMensagemChat('${orderId}', ${step})" class="bg-slate-900 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition">➤</button>
                </div>
            </div>` : ''}
        </div>
    `;
    
    // Inicia o "tic-tac" do relógio local
    if(window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => atualizarRelogioDOM(pedido), 1000);
    
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
        // --- 1. CONFIGURAÇÕES FINANCEIRAS (Leitura do Cache ou Padrão) ---
        // 🛡️ CORREÇÃO V11: Fallback inteligente -> Se não tem regra específica, usa a geral (10%)
        const configPadrao = { porcentagem_reserva: 10, porcentagem_reserva_cliente: 10, limite_divida: 0 };
        const config = window.configFinanceiroAtiva || configPadrao;
        
        // --- 2. TRAVA PRELIMINAR DE UI (CLIENTE) ---
        // Se já sabemos que o user é cliente e está negativo, nem abrimos a transação pesada
        const userMem = window.userProfile || {};
        if (userMem.uid === uid && userMem.wallet_balance !== undefined) {
             // Se não for prestador (ou seja, é cliente)
             const orderPreSnap = await getDoc(orderRef);
             if(orderPreSnap.exists() && orderPreSnap.data().provider_id !== uid) {
                 const valorTotal = parseFloat(orderPreSnap.data().offer_value || 0);
                 
                // 🛡️ CORREÇÃO DEFINITIVA V12: Lógica que aceita ZERO como valor válido
                 let taxaCli = config.porcentagem_reserva_cliente;
                 
                 // Se for indefinido ou vazio, aí sim busca o geral. Se for 0, ele MANTÉM 0.
                 if (taxaCli === undefined || taxaCli === null || taxaCli === "") {
                     taxaCli = config.porcentagem_reserva;
                 }
                 // Se ainda assim não tiver nada, usa 10
                 if (taxaCli === undefined || taxaCli === null || taxaCli === "") {
                     taxaCli = 10;
                 }
                 
                 taxaCli = parseFloat(taxaCli);
                 
                 const precisa = valorTotal * (taxaCli / 100);
                 
                 if (precisa > 0 && parseFloat(userMem.wallet_balance) < precisa) {
                     alert(`⛔ SALDO INSUFICIENTE\n\nVocê precisa de R$ ${precisa.toFixed(2)} em conta para cobrir a garantia de proteção (${taxaCli}%).\nRecarregue sua carteira.`);
                     if(window.switchTab) window.switchTab('ganhar');
                     return;
                 }
             }
        }

        // --- 3. OPERAÇÃO BLINDADA NO BANCO DE DADOS ---
        let vaiFecharAgora = false;
        await runTransaction(db, async (transaction) => {
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw "Pedido não encontrado!";
            const freshOrder = freshOrderSnap.data();

            const clientRef = doc(db, "usuarios", freshOrder.client_id);
            const clientSnap = await transaction.get(clientRef);
            if (!clientSnap.exists()) throw "Perfil do cliente não encontrado.";

            const isMeProvider = uid === freshOrder.provider_id;
            const campoUpdate = isMeProvider ? { provider_confirmed: true } : { client_confirmed: true };
            const oOutroJaConfirmou = isMeProvider ? freshOrder.client_confirmed : freshOrder.provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou;

            // Atualiza o "De acordo" de quem clicou
            transaction.update(orderRef, campoUpdate);

            // SE OS DOIS ACEITARAM -> EXECUTA A CUSTÓDIA
            if (vaiFecharAgora) {
                const saldoClient = parseFloat(clientSnap.data()?.wallet_balance || 0);
                
                // Busca a regra fresca no banco para não ter erro
                const configSnap = await transaction.get(doc(db, "settings", "financeiro"));
                const configData = configSnap.exists() ? configSnap.data() : config;
                
                // 🛡️ CORREÇÃO V11: Robustez no cálculo da taxa (Prioridade: Específico > Geral > 10%)
                const taxaClienteAdmin = parseFloat(configData.porcentagem_reserva_cliente || configData.porcentagem_reserva || 10);
                
                const valorPedido = parseFloat(freshOrder.offer_value || 0);
                const valorCofre = valorPedido * (taxaClienteAdmin / 100);

                if (valorCofre > 0) {
                    // ⛔ AQUI ESTÁ A TRAVA REAL DO BANCO ⛔
                    if (saldoClient < valorCofre) {
                        throw `O Cliente não possui saldo suficiente (R$ ${saldoClient.toFixed(2)}) para a garantia de R$ ${valorCofre.toFixed(2)} (${taxaClienteAdmin}%).`;
                    }

                    // 💸 MOVIMENTO: Tira do Saldo -> Põe na Reserva
                    transaction.update(clientRef, {
                        wallet_balance: saldoClient - valorCofre,
                        wallet_reserved: (parseFloat(clientSnap.data()?.wallet_reserved || 0) + valorCofre)
                    });
                }

                // Atualiza status do pedido
                transaction.update(orderRef, { 
                    system_step: 3, 
                    status: 'confirmed_hold',
                    value_reserved: valorCofre,
                    confirmed_at: serverTimestamp()
                });

                // Mensagem no chat
                const msgRef = doc(collection(db, `chats/${orderId}/messages`));
                transaction.set(msgRef, {
                    text: `🔒 ACORDO FECHADO: ${valorCofre > 0 ? `R$ ${valorCofre.toFixed(2)} em garantia.` : 'Taxa zero aplicada.'} Contato liberado!`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });

        if(vaiFecharAgora) {
            alert("✅ Acordo Fechado! O valor de garantia está protegido na custódia.");
        } else {
            alert("✅ Confirmado! Aguardando a outra parte aceitar.");
        }

    } catch(e) { 
        console.error("Erro no acordo:", e);
        // Tratamento de erro amigável
        if(String(e).includes("Cliente não possui saldo") || String(e).includes("insuficiente")) {
            alert("⛔ FALHA NO FECHAMENTO\n\n" + e + "\n\nO acordo não foi fechado.");
        } else {
            alert("⚠️ Falha: " + e);
        }
    }
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

// ============================================================================
// 🕒 MÓDULO DE AGENDAMENTO E CRONÔMETRO (AÇÃO 10)
// ============================================================================

function gerarPainelTempo(pedido, isProvider, orderId) {
    // 1. Serviço em Execução (Cronômetro Ativo)
    if (pedido.status === 'in_progress' && pedido.real_start) {
        return `
        <div class="bg-green-600 text-white px-4 py-2 flex justify-between items-center shadow-inner">
            <div class="flex items-center gap-2">
                <span class="animate-pulse text-xs">🔴</span>
                <span class="text-xs font-bold uppercase tracking-widest">Em Execução</span>
            </div>
            <div class="font-mono text-xl font-black tracking-widest" id="timer-display">00:00:00</div>
            ${isProvider ? `<button onclick="window.finalizarTrabalho('${orderId}')" class="bg-white text-green-700 text-[9px] font-black px-2 py-1 rounded shadow hover:bg-gray-100">CONCLUIR</button>` : ''}
        </div>`;
    }

    // 2. Serviço Agendado (Contagem Regressiva)
    if (pedido.scheduled_at) {
        const dataAgendada = pedido.scheduled_at.toDate ? pedido.scheduled_at.toDate() : new Date(pedido.scheduled_at);
        const agora = new Date();
        const diff = dataAgendada - agora;
        const isHoje = dataAgendada.toDateString() === agora.toDateString();
        
        const dataFormatada = dataAgendada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `
        <div class="bg-slate-800 text-white px-4 py-2 flex justify-between items-center shadow-lg relative overflow-hidden">
            <div class="z-10">
                <p class="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Agendado para ${isHoje ? 'HOJE' : ''}</p>
                <div class="flex items-baseline gap-2">
                    <span class="text-sm font-bold text-white">${dataFormatada}</span>
                </div>
            </div>
            
            <div class="z-10 text-right">
                ${diff > 0 ? 
                    `<p class="text-[9px] text-gray-400">Começa em</p><p class="font-mono text-sm font-bold text-yellow-400" id="countdown-display">--:--</p>` : 
                    `<p class="text-[10px] font-bold text-green-400 animate-pulse">⏰ HORA DE INICIAR</p>`
                }
            </div>

            ${isProvider && pedido.status === 'confirmed_hold' ? 
                `<button onclick="window.iniciarTrabalho('${orderId}')" class="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 hover:bg-green-400 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-lg z-20 flex items-center gap-1 animate-bounce-subtle">
                    ▶ INICIAR
                </button>` : ''
            }
        </div>`;
    }

    // 3. Sem Agendamento (Botão para Definir)
    if (pedido.status === 'confirmed_hold' || pedido.status === 'accepted') {
        return `
        <div class="bg-amber-50 border-b border-amber-100 px-4 py-2 flex justify-between items-center">
            <div class="flex items-center gap-2 text-amber-800">
                <span class="text-lg">📅</span>
                <p class="text-[10px] font-bold uppercase">Data não definida</p>
            </div>
            <button onclick="window.abrirAgendamento('${orderId}')" class="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded shadow hover:bg-amber-600 transition">
                DEFINIR DATA
            </button>
        </div>`;
    }

    return '';
}

function atualizarRelogioDOM(pedido) {
    const displayTimer = document.getElementById('timer-display');
    const displayCountdown = document.getElementById('countdown-display');

    // Modo Cronômetro (Em execução)
    if (displayTimer && pedido.real_start) {
        const inicio = pedido.real_start.toDate ? pedido.real_start.toDate() : new Date(pedido.real_start);
        const agora = new Date();
        const diff = Math.floor((agora - inicio) / 1000);
        
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        
        displayTimer.innerText = `${h}:${m}:${s}`;
    }

    // Modo Contagem Regressiva
    if (displayCountdown && pedido.scheduled_at) {
        const alvo = pedido.scheduled_at.toDate ? pedido.scheduled_at.toDate() : new Date(pedido.scheduled_at);
        const agora = new Date();
        const diff = Math.floor((alvo - agora) / 1000);

        if (diff <= 0) {
            displayCountdown.innerText = "00:00";
        } else {
            const d = Math.floor(diff / 86400);
            const h = Math.floor((diff % 86400) / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            
            if (d > 0) displayCountdown.innerText = `${d}d ${h}h`;
            else displayCountdown.innerText = `${h}:${m}`;
        }
    }
}

// --- FUNÇÕES DE AÇÃO DO TEMPO ---

window.abrirAgendamento = async (orderId) => {
    const dataStr = prompt("📅 DATA E HORA DO SERVIÇO\n\nDigite no formato: DD/MM/AAAA HH:MM\nExemplo: 25/12/2026 14:30");
    if (!dataStr) return;

    // Parser simples de data BR
    const [dia, mes, ano, hora, min] = dataStr.split(/[\/\s:]/);
    const dataObj = new Date(`${ano}-${mes}-${dia}T${hora}:${min}:00`);

    if (isNaN(dataObj.getTime())) {
        alert("❌ Data inválida. Use o formato DD/MM/AAAA HH:MM");
        return;
    }

    try {
        await updateDoc(doc(db, "orders", orderId), { 
            scheduled_at: dataObj, // Salva como Timestamp
            schedule_updated_by: auth.currentUser.uid 
        });
        
        // Avisa no chat
        await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: `📅 Agendado para: ${dataStr}`, 
            sender_id: 'system', 
            timestamp: serverTimestamp() 
        });
        
    } catch(e) { console.error(e); alert("Erro ao agendar."); }
};

window.iniciarTrabalho = async (orderId) => {
    if(!confirm("▶ INICIAR O SERVIÇO AGORA?\n\nO cronômetro começará a rodar para o cliente ver.")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'in_progress', 
            real_start: serverTimestamp() 
        });
         await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: `▶ Serviço Iniciado! Cronômetro rodando.`, 
            sender_id: 'system', 
            timestamp: serverTimestamp() 
        });
    } catch(e) { console.error(e); }
};

window.finalizarTrabalho = async (orderId) => {
    if(!confirm("🏁 CONCLUIR O SERVIÇO?\n\nIsso encerrará o cronômetro e liberará o pagamento.")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'completed', // Vai para o estado final de liberação
            real_end: serverTimestamp(),
            system_step: 4
        });
         await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: `🏁 Serviço Finalizado pelo Prestador.`, 
            sender_id: 'system', 
            timestamp: serverTimestamp() 
        });
    } catch(e) { console.error(e); }
};

// ⚖️ AÇÃO 11: LÓGICA DE CANCELAMENTO COM PENALIDADE E ESTORNO
window.cancelarServico = async (orderId) => {
    if(!confirm("🚫 DESEJA REALMENTE CANCELAR?\n\n⚠️ Atenção:\n1. Isso impactará sua Reputação (Risk Score).\n2. O valor reservado (se houver) será estornado para seu saldo.\n\nTem certeza?")) return;

    const reason = prompt("Por favor, digite o motivo do cancelamento:");
    if(!reason) return;

    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "orders", orderId);
            const userRef = doc(db, "usuarios", auth.currentUser.uid);

            const orderSnap = await transaction.get(orderRef);
            const userSnap = await transaction.get(userRef);

            if (!orderSnap.exists() || !userSnap.exists()) throw "Erro ao buscar dados.";

            const order = orderSnap.data();
            const user = userSnap.data();

            // 1. CÁLCULO DE REPUTAÇÃO (Auto-Inicialização)
            // Se o risk_score não existir, começa em 0. Penalidade: +10 pontos.
            const currentRisk = user.risk_score || 0; 
            const currentCancels = user.cancelation_count || 0;
            const newRisk = currentRisk + 10; 

            // 2. ESTORNO FINANCEIRO (Escrow -> Saldo)
            const valorRetido = parseFloat(order.value_reserved || 0);
            let updateWallet = {};
            
            // Se tinha dinheiro preso, devolve para o saldo livre
            if (valorRetido > 0) {
                const currentReserved = parseFloat(user.wallet_reserved || 0);
                const currentBalance = parseFloat(user.wallet_balance || 0);
                
                updateWallet = {
                    wallet_reserved: Math.max(0, currentReserved - valorRetido),
                    wallet_balance: currentBalance + valorRetido
                };
            }

            // 3. EXECUÇÃO ATÔMICA (Tudo ou Nada)
            transaction.update(orderRef, {
                status: 'cancelled',
                canceled_by: auth.currentUser.uid,
                cancel_reason: reason,
                canceled_at: serverTimestamp()
            });

            transaction.update(userRef, {
                risk_score: newRisk,
                cancelation_count: currentCancels + 1,
                ...updateWallet // Espalha as atualizações de saldo aqui
            });

            // 4. MENSAGEM NO SISTEMA
            const msgRef = doc(collection(db, `chats/${orderId}/messages`));
            transaction.set(msgRef, {
                text: `🚫 PEDIDO CANCELADO pelo usuário. Motivo: "${reason}"`,
                sender_id: 'system',
                timestamp: serverTimestamp()
            });
        });

        alert("✅ Cancelamento realizado.\n\nSeu saldo foi estornado e sua reputação foi atualizada.");
        window.voltarParaListaPedidos();

    } catch (e) {
        console.error(e);
        alert("Erro ao cancelar: " + e);
    }
};

// ✋ AÇÃO 12: ENCERRAR NEGOCIAÇÃO (Sem Punição - Apenas Arquiva)
window.encerrarNegociacao = async (orderId) => {
    if(!confirm("✋ ENCERRAR NEGOCIAÇÃO?\n\nO chat será fechado e ninguém poderá mais enviar mensagens.\nComo o acordo ainda não foi fechado, NÃO haverá penalidade.\n\nConfirmar?")) return;

    try {
        await updateDoc(doc(db, "orders", orderId), {
            status: 'negotiation_closed', // Status específico para "não deu certo"
            closed_by: auth.currentUser.uid,
            closed_at: serverTimestamp(),
            system_step: 0 // Zera etapas
        });

        // Avisa no chat (última mensagem)
        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: `✋ NEGOCIAÇÃO ENCERRADA. Este chat foi arquivado.`,
            sender_id: 'system',
            timestamp: serverTimestamp()
        });

        alert("Negociação encerrada.");
        window.voltarParaListaPedidos();

    } catch(e) { console.error(e); }
};
// --- MAPEAMENTO FINAL DE GATILHOS (FECHANDO O ARQUIVO) ---
window.executarDescricao = (id) => window.novoDescreverServico(id);
window.executarProposta = (id) => window.novoEnviarProposta(id);
// Novas funções de tempo e cancelamento
window.abrirAgendamento = window.abrirAgendamento;
window.iniciarTrabalho = window.iniciarTrabalho;
window.finalizarTrabalho = window.finalizarTrabalho;
window.cancelarServico = window.cancelarServico;
window.encerrarNegociacao = window.encerrarNegociacao;
