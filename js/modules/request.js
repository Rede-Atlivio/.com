// js/modules/request.js
// 1. IMPORTAÇÃO DO MOTOR CENTRAL (Obrigatório)
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
// 1. MODAL DE SOLICITAÇÃO (CONTROLE DINÂMICO ADMIN & ANTI-NaN)
// ============================================================================
export async function abrirModalSolicitacao(providerId, providerName, initialPrice) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    // --- 1. BUSCA REGRAS DO ADMIN PARA CÁLCULO DINÂMICO ---
    let configAdmin = { valor_minimo: 20, valor_maximo: 500, porcentagem_reserva: 10 }; 
try {
    const configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
    if (configSnap.exists()) {
        const d = configSnap.data();
        configAdmin = {
            valor_minimo: d.valor_minimo || 20,
            valor_maximo: d.valor_maximo || 500,
            porcentagem_reserva: d.porcentagem_reserva || 10,
            reserva_minima: d.reserva_minima || 20, // Mantém suporte a reserva se usar
            reserva_maxima: d.reserva_maxima || 200
        };
    }
} catch (e) { console.error("Erro ao sincronizar regras financeiras:", e); }
    
    // Armazena na janela para as outras funções de cálculo usarem
    window.configFinanceiroAtiva = configAdmin; 

    // --- 2. CONFIGURAÇÃO DOS DADOS DO PRESTADOR ---
    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    
    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        
        const elTitle = modal.querySelector('h3') || modal.querySelector('.font-bold'); 
        if(elTitle) elTitle.innerText = `Contratar ${providerName}`;

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
                    <select id="select-service-type" onchange="window.mudarServicoSelecionado(this)" class="w-full bg-blue-50 border border-blue-200 text-gray-800 text-sm rounded-lg p-3 font-bold mb-3 focus:ring-2 focus:ring-blue-500 outline-none">
                        ${servicos.map((s, idx) => `
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
            console.error("Erro ao carregar serviços:", e);
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
    const price = parseFloat(select.value);
    const title = select.options[select.selectedIndex].getAttribute('data-title');
    
    mem_BasePrice = price;
    mem_CurrentOffer = price; // Reseta a oferta para o preço base
    mem_SelectedServiceTitle = title;
    
    atualizarVisualModal(); // Recalcula totais
    
    // Animação visual de feedback
    const display = document.getElementById('calc-total-reserva');
    if(display) {
        display.classList.add('scale-110', 'text-blue-600');
        setTimeout(() => display.classList.remove('scale-110', 'text-blue-600'), 200);
    }
};

function injetarBotoesOferta(modal) {
    const containers = modal.querySelectorAll('.grid'); 
    let targetContainer = null;
    containers.forEach(div => { if(div.innerHTML.includes('%')) targetContainer = div; });

    if(targetContainer) {
        targetContainer.className = "grid grid-cols-4 gap-2 mb-3"; 
        targetContainer.innerHTML = `
            <button onclick="window.selecionarDesconto(-0.10)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100 transition">-10%</button>
            <button onclick="window.selecionarDesconto(-0.05)" class="bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-xs hover:bg-red-100 transition">-5%</button>
            <button onclick="window.selecionarDesconto(0.10)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100 transition">+10%</button>
            <button onclick="window.selecionarDesconto(0.20)" class="bg-green-50 text-green-600 border border-green-200 py-2 rounded-lg font-bold text-xs hover:bg-green-100 transition">+20%</button>
        `;
    }
}

export function selecionarDesconto(percent) {
    const p = parseFloat(percent);
    const base = mem_BasePrice; 
    mem_CurrentOffer = base + (base * p);
    atualizarVisualModal();
}

export function ativarInputPersonalizado() {
    const input = document.getElementById('req-value');
    if(input) { input.disabled = false; input.focus(); input.style.border = "2px solid #3b82f6"; }
}

export function validarOferta(val) {
    let offer = parseFloat(val);
    if(isNaN(offer)) return;

    const minAllowed = mem_BasePrice * 0.80; 
    const maxAllowed = mem_BasePrice * 1.30; 
    
    const input = document.getElementById('req-value');
    const btn = document.getElementById('btn-confirm-req');
    const aviso = document.getElementById('calc-total-reserva');

    if (offer < minAllowed || offer > maxAllowed) {
        if(input) { input.style.borderColor = "red"; input.style.color = "red"; }
        if(btn) { btn.disabled = true; btn.classList.add('opacity-50'); }
        if(aviso) { aviso.innerText = "Valor fora do limite"; aviso.style.color = "red"; }
    } else {
        if(input) { input.style.borderColor = "#e5e7eb"; input.style.color = "black"; }
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-50'); }
        if(aviso) { aviso.innerText = `R$ ${offer.toFixed(2)}`; aviso.style.color = "black"; }
        mem_CurrentOffer = offer;
    }
}

function atualizarVisualModal() {
    const inputValor = document.getElementById('req-value');
    // Busca a config do Admin salva na abertura do modal ou usa o padrão de segurança
    const config = window.configFinanceiroAtiva || { reserva_minima: 20, porcentagem_reserva: 10, reserva_maxima: 200 };

    // 🛡️ TRATAMENTO ANTI-NaN: Garante que oferta seja número puro
    const ofertaSegura = parseFloat(mem_CurrentOffer) || 0;

    if(inputValor) {
        // Exibe com vírgula para o usuário, mas mantém ponto internamente
        inputValor.value = ofertaSegura.toFixed(2).replace('.', ','); 
        inputValor.style.color = "black";
        inputValor.disabled = true; 
    }
    
    // CÁLCULO DINÂMICO DA RESERVA (Regra do seu Admin)
    const valorCalculado = ofertaSegura * (config.porcentagem_reserva / 100);
    const valorReserva = Math.max(config.reserva_minima, Math.min(valorCalculado, config.reserva_maxima));

    const elTotal = document.getElementById('calc-total-reserva');
    if(elTotal) { 
        // HTML limpo e direto para o usuário final
        elTotal.innerHTML = `
            <div class="flex flex-col items-center">
                <span class="text-lg font-black text-gray-800">R$ ${ofertaSegura.toFixed(2).replace('.', ',')}</span>
                <span class="text-[9px] text-blue-600 font-bold uppercase tracking-tighter">
                    Garantia Atlivio: R$ ${valorReserva.toFixed(2).replace('.', ',')}
                </span>
            </div>
        `; 
    }
    
    // Valida se o valor está dentro dos limites de 80% a 130% do preço base
    validarOferta(ofertaSegura);
}

export async function enviarPropostaAgora() {
    const user = auth.currentUser;
    if (!user) return alert("Sessão expirada.");

    // Busca limites do Admin ou usa Fallback
    const config = window.configFinanceiroAtiva || { valor_minimo: 20, valor_maximo: 500 };
    
    // Trava 1: Limites Absolutos do Sistema
    if (mem_CurrentOffer < config.valor_minimo || mem_CurrentOffer > config.valor_maximo) {
        return alert(`⛔ AÇÃO BLOQUEADA\n\nO sistema permite apenas valores entre R$ ${config.valor_minimo},00 e R$ ${config.valor_maximo},00.`);
    }

    // Trava 2: Margem de Negociação do Serviço (80% a 130%)
    const minMargem = mem_BasePrice * 0.80;
    const maxMargem = mem_BasePrice * 1.30;
    if (mem_CurrentOffer < minMargem || mem_CurrentOffer > maxMargem) {
        return alert(`⚠️ VALOR FORA DA MARGEM\n\nSua oferta deve estar entre R$ ${minMargem.toFixed(2)} e R$ ${maxMargem.toFixed(2)} para este serviço.`);
    }
    const btn = document.getElementById('btn-confirm-req'); 
    if(btn) { btn.innerText = "⏳ ENVIANDO..."; btn.disabled = true; }

    try {
        const dataServico = document.getElementById('req-date')?.value || "A combinar";
        const horaServico = document.getElementById('req-time')?.value || "A combinar";
        const localServico = document.getElementById('req-local')?.value || "A combinar";

        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || "Cliente",
            client_phone: user.phoneNumber || "Não informado", 
            provider_id: mem_ProviderId,
            provider_name: mem_ProviderName || "Prestador",
            service_title: mem_SelectedServiceTitle, // SALVA O NOME DO SERVIÇO ESCOLHIDO
            status: 'pending', 
            base_price: mem_BasePrice,
            offer_value: mem_CurrentOffer,
            service_date: dataServico,
            service_time: horaServico,
            location: localServico,
            created_at: serverTimestamp()
        });

        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp(),
            last_message: "Nova solicitação."
        });

        alert("✅ SOLICITAÇÃO ENVIADA!\nVerifique a aba 'Em Andamento'.");
        document.getElementById('request-modal').classList.add('hidden');
        
        const tabServicos = document.getElementById('tab-servicos');
        if(tabServicos) tabServicos.click(); 

        setTimeout(() => {
            if(window.switchServiceSubTab) window.switchServiceSubTab('andamento');
            if(window.carregarPedidosAtivos) window.carregarPedidosAtivos();
        }, 500);

    } catch (e) {
        alert(`❌ Falha: ${e.message}`);
    } finally {
        if(btn) { btn.innerText = "ENVIAR SOLICITAÇÃO 🚀"; btn.disabled = false; }
    }
}

// ============================================================================
// 2. RADAR DO PRESTADOR (SINCRONIA ADMIN & TRAVA PROATIVA)
// ============================================================================
export async function iniciarRadarPrestador(uid) {
    // --- 1. SINCRONIA DE TAXA COM PAINEL ADMIN ---
    try {
        const configSnap = await getDoc(doc(db, "configuracoes", "financeiro"));
        if (configSnap.exists()) {
            window.configFinanceiroAtiva = configSnap.data();
        }
    } catch (e) { 
        console.error("Erro ao sincronizar taxas do radar:", e); 
    }

    // --- 2. ESCUTA DE NOVAS SOLICITAÇÕES EM TEMPO REAL ---
    const q = query(collection(db, "orders"), where("provider_id", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                mostrarModalRadar({ id: change.doc.id, ...change.doc.data() });
            }
            if (change.type === "removed") {
                fecharModalRadar();
            }
        });
    });
}

function mostrarModalRadar(pedido) {
    let modalContainer = document.getElementById('modal-radar-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-radar-container';
        modalContainer.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4";
        document.body.appendChild(modalContainer);
    }
    modalContainer.classList.remove('hidden');

    const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * (config.porcentagem_reserva / 100);
    const lucro = valor - taxa; // Variável corrigida

    modalContainer.innerHTML = `
        <div class="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-700 animate-bounce-in">
            <div class="bg-slate-800 p-4 text-center border-b border-slate-700">
                <span class="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Nova Solicitação</span>
            </div>
            <div class="text-center py-6 bg-slate-900 relative">
                <h1 class="text-5xl font-black text-white mb-2">R$ ${valor.toFixed(0)}</h1>
                <p class="text-blue-300 font-bold text-sm mb-1">${pedido.service_title || 'Serviço'}</p>
                <div class="flex justify-center gap-3 text-[10px] font-bold text-gray-400">
                    <span>Taxa: -R$ ${taxa.toFixed(2)}</span>
                    <span class="text-green-400">Lucro: R$ ${lucro.toFixed(2)}</span>
                </div>
            </div>
            <div class="mx-4 mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 class="text-white font-bold text-sm text-center">${pedido.client_name}</h3>
                <p class="text-gray-400 text-xs text-center mt-1">📍 ${pedido.location || "Local a combinar"}</p>
            </div>
            <div class="grid grid-cols-2 gap-0 border-t border-slate-700">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="bg-slate-800 text-gray-400 font-bold py-5 hover:bg-slate-700 border-r border-slate-700">RECUSAR</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-600 text-white font-black py-5 hover:bg-green-500">ACEITAR SOLICITAÇÃO</button>
            </div>
        </div>
    `;
}

function fecharModalRadar() {
    const el = document.getElementById('modal-radar-container');
    if (el) el.classList.add('hidden');
}

// 🔥 AQUI ESTÁ A CORREÇÃO: ACEITAR COM TRAVA PROATIVA 🔥
export async function aceitarPedidoRadar(orderId) {
    fecharModalRadar();
    
    // Não usamos mais só o podeTrabalhar(), usamos a lógica completa abaixo
    
    try {
        const uid = auth.currentUser.uid;

        // 1. Busca dados do Pedido para saber o Valor
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        if (!orderSnap.exists()) return alert("Pedido expirou ou foi cancelado.");
        
        const config = window.configFinanceiroAtiva || { porcentagem_reserva: 10 };
        const orderData = orderSnap.data();
        const valorServico = parseFloat(orderData.offer_value || 0);
        const taxa = valorServico * (config.porcentagem_reserva / 100);

        // 2. Busca o Saldo Atual do Prestador (Tenta 'users' ou 'usuarios')
        let saldoAtual = 0;
        let userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) userSnap = await getDoc(doc(db, "usuarios", uid)); // Fallback
        
        if (userSnap.exists()) {
            saldoAtual = parseFloat(userSnap.data().saldo || 0);
        }

        // 3. A TRAVA PROATIVA (Cálculo do Futuro) 🛡️
        const LIMITE_DEBITO = -60.00; // Limite de R$ 60,00 negativo
        const saldoFuturo = saldoAtual - taxa;

        // Se o saldo após a taxa for menor que -60, BLOQUEIA.
        if (saldoFuturo < LIMITE_DEBITO) {
             alert(`⛔ AÇÃO BLOQUEADA\n\nAceitar este serviço de R$ ${valorServico} geraria uma taxa de R$ ${taxa.toFixed(2)}.\n\nSeu saldo iria para R$ ${saldoFuturo.toFixed(2)}, o que ultrapassa o limite permitido (R$ ${LIMITE_DEBITO}).\n\nPor favor, faça uma recarga para liberar este serviço.`);
             
             // Redireciona para a carteira
             const tabGanhar = document.getElementById('tab-ganhar');
             if(tabGanhar) tabGanhar.click();
             return; // PARA TUDO AQUI
        }

        // 4. Se passou na trava, executa o aceite normalmente
        await setDoc(doc(db, "orders", orderId), { status: 'accepted', accepted_at: serverTimestamp() }, { merge: true });
        await setDoc(doc(db, "chats", orderId), { status: 'active' }, { merge: true });

        const tabServicos = document.getElementById('tab-servicos');
        if(tabServicos) tabServicos.click();
        
        setTimeout(() => {
            if(window.switchProviderSubTab) window.switchProviderSubTab('ativos');
            if(window.iniciarMonitoramentoPedidos) window.iniciarMonitoramentoPedidos();
        }, 300);

    } catch (e) { alert("Erro: " + e.message); }
}

export async function recusarPedidoReq(orderId) {
    fecharModalRadar();
    if(!confirm("Recusar serviço?")) return;
    await setDoc(doc(db, "orders", orderId), { status: 'rejected' }, { merge: true });
}

// Compatibilidade
export async function carregarPedidosEmAndamento() {
    if (window.iniciarMonitoramentoPedidos) {
        window.iniciarMonitoramentoPedidos();
    }
}

// EXPORTAÇÃO GLOBAL
window.abrirModalSolicitacao = abrirModalSolicitacao;
window.selecionarDesconto = selecionarDesconto;
window.ativarInputPersonalizado = ativarInputPersonalizado;
window.validarOferta = validarOferta;
window.enviarPropostaAgora = enviarPropostaAgora;
window.aceitarPedidoRadar = aceitarPedidoRadar;
window.recusarPedidoReq = recusarPedidoReq;
window.iniciarRadarPrestador = iniciarRadarPrestador;
window.carregarPedidosEmAndamento = carregarPedidosEmAndamento;
window.SERVICOS_PADRAO = SERVICOS_PADRAO;
window.CATEGORIAS_ATIVAS = CATEGORIAS_ATIVAS;
