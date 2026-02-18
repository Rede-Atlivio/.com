// ============================================================================
// js/modules/chat.js - ATUALIZAÇÃO V11.0 (SANEAMENTO E NOMENCLATURA)
// ============================================================================

import { db, auth } from '../config.js'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO GLOBAL ---
let unsubscribeChat = null; // 🔑 CHAVE PARA TROCAR DE CHAT SEM BUG
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
window.finalizarServicoPassoFinal = (id) => finalizarServicoPassoFinalAction(id);
window.voltarParaListaPedidos = () => {
    document.getElementById('painel-chat-individual')?.classList.add('hidden');
    const painelLista = document.getElementById('painel-pedidos');
    if(painelLista) painelLista.classList.remove('hidden');
};

// 🔄 ROLAGEM INTELIGENTE V15 (Blindagem Desktop/Mobile)
window.rolarChatParaBaixo = () => {
    const area = document.getElementById('chat-messages');
    if (area) {
        // Timeout de 100ms garante que as novas mensagens já foram renderizadas no DOM
        setTimeout(() => {
            area.scrollTo({
                top: area.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }
};

window.sugerirDetalhe = (orderId, campo) => {
    const input = document.getElementById('chat-input-msg');
    if(!input) return;
    input.value = campo === 'Horário' ? "Qual o melhor horário para você?" : "Pode confirmar o local?";
    input.focus();
};

// 🔄 RENOMEADA PARA EVITAR CONFLITO COM REQUEST.JS

export async function abrirChatPedido(orderId) {
    // ✋ Desconecta o chat anterior se houver um aberto
    if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }

    let painelChat = document.getElementById('painel-chat-individual');
    
    // Limpeza visual imediata para evitar "fantasma" do chat anterior
    const areaMensagens = document.getElementById('chat-messages');
    const areaBubbles = document.getElementById('bubbles-area');
    if (areaBubbles) areaBubbles.innerHTML = ""; 
    
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
    unsubscribeChat = onSnapshot(pedidoRef, (snap) => {
        if (!snap.exists()) return;
        const pedido = snap.data();
        const isProvider = pedido.provider_id === auth.currentUser.uid;
        const step = pedido.system_step || 1;

        if (typeof window.atualizarCronometro === 'function') {
            window.atualizarCronometro(pedido);
        }

  iniciarGatilhosContextuais(orderId, step);

        // 🚀 GATILHO DE LIQUIDAÇÃO AUTOMÁTICA (ATLIVIO V47 - TRAVA DE DUPLICIDADE)
        if (step === 3 && pedido.status === 'in_progress' && pedido.real_start && !isProvider) {
            const inicioMs = pedido.real_start.toDate ? pedido.real_start.toDate().getTime() : new Date(pedido.real_start).getTime();
            const dozeHorasMs = 12 * 60 * 60 * 1000;
            
            if (Date.now() - inicioMs >= dozeHorasMs) {
                console.log("⚠️ PRAZO EXPIRADO (PRESTADOR): Executando auto-pagamento.");
                if(window.finalizarServicoPassoFinalAction) {
                    window.finalizarServicoPassoFinalAction(orderId); 
                }
            }
        }

        renderizarEstruturaChat(painelChat, pedido, isProvider, orderId, step);
        
        // 📡 ATIVAÇÃO WHATSAPP: Inicia escuta do parceiro e marca você como online
        const uidPartner = isProvider ? pedido.client_id : pedido.provider_id;
        window.escutarPresenca(uidPartner);
        window.atualizarMeuStatus('online');

        // 🛡️ EDUCAÇÃO INICIAL: Mostra regras se for o primeiro acesso
        verificarOnboardingChat(auth.currentUser.uid);
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
                          <div class="flex items-center gap-1.5">
                                <h3 class="font-black text-xs text-gray-800 uppercase italic leading-none hover:text-blue-600 transition">${outroNome}</h3>
                                <div id="status-indicador-${uidPartner}" class="w-1.5 h-1.5 rounded-full bg-gray-300 shadow-[0_0_5px_rgba(0,0,0,0.1)]"></div>
                            </div>
                            <p id="status-texto-${uidPartner}" class="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-tighter italic">offline</p>  
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${contatoLiberado ? `<a href="tel:${partnerData.phone || partnerData.telefone}" class="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm">📞 Ligar</a>` : ''}
                        ${(step < 3 || step === 4) && pedido.status !== 'dispute' ? 
    `<button onclick="window.confirmarEncerramentoChat('${orderId}')" class="text-gray-300 hover:text-red-500 p-2 transition">Encerrar Conversa✋</button>` : 
    `<span class="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">🔒 CONTRATO ATIVO</span>`
}
                    </div>
                </div>
                ${stepsHTML}
                ${timeHTML}
            </div>

            <div id="chat-messages" class="flex-1 overflow-y-auto p-0 space-y-3 pb-4 custom-scrollbar relative">
                <div class="sticky top-0 z-[50] w-full flex flex-col gap-0 bg-slate-50/90 backdrop-blur-sm">
                    ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                    <div id="contextual-dica-area"></div>
                </div>
                <div id="bubbles-area" class="p-4 pt-4 md:pt-6 flex flex-col gap-3" style="margin-top: 10px; padding-bottom: 50px;"></div>
            </div>

           ${!['completed', 'cancelled', 'negotiation_closed', 'dispute'].includes(pedido.status) ? `
            <div class="bg-white border-t mt-auto z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
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
                    <input type="text" id="chat-input-msg" 
                        placeholder="${isProvider ? 'Explique como fará o serviço...' : 'Descreva o que precisa, datas e local...'}" 
                        oninput="let uIdP = '${uidPartner}'; if(this.value.length > 0) { window.atualizarMeuStatus('online', uIdP); } clearTimeout(window.typingTimer); window.typingTimer = setTimeout(() => window.atualizarMeuStatus('online', null), 2000);"
                        class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-200">
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
    // ⚖️ 1º PRIORIDADE: SUPORTE/DISPUTA (Bloqueia tudo o resto)
    if (pedido.status === 'dispute') {
        return `
            <div class="bg-slate-900 p-6 rounded-2xl shadow-2xl mb-4 mx-4 border-2 border-amber-500 animate-slideUp">
                <div class="flex flex-col items-center text-center gap-3">
                    <div class="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]"><span class="text-2xl">⚖️</span></div>
                    <div>
                        <h4 class="text-amber-500 font-black text-xs uppercase tracking-widest">Negociação Sob Análise</h4>
                        <p class="text-white text-[10px] font-bold mt-1 leading-tight">O suporte foi acionado. Por segurança, as mensagens e pagamentos foram bloqueados.</p>
                    </div>
                </div>
            </div>`;
    }

    // 🏆 2º PRIORIDADE: SUCESSO/CONCLUÍDO
    if (step === 4 || pedido.status === 'completed') {
        return `
            <div class="bg-indigo-700 p-5 rounded-2xl shadow-xl mb-4 mx-4 relative overflow-hidden animate-fadeIn">
                <div class="flex flex-col items-center text-center gap-2">
                    <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🏆</div>
                    <h4 class="text-white font-black italic text-sm uppercase">Pagamento Liberado</h4>
                </div>
            </div>`;
    }

    // 🤝 3º PRIORIDADE: NEGOCIAÇÃO E ACORDO (RESTAURADO)
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
    let textoOriginal = input.value.trim();
    if (!textoOriginal) return;

    // 🛡️ CAMADA 1: NORMALIZAÇÃO AGRESSIVA V14
    let t = textoOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    t = t.replace(/ponto/g, ".").replace(/arroba/g, "@").replace(/whats/g, "whatsapp");
    // Remove qualquer símbolo ou espaço para colar as letras (ex: P.O.R.R.A vira porra)
    const textoLimpo = t.replace(/[^a-z0-9]/g, "");
    // 🔍 CAMADA 2: DICIONÁRIO PROIBIDO INTEGRAL
    const proibidos = [
        // 🚨 EVASÃO DE PLATAFORMA (CONTATOS E REDES)
        'whatsapp', 'zap', 'wpp', 'whats', 'vvhats', 'vvp', 'z@p', 'zapp', 'contato', 'meucontato', 
        'meunumero', 'chamanowhats', 'chamanozap', 'meadd', 'insta', 'instagram', 'facebook', 
        'face', 'tiktok', 'kawai', 'telegram', 't-e-l-e-g-r-a-m', 'pvd', 'p-v-d', 'direct', 'dm', 
        'privado', 'meulink', 'wa.me', 'bit.ly', 'linktr.ee', 'hotmail', 'gmail', 'outlook', 
        '.com', '.br', '.net', '@', 'arroba', 'ponto',

        // 💸 BURLA FINANCEIRA (PAGAMENTO POR FORA)
        'pix', 'p-i-x', 'pixdireto', 'transferencia', 'deposito', 'ted', 'doc', 'dinheiro', 
        'dinheironamao', 'pagamentoporfora', 'descontoporfora', 'metadeagora', 'metadedepois', 
        'porfora', 'pagoemdinheiro', 'meupix',

        // 🚫 TOXICIDADE, OFENSAS E GOLPES (BLINDAGEM DE REPUTAÇÃO)
        'porra', 'caralho', 'fdp', 'f.d.p', 'vtnm', 'lixo', 'vagabundo', 'estelionato', 'golpe', 
        'golpista', 'mentira', 'merda', 'puta', 'desgraca', 'satanas', 'imbecil', 'idiota', 
        'trouxa', 'corno', 'maldito', 'safado', 'ladrao', 'ladra', 'm-e-r-d-a'
    ];

    // 🔢 CAMADA 3: DETECTOR DE TELEFONE (8+ DÍGITOS OU +55)
    const apenasNumeros = t.replace(/\D/g, "");
   // Pega sequências de números mesmo com caracteres no meio (ex: 1.1-9_8)
    const padraoNumericoEspalhado = t.replace(/[^0-9]/g, "");
    const temTelefone = padraoNumericoEspalhado.length >= 8 || t.includes("+55") || t.includes("0800");
    // 🚨 VERIFICAÇÃO DE BLOQUEIO ATÔMICO
    // 🧩 CAMADA 2: DETECÇÃO DE FRAGMENTAÇÃO (BUFFER)
    if (!window.chat_risk_buffer) window.chat_risk_buffer = [];
    window.chat_risk_buffer.push({ n: apenasNumeros, t: Date.now() });
    
    // Limpa números com mais de 2 minutos
    window.chat_risk_buffer = window.chat_risk_buffer.filter(i => Date.now() - i.t < 120000);
    
    const somaNumerosBuffer = window.chat_risk_buffer.reduce((acc, i) => acc + i.n, "");
    const temFragmentacao = somaNumerosBuffer.length >= 8;

    const encontrouPalavra = proibidos.some(p => textoLimpo.includes(p) || t.includes(p));
    
    if ((encontrouPalavra || temTelefone || temFragmentacao) && step < 3) {
        let riskScoreAtual = (window.meuPerfil?.risk_score || 0) + 3;
        window.atualizarRiscoUsuario(auth.currentUser.uid, riskScoreAtual);

        // 🔐 OBS 7: MODO SILENCIOSO (PUNIÇÃO PROGRESSIVA)
        if (riskScoreAtual >= 15) {
            console.warn("🔇 Modo Silencioso: Mensagem bloqueada sem aviso ao infrator.");
            input.value = "";
            return; // Encerra aqui, o usuário acha que enviou mas não salvamos no banco
        }

        let msgAlerta = riskScoreAtual > 10 ? 
            "🚨 ATENÇÃO: Tentativas repetidas geram bloqueio da conta." : 
            "⚠️ Por segurança, contatos só após o fechamento do acordo.";
        
        alert(msgAlerta);
        input.value = "";
        return;
    }
    
    if ((encontrouPalavra || temTelefone) && step < 3) {
        // 📈 CAMADA 4: EVOLUÇÃO DO RISK SCORE (CONTROLE DE EVASÃO)
        let riskScoreAtual = (window.meuPerfil?.risk_score || 0) + 3;
        window.atualizarRiscoUsuario(auth.currentUser.uid, riskScoreAtual);

        let msgAlerta = "⚠️ Por segurança, a troca de contatos só é permitida após o fechamento do acordo.";
        if (riskScoreAtual > 10) msgAlerta = "🚨 ATENÇÃO: Tentativas repetidas de burlar a plataforma geram bloqueio da conta.";
        
        alert(msgAlerta);
        input.value = "";
        return;
    }

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
            text: textoOriginal, 
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
            
            // 💰 LEITURA HÍBRIDA: Identifica saldo real e bônus de quem está confirmando - PONTO CRÍTICO
            const userData = uid === freshOrder.client_id ? clientSnap.data() : providerSnap.data();
            const meuSaldoReal = parseFloat(userData.wallet_balance || 0);
            const meuSaldoBonus = parseFloat(userData.wallet_bonus || 0);
            const meuPoderDeCompra = meuSaldoReal + meuSaldoBonus;
            
            const limiteFin = parseFloat(configData.limite_divida || 0);

           // 2. VALIDAÇÕES FINANCEIRAS (TRAVA ANTI-GOLPE) - PONTO CRÍITICO TRAVAS FINANCEIRAS 274 A 286
           // 🛡️ TRAVA FINANCEIRA V27.2 (PROTEÇÃO CONTRA SAQUE E INADIMPLÊNCIA)
            const pReservaPct = isMeProvider ? (parseFloat(configData.porcentagem_reserva || 0)) : (parseFloat(configData.porcentagem_reserva_cliente || 0));
            const valorReservaExigida = totalPedido * (pReservaPct / 100);
            
            // Re-checagem rigorosa usando o Poder de Compra (Real + Bônus) - PONTO CRÍTICO
            const saldoResultante = meuPoderDeCompra - valorReservaExigida;

            if (saldoResultante < limiteFin) {
                throw `Operação Negada: Saldo insuficiente.\nDisponível: R$ ${meuPoderDeCompra.toFixed(2)}\nReserva Exigida: R$ ${valorReservaExigida.toFixed(2)}`;
            }

            // 3. ESCRITAS (WRITES AFTER ALL READS)
            transaction.update(orderRef, isMeProvider ? { provider_confirmed: true } : { client_confirmed: true });

            if (vaiFecharAgora) {
                const valorReservaPrestador = totalPedido * (parseFloat(configData.porcentagem_reserva || 0) / 100);
                const valorReservaCliente = totalPedido * (parseFloat(configData.porcentagem_reserva_cliente || 0) / 100);

                // 🌀 LIQUIDIFICADOR DE BÔNUS: Desconta do bônus antes do saldo real 299  A 326 - PONTO CRÍTICO
                const processarDebitoHibrido = (snap, ref, valorDebito, uidDestino) => {
                    let rBonus = parseFloat(snap.data().wallet_bonus || 0);
                    let rBal = parseFloat(snap.data().wallet_balance || 0);
                    let rRes = parseFloat(snap.data().wallet_reserved || 0);

                    if (rBonus >= valorDebito) {
                        rBonus -= valorDebito;
                    } else {
                        const resto = valorDebito - rBonus;
                        rBonus = 0;
                        rBal -= resto;
                    }

                    transaction.update(ref, { 
                        wallet_balance: rBal, 
                        wallet_bonus: rBonus, 
                        wallet_reserved: rRes + valorDebito 
                    });
                    
                    transaction.set(doc(collection(db, "extrato_financeiro")), { 
                        uid: uidDestino, tipo: "RESERVA_SERVICO 🔒", valor: -valorDebito, 
                        descricao: `Reserva de garantia (Uso de Bônus/Saldo)`, timestamp: serverTimestamp() 
                    });
                };

                if (valorReservaCliente > 0) processarDebitoHibrido(clientSnap, clientRef, valorReservaCliente, freshOrder.client_id);
                if (valorReservaPrestador > 0) processarDebitoHibrido(providerSnap, providerRef, valorReservaPrestador, freshOrder.provider_id);

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
       
// 🟢 MOTOR DE PRESENÇA V12 (ESTILO WHATSAPP)
export function escutarPresenca(uidPartner) {
    const statusRef = doc(db, "status_online", uidPartner);
    onSnapshot(statusRef, (doc) => {
        const indicador = document.getElementById(`status-indicador-${uidPartner}`);
        const texto = document.getElementById(`status-texto-${uidPartner}`);
        if (!indicador || !texto) return;

        const data = doc.data();
        const isOnline = data?.state === 'online';
        const isTyping = data?.typing_to === auth.currentUser.uid;

        if (isTyping) {
            indicador.className = "w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse";
            texto.innerText = "digitando...";
            texto.className = "text-[8px] font-black text-blue-600 mt-1 uppercase italic";
        } else if (isOnline) {
            indicador.className = "w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]";
            texto.innerText = "online agora";
            texto.className = "text-[8px] font-bold text-green-600 mt-1 uppercase tracking-tighter";
        } else {
            indicador.className = "w-1.5 h-1.5 rounded-full bg-gray-300";
            texto.innerText = "offline";
            texto.className = "text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-tighter italic";
        }
    });
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
        if(window.rolarChatParaBaixo) window.rolarChatParaBaixo();
    });
}
//PONTO CRÍTICO: UPGRADE DO BOTÃO CONFIRMAR E PAGAR, AGORA TEM A OPÇÃO DE TAXA PARA O CLIENTE TAMBÉM. LINHAS ANTES - 348 A 428 AGORA 348 A 432
export async function finalizarServicoPassoFinalAction(orderId, acaoPorAdmin = false) {
    // 💡 RE-INJEÇÃO GLOBAL: Necessária para o gatilho de 12h e robôs funcionarem
    window.finalizarServicoPassoFinalAction = finalizarServicoPassoFinalAction;
    if(!auth.currentUser) return alert("Sessão expirada. Faça login novamente.");
    // 🔕 MODO SILENCIOSO: Se a ação vier do Admin/Robô, pula o prompt de confirmação
    if (!acaoPorAdmin) {
        if (!confirm("🏁 CONFIRMAR CONCLUSÃO E LIBERAR PAGAMENTO?\n\nEsta ação é irreversível.")) return;
    }
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "orders", orderId);
            const configFinRef = doc(db, "settings", "financeiro");
            const configGlobRef = doc(db, "settings", "global");
            
            // 🔄 SINCRONIA DE LEITURAS (Passo 1: Ordem, Config e Cofre)
            const atlivioReceitaRef = doc(db, "sys_finance", "receita_total");
            const [orderSnap, configFinSnap, cofreSnap] = await Promise.all([
                transaction.get(orderRef),
                transaction.get(configFinRef),
                transaction.get(atlivioReceitaRef)
            ]);

            if (!orderSnap.exists()) throw "Pedido não encontrado.";
            const pedido = orderSnap.data();
            const clientRef = doc(db, "usuarios", pedido.client_id);
            const providerRef = doc(db, "usuarios", pedido.provider_id);
            // 💰 LEITURA DINÂMICA: Busca os donos reais da conta baseados na Ordem
            const [clientSnap, providerSnap] = await Promise.all([transaction.get(clientRef), transaction.get(providerRef)]);
            // 🛡️ PREVENÇÃO DE ERROS: Se não tiver config, assume tudo ZERO (nada de 10% automático)
            const configFin = configFinSnap.exists() ? configFinSnap.data() : {};
            
            const valorTotalBase = parseFloat(pedido.offer_value || 0);
            const resCliente = parseFloat(pedido.value_reserved_client || 0);
            const resProvider = parseFloat(pedido.value_reserved_provider || 0);

            // 1. CÁLCULO TAXA PRESTADOR (Busca 'taxa_plataforma' primeiro, depois 'taxa_prestador', por fim 0)
            let rawTaxaP = configFin.taxa_plataforma ?? configFin.taxa_prestador ?? 0;
            let pctP = parseFloat(rawTaxaP);
            if (pctP > 1) pctP = pctP / 100; // Converte 20 em 0.20
            const valorTaxaAtlivioP = Number((valorTotalBase * pctP).toFixed(2));

            // 2. CÁLCULO TAXA CLIENTE (Busca 'taxa_cliente' no mesmo arquivo financeiro)
            let rawTaxaC = configFin.taxa_cliente ?? 0;
            let pctC = parseFloat(rawTaxaC);
            if (pctC > 1) pctC = pctC / 100; // Converte 5 em 0.05
            const valorTaxaAtlivioC = Number((valorTotalBase * pctC).toFixed(2));

            // REGRA DO LUCRO LÍQUIDO (O que o prestador efetivamente embolsa)
            const ganhoLiquidoRealMétrica = Number((valorTotalBase - valorTaxaAtlivioP).toFixed(2));
            
            console.log(`📊 SIMULAÇÃO V12: Base: ${valorTotalBase} | Taxa P: ${valorTaxaAtlivioP} (${pctP*100}%) | Taxa C: ${valorTaxaAtlivioC} (${pctC*100}%)`);

            // 3. EXECUÇÃO CLIENTE: CASCATA FINANCEIRA (Reserva + Saldo Livre)
            const walletResC = parseFloat(clientSnap.data().wallet_reserved || 0);
            const walletBalC = parseFloat(clientSnap.data().wallet_balance || 0);

            const faltaPagar = valorTaxaAtlivioC; // O cliente paga a taxa de 10 reais agora.
            
            // Validação de Fundos: Se não tiver saldo livre para cobrir a diferença, aborta.
            // VALIDAÇÃO FLEXÍVEL V12: Permite saldo negativo até o limite configurado (Ex: -50.00)
            // 🛡️ VALIDAÇÃO INTELIGENTE V13: Considera Saldo Livre + Reserva do Pedido
            const poderDeQuitacaoC = walletBalC + resCliente; 
            if (!acaoPorAdmin && (poderDeQuitacaoC - faltaPagar) < -Math.abs(parseFloat(configFin.limite_divida || 0))) {
                throw `Saldo Insuficiente: O cliente não possui lastro (Saldo + Reserva) para quitar as taxas de R$ ${faltaPagar.toFixed(2)}.`;
            }

            // Debita a Reserva (que zera) E o Saldo Livre (o que faltava)
            const novoSaldoC = Number((walletBalC - faltaPagar).toFixed(2));
            const bonusAtualC = parseFloat(clientSnap.data().wallet_bonus || 0);

            transaction.update(clientRef, { 
                wallet_reserved: Math.max(0, walletResC - resCliente),
                wallet_balance: novoSaldoC,
                wallet_total_power: Number((novoSaldoC + bonusAtualC).toFixed(2)),
                wallet_earnings: 0 
            });
            
            transaction.set(doc(collection(db, "extrato_financeiro")), {
                uid: pedido.client_id, tipo: "SERVIÇO_PAGO 🏁", valor: -Number((resCliente + faltaPagar).toFixed(2)),
                descricao: `Pagamento total (Reserva + Saldo).`, timestamp: serverTimestamp()
            });

            // 4. EXECUÇÃO PRESTADOR: Recebe a soma da Reserva + O que foi cobrado agora
            const walletResP = parseFloat(providerSnap.data().wallet_reserved || 0);
            const balanceP = parseFloat(providerSnap.data().wallet_balance || 0);
            const bonusP = parseFloat(providerSnap.data().wallet_bonus || 0);
            
            // LÓGICA V16: Define o repasse direto e as taxas separadas
            // O Prestador recebe a Reserva do Cliente + o estorno da sua própria reserva (descontada a taxa dele)
            const repasseParaPrestador = Number((resCliente + (resProvider - valorTaxaAtlivioP)).toFixed(2));
            
            // Valor total que a Atlivio fatura neste serviço (Taxa P + Taxa C)
            const receitaPlataforma = Number((valorTaxaAtlivioP + valorTaxaAtlivioC).toFixed(2));

            let valorParaInjetarNoSaldo = 0;

            if (configFin.completar_valor_total === true) {
                // 🛡️ TRAVA DE LASTRO V12.2: Verifica se o cofre cobre o prejuízo de completar o valor
                // DÉFICIT REAL V12: Calcula o lastro antes de verificar o déficit
                const sobraRealCustodia = resCliente - valorTaxaAtlivioP;
                const deficitTotal = sobraRealCustodia < 0 ? Math.abs(sobraRealCustodia) : 0;
                const saldoCofreAtual = cofreSnap.exists() ? (cofreSnap.data().total_acumulado || 0) : 0;

                if (deficitTotal > 0 && saldoCofreAtual < deficitTotal) {
                    throw `Liquidação Negada: A plataforma não possui saldo no cofre (R$ ${saldoCofreAtual.toFixed(2)}) para completar o pagamento integral (Déficit: R$ ${deficitTotal.toFixed(2)}).`;
                }
                
                // CORREÇÃO CIRÚRGICA: Garante que o prestador receba a reserva do cliente
                valorParaInjetarNoSaldo = Number((resCliente + (resProvider - valorTaxaAtlivioP)).toFixed(2));

                // Se houver déficit real, a Atlivio retira do cofre para pagar o prestador
                if (deficitTotal > 0) {
                    transaction.update(atlivioReceitaRef, { 
                        total_acumulado: increment(-Number(deficitTotal.toFixed(2))),
                        ultima_atualizacao: serverTimestamp()
                    });
                }
            } else {
                // MODO HÍBRIDO: Devolve a reserva do cliente + o troco da reserva do prestador
                valorParaInjetarNoSaldo = Number((resCliente + (resProvider - valorTaxaAtlivioP)).toFixed(2));
            }

            const novoBalanceP = Number((balanceP + valorParaInjetarNoSaldo).toFixed(2));

            transaction.update(providerRef, {
                wallet_reserved: Math.max(0, walletResP - resProvider),
                wallet_balance: novoBalanceP,
                wallet_total_power: Number((novoBalanceP + bonusP).toFixed(2)),
                wallet_earnings: increment(ganhoLiquidoRealMétrica)
            });

            // 5. COFRE ATLIVIO: Soma as taxas P + C e atualiza o saldo global
            const totalTaxasCalculadas = Number((valorTaxaAtlivioP + valorTaxaAtlivioC).toFixed(2));
            if (totalTaxasCalculadas > 0) {
                transaction.update(atlivioReceitaRef, {
                    total_acumulado: increment(totalTaxasCalculadas),
                    ultima_atualizacao: serverTimestamp()
                });
            }

            // REGISTRO 1 (MÉTRICA SITE): Alimenta o "Hoje" e "Total" com o lucro líquido
            transaction.set(doc(collection(db, "extrato_financeiro")), {
                uid: pedido.provider_id,
                tipo: "GANHO_SERVIÇO ✅",
                valor: ganhoLiquidoRealMétrica,
                descricao: `Ganho líquido ref. pedido #${orderId.slice(0,5)}`,
                timestamp: serverTimestamp()
            });

            // REGISTRO 2 (HISTÓRICO CARTEIRA): Explica a movimentação de saldo real
            if (valorParaInjetarNoSaldo !== 0) {
                const descFinal = valorParaInjetarNoSaldo > 0 ? "Repasse de saldo/garantia" : "Ajuste de taxas";
                transaction.set(doc(collection(db, "extrato_financeiro")), {
                    uid: pedido.provider_id,
                    tipo: "LIBERAÇÃO_SALDO 💳",
                    valor: Number(valorParaInjetarNoSaldo.toFixed(2)),
                    descricao: `${descFinal} (#${orderId.slice(0,5)})`,
                    timestamp: serverTimestamp()
                });
            }
            // 5. ATUALIZA ORDEM: Finaliza e registra o lucro da Atlivio para auditoria
            transaction.update(orderRef, { 
                status: 'completed', system_step: 4, completed_at: serverTimestamp(),
                value_reserved_client: 0, value_reserved_provider: 0,
                lucro_atlivio_prestador: valorTaxaAtlivioP,
                lucro_atlivio_cliente: valorTaxaAtlivioC
            });

            transaction.set(doc(collection(db, `chats/${orderId}/messages`)), {
                text: `🏁 SERVIÇO CONCLUÍDO: Pagamento e taxas processados com sucesso.`,
                sender_id: "system", timestamp: serverTimestamp()
            });
        });
        alert("✅ Pagamento Realizado com Sucesso!");
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
    if (!displayTimer || !pedido.real_start) return;

    // Converte o início do banco para milissegundos
    const inicioMs = pedido.real_start.toDate ? pedido.real_start.toDate().getTime() : new Date(pedido.real_start).getTime();
    const agoraMs = Date.now();
    const dozeHorasMs = 12 * 60 * 60 * 1000;
    
    const tempoPassado = agoraMs - inicioMs;
    const tempoRestante = dozeHorasMs - tempoPassado;

    // 🚨 TRAVA DE SEGURANÇA: Se o tempo for negativo ou zero, força o estado de expiração
    if (tempoRestante <= 0) {
        displayTimer.innerHTML = `
            <span class="text-yellow-300 font-black animate-pulse" style="font-size: 1.2rem;">00:00:00</span>
            <br>
            <span class="text-yellow-400 text-[9px] font-bold uppercase tracking-tighter">⚠️ PRAZO EXPIRADO: Finalizando pagamento...</span>
        `;
        return; // Para a execução aqui
    }

    // Cálculo do tempo reverso normal
    const totalSegundos = Math.floor(tempoRestante / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    const horasParaFrase = Math.floor(totalSegundos / 3600);

    displayTimer.innerHTML = `
        <span class="font-mono">${h}:${m}:${s}</span>
        <br>
        <span style="font-size: 9px; opacity: 0.8;">Você tem ${horasParaFrase}h para confirmar ou contestar.</span>
    `;
} // Fim da função atualizarRelogioDOM

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
            system_step: 3,
            real_start: serverTimestamp(),
            timer_initialized: true
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
// 🟢 MOTOR DE STATUS V12 (VOZ)
export async function atualizarMeuStatus(estado, paraUid = null) {
    if (!auth.currentUser) return;
    const statusRef = doc(db, "status_online", auth.currentUser.uid);
    try {
        await updateDoc(statusRef, {
            state: estado,
            typing_to: paraUid,
            last_changed: serverTimestamp()
        });
    } catch (e) {
        // Se o doc não existir, cria com setDoc
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(statusRef, { state: estado, typing_to: paraUid, last_changed: serverTimestamp() }, { merge: true });
    }
}

// 🟢 CONEXÃO WHATSAPP: Expõe a escuta e o motor de status
window.escutarPresenca = (uid) => escutarPresenca(uid);
window.atualizarMeuStatus = (estado, uid) => atualizarMeuStatus(estado, uid);
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
        const container = document.getElementById('contextual-dica-area');
        if (!container) return;
        
        const dicaHtml = `
            <div class="flex justify-center my-4 animate-fadeIn">
                <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl max-w-[80%] text-center shadow-sm">
                    <p class="text-[10px] text-amber-800 font-bold uppercase mb-1">💡 Dica ATLIVIO:</p>
                    <p class="text-[11px] text-amber-900 leading-tight font-medium">
                        Serviços com reserva confirmada têm prioridade total. <br>
                        <span class="font-black">⚠️ A troca de contatos é proibida antes do fechamento do acordo.</span>
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
        if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'negotiation_closed', 
            closed_at: serverTimestamp() 
        });
        alert("Conversa encerrada.");
        window.voltarParaListaPedidos();
    } catch(e) { console.error("Erro ao encerrar:", e); }
};

// 🛡️ MOTOR DE EDUCAÇÃO E SEGURANÇA CHAT V12
async function verificarOnboardingChat(uid) {
    const userRef = doc(db, "usuarios", uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && !snap.data().chat_onboarding_seen) {
        const onboardingHtml = `
            <div id="chat-onboarding" class="bg-blue-600 text-white p-4 rounded-xl mb-4 mx-4 shadow-xl animate-fadeIn relative overflow-hidden">
                <div class="absolute top-0 right-0 p-2 opacity-20 text-3xl font-black">🛡️</div>
                <h4 class="text-xs font-black uppercase mb-1">Negocie com Segurança</h4>
                <p class="text-[10px] leading-tight opacity-90 mb-3">Combine detalhes por aqui. A troca de contatos só é liberada após o fechamento do acordo oficial.</p>
                <button onclick="window.confirmarLeituraRegras('${uid}')" class="bg-white text-blue-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 transition">Entendi</button>
            </div>`;
        document.getElementById('chat-messages')?.insertAdjacentHTML('afterbegin', onboardingHtml);
    }
}

window.confirmarLeituraRegras = async (uid) => {
    try {
        await updateDoc(doc(db, "usuarios", uid), { chat_onboarding_seen: true });
        document.getElementById('chat-onboarding')?.remove();
    } catch (e) { console.error("Erro onboarding:", e); }
};

// 📈 MOTOR DE ATUALIZAÇÃO DE RISCO E AUDITORIA V14
window.atualizarRiscoUsuario = async (uid, novoScore) => {
    try {
        const { doc, updateDoc, addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const userRef = doc(window.db, "usuarios", uid);
        await updateDoc(userRef, { 
            risk_score: novoScore,
            ultima_tentativa_contato: serverTimestamp() 
        });
        
        // 🚨 DISPARA AUDITORIA PARA COMPORTAMENTO SUSPEITO
        if (novoScore >= 15) {
            await addDoc(collection(window.db, "system_events"), {
                tipo: "ALERTA_EVASAO",
                uid: uid,
                score_atingido: novoScore,
                timestamp: serverTimestamp(),
                descricao: "Tentativas repetidas de envio de contato detectadas pelo Filtro V14."
            });
        }
    } catch (e) { console.error("Erro ao processar risco:", e); }
};
