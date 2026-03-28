// ============================================================================
// js/modules/chat.js - ATUALIZAÇÃO V11.0 (SANEAMENTO E NOMENCLATURA)
// ============================================================================

import { db, auth } from '../config.js'; 
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, limit, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GATILHOS E NAVEGAÇÃO GLOBAL ---
window.unsubscribeChat = null; // 🔑 CHAVE GLOBAL PARA TROCAR DE CHAT SEM BUG - PONTO CRÍTICO SOLUÇÃO 01 TROCA DE CHATS
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
// 🚀 EXPOSIÇÃO GLOBAL V302: Garante que o Admin e o App vejam as funções financeiras
window.abrirChatPedido = abrirChatPedido;
window.enviarMensagemChat = enviarMensagemChat;
window.confirmarAcordo = confirmarAcordo;
// Exporta a ação real para o Robô de 12h e para o Robô de Auditoria
window.finalizarServicoPassoFinalAction = finalizarServicoPassoFinalAction; 
window.finalizarServicoPassoFinal = (id) => finalizarServicoPassoFinalAction(id);
window.voltarParaListaPedidos = () => {
    console.log("⬅️ Executando Minimizar e Voltar...");
    
    const chat = document.getElementById('painel-chat-individual');
    if(chat) {
        // 1. Mata o estilo fixo que impede o chat de sumir
        chat.style.display = 'none'; 
        // 2. Garante a classe hidden por segurança
        chat.classList.add('hidden');
    }

    // 3. Força o clique na aba de serviços para mostrar os pedidos atrás
    const tabServicos = document.getElementById('tab-servicos');
    if(tabServicos) {
        tabServicos.click();
        console.log("✅ Chat minimizado e aba restaurada.");
    }
};

// 🔄 ROLAGEM RADICAL V24 (Correção para Windows/Desktop)
window.rolarChatParaBaixo = () => {
    const area = document.getElementById('scroll-area-v16');
    if (area) {
        // Dobramos a segurança com requestAnimationFrame + Timeout
        // Isso força o navegador a terminar de desenhar ANTES de rolar
        requestAnimationFrame(() => {
            setTimeout(() => {
                area.scrollTo({
                    top: area.scrollHeight + 500, // Força bruta: tenta rolar mais do que existe
                    behavior: 'instant' // Desktop precisa de resposta imediata
                });
            }, 50);
        });
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
    console.log("🔄 Gina iniciando troca para o pedido:", orderId);
    
    // ✋ 1. MATA A CONEXÃO ANTERIOR NA HORA - PONTO CRÍTICO SOLUÇÃO 02 - TROCA DE CHATS
    // ✋ 1. MATA A CONEXÃO ANTERIOR NA HORA (Reforço Global)
    if (window.unsubscribeChat) { 
        window.unsubscribeChat(); 
        window.unsubscribeChat = null; 
    }
    

    // 🧹 2. RESET TOTAL DE INSTÂNCIA (Padrão PICA GROSSA)
    let painelChat = document.getElementById('painel-chat-individual');
    if (painelChat) painelChat.innerHTML = ""; // Limpa tudo para não misturar chats
    
    if (!window.CATEGORIAS_ATIVAS) {
        const servicesMod = await import('./services.js');
        window.CATEGORIAS_ATIVAS = servicesMod.CATEGORIAS_ATIVAS;
    }

    if (!painelChat || painelChat.parentElement !== document.body) {
        if(painelChat) painelChat.remove();
        painelChat = document.createElement('div');
        painelChat.id = 'painel-chat-individual';
        
        // 🚀 MODO SUPER APP: Expansão máxima vertical no PC (Padrão PICA GROSSA)
        const isPC = window.innerWidth >= 768;
        const stylePC = "width: 400px; height: 96vh; right: 20px; bottom: 2vh; border-radius: 28px; border: 6px solid #0f172a; box-shadow: 0 0 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden !important; position: fixed; z-index: 9999;";
        const styleMobile = "width: 100%; height: 100%; right: 0; bottom: 0; border: none; border-radius: 0; z-index: 999999 !important;";
        
        painelChat.className = "fixed bg-white flex flex-col hidden overflow-hidden animate-slideUp";
        painelChat.style.cssText = isPC ? stylePC : styleMobile;
        
        document.body.appendChild(painelChat);
    }

    document.getElementById('painel-pedidos')?.classList.add('hidden');
    painelChat.classList.remove('hidden');
    painelChat.style.display = window.innerWidth >= 768 ? 'flex' : 'block';
    window.lastOpenedOrderId = orderId; // Garante ID para robôs e cronômetros
    const pedidoRef = doc(db, "orders", orderId);
    window.unsubscribeChat = onSnapshot(pedidoRef, (snap) => { //PONTO CRÍTICO - SOLUÇÃO 03 TROCA DE CHATS
        if (!snap.exists()) return;
        const pedido = snap.data();
        const isProvider = pedido.provider_id === auth.currentUser.uid;
        const step = pedido.system_step || 1;

        if (typeof window.atualizarCronometro === 'function') {
            window.atualizarCronometro(pedido);
        }

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

        // 🕒 VIGILANTE LAZARUS: Verifica se o chat expirou por inatividade
        if (window.verificarVidaUtilChat) window.verificarVidaUtilChat({id: orderId, ...pedido});
    });
}

// Gina: Função Pesada para contar demanda e injetar gatilhos psicológicos
async function injetarGatilhosDemanda(uidPartner, isProvider, categoriaId) {
    try {
        const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const container = document.getElementById(`demanda-indicador-${uidPartner}`);
        if (!container) return;

        // 1. Conta serviços ativos do prestador (Escassez)
        const qDemanda = query(collection(db, "orders"), where("provider_id", "==", uidPartner), where("status", "in", ["confirmed_hold", "in_progress"]));
        const snapDemanda = await getDocs(qDemanda);
        const totalAtivos = snapDemanda.size;

        // 2. Conta concorrentes para este serviço (Comparação Implícita)
        const qConcorrencia = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid), where("service_category_id", "==", categoriaId), where("status", "==", "pending"));
        const snapConcorrencia = await getDocs(qConcorrencia);
        const totalConcorrentes = snapConcorrencia.size;

        let htmlStatus = "";

        // 🚀 Ajuste V15: Layout Horizontal Compacto para o PICA GROSSA
        container.className = "flex flex-row gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-1";

        if (!isProvider && totalAtivos >= 2) {
            htmlStatus += `
                <div class="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded shadow-sm animate-pulse shrink-0">
                    <span class="text-[7px]">🔥</span>
                    <span class="text-[6.5px] font-black uppercase italic whitespace-nowrap">Alta Demanda</span>
                </div>`;
        }
        
        if (totalConcorrentes > 1) {
            const txt = isProvider ? `Comparando ${totalConcorrentes}` : `Comparando ${totalConcorrentes} Profissionais`;
            htmlStatus += `
                <div class="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm border border-blue-400/30 shrink-0">
                    <span class="text-[7px]">📍</span>
                    <span class="text-[6.5px] font-black uppercase italic whitespace-nowrap">${txt}</span>
                </div>`;
        }

        container.innerHTML = htmlStatus;
    } catch (e) { console.error("Erro Gina Gatilhos:", e); }
}

// Gina: Benção do Engajamento - Calcula e exibe o tempo de resposta
async function injetarMétricasEngajamento(uidPartner) {
    const container = document.getElementById(`engajamento-indicador-${uidPartner}`);
    if (!container) return;

    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const pSnap = await getDoc(doc(db, "usuarios", uidPartner));
        if (!pSnap.exists()) return;
        
        const pData = pSnap.data();
        const tempoMedio = pData?.avg_response_time || "5 min";
        const totalServicos = pData?.completed_services_count || 0;

        container.innerHTML = `
            <div class="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shadow-sm">
                <span class="text-[7px]">⚡</span>
                <span class="text-[7px] font-bold text-emerald-700 uppercase leading-none italic">Responde em ~${tempoMedio}</span>
            </div>
            ${totalServicos > 0 ? `
                <div class="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shadow-sm">
                    <span class="text-[7px]">✅</span>
                    <span class="text-[7px] font-bold text-blue-700 uppercase leading-none italic">${totalServicos} Serviços</span>
                </div>
            ` : ''}
        `;
    } catch (e) { console.error("Erro Engajamento:", e); }
}

async function renderizarEstruturaChat(container, pedido, isProvider, orderId, step) {
    /* 🛡️ V107: Garante que a identidade seja preservada mesmo se o Index falhar */
    const meuUid = window.auth?.currentUser?.uid;
    const souPrestadorTrabalhando = pedido.provider_id === meuUid;
    
    // Sobrescreve a variável para evitar o erro de 'undefined'
    isProvider = souPrestadorTrabalhando; 
    window.isProvider = isProvider;

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
            <div class="bg-white shadow-sm z-[100] border-b sticky top-0">
                <div class="p-2 px-3 flex items-center justify-between w-full">
                    <div class="flex items-center gap-2 min-w-0">
                        <button onclick="window.voltarParaListaPedidos()" class="text-gray-400 p-1 hover:bg-gray-50 rounded-full transition">⬅</button>
                        <div class="relative flex-shrink-0 cursor-pointer" onclick="window.verPerfilCompleto('${uidPartner}')">
                            <img src="${partnerData.photoURL || 'https://ui-avatars.com/api/?name=' + outroNome}" class="w-8 h-8 rounded-full border-2 border-blue-500 object-cover">
                            <div id="status-indicador-${uidPartner}" class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-gray-300"></div>
                        </div>
                        <div class="flex flex-col leading-none cursor-pointer" onclick="window.verPerfilCompleto('${uidPartner}')">
                            <h3 class="font-black text-[11px] text-gray-800 uppercase italic leading-none truncate">${outroNome}</h3>
                            <p id="status-texto-${uidPartner}" class="text-[7px] font-black text-gray-400 uppercase tracking-tighter italic mt-0.5">offline</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        ${contatoLiberado ? `<a href="tel:${partnerData.phone || partnerData.telefone}" class="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm">📞 Ligar</a>` : ''}
                        ${(step < 3 || step === 4) && pedido.status !== 'dispute' ? 
                            `<button onclick="window.confirmarEncerramentoChat('${orderId}')" class="bg-red-50 text-red-500 w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 font-black text-sm hover:bg-red-100 transition active:scale-90" title="Encerrar Conversa">✕</button>` : 
                            `<span class="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 uppercase">🔒 ATIVO</span>`
                        }
                    </div>
                </div>

                <div class="px-4 pb-2 flex flex-col gap-1">
                    <div id="demanda-indicador-${uidPartner}"></div>
                    <div id="engajamento-indicador-${uidPartner}"></div>
                </div> 
               ${stepsHTML}
                ${timeHTML}
            </div>

           <div id="chat-messages" class="flex-1 flex flex-col bg-slate-50 relative overflow-hidden" style="height: 100%; min-height: 0;">
                <div id="header-estatico-chat" class="flex-shrink-0 w-full bg-white z-[50] border-b shadow-sm">
                    ${gerarBannerEtapa(step, isProvider, pedido, orderId)}
                    <div id="contextual-dica-area" class="bg-amber-50/50" style="display: none; height: 0; overflow: hidden;"></div>
                </div>
                
               <div id="scroll-area-v16" class="custom-scrollbar p-4 flex-1" style="overflow-y: auto; scroll-behavior: smooth; display: flex; flex-direction: column; background: #f8fafc; height: 100%;">
                    <div id="bubbles-area" class="flex flex-col gap-3" style="padding-bottom: 20px; width: 100%;"></div>
                </div>
            </div>

          
         ${(step < 4 && pedido.status !== 'cancelled' && pedido.status !== 'negotiation_closed' && pedido.status !== 'dispute') ? `
            <div class="bg-white border-t z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button onclick="window.toggleFerramentasChat()" class="w-full py-1.5 bg-gray-50 border-b flex items-center justify-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition">
                    <span id="icon-ferramentas">➕</span> <span id="txt-ferramentas">Mais Opções</span>
                </button>

                <div id="gaveta-ferramentas" class="hidden animate-fadeIn">
                    <div class="flex gap-2 p-2 overflow-x-auto bg-gray-50 border-b no-scrollbar">
                        <button onclick="window.abrirAgendamento('${orderId}')" class="bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full text-[9px] font-black text-amber-800 shadow-sm whitespace-nowrap">📅 Definir Data</button>
                        <button onclick="window.sugerirFrase('Já realizei serviços parecidos. Pode ficar tranquilo(a).')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">💡 Confiança</button>
                        <button onclick="window.sugerirFrase('Tenho disponibilidade para hoje ou amanhã.')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">⚡ Urgência</button>
                        <button onclick="window.sugerirFrase('A ATLIVIO segura a reserva até o serviço ser concluído.')" class="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-[9px] font-bold text-gray-600 shadow-sm whitespace-nowrap">🔒 Garantia</button>
                    </div>

                    <div class="flex gap-2 p-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                        ${step < 3 ? `
                            <button onclick="window.novoDescreverServico('${orderId}')" class="bg-white px-4 py-2 rounded-xl text-[10px] border border-blue-200 text-blue-700 font-black shadow-sm">📦 Descrever</button>
                            <div class="flex gap-2">
                            <button onclick="window.novoEnviarProposta('${orderId}')" class="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex flex-col items-center transform active:scale-95 transition">
                                <span>🎯 PROPOSTA</span>
                                <span class="text-[7px] opacity-70 uppercase tracking-tighter">Negociar</span>
                            </button>
                            <button onclick="window.ativarModoUltimato('${orderId}')" class="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex flex-col items-center animate-pulse transform active:scale-95 transition">
                                <span>🔥 ULTIMATO</span>
                                <span class="text-[7px] opacity-90 uppercase tracking-tighter">Última Oferta</span>
                            </button>
                        </div>
                        ` : ''}
                    
                    ${step >= 3 && !isProvider ? `<button onclick="window.finalizarServicoPassoFinal('${orderId}')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg w-full">🏁 CONFIRMAR & PAGAR</button>` : ''}
                    
                    <button onclick="window.reportarProblema('${orderId}')" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-100">⚠️ Ajuda</button>
                </div>
                
                </div>
                <div class="px-3 ${window.innerWidth < 768 ? 'pb-10 pt-3' : 'py-3'} flex gap-2 items-center bg-white border-t relative z-[10000]">
                    <input type="text" id="chat-input-msg" 
                        placeholder="${isProvider ? 'Explique como fará o serviço...' : 'Descreva o que precisa, datas e local...'}" 
                        oninput="let uIdP = '${uidPartner}'; if(this.value.length > 0) { window.atualizarMeuStatus('online', uIdP); } clearTimeout(window.typingTimer); window.typingTimer = setTimeout(() => window.atualizarMeuStatus('online', null), 2000);"
                        class="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-blue-200">
                    <button onclick="window.enviarMensagemChat('${orderId}', ${step})" class="bg-slate-900 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition relative z-[1000000]">➤</button>
                </div>
            </div>` : ''}
        </div>
    `;
    
    if(window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => atualizarRelogioDOM(pedido), 1000);
    escutarMensagens(orderId);
    
    // Gina: Dispara a inteligência de fechamento e o Martelo de Vendas
    injetarGatilhosDemanda(uidPartner, isProvider, pedido.service_category_id || "gerais");
    injetarMétricasEngajamento(uidPartner);

    // 🚀 LÓGICA ROBÔ 78: Garante Geometria e Cores na Troca de Chats
    setTimeout(() => {
        const cards = container.querySelectorAll('.max-w-\\[290px\\]');
        cards.forEach((card) => {
            card.style.setProperty('width', '340px', 'important');
            card.style.setProperty('max-width', '340px', 'important');
            card.style.setProperty('min-height', '75px', 'important');
            card.style.setProperty('background', '#020617', 'important');
            card.style.setProperty('border', '2px solid #fbbf24', 'important');
            card.style.setProperty('border-radius', '10px', 'important');
        });
    }, 100);
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
        const isPC = window.innerWidth >= 768;
        const jaConfirmei = isProvider ? pedido.provider_confirmed : pedido.client_confirmed;
        if (jaConfirmei) {
            return `<div class="bg-blue-50 border border-blue-200 ${isPC ? 'p-2 mx-2 mb-2' : 'p-4 mx-4 mb-4'} rounded-xl text-center animate-pulse"><p class="text-xs font-bold text-blue-800">⏳ Aguardando confirmação...</p></div>`;
        }

        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, porcentagem_reserva_cliente: 0 };
        const pct = isProvider ? config.porcentagem_reserva : config.porcentagem_reserva_cliente;
        const valorAcordo = parseFloat(pedido.offer_value) || 0;
        const reservaCalculada = valorAcordo * (pct / 100);

       const isUltimato = pedido.modo_ultimato === true;
        return `
        <style>
            @keyframes bounce-subtle { from { transform: translateY(0); } to { transform: translateY(-4px); } }
            @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
            .animate-martelo { animation: bounce-subtle 1.5s infinite alternate; }
            .animate-ultimato { animation: pulse-red 2s infinite; background: #7f1d1d !important; border-color: #ef4444 !important; }
        </style>
        <div id="banner-fechamento-v12" class="${isUltimato ? 'animate-ultimato' : 'bg-[#0f172a] animate-martelo'} border-2 border-slate-700 ${isPC ? 'p-3 mx-2 mb-2' : 'p-5 mx-4 mb-4'} rounded-2xl shadow-2xl relative overflow-hidden">
            ${isUltimato ? `<div class="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>` : `<div class="absolute top-0 left-0 w-1.5 h-full bg-[#10b981]"></div>`}
            
            <div class="flex justify-between items-center mb-4 relative z-10">
                <div class="flex flex-col leading-none">
                    <p class="text-[8px] font-black text-white uppercase tracking-widest">${isUltimato ? '⚠️ OFERTA FINAL' : 'Investimento Total'}</p>
                    <p class="text-2xl font-black text-[#34d399] mt-1 tracking-tighter">R$ ${valorAcordo.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="text-right leading-none max-w-[120px]">
                    <p class="text-[7px] text-amber-400 font-black uppercase italic animate-pulse leading-tight" id="timer-ultimato">
                        ${isUltimato ? '⏳ CALCULANDO...' : '⚠️ Disponibilidade sujeita a alteração'}
                    </p>
                </div>
            </div>

            <div class="flex flex-col gap-2 relative z-10">
                <button onclick="window.confirmarAcordo('${orderId}', true)" class="w-full ${isUltimato ? 'bg-red-600 hover:bg-red-500' : 'bg-[#10b981] hover:bg-[#34d399]'} text-black ${isPC ? 'py-2.5' : 'py-4'} rounded-xl text-[11px] font-black uppercase shadow-lg transition active:scale-95 transform">
                    ${isUltimato ? '🤝 ACEITAR AGORA OU PERDER' : '🤝 ACEITAR E FECHAR AGORA'}
                </button>
                <p class="text-[6px] text-white font-bold uppercase text-center tracking-widest italic">
                    ⚠️ Confirme os detalhes no chat antes. Esta ação é <span class="text-amber-500 font-black">irreversível</span>.
                </p>
            </div>

            <div class="${isPC ? 'mt-2 p-1.5' : 'mt-4 p-2'} bg-slate-800/50 rounded-lg flex justify-between items-center border border-slate-700/50 relative z-10">
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px]">🔒</span>
                    <p class="text-[8px] text-amber-500 font-black uppercase tracking-tighter italic">Garantia ATLIVIO: R$ ${reservaCalculada.toFixed(2).replace('.', ',')}</p>
                </div>
                <span class="text-[6px] text-white font-bold uppercase tracking-tighter">Reserva de saldo segura</span>
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
        // 🚀 AÇÃO SINCRONIZADA: Mensagem + Atualização de Sinal para o Admin
        const batchMsg = [
            addDoc(collection(db, `chats/${orderId}/messages`), { 
                text: textoOriginal, sender_id: auth.currentUser.uid, timestamp: serverTimestamp() 
            }),
            updateDoc(doc(db, "orders", orderId), { 
                last_interaction_at: serverTimestamp(),
                chat_lifecycle_status: 'active'
            }),
            // 📡 O GATILHO: Avisa ao Admin que há algo novo. O Admin buscará o destinatário na coleção 'orders'
            updateDoc(doc(db, "chats", orderId), {
                last_message_read: false, 
                updated_at: serverTimestamp()
            })
        ];
        await Promise.all(batchMsg);
    } catch (e) { console.error("Erro no sinalizador de chat:", e); }
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

                // 🌀 LIQUIDIFICADOR DE ESCASSEZ V300: Prioriza SALDO REAL (PIX)
                // O bônus só é usado se o dinheiro real do usuário acabar.
                const processarDebitoHibrido = (snap, ref, valorDebito, uidDestino) => {
                    let rBal = parseFloat(snap.data().wallet_balance || 0); // Cofre Real
                    let rBonus = parseFloat(snap.data().wallet_bonus || 0); // Cofre de Marketing
                    let rRes = parseFloat(snap.data().wallet_reserved || 0); // Cofre em Custódia

                    if (rBal >= valorDebito) {
                        rBal -= valorDebito; // Queima o saldo real primeiro para gerar lucro
                    } else {
                        const resto = valorDebito - rBal;
                        rBal = 0;
                        rBonus -= resto; // Usa o bônus apenas para cobrir a falta
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
            
            // 🔄 SINCRONIA DE LEITURAS (V2026): Alvo ajustado para o Cofre de Taxas (Stats)
            const atlivioStatsRef = doc(db, "sys_finance", "stats");
            const [orderSnap, configFinSnap, statsSnap] = await Promise.all([
                transaction.get(orderRef),
                transaction.get(configFinRef),
                transaction.get(atlivioStatsRef)
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

            // 🛡️ ABATE DE RESERVA ATÔMICO: Garante que a reserva morra ao liquidar
            transaction.update(clientRef, { 
                wallet_reserved: increment(-Number(resCliente.toFixed(2))), // ◄── VÍRGULA ADICIONADA E COERÇÃO NUMÉRICA
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
                const saldoStatsAtual = statsSnap.exists() ? (statsSnap.data().total_revenue || 0) : 0;

                if (deficitTotal > 0 && saldoStatsAtual < deficitTotal) {
                    throw `Liquidação Negada: A plataforma não possui saldo em taxas (R$ ${saldoStatsAtual.toFixed(2)}) para completar o pagamento (Déficit: R$ ${deficitTotal.toFixed(2)}).`;
                }
                
                valorParaInjetarNoSaldo = Number((resCliente + (resProvider - valorTaxaAtlivioP)).toFixed(2));

                // Se houver déficit, o abatimento ocorre no balde de TAXAS (total_revenue)
                if (deficitTotal > 0) {
                    transaction.update(atlivioStatsRef, { 
                        total_revenue: increment(-Number(deficitTotal.toFixed(2))),
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

           // 💎 CAPTURA DE LUCRO (V2026): A taxa do serviço é enviada para o cofre de taxas (STATS)
            if (receitaPlataforma > 0) {
                transaction.update(atlivioStatsRef, {
                    total_revenue: increment(Number(receitaPlataforma.toFixed(2))),
                    ultima_atualizacao: serverTimestamp()
                });
                console.log(`✅ [COFRE CHAT] Receita de R$ ${receitaPlataforma} consolidada em STATS.`);
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

    if (pedido.status === 'accepted' || step < 3) {
        return `
        <div class="bg-amber-50 border-b border-amber-100 px-4 py-1.5 shadow-sm">
            <p class="text-[8px] text-amber-900 leading-tight font-medium text-center">
                💡 <span class="font-black text-amber-800 uppercase">Dica:</span> Reserva confirmada tem prioridade. <span class="font-black text-red-600">⚠️ PROIBIDO CONTATOS ANTES DO ACORDO.</span>
            </p>
        </div>`;
    }
    return '';
}

function atualizarRelogioDOM(pedido) {
    const displayUltimato = document.getElementById('timer-ultimato');
    const displayTimer = document.getElementById('timer-display');

    // 🚨 VIGIA DO ULTIMATO (Versão Corrigida V12)
    if (pedido.modo_ultimato && pedido.ultimato_expira) {
        const agora = Date.now();
        const restante = pedido.ultimato_expira - agora;
        
       if (restante <= 0) {
            // 🔒 V115: Torna o card inútil e visualmente bloqueado
            const banner = document.getElementById('banner-fechamento-v12');
            if (banner) {
                banner.style.opacity = "0.5"; // Fica "apagado"
                banner.style.pointerEvents = "none"; // Ninguém consegue clicar em nada
                banner.classList.remove('animate-ultimato'); // Para de pulsar
            }
            
            if (displayUltimato) displayUltimato.innerText = "🚨 OFERTA EXPIRADA";
            
            // Só dispara o fechamento no banco se ainda não estiver fechado
            if (pedido.status !== 'negotiation_closed') {
                const currentId = pedido.id || window.lastOpenedOrderId;
                window.encerrarNegociacaoSilenciosa(currentId);
            }
            return;
        } 
        else if (displayUltimato && restante > 0) {
            const m = Math.floor((restante % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((restante % 60000) / 1000).toString().padStart(2, '0');
            displayUltimato.innerText = `🚨 CASO VOCÊ NÃO ACEITE A PROPOSTA ESSE CHAT SE ENCERRARÁ EM ${m}:${s}`;
        }
    }

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
    /* ✅ V109: O Prestador finaliza a execução, mas NÃO LIQUIDA o financeiro. */
    if(!confirm("🏁 CONCLUIR O TRABALHO?\n\nIsso avisará o cliente para realizar o pagamento final.")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'completed', 
            real_end: serverTimestamp(),
            // Mantemos no Step 3 para o botão de PAGAR do cliente continuar visível
            system_step: 3 
        });
        await addDoc(collection(db, `chats/${orderId}/messages`), { 
            text: `🏁 O Prestador marcou o serviço como CONCLUÍDO. Aguardando liberação do pagamento pelo Cliente.`, 
            sender_id: 'system', 
            timestamp: serverTimestamp() 
        });
    } catch(e) { console.error("Erro ao finalizar trabalho:", e); }
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
            status: 'negotiation_closed'.toLowerCase(),
            closed_by: auth.currentUser.uid,
            closed_at: serverTimestamp(),
            system_step: 0 // Zera etapas
        });

        // Avisa no chat (última mensagem)
        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: `✋ NEGOCIAÇÃO ENCERRADA: O chat foi movido para o arquivo.`,
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

    const categoriaId = pedidoData.service_category_id || "gerais";
    const infoCategoria = (window.CATEGORIAS_ATIVAS || []).find(c => c.id === categoriaId) || { minPrice: 20 };
    const valorMinimo = infoCategoria.minPrice;

    const valorStr = prompt(`💰 VALOR DA PROPOSTA (Mínimo R$ ${valorMinimo}):`);
    if (!valorStr) return;
    const valor = parseFloat(valorStr.replace(',', '.'));

    if (isNaN(valor) || valor < valorMinimo) {
        return alert(`⛔ VALOR INVÁLIDO\nO valor mínimo permitido é R$ ${valorMinimo.toFixed(2)}.`);
    }

    const beneficio = prompt("🎁 BENEFÍCIO EXTRA (Ex: Material incluso, Garantia estendida):");
    const labelBeneficio = beneficio ? beneficio.toUpperCase() : "QUALIDADE PREMIUM GARANTIDA";

    try {
        await updateDoc(doc(db, "orders", orderId), {
            offer_value: valor,
            offer_bonus: beneficio || "",
            provider_confirmed: false, 
            client_confirmed: false
        });

        // 💎 V78: MODELO PERFECT FRAME (Geometria 67 + Fidelidade Absoluta)
        const htmlProposta = `
            <div class="my-3 border-2 border-[#fbbf24] rounded-xl overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.8)] bg-[#020617] animate-fadeIn mx-auto w-[340px] max-w-[340px] min-h-[75px]">
                <div class="bg-black text-[#fbbf24] text-[7px] font-black text-center py-1 uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-b border-[#fbbf24]">
                    <span>💎</span> NOVA PROPOSTA COMERCIAL <span>💎</span>
                </div>
                
                <div class="p-3 flex flex-row items-center justify-between w-full">
                    <div class="flex flex-col items-start leading-tight">
                        <p class="text-white text-[8px] font-black uppercase tracking-tighter m-0">Investimento Total</p>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-[#fbbf24] text-[11px] font-black">R$</span>
                            <span class="text-[#fbbf24] text-[1.25rem] font-black tracking-tighter drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">${valor.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>

                    <div class="bg-[rgba(251,191,36,0.15)] px-2.5 py-1.5 rounded-lg border border-[#fbbf24]/30 flex items-center gap-2 mx-1">
                        <span class="text-base">🎁</span>
                        <div class="flex flex-col">
                            <p class="text-[#fbbf24] text-[8px] font-black uppercase leading-[1] m-0">${labelBeneficio}</p>
                            <p class="text-[#fbbf24]/60 text-[5px] font-bold uppercase m-0">Exclusivo</p>
                        </div>
                    </div>

                    <div class="max-w-[85px] text-right">
                        <p class="text-white text-[7.5px] font-black leading-[1.1] m-0">
                            Para aceitar, clique em <span class="text-[#22c55e] drop-shadow-[0_0_5px_#22c55e]">🤝 ACEITAR E FECHAR</span> no topo.
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
        
    } catch (e) { 
        console.error("Erro proposta V34:", e); 
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
    if(!confirm("✋ ENCERRAR E OCULTAR?\n\nA conversa será movida para o arquivo morto e não aparecerá mais na sua lista.\n\nConfirmar?")) return;
    try {
        await updateDoc(doc(db, "orders", orderId), { 
            status: 'archived', // Status especial para o Limbo
            archived_by: auth.currentUser.uid,
            closed_at: serverTimestamp() 
        });
        alert("✅ Conversa arquivada com sucesso.");
        
        // 🧼 FAXINA DE MEMÓRIA GINA: Mata o ID antigo para não ressuscitar
        window.lastOpenedOrderId = null; 
        if (window.unsubscribeChat) { 
            window.unsubscribeChat(); 
            window.unsubscribeChat = null; 
        }
        
        console.log("🧹 Memória global limpa. O próximo chat será 100% novo.");
        window.voltarParaListaPedidos();
    } catch(e) { 
        console.error("Erro ao arquivar:", e); 
    }
};

window.exibirAlertaSegurancaReserva = () => {
    alert("🔐 PROTEÇÃO ATLIVIO:\n\nAo fechar o acordo, o valor da garantia fica guardado com a plataforma e só é liberado ao profissional após você confirmar que o serviço foi concluído.");
};
window.confirmarEncerramentoChat = async (orderId) => {
    if(!confirm("✋ DESEJA ENCERRAR ESTE CHAT?")) return;
    try {
        // 1. Para de ouvir o chat atual
        if (window.unsubscribeChat) { window.unsubscribeChat(); window.unsubscribeChat = null; }
        
        // 2. Atualiza o banco
        const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(window.db, "orders", orderId), { 
            status: 'negotiation_closed'.toLowerCase(),
            closed_at: serverTimestamp(),
            chat_lifecycle_status: 'expired'
        });

        // 3. 💣 O GOLPE FINAL: Limpa qualquer trava visual do Request
        const btnReq = document.getElementById('btn-confirm-req');
        if(btnReq) { btnReq.disabled = false; btnReq.dataset.loading = "false"; }

        alert("Conversa encerrada.");
        window.voltarParaListaPedidos(); // Volta para a tela de serviços
    } catch(e) { console.error("Erro ao encerrar:", e); }
};

// 🛡️ MOTOR DE EDUCAÇÃO E SEGURANÇA CHAT V13 (POSICIONAMENTO GARANTIDO)
async function verificarOnboardingChat(uid) {
    const userRef = doc(db, "usuarios", uid);
    const snap = await getDoc(userRef);
    
    // Se o campo for true, encerra. Se for false ou não existir, prossegue.
    if (snap.exists() && snap.data().chat_onboarding_seen === true) return;

    const onboardingHtml = `
        <div id="chat-onboarding" class="my-6 border-2 border-blue-400 rounded-xl overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.8)] bg-[#020617] animate-slideUp mx-auto w-[340px] max-w-[340px] min-h-[75px] z-[50]">
            <div class="bg-blue-600 text-white text-[7px] font-black text-center py-1 uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-b border-blue-400">
                <span>🛡️</span> NEGOCIAÇÃO SEGURA ATLIVIO <span>🛡️</span>
            </div>
            
            <div class="p-3 flex flex-row items-center justify-between w-full">
                <div class="flex flex-col items-start leading-tight flex-1 pr-2">
                    <p class="text-white text-[8px] font-black uppercase tracking-tighter m-0">Atenção às Regras</p>
                    <p class="text-blue-400 text-[10px] font-bold leading-tight mt-1">Troca de contatos liberada apenas após o acordo.</p>
                </div>

                <div class="flex flex-col gap-1 items-end">
                    <button onclick="window.confirmarLeituraRegras('${uid}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-md active:scale-95 transition whitespace-nowrap">
                        🤝 ENTENDI
                    </button>
                    <p class="text-white/40 text-[5px] font-bold uppercase m-0">Segurança ATLÍVIO</p>
                </div>
            </div>
        </div>`;

    // 🚀 TENTATIVA RECURSIVA: Espera a área de bolhas carregar para injetar no final
    let checkExist = setInterval(() => {
        const areaAlvo = document.getElementById('bubbles-area');
        if (areaAlvo) {
            // Remove duplicata se houver
            document.getElementById('chat-onboarding')?.remove();
            
            areaAlvo.insertAdjacentHTML('beforeend', onboardingHtml);
            clearInterval(checkExist);
            console.log("💉 Onboarding injetado no final do chat com sucesso.");
            
            // Força a rolagem para o usuário ver o balão
            setTimeout(() => { if(window.rolarChatParaBaixo) window.rolarChatParaBaixo(); }, 300);
        }
    }, 500);

    // Timeout de segurança para não rodar infinito
    setTimeout(() => clearInterval(checkExist), 5000);
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
window.toggleFerramentasChat = () => {
    const gaveta = document.getElementById('gaveta-ferramentas');
    const icone = document.getElementById('icon-ferramentas');
    const texto = document.getElementById('txt-ferramentas');
    
    if (gaveta.classList.contains('hidden')) {
        gaveta.classList.remove('hidden');
        icone.innerText = "➖";
        texto.innerText = "Recolher";
    } else {
        gaveta.classList.add('hidden');
        icone.innerText = "➕";
        texto.innerText = "Mais Opções";
    }
    // Garante que o scroll ajuste após mudar o tamanho do rodapé
    if(window.rolarChatParaBaixo) window.rolarChatParaBaixo();
};
window.ativarModoUltimato = async (orderId) => {
    if (!confirm("🚨 ATENÇÃO. AVISE AO CLIENTE ANTES DE ENVIAR. \n\nATIVAR ÚLTIMA OFERTA? Isso iniciará um cronômetro de pressão para a outra parte. Se ele não aceitar a tempo, a negociação será ENCERRADA AUTOMATICAMENTE.\n\nConfirmar envio?")) return;

    const minutos = prompt("Em quantos minutos a oferta expira?", "5");
    const tempoFinal = Date.now() + (parseInt(minutos) * 60000);

    try {
        await updateDoc(doc(db, "orders", orderId), {
            modo_ultimato: true,
            ultimato_expira: tempoFinal,
            offer_bonus: "🔥 ÚLTIMA CHANCE: ACEITE AGORA OU PERDERÁ A VAGA"
        });

        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: `🔥 O prestador enviou um ULTIMATO! Esta proposta expira em ${minutos} minutos.`,
            sender_id: 'system',
            timestamp: serverTimestamp()
        });
    } catch (e) { console.error(e); }
};

// Função para o sistema matar o chat sem perguntar ao usuário
// 🛡️ V114: Função de Encerramento com Trava de Segurança (Evita Spam/Duplicidade)
window.encerrarNegociacaoSilenciosa = async (orderId) => {
    if (!orderId || window.bloqueioDisparoUltimato === orderId) return;
    
    // 🔒 Ativa a trava imediata na memória para evitar que o próximo segundo do cronômetro dispare
    window.bloqueioDisparoUltimato = orderId;

    try {
        const { doc, updateDoc, addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const orderRef = doc(db, "orders", orderId);

        // 📝 Grava no banco a trava 'negotiation_closed: true' para silenciar o Lazarus e outros robôs
        await updateDoc(orderRef, {
            status: 'negotiation_closed',
            negotiation_closed: true, // 🚩 Sincronia: Esta é a trava que faltava no Robô 03
            closed_by: 'system_ultimato',
            closed_at: serverTimestamp()
        });

        // 💬 Envia apenas UMA mensagem de sistema
        await addDoc(collection(db, `chats/${orderId}/messages`), {
            text: `🤝 NEGOCIAÇÃO ENCERRADA: O prazo de resposta expirou.`,
            sender_id: 'system',
            timestamp: serverTimestamp()
        });

        console.log("✅ Chat encerrado com sucesso e trava ativada.");
    } catch(e) { 
        console.error("Erro no auto-close:", e);
        window.bloqueioDisparoUltimato = null; // Libera a trava apenas em caso de erro real
    }
};

// ============================================================================
// 🕒 SISTEMA LAZARUS: VIGILANTE DE VIDA ÚTIL DO CHAT
// ============================================================================
window.verificarVidaUtilChat = async (pedido) => {
    // 🛡️ TRAVA DE SEGURANÇA: Não mexe em serviços pagos (Step 3+) ou já encerrados
    if (pedido.system_step >= 3 || ['completed', 'archived', 'negotiation_closed'].includes(pedido.status)) return;

    const agora = Date.now();
    // Recupera a última interação (ou a criação do pedido se nunca houve chat)
    // 🛡️ DESFIBRILADOR LAZARUS: Se o pedido nasceu sem carimbo, cura ele automaticamente agora
    if (!pedido.last_interaction_at || !pedido.system_step) {
        console.log("💉 Lazarus: Curando pedido incompleto detectado na abertura...");
        const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        updateDoc(doc(window.db, "orders", pedido.id), {
            last_interaction_at: pedido.created_at || serverTimestamp(),
            system_step: pedido.system_step || 1,
            chat_lifecycle_status: 'active'
        });
        // Segue a função usando o tempo atual para não travar a primeira execução
    }
    
    
    const ultimaInteracao = pedido.last_interaction_at ? 
        (pedido.last_interaction_at.toMillis ? pedido.last_interaction_at.toMillis() : Date.now()) : 
        (pedido.created_at && pedido.created_at.toMillis ? pedido.created_at.toMillis() : Date.now());
    const horasPassadas = (agora - ultimaInteracao) / (1000 * 60 * 60);

    // 🧠 LÓGICA DE TIERS ACELERADA V25 (Minutos em vez de Horas)
    const minutosPassados = (agora - ultimaInteracao) / (1000 * 60);
    
    let limiteMorte = 30; // Tier 1: Mata o chat em 30 minutos de silêncio total
    if (pedido.offer_value > 0) limiteMorte = 60; // Tier 2: Se tiver proposta, dá 1 hora
    
    const limiteAviso = 15; // Dispara aviso com 15 minutos de silêncio

    // 🔴 ESTADO 3: ENCERRAMENTO POR INATIVIDADE (Morte do Chat)
    if (minutosPassados >= limiteMorte) {
        console.warn(`💀 Lazarus: Pedido ${pedido.id} expirou.`);
        if (window.encerrarNegociacaoSilenciosa) {
            window.encerrarNegociacaoSilenciosa(pedido.id, "Encerrado por inatividade");
        }
        return;
    }

    // 🟡 ESTADO 2: O RESGATE DO MAESTRO (Aviso Premium após 15 min)
    if (minutosPassados >= limiteAviso && pedido.chat_lifecycle_status !== 'warning') {
        console.log(`🛰️ Maestro: Resgatando usuário no pedido ${pedido.id}`);
        
        try {
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            // Marca no banco que o aviso foi disparado para não travar o celular do usuário com spam
            await updateDoc(doc(window.db, "orders", pedido.id), { chat_lifecycle_status: 'warning' });

            // 💎 V126: Maestro Inteligente - Fala a língua de quem está ouvindo
            if (window.mostrarBarraNotificacao) {
                const souPrestador = window.auth?.currentUser?.uid === pedido.provider_id;
                
                const configMaestro = souPrestador ? {
                    type: 'alert',
                    action: 'chat', // Mantém o prestador no chat para ele insistir
                    message: "O cliente silenciou? 🤐 Envie um ultimato ou tente outra oportunidade!"
                } : {
                    type: 'chat',
                    action: 'services', // Manda o cliente procurar outro profissional
                    message: "A negociação parou? ⏳ Não perca tempo, veja outros profissionais ativos!"
                };

                window.mostrarBarraNotificacao(pedido.id, configMaestro);
            }
        } catch (e) { console.error("Erro no resgate Maestro:", e); }
    }
};
/**
 * 🕒 DESPERTADOR LAZARUS V26 (Sincronizado)
 * Esta função substitui o gatilho automático por um comando controlado pelo Maestro.
 * Agora ele só executa a varredura se o usuário estiver autenticado.
 */
window.ativarDespertadorLazarus = async function() {
    console.log("🕒 Lazarus: Iniciando despertador de chats ativos...");
    
    if (!window.db || !window.verificarVidaUtilChat) {
        return console.warn("🤖 Lazarus: Banco de dados ainda não disponível.");
    }

    try {
        // Importação dinâmica para economizar memória em dispositivos humildes
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🔍 VARREDURA SEGURA V27: O Lazarus agora só vigia os SEUS pedidos.
        // Isso respeita as Rules do Firebase e elimina o erro de permissão no console.
        const uid = window.auth?.currentUser?.uid;
        if (!uid) return console.warn("🤖 Lazarus: Aguardando identificação para iniciar vigia.");

        // Criamos duas buscas rápidas: uma como cliente e outra como prestador
        const qCliente = query(collection(window.db, "orders"), where("client_id", "==", uid), where("status", "in", ["pending", "accepted"]));
        const qPrestador = query(collection(window.db, "orders"), where("provider_id", "==", uid), where("status", "in", ["pending", "accepted"]));

        const [snapC, snapP] = await Promise.all([getDocs(qCliente), getDocs(qPrestador)]);
        
        // Unifica os resultados para o Lazarus processar
        const docsParaVigiar = [...snapC.docs, ...snapP.docs];
        
        // 🔄 LOOP DE VIGIA: Percorre a lista unificada de pedidos (Cliente + Prestador)
        docsParaVigiar.forEach(d => {
            window.verificarVidaUtilChat({id: d.id, ...d.data()});
        });

        console.log(`✅ Lazarus: Varredura concluída (${docsParaVigiar.length} pedidos vigiados).`);
    } catch (e) { 
        console.error("❌ Erro na varredura Lazarus:", e.message); 
    }
};
