import { db, auth } from '../app.js';
import { podeTrabalhar } from '../wallet.js'; 
import { collection, addDoc, serverTimestamp, setDoc, doc, query, where, onSnapshot, orderBy, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE MEMÓRIA (O Cérebro do Pedido) ---
let mem_ProviderId = null;
let mem_ProviderName = null;
let mem_BasePrice = 0;
let mem_CurrentOffer = 0;

// --- GATILHOS E RADAR ---
auth.onAuthStateChanged(user => {
    if (user) {
        iniciarRadarPrestador(user.uid);
        if (typeof window.carregarPedidosEmAndamento === 'function') {
             window.carregarPedidosEmAndamento();
        }
    }
});

// ============================================================================
// 1. ABRIR O MODAL (BLINDAGEM DO BOTÃO)
// ============================================================================
export function abrirModalSolicitacao(providerId, providerName, price) {
    if(!auth.currentUser) return alert("⚠️ Faça login para solicitar serviços!");

    console.log("📝 [REQUEST] Preparando Proposta:", { providerId, providerName, price });

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
        
        if(elInputVal) {
            elInputVal.value = mem_CurrentOffer.toFixed(2);
            elInputVal.disabled = true; 
        }

        if(elTotal) elTotal.innerText = `R$ ${mem_CurrentOffer.toFixed(2)}`;

        const btn = document.getElementById('btn-confirm-req');
        if(btn) {
            const novoBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(novoBtn, btn);
            
            novoBtn.disabled = false;
            novoBtn.innerText = "ENVIAR PROPOSTA 🚀";
            novoBtn.onclick = enviarPropostaAgora; 
            novoBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
        } 
    } else {
        alert("Erro Crítico: O modal de proposta não existe no HTML.");
    }
}

// ============================================================================
// 2. CÁLCULOS
// ============================================================================
export function selecionarDesconto(percent) {
    if(!mem_BasePrice) mem_BasePrice = parseFloat(document.getElementById('service-base-price')?.value || 0);
    const discountValue = mem_BasePrice * percent;
    mem_CurrentOffer = mem_BasePrice - discountValue;
    
    const inputValor = document.getElementById('req-value');
    if(inputValor) inputValor.value = mem_CurrentOffer.toFixed(2);
    
    const elTotal = document.getElementById('calc-total-reserva');
    if(elTotal) elTotal.innerText = `R$ ${mem_CurrentOffer.toFixed(2)}`;
}

export function ativarInputPersonalizado() {
    const input = document.getElementById('req-value');
    if(input) { input.disabled = false; input.focus(); }
}

export function validarOferta(val) {
    const offer = parseFloat(val);
    if(!isNaN(offer)) {
        mem_CurrentOffer = offer;
        const elTotal = document.getElementById('calc-total-reserva');
        if(elTotal) elTotal.innerText = `R$ ${mem_CurrentOffer.toFixed(2)}`;
    }
}

// ============================================================================
// 3. ENVIAR PROPOSTA (CORRIGIDO ITEM 15 + EDUCATIVO)
// ============================================================================
export async function enviarPropostaAgora() {
    console.log("🚀 [REQUEST] Iniciando processo de envio...");
    
    const user = auth.currentUser;
    if (!user) return alert("Sessão expirada. Faça login novamente.");

    // ⛔ TRAVA FINANCEIRA
    if (!podeTrabalhar()) {
        console.warn("⛔ Bloqueio Financeiro Ativado.");
        return; 
    }

    let finalProviderId = mem_ProviderId;
    let finalOffer = mem_CurrentOffer;

    if (!finalProviderId) {
        finalProviderId = document.getElementById('target-provider-id')?.value;
        finalOffer = parseFloat(document.getElementById('req-value')?.value);
    }

    if(!finalProviderId || !finalOffer || isNaN(finalOffer)) {
        return alert("Erro: Dados da proposta inválidos.");
    }
    
    const btn = document.getElementById('btn-confirm-req'); 
    if(btn) { 
        btn.innerText = "⏳ ENVIANDO..."; 
        btn.disabled = true; 
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const dataServico = document.getElementById('req-date')?.value || "A combinar";
        const horaServico = document.getElementById('req-time')?.value || "A combinar";
        const localServico = document.getElementById('req-local')?.value || "A combinar";

        const docRef = await addDoc(collection(db, "orders"), {
            client_id: user.uid,
            client_name: user.displayName || user.email?.split('@')[0] || "Cliente",
            client_phone: user.phoneNumber || "Não informado", 
            provider_id: finalProviderId,
            provider_name: mem_ProviderName || "Prestador",
            status: 'pending', 
            base_price: mem_BasePrice || finalOffer,
            offer_value: finalOffer,
            service_date: dataServico,
            service_time: horaServico,
            location: localServico,
            created_at: serverTimestamp()
        });

        await setDoc(doc(db, "chats", docRef.id), {
            participants: [user.uid, finalProviderId],
            order_id: docRef.id,
            status: "pending_approval",
            updated_at: serverTimestamp(),
            last_message: "Nova proposta enviada."
        });

        // 🎉 SUCESSO & REDIRECIONAMENTO (AQUI ESTÁ A CORREÇÃO)
        
        // 1. Mensagem Educativa
        alert("✅ PROPOSTA ENVIADA!\n\nCHAT LIBERADO: Combine os detalhes diretamente com o prestador no chat que vai abrir agora.");
        
        document.getElementById('request-modal').classList.add('hidden');
        mem_ProviderId = null;

        // 2. Redirecionamento Automático para o Chat
        if(window.irParaChat) {
            console.log("🔄 Redirecionando para o Chat...");
            window.irParaChat(); // Muda a aba
            
            // Abre a conversa específica após um breve delay para a lista carregar
            setTimeout(() => {
                if(window.abrirChatPedido) window.abrirChatPedido(docRef.id);
            }, 800);
        }

    } catch (e) {
        console.error("❌ [REQUEST] Erro:", e);
        alert(`❌ Falha no envio: ${e.message}`);
    } finally {
        if(btn) { 
            btn.innerText = "ENVIAR PROPOSTA 🚀"; 
            btn.disabled = false; 
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

// ============================================================================
// 4. RADAR E ACEITE
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
    const taxa = valor * 0.20;
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
                <h3 class="text-white font-bold text-sm">${pedido.client_name}</h3>
                <p class="text-gray-400 text-xs">${pedido.location || "Local a combinar"}</p>
            </div>
            <div class="grid grid-cols-2 gap-0 border-t border-slate-700">
                <button onclick="window.recusarPedidoReq('${pedido.id}')" class="bg-slate-800 text-gray-400 font-bold py-5 hover:bg-slate-700 border-r border-slate-700">RECUSAR</button>
                <button onclick="window.aceitarPedidoRadar('${pedido.id}')" class="bg-green-600 text-white font-black py-5 hover:bg-green-500">ACEITAR</button>
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

        // Redirecionamento do Prestador também
        if(window.irParaChat) {
            window.irParaChat();
            setTimeout(() => { if(window.abrirChatPedido) window.abrirChatPedido(orderId); }, 800);
        }
    } catch (e) { alert("Erro: " + e.message); }
}

export async function recusarPedidoReq(orderId) {
    fecharModalRadar();
    if(!confirm("Recusar?")) return;
    await updateDoc(doc(db, "orders", orderId), { status: 'rejected' });
}

export async function carregarPedidosEmAndamento() {
    // Mantido igual (Função de carregamento passivo)
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const pedidosRef = collection(db, "orders");
    const statuses = ["accepted", "in_progress"];
    const qProvider = query(pedidosRef, where("provider_id", "==", uid), where("status", "in", statuses));
    
    onSnapshot(qProvider, (snap) => {
        container.innerHTML = "";
        if(snap.empty) { container.innerHTML = `<div class="text-center py-10 opacity-50"><p>Sem serviços em andamento.</p></div>`; return; }
        snap.forEach(d => {
            const p = d.data();
            container.innerHTML += `<div onclick="window.abrirChatPedido('${d.id}')" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-3 cursor-pointer"><h3 class="font-bold text-gray-800">${p.client_name}</h3><p class="text-xs text-green-600 font-bold">R$ ${p.offer_value} • ${p.status === 'accepted' ? 'A iniciar' : 'Em andamento'}</p></div>`;
        });
    });
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
