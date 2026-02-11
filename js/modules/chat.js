// ============================================================================
// js/modules/chat.js - ATUALIZAÇÃO V11.0 (SANEAMENTO E NOMENCLATURA)
// ============================================================================

import { db, auth } from '../config.js'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO GLOBAL ---
window.irParaChat = () => {
    const tab = document.getElementById('tab-chat');
    if(tab) tab.click();
    // 🔄 CORREÇÃO: Chama a função exclusiva do chat, sem conflito com services.js
    if(window.carregarInterfaceDeChat) window.carregarInterfaceDeChat();
    window.scrollTo(0,0);
};

// 🔄 GARANTINDO QUE O NOME SEJA ÚNICO
window.carregarChat = () => {
    if(window.carregarInterfaceDeChat) window.carregarInterfaceDeChat();
};
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

// 🔄 RENOMEADA PARA EVITAR CONFLITO COM REQUEST.JS

export async function abrirChatPedido(orderId) {
    let painelChat = document.getElementById('painel-chat-individual');
    
    // 🛡️ SEGURANÇA DE DADOS: Garante que as categorias existam antes de interagir
    if (!window.CATEGORIAS_ATIVAS) {
        const servicesMod = await import('./services.js');
        window.CATEGORIAS_ATIVAS = servicesMod.CATEGORIAS_ATIVAS;
    }

    if (!painelChat || painelChat.parentElement !== document.body) {
        if(painelChat) painelChat.remove();
        painelChat = document.createElement('div');
        painelChat.id = 'painel-chat-individual';
        
        // 📏 RESPONSIVIDADE V12 (Injetada via JS para não depender do Index)
        const isPC = window.innerWidth >= 768;
        const stylePC = "width: 450px; height: 85vh; right: 20px; bottom: 20px; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);";
        const styleMobile = "width: 100%; height: 100%; right: 0; bottom: 0;";
        
        painelChat.className = "fixed z-[9999] bg-white flex flex-col hidden overflow-hidden animate-slideUp";
        painelChat.style.cssText = isPC ? stylePC : styleMobile;
        
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

        if (typeof window.atualizarCronometro === 'function') {
            window.atualizarCronometro(pedido);
        }

        iniciarGatilhosContextuais(orderId, step);
        renderizarEstruturaChat(painelChat, pedido, isProvider, orderId, step);
    });
}
async function renderizarEstruturaChat(container, pedido, isProvider, orderId, step) {
    const uidPartner = isProvider ? pedido.client_id : pedido.provider_id;
    let partnerData = { nome: "Usuário", photoURL: "", phone: "" };

    try {
        const pSnap = await getDoc(doc(db, "usuarios", uidPartner));
        if (pSnap.exists()) partnerData = pSnap.data();
    } catch (e) { console.error("Erro parceiro:", e); }

    const outroNome = partnerData.nome || partnerData.nome_profissional || "Usuário";
    const contatoLiberado = step >= 3;
    const isPartnerVerified = partnerData.is_verified ? '🏅 Verificado' : '⭐ Novo';

    // Barra de Progresso
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

    const timeHTML = gerarPainelTempo(pedido, isProvider, orderId);

    container.innerHTML = `
        <div class="flex flex-col h-full bg-slate-50">
            <div class="bg-white shadow-sm z-30">
                <div class="p-3 flex items-center justify-between border-b">
                    <div class="flex items-center gap-3">
                        <button onclick="window.voltarParaListaPedidos()" class="text-gray-400 p-2 hover:bg-gray-50 rounded-full">⬅</button>
                        <div class="relative group cursor-pointer" onclick="window.verPerfilCompleto('${uidPartner}')">
                            <img src="${partnerData.photoURL || 'https://ui-avatars.com/api/?name=' + outroNome}" class="w-10 h-10 rounded-full border-2 border-blue-500 object-cover">
                            <div class="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 text-[8px] font-bold shadow-sm">🔍</div>
                        </div>
                        <div class="cursor-pointer" onclick="window.verPerfilCompleto('${uidPartner}')">
                            <h3 class="font-black text-xs text-gray-800 uppercase italic leading-none hover:text-blue-600 transition">${outroNome}</h3>
                            <p class="text-[8px] font-bold text-blue-600 mt-1 uppercase tracking-tighter">${isPartnerVerified} • ${partnerData.rating_avg || '5.0'} ⭐</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${contatoLiberado ? `<a href="tel:${partnerData.phone || partnerData.telefone}" class="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm">📞 Ligar</a>` : ''}
                        <button onclick="window.confirmarEncerramentoChat('${orderId}')" class="text-gray-300 hover:text-red-500 p-2 transition" title="Encerrar Conversa">Encerrar Conversa✋</button>
                    </div>
                </div>
                ${stepsHTML}
                ${timeHTML}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 pb-48 custom-scrollbar">
                ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                <div id="bubbles-area"></div>
            </div>

            ${!['completed', 'cancelled', 'negotiation_closed'].includes(pedido.status) ? `
            <div class="bg-white border-t fixed bottom-0 w-full max-w-2xl z-40 shadow-2xl">
                <div class="flex gap-2 p-2 overflow-x-auto bg-gray-50 border-b no-scrollbar">
                    <button onclick="window.sugerirFrase('Já realizei serviços parecidos. Pode ficar tranquilo(a).')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">💡 Confiança</button>
                    <button onclick="window.sugerirFrase('Tenho disponibilidade para hoje ou amanhã.')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">⚡ Urgência</button>
                    <button onclick="window.sugerirFrase('A ATLIVIO segura a reserva até o serviço ser concluído.')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">🔒 Garantia</button>
                </div>

                <div class="flex gap-2 p-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    ${step < 3 ? `
                        <button onclick="window.novoDescreverServico('${orderId}')" class="bg-white px-4 py-2 rounded-xl text-[10px] border border-blue-200 text-blue-700 font-black shadow-sm">📦 Descrever</button>
                        <button onclick="window.novoEnviarProposta('${orderId}')" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex flex-col items-center transform active:scale-95 transition">
                            <span>🎯 PROPOSTA</span>
                            <span class="text-[7px] opacity-70 uppercase tracking-tighter">Negociar Valor</span>
                        </button>
                    ` : ''}
                    
                    ${step >= 3 && !isProvider ? `<button onclick="window.finalizarServicoPassoFinal('${orderId}')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg w-full">🏁 CONFIRMAR & PAGAR</button>` : ''}
                    
                    <button onclick="window.reportarProblema('${orderId}')" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-100">⚠️ Ajuda</button>
                </div>

                <div class="px-3 pb-3 flex gap-2 items-center">
                    <input type="text" id="chat-input-msg" placeholder="Digite sua mensagem..." class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-200">
                    <button onclick="window.enviarMensagemChat('${orderId}', ${step})" class="bg-slate-900 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition">➤</button>
                </div>
            </div>` : ''}
        </div>
    `;
    
    if(window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => atualizarRelogioDOM(pedido), 1000);
    escutarMensagens(orderId);
}
function gerarBannerEtapa(step, isProvider, pedido, orderId) {
    if (step < 3) {
        const jaConfirmei = isProvider ? pedido.provider_confirmed : pedido.client_confirmed;
        if (jaConfirmei) {
            return `<div class="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center animate-pulse mb-4 mx-4"><p class="text-xs font-bold text-blue-800">⏳ Aguardando a outra parte confirmar...</p></div>`;
        }

        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0 };
        const pct = isProvider ? config.porcentagem_reserva : config.porcentagem_reserva_cliente;
        const valorAcordo = parseFloat(pedido.offer_value) || 0;
        const reservaCalculada = valorAcordo * (pct / 100);

        return `<div id="banner-fechamento-v12" class="bg-white border-2 border-blue-600 p-5 rounded-2xl shadow-2xl mb-4 mx-4 relative overflow-hidden animate-bounce-subtle">
            <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
            <div class="flex justify-between items-start mb-2">
                <div>
                    <p class="text-sm font-black text-blue-900 mb-1">🤝 FINALIZAR NEGOCIAÇÃO</p>
                    <p class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Confirme para reservar sua agenda</p>
                </div>
                <span class="text-xl">✍️</span>
            </div>
            <button onclick="window.confirmarAcordo('${orderId}', true)" class="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black uppercase shadow-lg hover:bg-blue-700 active:scale-95 transition transform">
                🤝 ACEITAR E FECHAR AGORA
            </button>
            <div class="mt-3 bg-amber-50 p-2 rounded-lg flex gap-2 items-center">
                <span class="text-xs">🔒</span>
                <p class="text-[9px] text-amber-800 font-bold leading-tight uppercase tracking-tighter">Garantia de Proteção: R$ ${reservaCalculada.toFixed(2)}</p>
            </div>
        </div>`;
    }
    
    if (step === 3) {
        return `<div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center mb-4 mx-4 shadow-sm"><p class="text-sm font-black text-emerald-800 uppercase">✨ Acordo Confirmado!</p></div>`;
    }
    
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

export async function confirmarAcordo(orderId, aceitar) { //240 A 323 - PONTO CRÍTICO remove o "lixo" do arquivo e coloca as leituras de saldo no lugar certo.
    if(!aceitar) return;
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);

    try {
        let vaiFecharAgora = false;
        
        await runTransaction(db, async (transaction) => {
            // 1. LEITURAS INICIAIS (READS FIRST)
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw "Pedido não encontrado!";
            const freshOrder = freshOrderSnap.data();

            // ⚡ DEFINIÇÃO DE IDENTIDADE E VALORES (Impedindo ReferenceError)
            const isMeProvider = uid === freshOrder.provider_id;
            const totalPedido = parseFloat(freshOrder.offer_value || 0);
            const oOutroJaConfirmou = isMeProvider ? freshOrder.client_confirmed : freshOrder.provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou;

            const clientRef = doc(db, "usuarios", freshOrder.client_id);
            const providerRef = doc(db, "usuarios", freshOrder.provider_id);
            const configRef = doc(db, "settings", "financeiro");

            const [clientSnap, providerSnap, configSnap] = await Promise.all([
                transaction.get(clientRef),
                transaction.get(providerRef),
                transaction.get(configRef)
            ]);

            const configData = configSnap.exists() ? configSnap.data() : { porcentagem_reserva: 0, porcentagem_reserva_cliente: 0, limite_divida: 0 };
            const meuSaldo = uid === freshOrder.client_id ? (parseFloat(clientSnap.data().wallet_balance || 0)) : (parseFloat(providerSnap.data().wallet_balance || 0));
            const limiteFin = parseFloat(configData.limite_divida || 0);

           // 2. VALIDAÇÕES FINANCEIRAS (TRAVA ANTI-GOLPE)
            const pReservaCalculo = isMeProvider ? (parseFloat(configData.porcentagem_reserva || 0)) : (parseFloat(configData.porcentagem_reserva_cliente || 0));
            const valorReservaNecessaria = totalPedido * (pReservaCalculo / 100);

            if (meuSaldo < valorReservaNecessaria) {
                throw `Saldo insuficiente para garantir este acordo. Reserva necessária: R$ ${valorReservaNecessaria.toFixed(2)}`;
            }

            if (limiteFin !== 0 && meuSaldo < limiteFin) {
                throw `Bloqueio Financeiro: Seu saldo (R$ ${meuSaldo.toFixed(2)}) atingiu o limite de dívida.`;
            }

            // 3. ESCRITAS (WRITES AFTER ALL READS)
            transaction.update(orderRef, isMeProvider ? { provider_confirmed: true } : { client_confirmed: true });

            if (vaiFecharAgora) {
                const valorReservaPrestador = totalPedido * (parseFloat(configData.porcentagem_reserva || 0) / 100);
                const valorReservaCliente = totalPedido * (parseFloat(configData.porcentagem_reserva_cliente || 0) / 100);

                if (valorReservaCliente > 0) {
                    const cBal = parseFloat(clientSnap.data().wallet_balance || 0);
                    const cRes = parseFloat(clientSnap.data().wallet_reserved || 0);
                    transaction.update(clientRef, { wallet_balance: cBal - valorReservaCliente, wallet_reserved: cRes + valorReservaCliente });
                    transaction.set(doc(collection(db, "extrato_financeiro")), { uid: freshOrder.client_id, tipo: "RESERVA_SERVICO 🔒", valor: -valorReservaCliente, descricao: `Bloqueio de garantia para início do serviço`, timestamp: serverTimestamp() });
                }

                if (valorReservaPrestador > 0) {
                    const pBal = parseFloat(providerSnap.data().wallet_balance || 0);
                    const pRes = parseFloat(providerSnap.data().wallet_reserved || 0);
                    transaction.update(providerRef, { wallet_balance: pBal - valorReservaPrestador, wallet_reserved: pRes + valorReservaPrestador });
                    transaction.set(doc(collection(db, "extrato_financeiro")), { uid: freshOrder.provider_id, tipo: "RESERVA_SERVICO 🔒", valor: -valorReservaPrestador, descricao: `Taxa de reserva para garantia de agenda`, timestamp: serverTimestamp() });
                }

                transaction.update(orderRef, { 
                    system_step: 3, status: 'confirmed_hold', 
                    value_reserved_client: valorReservaCliente, 
                    value_reserved_provider: valorReservaPrestador, 
                    confirmed_at: serverTimestamp() 
                });

                transaction.set(doc(collection(db, `chats/${orderId}/messages`)), { text: `🔒 ACORDO FECHADO: Garantia retida conforme regras da plataforma.`, sender_id: "system", timestamp: serverTimestamp() });
            }
        });

        alert(vaiFecharAgora ? "✅ Acordo Fechado! O serviço pode começar." : "✅ Confirmado! Aguardando o outro.");
    } catch(e) { 
        console.error("Erro no acordo:", e); 
        alert("⛔ FALHA NO ACORDO:\n" + e); 
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
    if(!confirm("🏁 CONFIRMAR CONCLUSÃO E LIBERAR PAGAMENTO?\n\nEsta ação é irreversível.")) return;
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "orders", orderId);
            const configRef = doc(db, "settings", "financeiro");
            
            const [orderSnap, configSnap] = await Promise.all([
                transaction.get(orderRef),
                transaction.get(configRef)
            ]);

            const pedido = orderSnap.data();
            const config = configSnap.data() || { taxa_plataforma: 0.20 };
            
            const clientRef = doc(db, "usuarios", pedido.client_id);
            const providerRef = doc(db, "usuarios", pedido.provider_id);

            const [clientSnap, providerSnap] = await Promise.all([
                transaction.get(clientRef),
                transaction.get(providerRef)
            ]);

            // ⚡ CÁLCULO DA CASCATA (OPÇÃO A)
            const valorTotal = parseFloat(pedido.offer_value || 0);
            const reservaCliente = parseFloat(pedido.value_reserved_client || 0);
            const reservaProvider = parseFloat(pedido.value_reserved_provider || 0);
            
            let pTaxa = parseFloat(config.taxa_plataforma || 0);
            if (pTaxa > 1) pTaxa = pTaxa / 100; // Se for 20, vira 0.2 - NÃO MUDAR ISSO PONTO CRÍTICO
            const taxaPlataforma = valorTotal * pTaxa;
            const lucroLiquidoPrestador = valorTotal - taxaPlataforma;

            // 1. LIQUIDAÇÃO DO CLIENTE (Reserva sai da custódia e some)
            const cRes = parseFloat(clientSnap.data().wallet_reserved || 0);
            transaction.update(clientRef, { 
                wallet_reserved: cRes - reservaCliente 
            });
            transaction.set(doc(collection(db, "extrato_financeiro")), {
                uid: pedido.client_id, tipo: "SERVIÇO_PAGO 🏁", valor: -reservaCliente,
                descricao: `Pagamento finalizado pedido #${orderId.slice(0,5)}`, timestamp: serverTimestamp()
            });

            // 2. LIQUIDAÇÃO DO PRESTADOR (Garantia vai para Atlivio + Recebe Lucro)
            const pBal = parseFloat(providerSnap.data().wallet_balance || 0);
            const pRes = parseFloat(providerSnap.data().wallet_reserved || 0);
            const pEarn = parseFloat(providerSnap.data().wallet_earnings || 0);

            transaction.update(providerRef, {
                wallet_reserved: pRes - reservaProvider, // Garantia "some" (vai para Atlivio)
                wallet_balance: pBal + lucroLiquidoPrestador,
                wallet_earnings: pEarn + lucroLiquidoPrestador
            });

            transaction.set(doc(collection(db, "extrato_financeiro")), {
                uid: pedido.provider_id, tipo: "GANHO_SERVIÇO ⚡", valor: lucroLiquidoPrestador,
                descricao: `Recebimento pedido #${orderId.slice(0,5)} (Taxas deduzidas)`, timestamp: serverTimestamp()
            });

            // 3. FINALIZA ORDEM
            transaction.update(orderRef, { 
                status: 'completed', 
                system_step: 4,
                completed_at: serverTimestamp(),
                value_reserved_client: 0,
                value_reserved_provider: 0
            });

            transaction.set(doc(collection(db, `chats/${orderId}/messages`)), {
                text: `🏁 SERVIÇO CONCLUÍDO E PAGO. Obrigado por usar a ATLIVIO!`,
                sender_id: "system", timestamp: serverTimestamp()
            });
        });

        alert("✅ Pagamento Liberado com Sucesso!");
        window.voltarParaListaPedidos();
    } catch(e) { 
        console.error("Erro na liquidação:", e);
        alert("⛔ FALHA NA LIQUIDAÇÃO:\n" + e);
    }
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
    const step = pedido.system_step || 1;

    // 1️⃣ MODO: EM EXECUÇÃO (Cronômetro Rodando)
    if (pedido.status === 'in_progress' && pedido.real_start) {
        return `
        <div class="bg-green-600 text-white px-4 py-3 flex justify-between items-center shadow-lg border-b border-green-500">
            <div class="flex items-center gap-3">
                <span class="relative flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black uppercase tracking-tighter">Serviço em Andamento</span>
                    <div class="font-mono text-xl font-black leading-none" id="timer-display">00:00:00</div>
                </div>
            </div>
            ${isProvider ? `
                <button onclick="window.finalizarTrabalho('${orderId}')" class="bg-white text-green-700 text-[10px] font-black px-4 py-2 rounded-xl shadow-xl transform active:scale-95 transition">
                    🏁 FINALIZAR
                </button>
            ` : `<span class="text-[9px] font-bold opacity-80 uppercase text-right">Valor protegido<br>pela ATLIVIO</span>`}
        </div>`;
    }

    // 2️⃣ MODO: ACORDO FECHADO (Botão Iniciar)
    if (step === 3 && pedido.status === 'confirmed_hold') {
        return `
        <div class="bg-slate-900 text-white px-4 py-4 flex flex-col gap-3 shadow-xl">
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-[9px] text-gray-400 font-bold uppercase">Aguardando Início</p>
                    <p class="text-xs font-black text-green-400">🛡️ RESERVA DE SALDO CONFIRMADA</p>
                </div>
                <span class="text-2xl">🔐</span>
            </div>
            ${isProvider ? `
                <button onclick="window.iniciarTrabalho('${orderId}')" class="w-full bg-green-500 hover:bg-green-400 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg animate-bounce-subtle">
                    ▶ INICIAR SERVIÇO AGORA
                </button>
            ` : `
                <div class="bg-white/5 p-2 rounded-lg border border-white/10">
                    <p class="text-[10px] text-center text-gray-300 italic">O cronômetro iniciará assim que o profissional der o play.</p>
                </div>
            `}
        </div>`;
    }

    // 3️⃣ MODO: ACEITO MAS SEM ACORDO (Botão Definir Data)
    if (pedido.status === 'accepted' || step < 3) {
        return `
        <div class="bg-amber-50 border-b border-amber-100 px-4 py-2 flex justify-between items-center">
            <div class="flex items-center gap-2 text-amber-800">
                <span class="text-lg">📅</span>
                <p class="text-[10px] font-bold uppercase">Aguardando Fechamento</p>
            </div>
            ${pedido.scheduled_at ? `
                <div class="text-right">
                    <p class="text-[9px] text-gray-500 uppercase">Agendado</p>
                    <p class="text-[10px] font-black text-slate-800" id="countdown-display">--:--</p>
                </div>
            ` : `
                <button onclick="window.abrirAgendamento('${orderId}')" class="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded shadow-md">
                    DEFINIR DATA
                </button>
            `}
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
                wallet_balance: updateWallet.wallet_balance || user.wallet_balance,
                wallet_reserved: updateWallet.wallet_reserved || 0
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

// 🚑 RESTAURAÇÃO: FUNÇÃO DE DESCREVER SERVIÇO (Muda o Título)
window.novoDescreverServico = async (orderId) => {
    const novoTitulo = prompt("📝 Descreva o serviço ou mude o título:");
    if (!novoTitulo) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { service_title: novoTitulo });
        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: `📝 Atualizou a descrição para: "${novoTitulo}"`,
            sender_id: 'system',
            timestamp: serverTimestamp()
        });
    } catch (e) { console.error(e); alert("Erro ao atualizar."); }
};

window.novoEnviarProposta = async (orderId) => {
    const orderSnap = await getDoc(doc(db, "orders", orderId));
    if (!orderSnap.exists()) return;
    const pedidoData = orderSnap.data();

    // 🛡️ TRAVA DINÂMICA DE VALOR MÍNIMO
    const categoriaId = pedidoData.service_category_id || "gerais";
    const infoCategoria = (window.CATEGORIAS_ATIVAS || []).find(c => c.id === categoriaId) || { minPrice: 20 };
    const valorMinimo = infoCategoria.minPrice;

    const valorStr = prompt(`💰 VALOR DA PROPOSTA (Mínimo R$ ${valorMinimo}):`);
    if (!valorStr) return;
    const valor = parseFloat(valorStr.replace(',', '.'));

    if (isNaN(valor) || valor < valorMinimo) {
        return alert(`⛔ VALOR INVÁLIDO\nO valor mínimo permitido para este serviço é R$ ${valorMinimo.toFixed(2)}.`);
    }

    const beneficio = prompt("🎁 BENEFÍCIO EXTRA (Ex: 30min extras, Desconto, Material incluso):");
    const labelBeneficio = beneficio ? beneficio.toUpperCase() : "CONDIÇÃO ESPECIAL";

    try {
        // Atualiza o pedido e reseta as confirmações mútuas
        await updateDoc(doc(db, "orders", orderId), {
            offer_value: valor,
            offer_bonus: beneficio || "",
            provider_confirmed: false, 
            client_confirmed: false
        });

        // 🎨 VISUAL PREMIUM RETA (ALTA CONVERSÃO)
        const htmlProposta = `
            <div class="my-4 border border-blue-100 rounded-2xl overflow-hidden shadow-xl bg-white animate-fadeIn" style="transform: rotate(0deg) !important;">
                <div class="bg-slate-900 text-white text-[9px] font-black text-center py-2 uppercase tracking-[0.2em]">
                    💎 Nova Proposta Comercial
                </div>
                <div class="p-6 text-center">
                    <p class="text-slate-400 text-[10px] uppercase font-bold mb-1">Investimento Total</p>
                    <div class="flex justify-center items-center gap-1 text-slate-900">
                        <span class="text-xl font-bold">R$</span>
                        <span class="text-5xl font-black tracking-tighter">${valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="mt-4 py-2 px-4 bg-blue-50 border border-blue-100 rounded-xl inline-flex items-center gap-2">
                        <span class="text-lg">🎁</span>
                        <p class="text-blue-700 text-[10px] font-black uppercase tracking-tight">${labelBeneficio}</p>
                    </div>
                    <div class="mt-5 pt-4 border-t border-slate-50">
                        <p class="text-[10px] text-slate-500 leading-relaxed font-medium">
                            Para aceitar este valor e garantir o compromisso, clique no botão <b>🤝 ACEITAR E FECHAR</b> localizado no topo ou no banner de etapa deste chat.
                        </p>
                    </div>
                </div>
            </div>
        `;

        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: htmlProposta,
            sender_id: 'system',
            timestamp: serverTimestamp()
        });
        
        console.log("✅ Proposta V12 Premium enviada com sucesso.");
    } catch (e) { 
        console.error("Erro proposta:", e);
        alert("Erro ao processar proposta."); 
    }
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

// 🚨 CORREÇÃO CRÍTICA: EXPORTANDO A NOVA FUNÇÃO PRINCIPAL
// ============================================================================
// 🛠️ MÓDULO DE SUPORTE, GATILHOS E UTILITÁRIOS CHAT V12
// ============================================================================

window.sugerirFrase = (msg) => {
    const input = document.getElementById('chat-input-msg');
    if (input) {
        input.value = msg;
        input.focus();
    }
};

window.verPerfilCompleto = (uid) => {
    console.log("🔍 Solicitando Perfil Completo:", uid);
    if (window.switchTab && window.carregarPerfilPublico) {
        window.carregarPerfilPublico(uid);
    } else {
        // Fallback caso o módulo de perfil ainda não tenha injetado a função global
        alert("📊 Reputação Atlivio: Este profissional possui 100% de entregas garantidas pelo sistema.");
    }
};

window.atualizarCronometro = (pedido) => atualizarRelogioDOM(pedido);

// ✋ AÇÃO: ENCERRAR CONVERSA (Botão do Topo)
window.encerrarNegociacao = async (orderId) => {
    if(!confirm("✋ ENCERRAR NEGOCIAÇÃO?\n\nEste chat será arquivado e a solicitação cancelada.\nConfirmar?")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'negotiation_closed',
            closed_at: serverTimestamp() 
        });
        alert("Conversa encerrada.");
        window.voltarParaListaPedidos();
    } catch(e) { 
        console.error("Erro ao encerrar:", e); 
    }
};

// 💡 GATILHOS CONTEXTUAIS (ASSISTENTE SILENCIOSO)
let timerLembreteInatividade = null; 

export function iniciarGatilhosContextuais(orderId, step) {
    if (timerLembreteInatividade) clearTimeout(timerLembreteInatividade);
    if (step >= 3) return; // Não envia dicas se o acordo já fechou

    timerLembreteInatividade = setTimeout(async () => {
        const container = document.getElementById('bubbles-area');
        if (!container) return;
        
        const dicaHtml = `
            <div class="flex justify-center my-4 animate-fadeIn">
                <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl max-w-[80%] text-center shadow-sm">
                    <p class="text-[10px] text-amber-800 font-bold uppercase mb-1">💡 Dica ATLIVIO:</p>
                    <p class="text-[11px] text-amber-900 leading-tight">
                        Serviços com reserva confirmada têm prioridade total na agenda. 
                        A reserva protege você contra imprevistos.
                    </p>
                </div>
            </div>`;
            
        container.insertAdjacentHTML('beforeend', dicaHtml);
        const divMsgs = document.getElementById('chat-messages');
        if(divMsgs) divMsgs.scrollTop = divMsgs.scrollHeight;
        
        console.log("💡 Gatilho Contextual ativado.");
    }, 180000); // 3 minutos
}

window.exibirAlertaSegurancaReserva = () => {
    alert("🔐 PROTEÇÃO ATLIVIO:\n\nAo fechar o acordo, o valor da garantia fica guardado com a plataforma e só é liberado ao profissional após você confirmar que o serviço foi concluído.");
};
window.confirmarEncerramentoChat = async (orderId) => {
    if(!confirm("✋ DESEJA ENCERRAR ESTE CHAT?\n\nEle será movido para o histórico e as negociações serão interrompidas.")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'negotiation_closed', 
            closed_at: serverTimestamp() 
        });
        alert("Conversa encerrada.");
        window.voltarParaListaPedidos();
    } catch(e) { console.error("Erro ao encerrar:", e); }
};
