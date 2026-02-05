// ============================================================================
// js/modules/request.js - ATUALIZAÇÃO V11.0 MASTER
// ============================================================================

import { db, auth } from '../config.js'; 
import { SERVICOS_PADRAO, CATEGORIAS_ATIVAS } from './services.js';
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
// 1. MODAL DE SOLICITAÇÃO (CONTROLE DINÂMICO ADMIN)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    // --- 1. BUSCA REGRAS DO ADMIN (FONTE: settings/financeiro) ---
    let configAdmin = { valor_minimo: 20, valor_maximo: 500, porcentagem_reserva: 10 }; 
    try {
        const configSnap = await getDoc(doc(db, "settings", "financeiro"));
        if (configSnap.exists()) {
            configAdmin = configSnap.data();
        }
    } catch (e) { console.error("Erro ao sincronizar regras:", e); }
    
    window.configFinanceiroAtiva = configAdmin; 

    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    
    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        const containerServicos = document.getElementById('service-selection-container');
        
        try {
            if(containerServicos) containerServicos.innerHTML = `<div class="loader border-blue-500 mx-auto"></div>`;
            const docSnap = await getDoc(doc(db, "active_providers", providerId));
            let htmlSelect = "";
            let servicos = [];

            if (docSnap.exists() && docSnap.data().services) {
                servicos = docSnap.data().services;
            }

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
        injetarBotoesOferta(modal);

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

function injetarBotoesOferta(modal) {
    const containers = modal.querySelectorAll('.grid'); 
    let targetContainer = null;
    containers.forEach(div => { if(div.innerHTML.includes('%')) targetContainer = div; });

    if(targetContainer) {
        targetContainer.className = "grid grid-cols-4 gap-2 mb-3"; 
        targetContainer.innerHTML = `
            <button onclick="window.selecionarDesconto(-0.10)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-10%</button>
            <button onclick="window.selecionarDesconto(-0.05)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100">-5%</button>
            <button onclick="window.selecionarDesconto(0.10)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+10%</button>
            <button onclick="window.selecionarDesconto(0.20)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100">+20%</button>
        `;
    }
}

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
    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const ofertaSegura = parseFloat(mem_CurrentOffer) || 0;

    if(inputValor) inputValor.value = ofertaSegura.toFixed(2).replace('.', ','); 
    
    const valorReserva = ofertaSegura * (config.porcentagem_reserva / 100);
    const elTotal = document.getElementById('calc-total-reserva');
    if(elTotal) { 
        elTotal.innerHTML = `
            <div class="flex flex-col items-center">
                <span class="text-lg font-black text-gray-800">R$ ${ofertaSegura.toFixed(2).replace('.', ',')}</span>
                <span class="text-[9px] text-blue-600 font-bold uppercase">Reserva: R$ ${valorReserva.toFixed(2).replace('.', ',')}</span>
            </div>
        `; 
    }
    window.validarOferta(ofertaSegura);
}

export async function enviarPropostaAgora() {
    const user = auth.currentUser;
    // Fallback para evitar erro se a config não carregar
    const config = window.configFinanceiroAtiva || { valor_minimo: 20, valor_maximo: 500 };
    
    // Validação de segurança básica
    if (mem_CurrentOffer < config.valor_minimo || mem_CurrentOffer > config.valor_maximo) {
        return alert(`⛔ Valor fora do permitido (R$ ${config.valor_minimo} - R$ ${config.valor_maximo})`);
    }

    try {
        // 1. CRIA O PEDIDO NO BANCO
        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            provider_id: mem_ProviderId,
            provider_name: mem_ProviderName,
            service_title: mem_SelectedServiceTitle,
            status: 'pending', 
            offer_value: mem_CurrentOffer,
            location: document.getElementById('req-local')?.value || "A combinar",
            created_at: serverTimestamp()
        });

        // 2. CRIA A SALA DE CHAT
        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp()
        });

        alert("✅ SOLICITAÇÃO ENVIADA! Redirecionando para o chat...");
        
        // Fecha o modal visualmente
        const modal = document.getElementById('request-modal');
        if(modal) modal.classList.add('hidden');

        // 🚀 O COMANDO DE ROTA (AQUI ESTÁ A CORREÇÃO)
        const tabChat = document.getElementById('tab-chat');
        if(tabChat) {
            console.log("🔄 Redirecionando para aba de Chats...");
            tabChat.click(); // O clique que o Robô Piloto testou
            
            // Força a atualização da lista após a animação de troca
            setTimeout(() => {
                if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
            }, 600);
        }

    } catch (e) { 
        console.error("Erro ao enviar:", e);
        alert("Erro: " + e.message); 
    }
}

// ============================================================================
// 2. RADAR DO PRESTADOR (STACK V10.0 - UBER STYLE)
// ============================================================================
export async function iniciarRadarPrestador(uid) {
    const configRef = doc(db, "settings", "financeiro");
    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) window.configFinanceiroAtiva = docSnap.data();
    });

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            // AJUSTE CRÍTICO: Passamos o ID e Data separadamente para evitar erro de referência
            if (change.type === "added") createRequestCard({ id: change.doc.id, ...change.doc.data() });
            // AJUSTE CRÍTICO: Removemos apenas o card específico, não fecha tudo
            if (change.type === "removed") removeRequestCard(change.doc.id);
        });
    });
}

function createRequestCard(pedido) {
    const container = document.getElementById('radar-container');
    if (!container) return console.error("Container Radar não encontrado!");

    // 1. Evita duplicidade (Se já existe, não desenha de novo)
    if (document.getElementById(`req-${pedido.id}`)) return;

    // 2. Limite de Stack (Mata o mais antigo se tiver mais de 5)
    if (container.children.length >= 5) {
        const oldest = container.firstElementChild;
        if (oldest) oldest.remove();
    }

    // 3. Toca o som
    const audio = document.getElementById('notification-sound');
    if (audio) { audio.currentTime = 0; audio.play().catch(e => console.log("Audio bloqueado")); }

    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * (config.porcentagem_reserva / 100);
    const distance = pedido.location || "Local não informado";

    const card = document.createElement('div');
    card.id = `req-${pedido.id}`;
    card.className = "request-card"; // Classe CSS definida no Passo 01
    
    // HTML INTERNO DO CARD (Versão Minimizável)
    card.innerHTML = `
        <div class="card-details p-4">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-1 rounded uppercase">Novo Pedido</span>
                    <h3 class="text-xl font-black text-slate-800 mt-1">${pedido.service_title}</h3>
                </div>
                <div class="text-right">
                    <h2 class="text-2xl font-black text-green-600">R$ ${valor.toFixed(0)}</h2>
                    <p class="text-[9px] text-gray-400 font-bold">Taxa: R$ ${taxa.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="flex items-center gap-2 text-gray-500 text-xs mb-4 bg-gray-50 p-2 rounded-lg">
                <span>📍</span>
                <span class="font-bold truncate">${distance}</span>
            </div>

            <div class="grid grid-cols-4 gap-2">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="col-span-1 bg-red-50 text-red-500 rounded-lg font-bold text-xs py-3 hover:bg-red-100 transition">✖</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="col-span-2 bg-blue-600 text-white rounded-lg font-black text-xs uppercase py-3 shadow-lg hover:bg-blue-700 transition transform active:scale-95">ACEITAR AGORA</button>
                <button onclick="window.minimizarPedido('${pedido.id}')" class="col-span-1 bg-gray-100 text-gray-500 rounded-lg font-bold text-xs py-3 hover:bg-gray-200 transition" title="Minimizar">_</button>
            </div>
        </div>

        <div class="card-summary hidden items-center justify-between p-3 w-full h-full" onclick="window.minimizarPedido('${pedido.id}')">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                <span class="text-xs font-bold text-slate-700 truncate w-32">${pedido.service_title}</span>
            </div>
            <span class="text-xs font-black text-green-600">R$ ${valor.toFixed(0)}</span>
        </div>
    `;

    // Adiciona no topo da pilha (prepend) ou fim (append). Stack geralmente é append.
    container.appendChild(card);
}

function removeRequestCard(orderId) {
    const card = document.getElementById(`req-${orderId}`);
    if (card) {
        card.classList.add('removing'); // Gatilho de animação CSS
        setTimeout(() => card.remove(), 300); // Espera a animação acabar
    }
}

// NOVA FUNÇÃO: Lógica de Minimizar/Maximizar
window.minimizarPedido = (orderId) => {
    const card = document.getElementById(`req-${orderId}`);
    if(!card) return;

    if(card.classList.contains('minimized')) {
        // Maximizar
        card.classList.remove('minimized');
        card.querySelector('.card-details').style.display = 'block';
        card.querySelector('.card-summary').classList.add('hidden');
        card.querySelector('.card-summary').classList.remove('flex');
    } else {
        // Minimizar
        card.classList.add('minimized');
        card.querySelector('.card-details').style.display = 'none';
        card.querySelector('.card-summary').classList.remove('hidden');
        card.querySelector('.card-summary').classList.add('flex');
    }
};

export async function aceitarPedidoRadar(orderId) {
    // NÃO FECHA O MODAL AINDA. O usuário precisa ver o que está acontecendo.
    try {
        const uid = auth.currentUser.uid;
        
        // 1. Busca Configuração em Tempo Real
        // Usa limite 0 como fallback de segurança caso o Admin esteja vazio
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10, limite_divida: 0 };
        
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) {
            fecharModalRadar();
            return alert("Este pedido não existe mais.");
        }
        
        const valorServico = parseFloat(orderSnap.data().offer_value || 0);
        const taxaAceite = valorServico * (config.porcentagem_reserva / 100);

        const userSnap = await getDoc(doc(db, "usuarios", uid));
        const saldo = parseFloat(userSnap.data()?.wallet_balance || 0);

        // 2. A GRANDE TRAVA (Onde estava a falha de redirecionamento)
        if ((saldo - taxaAceite) < config.limite_divida) {
             alert(`⛔ SALDO INSUFICIENTE\n\nEste serviço requer R$ ${taxaAceite.toFixed(2)} para o aceite.\nSeu limite não permite essa operação.`);
             
             fecharModalRadar(); // Agora sim fecha o modal
             
             // Redirecionamento forçado para recarga
             if(window.switchTab) {
                 window.switchTab('ganhar');
             } else {
                 window.location.reload(); // Fallback de emergência
             }
             return; 
        }

       // 3. SUCESSO: Grava no banco e abre o chat
        await setDoc(doc(db, "orders", orderId), { 
            status: 'accepted', 
            accepted_at: serverTimestamp() 
        }, { merge: true });
        
        await setDoc(doc(db, "chats", orderId), { 
            status: 'active',
            updated_at: serverTimestamp()
        }, { merge: true });

        fecharModalRadar(); // Fecha o modal pois deu tudo certo
        
        // Redireciona para o Chat (CORREÇÃO DA AÇÃO 13)
        // Alterado de 'tab-servicos' para 'tab-chat' para levar aos pedidos em andamento
        const tabDestino = document.getElementById('tab-chat');
        
        if(tabDestino) {
            tabDestino.click();
            // Pequeno delay para garantir que a lista carregue
            setTimeout(() => {
                 if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
            }, 500);
        } else {
            console.warn("Botão tab-chat não encontrado. Tentando recarregar.");
            window.location.reload();
        }

    } catch (e) { 
        console.error("Erro no aceite:", e);
        alert("Erro ao processar: " + e.message); 
    }
}

export async function recusarPedidoReq(orderId) {
    fecharModalRadar();
    try { await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true }); } catch(e) { console.error(e); }
}

export async function recuperarPedidoRadar(orderId) {
    try {
        const snap = await getDoc(doc(db, "orders", orderId));
        if (snap.exists() && snap.data().status === 'pending') mostrarModalRadar({ id: snap.id, ...snap.data() });
    } catch (e) { console.error(e); }
}

// EXPOSIÇÃO GLOBAL PARA O HTML
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.recuperarPedidoRadar = recuperarPedidoRadar;
window.iniciarRadarPrestador = iniciarRadarPrestador;
