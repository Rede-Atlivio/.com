// ============================================================================
// js/modules/request.js - V10.1 (STACK + OFFLINE GUARD + TIMER)
// ============================================================================

import { db, auth } from '../config.js'; 
import { podeTrabalhar } from './wallet.js'; 
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE MEMÓRIA ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;
let mem_SelectedServiceTitle = ""; 

// --- GATILHOS ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
    }
});

// ============================================================================
// 1. MODAL DE SOLICITAÇÃO (CLIENTE)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    // Sincroniza regras
    try {
        const configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if (configSnap.exists()) window.configFinanceiroAtiva = configSnap.data();
    } catch (e) { console.error("Erro config:", e); }
    
    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    
    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        const containerServicos = document.getElementById('service-selection-container');
        
        try {
            if(containerServicos) containerServicos.innerHTML = `<div class="loader border-blue-500 mx-auto"></div>`;
            const docSnap = await getDoc(doc(db, "active_providers", providerId));
            let servicos = (docSnap.exists() && docSnap.data().services) ? docSnap.data().services : [];

            let htmlSelect = "";
            if (servicos.length > 0) {
                htmlSelect = `
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Escolha o Serviço:</label>
                    <select id="select-service-type" onchange="window.mudarServicoSelecionado(this)" class="w-full bg-blue-50 border border-blue-200 text-gray-800 text-sm rounded-lg p-3 font-bold mb-3 outline-none">
                        ${servicos.map((s) => `
                            <option value="${s.price}" data-title="${s.title || s.category}">
                                ${s.title || s.category} - R$ ${s.price}
                            </option>
                        `).join('')}
                    </select>
                `;
                mem_BasePrice = parseFloat(servicos[0].price);
                mem_SelectedServiceTitle = servicos[0].title || servicos[0].category;
            } else {
                htmlSelect = `<p class="text-sm font-bold text-gray-700 mb-2">Serviço Geral</p>`;
                mem_BasePrice = parseFloat(initialPrice);
                mem_SelectedServiceTitle = "Serviço Geral";
            }
            if(containerServicos) containerServicos.innerHTML = htmlSelect;
        } catch (e) {
            mem_BasePrice = parseFloat(initialPrice);
        }

        mem_CurrentOffer = mem_BasePrice;
        atualizarVisualModal();
        
        // Injeta botões de desconto dinâmicos
        const grids = modal.querySelectorAll('.grid');
        grids.forEach(div => { 
            if(div.innerHTML.includes('%')) {
                div.className = "grid grid-cols-4 gap-2 mb-3"; 
                div.innerHTML = `
                    <button onclick="window.selecionarDesconto(-0.10)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-10%</button>
                    <button onclick="window.selecionarDesconto(-0.05)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-5%</button>
                    <button onclick="window.selecionarDesconto(0.10)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+10%</button>
                    <button onclick="window.selecionarDesconto(0.20)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+20%</button>
                `;
            }
        });

        const btn = document.getElementById('btn-confirm-req');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ENVIAR SOLICITAÇÃO 🚀"; 
            btn.onclick = enviarPropostaAgora; 
        } 
    }
}

window.mudarServicoSelecionado = (select) => {
    mem_BasePrice = parseFloat(select.value);
    mem_CurrentOffer = mem_BasePrice;
    mem_SelectedServiceTitle = select.options[select.selectedIndex].getAttribute('data-title');
    atualizarVisualModal();
};

window.selecionarDesconto = (percent) => {
    mem_CurrentOffer = mem_BasePrice + (mem_BasePrice * parseFloat(percent));
    atualizarVisualModal();
};

window.ativarInputPersonalizado = () => {
    const input = document.getElementById('req-value');
    if(input) { input.disabled = false; input.focus(); input.style.border = "2px solid #3b82f6"; }
};

window.validarOferta = (val) => {
    let offer = parseFloat(String(val).replace(',', '.'));
    const config = window.configFinanceiroAtiva || { valor_minimo: 20 };
    const input = document.getElementById('req-value');
    const btn = document.getElementById('btn-confirm-req');

    if (isNaN(offer) || offer < config.valor_minimo) {
        if(input) input.style.borderColor = "red";
        if(btn) btn.disabled = true;
    } else {
        if(input) input.style.borderColor = "#e5e7eb";
        if(btn) btn.disabled = false;
        mem_CurrentOffer = offer;
    }
};

function atualizarVisualModal() {
    const inputValor = document.getElementById('req-value');
    // 1. PREPARAÇÃO DOS DADOS (RICH DATA)
    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * (config.porcentagem_reserva / 100);
    
    // Extração de dados ricos (Fallback se não houver foto/nome)
    const clientName = pedido.client_name || "Cliente";
    const clientPic = pedido.client_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=random&color=fff`;
    const clientRating = pedido.client_rating || "5.0"; // Padrão 5.0 se for novo
    const location = pedido.location || "Localização não informada";
    const serviceTitle = pedido.service_title || "Serviço Geral";

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = "request-card"; // Aciona o CSS V12 (Dark Blue)
    
    // 2. A ESTRUTURA HTML (PERFIL RICO V12)
    card.innerHTML = `
        <div class="card-details p-4">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <img src="${clientPic}" class="w-12 h-12 rounded-full border-2 border-white/20 shadow-sm object-cover">
                    <div>
                        <h3 class="text-white font-bold text-sm leading-tight">${clientName}</h3>
                        <div class="flex items-center text-yellow-400 text-xs gap-1">
                            <span>★ ${clientRating}</span>
                            <span class="text-slate-500 text-[10px]">• Novo</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="price-tag text-2xl">R$ ${valor.toFixed(0)}</div>
                    <div class="text-[9px] text-slate-400">Reserva: R$ ${taxa.toFixed(2)}</div>
                </div>
            </div>

            <div class="mb-5 pl-1 border-l-2 border-slate-700 ml-1">
                <h4 class="text-blue-200 font-black text-sm uppercase mb-1 pl-2">${serviceTitle}</h4>
                <div class="flex items-center gap-1 text-slate-400 text-xs pl-2">
                    <span>📍</span>
                    <span class="truncate max-w-[220px] font-medium">${location}</span>
                </div>
            </div>

            <div class="flex gap-3 items-stretch h-12">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="btn-reject w-12 rounded-xl flex items-center justify-center font-bold text-lg hover:bg-slate-700 transition">
                    ✕
                </button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="btn-accept flex-1 rounded-xl text-sm tracking-wide uppercase flex items-center justify-center gap-2 hover:scale-[1.02] transition">
                    <span>ACEITAR PEDIDO</span>
                    <span class="bg-white/20 px-2 rounded text-[10px]">🚀</span>
                </button>
            </div>
            
            <div class="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                <div class="timer-bar" id="timer-${pedido.id}"></div>
            </div>
        </div>

        <div class="card-summary hidden" onclick="window.minimizarPedido('${pedido.id}')">
            <div class="flex items-center gap-3">
                <img src="${clientPic}" class="w-8 h-8 rounded-full border border-slate-500">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white">${clientName}</span>
                    <span class="text-[10px] text-slate-400">${serviceTitle}</span>
                </div>
            </div>
            <div class="flex flex-col items-end">
                <span class="text-xs font-black text-green-400">R$ ${valor.toFixed(0)}</span>
                <span class="text-[8px] text-slate-500 animate-pulse">Aguardando...</span>
            </div>
        </div>
    `;

    container.appendChild(card);

    // ⏱️ TIMER AUTOMÁTICO (30 SEGUNDOS)
    // Inicia a animação da barra
    setTimeout(() => {
        const timerBar = document.getElementById(`timer-${pedido.id}`);
        if(timerBar) timerBar.style.width = '0%';
    }, 100);

    // Minimiza após 30s
    setTimeout(() => {
        const currentCard = document.getElementById(`req-${pedido.id}`);
        // Só minimiza se ainda existir e não tiver sido interagido
        if (currentCard && !currentCard.classList.contains('minimized')) {
            window.minimizarPedido(pedido.id);
        }
    }, 30000);
}

function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) {
        card.classList.add('removing');
        setTimeout(() => card.remove(), 300);
    }
}

window.minimizarPedido = (orderId) => {
    const card = document.getElementById(`req-${orderId}`);
    if(!card) return;

    const details = card.querySelector('.card-details');
    const summary = card.querySelector('.card-summary');

    if(card.classList.contains('minimized')) {
        // Ação: MAXIMIZAR (Volta ao card completo)
        card.classList.remove('minimized');
        if(details) details.style.display = 'block';
        if(summary) {
            summary.classList.add('hidden');
            summary.classList.remove('flex');
        }
    } else {
        // Ação: MINIMIZAR (Recolhe para a barra de oportunidades)
        card.classList.add('minimized');
        if(details) details.style.display = 'none';
        if(summary) {
            summary.classList.remove('hidden');
            summary.classList.add('flex');
        }
    }
};
export async function aceitarPedidoRadar(orderId) {
    const btn = document.querySelector(`#req-${orderId} .btn-accept`);
    if(btn) { btn.disabled = true; btn.innerText = "⏳ Verificando..."; }

    try {
        // 1. Busca dados frescos (Pedido, Usuário e Configurações Financeiras do Admin)
        const userUid = auth.currentUser.uid;
        const [orderSnap, userSnap, configSnap] = await Promise.all([
            getDoc(doc(db, "orders", orderId)),
            getDoc(doc(db, "usuarios", userUid)),
            getDoc(doc(db, "settings", "financeiro"))
        ]);

        if (!orderSnap.exists()) {
            removeRequestCard(orderId);
            return alert("❌ Este pedido expirou ou foi cancelado pelo cliente.");
        }

        // Sincroniza a regra de % do admin no momento do aceite
        const config = configSnap.exists() ? configSnap.data() : { porcentagem_reserva: 10 };
        window.configFinanceiroAtiva = config;

        // 2. CÁLCULO DA TAXA BASEADO NA CONFIGURAÇÃO DO PAINEL
        const valorServico = parseFloat(orderSnap.data().offer_value || 0);
        const taxaNecessaria = valorServico * (config.porcentagem_reserva / 100);
        
        // 3. VERIFICAÇÃO DE SALDO (TRAVA DE SEGURANÇA REAL-TIME)
        const saldoAtual = parseFloat(userSnap.data().wallet_balance || 0);
        
        if (saldoAtual < taxaNecessaria) {
            alert(`⛔ SALDO INSUFICIENTE\n\nEste serviço requer R$ ${taxaNecessaria.toFixed(2)} de garantia em conta (Taxa de ${config.porcentagem_reserva}%).\nSeu saldo atual: R$ ${saldoAtual.toFixed(2)}.\n\nPor favor, faça uma recarga na aba Carteira para aceitar este pedido.`);
            
            if(window.switchTab) window.switchTab('ganhar');
            if(btn) { btn.disabled = false; btn.innerText = "ACEITAR PEDIDO"; }
            return;
        }

        // 4. SUCESSO: Processa o aceite e vincula o prestador
        await setDoc(doc(db, "orders", orderId), { 
            status: 'accepted', 
            accepted_at: serverTimestamp(),
            provider_id: userUid 
        }, { merge: true });
        
        await setDoc(doc(db, "chats", orderId), { 
            status: 'active',
            updated_at: serverTimestamp()
        }, { merge: true });

        // Feedback visual e sonoro
        const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg');
        audio.play().catch(()=>{});

        removeRequestCard(orderId);
        
        if(window.switchTab) {
            window.switchTab('chat');
            setTimeout(() => {
                 if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
            }, 600);
        }

    } catch (e) { 
        console.error("Erro crítico no aceite:", e);
        alert("Erro ao processar aceite: " + e.message); 
        if(btn) { btn.disabled = false; btn.innerText = "ACEITAR PEDIDO"; }
    }
}

export async function recusarPedidoReq(orderId) {
    removeRequestCard(orderId);
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
}

// EXPOSIÇÃO GLOBAL
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.minimizarPedido = minimizarPedido;
window.iniciarRadarPrestador = iniciarRadarPrestador;
