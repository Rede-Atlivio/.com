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
// 🚨 FASE 6: ACORDO MÚTUO E RESERVA (VERSÃO COFRE/ESCROW V2 - CORRIGIDA)
// ============================================================================
export async function confirmarAcordo(orderId, aceitar) {
    if(!aceitar) return alert("Negociação continua.");
    
    const uid = auth.currentUser.uid;
    const orderRef = doc(db, "orders", orderId);

    try {
        // --- 1. BUSCA OBRIGATÓRIA DAS REGRAS DO SEU PAINEL ADMIN ---
        let configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if(!configSnap.exists()) configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
        
        // Configuração padrão de segurança
        const configDefault = { porcentagem_reserva: 10, limite_divida: -60.00 };
        const config = configSnap.exists() ? configSnap.data() : configDefault;
        
        // --- 2. TRAVA DE PRIORIDADE: VALIDAÇÃO DINÂMICA POR PERFIL (V11.0) ---
        const pedidoSnap = await getDoc(orderRef);
        const pedido = pedidoSnap.data();
        const valorTotalPedido = parseFloat(String(pedido.offer_value).replace(',', '.')) || 0;
        
        const isMeProvider = uid === pedido.provider_id;
        const isMeClient = uid === pedido.client_id;

        // 🛡️ REGRAS DO ADMIN (Carregadas da Memória Unificada)
        const cfgMaster = window.configFinanceiroAtiva || config; 
        
        let valorNecessarioParaConfirmar = 0;
        let pctAplicada = 0;

        if (isMeProvider) {
            // Prestador usa a % de reserva do prestador e respeita o limite de -60
            pctAplicada = cfgMaster.porcentagem_reserva || 20;
            valorNecessarioParaConfirmar = valorTotalPedido * (pctAplicada / 100);
            
            const userSnap = await getDoc(doc(db, "usuarios", uid));
            const saldoAtual = parseFloat(userSnap.data()?.wallet_balance || 0);
            const limiteCredito = parseFloat(cfgMaster.limite_divida || -60);

            if ((saldoAtual - valorNecessarioParaConfirmar) < limiteCredito) {
                alert(`⛔ SALDO INSUFICIENTE (PRESTADOR)\n\nEste serviço exige R$ ${valorNecessarioParaConfirmar.toFixed(2)} de reserva.\nSeu limite de crédito não cobre este valor.`);
                if(window.switchTab) window.switchTab('ganhar');
                return;
            }
        } 
        else if (isMeClient) {
            // Cliente usa a % de reserva do cliente e PRECISA ter saldo real (não tem limite negativo)
            pctAplicada = cfgMaster.porcentagem_reserva_cliente || 10;
            valorNecessarioParaConfirmar = valorTotalPedido * (pctAplicada / 100);

            const userSnap = await getDoc(doc(db, "usuarios", uid));
            const saldoAtual = parseFloat(userSnap.data()?.wallet_balance || 0);

            if (saldoAtual < valorNecessarioParaConfirmar) {
                alert(`⛔ SALDO INSUFICIENTE (CLIENTE)\n\nPara fechar este acordo, você precisa de R$ ${valorNecessarioParaConfirmar.toFixed(2)} em saldo (Garantia de ${pctAplicada}%).\n\nPor favor, recarregue sua carteira.`);
                if(window.switchTab) window.switchTab('ganhar');
                return;
            }
        }

        // 🛡️ TRAVA PRESTADOR (Cheque Especial)
        if (isMeProvider) {
            const userSnap = await getDoc(doc(db, "usuarios", uid));
            const saldoAtual = parseFloat(userSnap.data()?.wallet_balance || userSnap.data()?.saldo || 0);
            const LIMITE_DEBITO = parseFloat(config.limite_divida || -60.00); 
            
            const estimativaTaxa = valorTotalPedido * 0.20;
            
            if ((saldoAtual - estimativaTaxa) < LIMITE_DEBITO) {
                alert(`⛔ LIMITE DE CRÉDITO EXCEDIDO\n\nPara aceitar este serviço, você precisa de saldo.\nLimite: R$ ${LIMITE_DEBITO.toFixed(2)}.\n\nPor favor, recarregue sua carteira.`);
                if(window.switchTab) window.switchTab('ganhar');
                return;
            }
        }

        // ⚡ VARIÁVEL DE CONTROLE EXTERNA (CORREÇÃO DO ERRO)
        let vaiFecharAgora = false;

        // --- 3. EXECUÇÃO DA TRANSAÇÃO (O COFRE) ---
        await runTransaction(db, async (transaction) => {
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw "Pedido não encontrado!";
            
            const clientRef = doc(db, "usuarios", pedido.client_id);
            const clientSnap = await transaction.get(clientRef);

            // Verifica quem está clicando
            const isProvider = uid === pedido.provider_id;
            const campoUpdate = isProvider ? { provider_confirmed: true } : { client_confirmed: true };
            
            // Verifica se este clique fecha o acordo (se o outro já confirmou)
            const oOutroJaConfirmou = isProvider ? orderSnap.data().client_confirmed : orderSnap.data().provider_confirmed;
            vaiFecharAgora = oOutroJaConfirmou; // Atualiza a variável externa

            transaction.update(orderRef, campoUpdate);

            if (vaiFecharAgora) {
                // SE O ACORDO FECHOU, O CLIENTE PAGA A RESERVA AGORA
                if (!clientSnap.exists()) throw "Cliente não encontrado para cobrança.";
                
                const saldoClienteAtual = parseFloat(clientSnap.data().wallet_balance || clientSnap.data().saldo || 0);

                // Validação final de segurança do cliente
                if (saldoClienteAtual < valorReserva) {
                    throw `Saldo insuficiente do Cliente para a reserva (R$ ${valorReserva.toFixed(2)}).`;
                }

                // 🏦 MOVIMENTO FINANCEIRO: CARTEIRA -> COFRE (Held)
                transaction.update(clientRef, {
                    wallet_balance: saldoClienteAtual - valorReserva,
                    wallet_reserved: (clientSnap.data().wallet_reserved || 0) + valorReserva,
                    saldo: saldoClienteAtual - valorReserva // Mantém sincronia legado
                });

                transaction.update(orderRef, { 
                    system_step: 3, 
                    status: 'confirmed_hold',
                    value_reserved: valorReserva,
                    confirmed_at: serverTimestamp()
                });

                const msgRef = doc(collection(db, `chats/${orderId}/messages`));
                transaction.set(msgRef, {
                    text: `🔒 RESERVA CONFIRMADA: R$ ${valorReserva.toFixed(2)} foram para a custódia. Contato liberado!`,
                    sender_id: "system",
                    timestamp: serverTimestamp()
                });
            }
        });
        
        // Agora a variável existe aqui fora!
        alert(vaiFecharAgora ? "✅ Acordo Fechado! O valor foi reservado." : "✅ Confirmado! Aguardando a outra parte.");
    
    } catch(e) { 
        console.error("Erro no acordo:", e);
        const erroTexto = String(e);

        if (erroTexto.includes("Saldo insuficiente")) {
            const pedidoSnap = await getDoc(orderRef);
            const pedido = pedidoSnap.data();
            if (auth.currentUser.uid === pedido.client_id) {
                if (confirm(`⚠️ VOCÊ ESTÁ SEM SALDO\n\nA reserva é de R$ ${valorReserva.toFixed(2)}.\nDeseja recarregar agora?`)) {
                    if(window.switchTab) window.switchTab('ganhar');
                }
            } else {
                alert("⏳ O Cliente precisa recarregar para cobrir a reserva.");
            }
        } else {
            alert("⚠️ " + e);
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

// ============================================================================
// 4. AÇÕES FINAIS E EXPOSIÇÃO GLOBAL
// ============================================================================
window.finalizarServicoPassoFinalAction = async (orderId) => {
    if(!confirm("Confirma a conclusão do serviço?\n\nAo confirmar, o valor reservado será liberado para o prestador (descontando as taxas) e o pedido será encerrado.")) return;
    
    try {
        // 1. Busca Taxa Atual do Admin
        let configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if(!configSnap.exists()) configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
        
        // Padrão 20% se der erro
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

            // VALORES
            const valorReservado = parseFloat(pedido.value_reserved || 0); // O que está no cofre (Ex: R$ 20,00)
            const valorTotal = parseFloat(pedido.offer_value || 0); // Valor do serviço (Ex: R$ 200,00)
            const valorTaxa = valorTotal * taxaPercent; // Taxa do Atlivio (Ex: R$ 40,00)
            
            // CÁLCULO FINAL DA TRANSFERÊNCIA (V10.0 CORRIGIDA)
            // O Cliente já pagou a Reserva (ex: R$ 20). 
            // Agora, o Prestador deve receber o valor TOTAL do serviço (ex: R$ 200) 
            // MENOS a taxa da plataforma (ex: 20% de 200 = R$ 40).
            // No final, o prestador recebe R$ 160 de lucro real.
            
            const valorLiquidoParaPrestador = valorTotal - valorTaxa;

            // Log de auditoria para o console (ajuda a debugar se a matemática bater)
            console.log(`💰 Cálculo: Total(${valorTotal}) - Taxa(${valorTaxa}) = Líquido(${valorLiquidoParaPrestador})`);

            // 1. ATUALIZA CLIENTE: Esvazia a reserva deste pedido
            if (clientSnap.exists()) {
                const currentReserved = parseFloat(clientSnap.data().wallet_reserved || 0);
                // Garante que não fique negativo por erro de arredondamento
                const novaReserva = Math.max(0, currentReserved - valorReservado);
                transaction.update(clientRef, { wallet_reserved: novaReserva });
            }

            // 2. ATUALIZA PRESTADOR: Aplica o valor líquido na carteira
            if (providerSnap.exists()) {
                const currentBalance = parseFloat(providerSnap.data().wallet_balance || providerSnap.data().saldo || 0);
                const newBalance = currentBalance + valorLiquidoParaPrestador;
                
                transaction.update(providerRef, { 
                    wallet_balance: newBalance,
                    saldo: newBalance 
                });
                
                // Mantém sync com a tabela de prestadores ativos
                transaction.update(activeProvRef, { balance: newBalance });
            }

            // 3. ATUALIZA PEDIDO: Finaliza
            transaction.update(orderRef, {
                status: 'completed',
                completed_at: serverTimestamp(),
                final_tax_paid: valorTaxa,
                final_amount_released: valorLiquidoParaPrestador
            });

            // 4. GERA EXTRATO (Histórico)
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
        console.error(e);
        alert("Erro ao finalizar: " + e.message);
    }
};

window.reportarProblema = async (orderId) => {
    const motivo = prompt("Descreva o problema:");
    if(!motivo) return;
    await updateDoc(doc(db, "orders", orderId), { status: 'dispute', dispute_reason: motivo, dispute_at: serverTimestamp() });
    alert("🚨 Suporte acionado.");
};

// Removemos as declarações simplistas e conectamos aos motores reais que você já tem no arquivo
window.voltarParaListaPedidos = () => {
    const chatIndiv = document.getElementById('painel-chat-individual');
    const listaPed = document.getElementById('painel-pedidos');
    if(chatIndiv) chatIndiv.classList.add('hidden');
    if(listaPed) listaPed.classList.remove('hidden');
};

// Conecta os gatilhos globais às versões robustas (async) que já estão no topo/meio do arquivo
window.executarDescricao = (id) => window.novoDescreverServico(id);
window.executarProposta = (id) => window.novoEnviarProposta(id);
