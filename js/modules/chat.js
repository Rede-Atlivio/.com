// ============================================================================
// js/modules/chat.js - ATUALIZAÇÃO 1: CONEXÃO CENTRALIZADA
// ============================================================================

// 1. IMPORTAÇÃO DO MOTOR CENTRAL (Aqui você usa a conexão oficial do Atlivio)
import { db, auth } from '../config.js'; 

// 2. FERRAMENTAS DO FIREBASE
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO GLOBAL ---
window.irParaChat = () => {
    const tab = document.getElementById('tab-chat');
    if(tab) tab.click();
    carregarPedidosAtivos();
    window.scrollTo(0,0);
};

// Conecta as funções com os botões do HTML (Mata o erro "not defined")
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

// Função que o botão ⏰ Horário chama:
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
    
    // Barras de Progresso
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
                        <button onclick="window.sugerirDetalhe('${orderId}', 'Horário')" class="bg-white px-3 py-2 rounded-xl text-[10px] border border-gray-200 font-bold text-gray-600 shadow-sm">
                            ⏰ Horário
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
                        class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition border border-transparent focus:border-blue-200">
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
        
        // 🛡️ LÓGICA DINÂMICA V11.0: Pega a regra real do Admin para o banner
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0 };
        const pct = isProvider ? config.porcentagem_reserva : config.porcentagem_reserva_cliente;
        const valorAcordo = parseFloat(pedido.offer_value) || 0;
        const reservaCalculada = valorAcordo * (pct / 100);

        return `<div class="bg-white border border-gray-100 p-5 rounded-2xl shadow-xl mb-4 mx-4 relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
            <p class="text-sm font-black text-gray-800 mb-1">🤝 Fechar Acordo?</p>
            <p class="text-xs text-gray-500 mb-4">Confirme se o valor e os detalhes estão certos.</p>
            
            <div class="flex gap-3 mb-4">
                <button onclick="window.confirmarAcordo('${orderId}', true)" class="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wide shadow-md hover:bg-blue-700 transition">✅ ACEITAR E FECHAR</button>
            </div>
            
            <div class="${reservaCalculada > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'} border p-2 rounded-lg flex gap-2 items-start">
                <span class="${reservaCalculada > 0 ? 'text-amber-500' : 'text-green-500'} text-xs mt-0.5">${reservaCalculada > 0 ? '🔒' : '✅'}</span>
                <p class="${reservaCalculada > 0 ? 'text-amber-800' : 'text-green-800'} text-[9px] font-medium leading-tight">
                    <strong>SISTEMA ATLIVIO:</strong> ${reservaCalculada > 0 
                        ? `Ao confirmar, o sistema reserva <strong>R$ ${reservaCalculada.toFixed(2)} (${pct}%)</strong> como garantia.` 
                        : `Sua taxa para este acordo está <strong>ZERADA (0%)</strong> pelo Admin.`}
                </p>
            </div>
        </div>`;
    }
    if (step === 3) return `<div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center mb-4 mx-4 shadow-sm"><p class="text-sm font-black text-emerald-800 uppercase">✨ Acordo Confirmado!</p><p class="text-[10px] text-emerald-600 mt-1">Contato liberado no topo da tela.</p></div>`;
    return "";
}

// ============================================================================
// 3. LOGICA DE FILTRO E MENSAGENS (CAMADA TITAN - COM RISK SCORE)
// ============================================================================
export async function enviarMensagemChat(orderId, step) {
    const input = document.getElementById('chat-input-msg');
    let texto = input.value.trim();
    if(!texto) return;

    // 🔒 TRAVA ZERO: O PRESTADOR SÓ FALA SE TIVER ACEITO O PEDIDO
    // (Impede o furo de conversar sem ter saldo para aceitar)
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
            const pedido = orderSnap.data();
            const souPrestador = auth.currentUser.uid === pedido.provider_id;
            
            // Se sou prestador e o status ainda é 'pending' (não aceitei/paguei), BLOQUEIA.
            if (souPrestador && pedido.status === 'pending') {
                alert("⛔ AÇÃO BLOQUEADA\n\nVocê precisa ACEITAR a solicitação (e ter saldo) antes de enviar mensagens.");
                input.value = "";
                // Tenta reabrir o Radar se a função estiver disponível
                if(window.recuperarPedidoRadar) window.recuperarPedidoRadar(orderId);
                return;
            }
        }
    } catch(e) { console.error("Erro verificação status chat:", e); }

    // 🔒 TRAVA BLINDADA 1: Verifica antecedentes criminais antes de enviar
    // Se o risco for alto (>= 50), nem processa a mensagem.
    try {
        const userRef = doc(db, "usuarios", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && (userSnap.data().risk_score || 0) >= 50) {
            alert("🚫 CONTA RESTRITA: Seu nível de risco está alto devido a infrações anteriores.\n\nO chat está temporariamente bloqueado para análise.");
            input.value = "";
            return;
        }
    } catch (e) { console.log("Erro verificação risco:", e); }

    // --- 🛡️ MODERAÇÃO ATIVA (Nível 1 - Palavras) ---
    if (step < 3) {
        const blacklist = ["porra", "caralho", "fdp", "puta", "viado", "lixo", "merda", "golpe", "ladrão", "idiota"];
        const proibidas = ["whatsapp", "zap", "fone", "contato", "meuchama", "porfora", "diretocomigo", "pix", "pagar por fora", "99", "98", "97"];
        
        const textoLimpo = texto.toLowerCase().replace(/[.\-_ @]/g, "");
        const temNumeroSuspeito = /\d{4,}/.test(textoLimpo);
        
        const encontrouOfensa = blacklist.some(p => texto.toLowerCase().includes(p));
        const encontrouEvasao = proibidas.some(p => textoLimpo.includes(p));

        if (encontrouOfensa || (temNumeroSuspeito && encontrouEvasao) || encontrouEvasao) {
            console.log("🛡️ Moderação: Infração detectada. Registrando risco...");
            await registrarRisco(auth.currentUser.uid, encontrouOfensa ? 'ofensa' : 'tentativa_evasao');
            alert("🚫 MENSAGEM BLOQUEADA PELO SISTEMA DE SEGURANÇA.\n\nDetectamos tentativa de contato externo ou linguagem inadequada.");
            input.value = ""; 
            return;
        }
    }

    // Envio normal
    input.value = "";
    try {
        await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: texto, 
            sender_id: auth.currentUser.uid, 
            timestamp: serverTimestamp() 
        });
    } catch (e) {
        console.error("Erro msg:", e);
        alert("Erro de conexão.");
    }
}
// 🛡️ FUNÇÃO AUXILIAR: REGISTRO DE RISCO (NOVA)
async function registrarRisco(uid, tipo) {
    try {
        const userRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const atualScore = userSnap.data().risk_score || 0;
            const novoScore = atualScore + (tipo === 'ofensa' ? 20 : 10); // Ofensa pesa mais
            
            // Atualiza o risco e data da última infração
            await updateDoc(userRef, {
                risk_score: novoScore,
                last_infraction: serverTimestamp()
            });
            
            // Se passar de 50 pontos, poderia disparar um bloqueio automático aqui no futuro (Pilar 3)
            if(novoScore >= 50) console.warn("⚠️ ALERTA DE RISCO ALTO PARA O USUÁRIO:", uid);
        }
    } catch (e) {
        console.error("Falha ao registrar risco (silencioso):", e);
    }
}

// --- NOVAS FUNÇÕES DE GUIAR O USUÁRIO ---

window.novoDescreverServico = async (orderId) => {
    const oQue = prompt("1. O que precisa ser feito? (Seja breve)");
    if(!oQue) return;
    
    const onde = prompt("2. Local exato ou Bairro:");
    if(!onde) return;

    const duracao = prompt("3. Duração estimada (Ex: 2 horas):");
    
    const msgFinal = `📦 SERVIÇO DETALHADO:\n• O que: ${oQue}\n• Local: ${onde}\n• Tempo: ${duracao || 'A combinar'}`;
    
    await enviarMsgSistema(orderId, msgFinal);
};

window.novoEnviarProposta = async (orderId) => {
    const valorStr = prompt("💰 Qual o VALOR FINAL do serviço? (Apenas números)");
    if(!valorStr) return;
    
    const incluso = prompt("🛠️ O que está incluso nesse valor?");
    if(!incluso) return;

    const obs = prompt("📝 Alguma observação? (Opcional)");

    const msgFinal = `🎯 PROPOSTA OFICIAL:\n• Valor Total: R$ ${valorStr}\n• Incluso: ${incluso}\n${obs ? `• Obs: ${obs}` : ''}\n\n👉 Se concordar, confirme no botão acima.`;
    
    await enviarMsgSistema(orderId, msgFinal);
};

// Função auxiliar para enviar sem passar pelo filtro de bloqueio (pois é gerado pelo sistema)
async function enviarMsgSistema(orderId, texto) {
    try {
        await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: texto, 
            sender_id: auth.currentUser.uid, 
            timestamp: serverTimestamp(),
            is_structured: true // Flag para identificar msg bonitinha
        });
    } catch (e) {
        alert("Erro ao enviar.");
    }
}

// ============================================================================
// 🚨 FASE 6: ACORDO MÚTUO E RESERVA (VERSÃO V11.0 - SANEAMENTO TOTAL)
// ============================================================================
export async function confirmarAcordo(orderId, aceitar) {
    if(!aceitar) return alert("Negociação continua.");
    
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);

    try {
        // --- 1. CAPTURA DE CONFIGURAÇÕES (Prioridade à Memória Global Real-Time) ---
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0, limite_divida: -60.00 };
        
        const pedidoSnap = await getDoc(orderRef);
        if (!pedidoSnap.exists()) return alert("Pedido não encontrado.");
        const pedido = pedidoSnap.data();
        const valorPedido = parseFloat(String(pedido.offer_value).replace(',', '.')) || 0;
        
        const isMeProvider = uid === pedido.provider_id;
        const isMeClient = uid === pedido.client_id;

        // --- 2. CÁLCULO DA RESERVA POR PERFIL ---
        const pctAplicada = isMeProvider ? (config.porcentagem_reserva ?? 0) : (config.porcentagem_reserva_cliente ?? 0);
        const valorReservaNecessaria = valorPedido * (pctAplicada / 100);

        // --- 3. TRAVA DE SALDO (SÓ BLOQUEIA SE A TAXA FOR MAIOR QUE ZERO) ---
        if (valorReservaNecessaria > 0) {
            const userSnap = await getDoc(doc(db, "usuarios", uid));
            const saldoAtual = parseFloat(userSnap.data()?.wallet_balance || 0);

            if (isMeProvider) {
                const limiteDebito = parseFloat(config.limite_divida || -60);
                if ((saldoAtual - valorReservaNecessaria) < limiteDebito) {
                    alert(`⛔ SALDO INSUFICIENTE (PRESTADOR)\n\nReserva necessária: R$ ${valorReservaNecessaria.toFixed(2)}.\nRecarregue para fechar o acordo.`);
                    if(window.switchTab) window.switchTab('ganhar');
                    return;
                }
            } else if (isMeClient) {
                if (saldoAtual < valorReservaNecessaria) {
                    alert(`⛔ SALDO INSUFICIENTE (CLIENTE)\n\nEste acordo requer R$ ${valorReservaNecessaria.toFixed(2)} de saldo real.\n\nRecarregue sua carteira para fechar.`);
                    if(window.switchTab) window.switchTab('ganhar');
                    return;
                }
            }
        }

       // --- 5. EXECUÇÃO DA TRANSAÇÃO NO COFRE (ORDEM CORRETA: LEITURAS -> ESCRITAS) ---
        let vaiFecharAgora = false;

        await runTransaction(db, async (transaction) => {
            // 1. TODAS AS LEITURAS PRIMEIRO (Obrigatório pelo Firebase)
            const freshOrderSnap = await transaction.get(orderRef);
            if (!freshOrderSnap.exists()) throw "Pedido não encontrado!";
            const freshOrder = freshOrderSnap.data();

            const clientRef = doc(db, "usuarios", freshOrder.client_id);
            const clientSnap = await transaction.get(clientRef);
            if (!clientSnap.exists()) throw "Perfil do cliente não encontrado.";

            // 2. LÓGICA DE DECISÃO (Sem mexer no banco ainda)
            const campoUpdate = isMeProvider ? { provider_confirmed: true } : { client_confirmed: true };
            const oOutroJaConfirmou = isMeProvider ? freshOrder.client_confirmed : freshOrder.provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou;

            // 3. TODAS AS ESCRITAS POR ÚLTIMO
            transaction.update(orderRef, campoUpdate);

            if (vaiFecharAgora) {
                const saldoClient = parseFloat(clientSnap.data()?.wallet_balance || 0);
                const taxaClienteAdmin = Number(config.porcentagem_reserva_cliente) || 0;
                const valorCofre = valorPedido * (taxaClienteAdmin / 100);

                if (valorCofre > 0 && saldoClient < valorCofre) {
                    throw `Saldo insuficiente (R$ ${saldoClient.toFixed(2)}) para reserva de R$ ${valorCofre.toFixed(2)}`;
                }

                // 🏦 Gravações Finais
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
                    text: valorCofre > 0 
                        ? `🔒 ACORDO FECHADO: R$ ${valorCofre.toFixed(2)} em garantia.` 
                        : `🔒 ACORDO FECHADO: Taxa zero aplicada.`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });
                const saldoClient = parseFloat(clientSnap.data()?.wallet_balance || 0);
                
                // Recalcula o que o cliente REALMENTE deve deixar no cofre baseado no Admin
                const taxaClienteAdmin = config.porcentagem_reserva_cliente ?? 0;
                const valorCofre = valorPedido * (taxaClienteAdmin / 100);

                if (valorCofre > 0 && saldoClient < valorCofre) throw "Erro: Cliente sem saldo no ato do fechamento.";

                // 🏦 MOVIMENTO FINANCEIRO: CARTEIRA -> COFRE
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
                    text: `🔒 ACORDO FECHADO: ${valorCofre > 0 ? `R$ ${valorCofre.toFixed(2)} em garantia.` : 'Taxa zero aplicada.'} Contato liberado!`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });
        
        alert(vaiFecharAgora ? "✅ Acordo Fechado! Contato Liberado." : "✅ Confirmado! Aguardando a outra parte.");

    } catch(e) { 
        console.error("Erro fatal no acordo:", e);
        alert("⚠️ Falha: " + e);
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

// ============================================================================
// 4. AÇÕES FINAIS E EXPOSIÇÃO GLOBAL (V11.0 SANEADO)
// ============================================================================
window.finalizarServicoPassoFinalAction = async (orderId) => {
    if(!confirm("Confirma a conclusão do serviço?\n\nAo confirmar, o valor reservado será liberado para o prestador (descontando as taxas) e o pedido será encerrado.")) return;
    
    try {
        // 1. Busca Taxa Atual do Admin
        let configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if(!configSnap.exists()) configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
        
        const taxaPercent = configSnap.exists() && configSnap.data().taxa_plataforma !== undefined 
            ? parseFloat(configSnap.data().taxa_plataforma) 
            : 0.20;

        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "orders", orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw "Pedido não encontrado.";
            
            const pedido = orderSnap.data();
            if (pedido.status !== 'confirmed_hold') throw "Este pedido não está em fase de liberação (Status incorreto).";

            const clientRef = doc(db, "usuarios", pedido.client_id);
            const providerRef = doc(db, "usuarios", pedido.provider_id);
            const activeProvRef = doc(db, "active_providers", pedido.provider_id);

            const clientSnap = await transaction.get(clientRef);
            const providerSnap = await transaction.get(providerRef);

            const valorReservado = parseFloat(pedido.value_reserved || 0);
            const valorTotal = parseFloat(pedido.offer_value || 0);
            const valorTaxa = valorTotal * taxaPercent;
            
            const valorLiquidoParaPrestador = valorTotal - valorTaxa;

            console.log(`💰 Cálculo Final: Total(${valorTotal}) - Taxa(${valorTaxa}) = Líquido(${valorLiquidoParaPrestador})`);

            // 1. ATUALIZA CLIENTE: Esvazia a reserva deste pedido
            if (clientSnap.exists()) {
                const currentReserved = parseFloat(clientSnap.data().wallet_reserved || 0);
                const novaReserva = Math.max(0, currentReserved - valorReservado);
                transaction.update(clientRef, { wallet_reserved: novaReserva });
            }

            // 2. ATUALIZA PRESTADOR: Aplica o valor líquido na carteira
            if (providerSnap.exists()) {
                const currentBalance = parseFloat(providerSnap.data().wallet_balance || 0);
                const newBalance = currentBalance + valorLiquidoParaPrestador;
                
                transaction.update(providerRef, { 
                    wallet_balance: newBalance,
                    saldo: newBalance 
                });
                
                transaction.update(activeProvRef, { balance: newBalance });
            }

            // 3. ATUALIZA PEDIDO: Finaliza
            transaction.update(orderRef, {
                status: 'completed',
                completed_at: serverTimestamp(),
                final_tax_paid: valorTaxa,
                final_amount_released: valorLiquidoParaPrestador
            });

            // 4. GERA EXTRATO
            const histRef = doc(collection(db, "transactions"));
            transaction.set(histRef, {
                order_id: orderId,
                provider_id: pedido.provider_id,
                client_id: pedido.client_id,
                type: 'release_escrow',
                amount_reserved: valorReservado,
                platform_fee: valorTaxa,
                net_transfer: valorLiquidoParaPrestador,
                description: `Finalização Pedido: ${pedido.service_title || 'Serviço'}`,
                created_at: serverTimestamp()
            });
        });

        alert("✅ Serviço finalizado com sucesso!\nValores transferidos.");
        window.voltarParaListaPedidos();

    } catch(e) {
        console.error("Erro ao finalizar:", e);
        alert("Erro ao finalizar: " + e.message);
    }
};

window.reportarProblema = async (orderId) => {
    const motivo = prompt("Descreva o problema:");
    if(!motivo) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'dispute', 
            dispute_reason: motivo, 
            dispute_at: serverTimestamp() 
        });
        alert("🚨 Suporte acionado. O dinheiro está bloqueado para análise.");
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
