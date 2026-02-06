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
// 2. RADAR DO PRESTADOR (SINCRONIA REAL-TIME)
// ============================================================================
export async function iniciarRadarPrestador(uid) {
    const configRef = doc(db, "settings", "financeiro");
    onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) window.configFinanceiroAtiva = docSnap.data();
    });

    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") mostrarModalRadar({ id: change.doc.id, ...change.doc.data() });
            if (change.type === "removed") fecharModalRadar();
        });
    });
}

function mostrarModalRadar(pedido) {
    let modal = document.getElementById('modal-radar-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-radar-container';
        modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4";
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');

    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * (config.porcentagem_reserva / 100);

    modal.innerHTML = `
        <div class="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700 overflow-hidden">
            <div class="p-6 text-center">
                <h1 class="text-4xl font-black text-white">R$ ${valor.toFixed(0)}</h1>
                <p class="text-blue-300 text-sm">${pedido.service_title}</p>
                <p class="text-[10px] text-gray-500 mt-2">Taxa Aceite: R$ ${taxa.toFixed(2)} (${config.porcentagem_reserva}%)</p>
            </div>
            <div class="grid grid-cols-2 border-t border-slate-700">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="py-4 text-gray-400 font-bold uppercase text-xs">Recusar</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="py-4 bg-green-600 text-white font-black uppercase text-xs">Aceitar</button>
            </div>
        </div>
    `;
}

function fecharModalRadar() {
    const el = document.getElementById('modal-radar-container');
    if (el) el.classList.add('hidden');
}

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
