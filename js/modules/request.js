import { db, auth } from '../app.js';
import { podeTrabalhar } from '../wallet.js'; 
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, orderBy, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE MEMÓRIA ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;

// --- GATILHOS ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
        if (typeof window.carregarPedidosEmAndamento === 'function') {
             window.carregarPedidosEmAndamento();
        }
    }
});

// ============================================================================
// 1. ABRIR O MODAL
// ============================================================================
export function abrirModalSolicitacao(providerId, providerName, price) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    mem_ProviderId = providerId;
    mem_ProviderName = providerName;
    mem_BasePrice = parseFloat(price);
    mem_CurrentOffer = mem_BasePrice;

    const modal = document.getElementById('request-modal');
    if(modal) {
        modal.classList.remove('hidden');
        
        const elId = document.getElementById('target-provider-id');
        const elPrice = document.getElementById('service-base-price');
        const elInputVal = document.getElementById('req-value');
        const elTotal = document.getElementById('calc-total-reserva');
        
        if(elId) elId.value = providerId || "";
        if(elPrice) elPrice.value = price || "0";
        
        // 🎨 CORREÇÃO VISUAL DO INPUT (Texto Preto Forte)
        if(elInputVal) {
            elInputVal.value = mem_CurrentOffer.toFixed(2);
            elInputVal.disabled = true;
            elInputVal.style.color = "#000000"; 
            elInputVal.style.fontWeight = "bold";
            elInputVal.classList.remove('text-gray-500');
            elInputVal.classList.add('text-black');
        }

        if(elTotal) elTotal.innerText = `R$ ${mem_CurrentOffer.toFixed(2)}`;

        // Reseta botão
        const btn = document.getElementById('btn-confirm-req');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ENVIAR PROPOSTA 🚀";
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.onclick = enviarPropostaAgora; 
        } 
    }
}

// ============================================================================
// 2. CÁLCULOS E TRAVAS (CORRIGIDO)
// ============================================================================
export function selecionarDesconto(percent) {
    if(!mem_BasePrice) mem_BasePrice = parseFloat(document.getElementById('service-base-price')?.value || 0);
    
    // Percent é negativo (-0.10) ou positivo (0.10)
    const discountValue = mem_BasePrice * percent;
    // Se percent é -0.10, discountValue é negativo. Base + (-negativo) = Errado.
    // Lógica correta: Novo Valor = Base * (1 + percent)
    // Ex: 100 * (1 + (-0.10)) = 100 * 0.90 = 90.
    
    mem_CurrentOffer = mem_BasePrice * (1 + percent);
    
    atualizarVisualModal();
}

export function ativarInputPersonalizado() {
    const input = document.getElementById('req-value');
    if(input) { 
        input.disabled = false; 
        input.focus(); 
        input.style.border = "2px solid #3b82f6"; // Azul para indicar foco
    }
}

export function validarOferta(val) {
    let offer = parseFloat(val);
    if(isNaN(offer)) return;

    // 🔒 TRAVA DE VALORES (-20% a +30%)
    const minAllowed = mem_BasePrice * 0.80; // -20%
    const maxAllowed = mem_BasePrice * 1.30; // +30%
    const input = document.getElementById('req-value');
    const btn = document.getElementById('btn-confirm-req');
    const aviso = document.getElementById('calc-total-reserva'); // Usando label de total para aviso

    if (offer < minAllowed) {
        input.style.borderColor = "red";
        input.style.color = "red";
        if(btn) btn.disabled = true;
        btn.classList.add('opacity-50');
        if(aviso) {
            aviso.innerText = `Mínimo: R$ ${minAllowed.toFixed(2)}`;
            aviso.style.color = "red";
        }
        return;
    } 
    
    if (offer > maxAllowed) {
        input.style.borderColor = "red";
        input.style.color = "red";
        if(btn) btn.disabled = true;
        btn.classList.add('opacity-50');
        if(aviso) {
            aviso.innerText = `Máximo: R$ ${maxAllowed.toFixed(2)}`;
            aviso.style.color = "red";
        }
        return;
    }

    // Se passou na trava
    input.style.borderColor = "#e5e7eb"; // Cinza normal
    input.style.color = "black";
    if(btn) btn.disabled = false;
    btn.classList.remove('opacity-50');
    if(aviso) {
        aviso.innerText = `R$ ${offer.toFixed(2)}`;
        aviso.style.color = "black";
    }

    mem_CurrentOffer = offer;
}

function atualizarVisualModal() {
    const inputValor = document.getElementById('req-value');
    if(inputValor) inputValor.value = mem_CurrentOffer.toFixed(2);
    
    const elTotal = document.getElementById('calc-total-reserva');
    if(elTotal) {
        elTotal.innerText = `R$ ${mem_CurrentOffer.toFixed(2)}`;
        elTotal.style.color = "black";
    }
    
    // Revalidar para garantir que o desconto automático não quebre a regra
    validarOferta(mem_CurrentOffer);
}

// ============================================================================
// 3. ENVIAR PROPOSTA (CORREÇÃO REDIRECIONAMENTO)
// ============================================================================
export async function enviarPropostaAgora() {
    const user = auth.currentUser;
    if (!user) return alert("Sessão expirada.");

    if (!podeTrabalhar()) {
        console.warn("⛔ Bloqueio Financeiro Ativado.");
        return; 
    }

    // Revalidação Final
    const min = mem_BasePrice * 0.80;
    const max = mem_BasePrice * 1.30;
    if (mem_CurrentOffer < min || mem_CurrentOffer > max) {
        alert(`O valor deve estar entre R$ ${min.toFixed(2)} e R$ ${max.toFixed(2)}`);
        return;
    }

    const btn = document.getElementById('btn-confirm-req'); 
    if(btn) { 
        btn.innerText = "⏳ ENVIANDO..."; 
        btn.disabled = true; 
    }

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
            status: 'pending', 
            base_price: mem_BasePrice,
            offer_value: mem_CurrentOffer,
            service_date: dataServico,
            service_time: horaServico,
            location: localServico,
            created_at: serverTimestamp()
        });

        // Cria o chat mas NÃO abre
        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, mem_ProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp(),
            last_message: "Nova proposta enviada."
        });

        // 🎉 SUCESSO & REDIRECIONAMENTO CORRETO
        alert("✅ PROPOSTA ENVIADA!\n\nAguarde o aceite do prestador na aba 'Em Andamento'.");
        
        document.getElementById('request-modal').classList.add('hidden');
        mem_ProviderId = null;

        // 🔄 Redireciona para a LISTA (Tab Chat/Pedidos) e NÃO para o chat específico
        if(window.carregarPedidosAtivos) {
            // Simula clique na aba de chat/pedidos
            const tabChat = document.getElementById('tab-chat');
            if(tabChat) tabChat.click();
            
            // Força recarregamento da lista
            window.carregarPedidosAtivos();
        }

    } catch (e) {
        alert(`❌ Falha no envio: ${e.message}`);
    } finally {
        if(btn) { 
            btn.innerText = "ENVIAR PROPOSTA 🚀"; 
            btn.disabled = false; 
        }
    }
}

// ============================================================================
// 4. RADAR (PRESTADOR)
// ============================================================================
function iniciarRadarPrestador(uid) {
    const q = query(
        collection(db, "orders"), 
        where("provider_id", "==", uid), 
        where("status", "==", "pending")
    );

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

    const valor = parseFloat(pedido.offer_value || 0);
    const taxa = valor * 0.20; // 20%
    const lucro = valor - taxa;

    modalContainer.innerHTML = `
        <div class="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-700 animate-bounce-in">
            <div class="bg-slate-800 p-4 text-center border-b border-slate-700">
                <span class="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Nova Solicitação</span>
            </div>
            <div class="text-center py-6 bg-slate-900 relative">
                <h1 class="text-5xl font-black text-white mb-2">R$ ${valor.toFixed(0)}</h1>
                <div class="flex justify-center gap-3 text-[10px] font-bold text-gray-400">
                    <span>Taxa: -R$ ${taxa.toFixed(2)}</span>
                    <span class="text-green-400">Lucro: R$ ${lucro.toFixed(2)}</span>
                </div>
            </div>
            <div class="mx-4 mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 class="text-white font-bold text-sm text-center">${pedido.client_name}</h3>
                <p class="text-gray-400 text-xs text-center mt-1">📍 ${pedido.location || "Local a combinar"}</p>
                <p class="text-gray-500 text-[10px] text-center mt-2">📅 ${pedido.service_date} • 🕒 ${pedido.service_time}</p>
            </div>
            <div class="grid grid-cols-2 gap-0 border-t border-slate-700">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="bg-slate-800 text-gray-400 font-bold py-5 hover:bg-slate-700 border-r border-slate-700">RECUSAR</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-600 text-white font-black py-5 hover:bg-green-500">ACEITAR CORRIDA</button>
            </div>
        </div>
    `;
}

function fecharModalRadar() {
    const el = document.getElementById('modal-radar-container');
    if (el) el.classList.add('hidden');
}

export async function aceitarPedidoRadar(orderId) {
    fecharModalRadar();
    if (!podeTrabalhar()) return;

    try {
        await updateDoc(doc(db, "orders", orderId), { status: 'accepted', accepted_at: serverTimestamp() });
        await updateDoc(doc(db, "chats", orderId), { status: 'active' });

        // Redireciona para LISTA DE PEDIDOS (não chat direto)
        if(window.carregarPedidosAtivos) {
            const tabChat = document.getElementById('tab-chat');
            if(tabChat) tabChat.click();
            window.carregarPedidosAtivos();
        }
    } catch (e) { alert("Erro: " + e.message); }
}

export async function recusarPedidoReq(orderId) {
    fecharModalRadar();
    if(!confirm("Tem certeza que deseja recusar?")) return;
    await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
}

export async function carregarPedidosEmAndamento() {
    // Mantido para carregamento passivo
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
