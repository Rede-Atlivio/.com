import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIÁVEL PARA GUARDAR QUEM ESTAMOS CONTRATANDO
let targetProviderId = null;
let targetProviderEmail = null;

// --- INICIALIZAÇÃO ---
setTimeout(() => {
    configurarBotaoOnline();
    carregarPrestadoresOnline(); 
    escutarMeusChamados();
    
    const tabServicos = document.getElementById('tab-servicos');
    if(tabServicos) {
        tabServicos.addEventListener('click', () => {
            carregarPrestadoresOnline();
        });
    }
}, 1000);

// 1. PRESTADOR: FICAR ONLINE
function configurarBotaoOnline() {
    const toggle = document.getElementById('online-toggle');
    if(!toggle) return;
    toggle.checked = false;

    toggle.addEventListener('change', async (e) => {
        const statusMsg = document.getElementById('status-msg');
        if (e.target.checked) {
            if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-pulse">📡</p><p class="font-bold text-green-500">Buscando Clientes...</p><p class="text-xs text-gray-400">Mantenha o app aberto.</p>`;
            await ficarOnline();
        } else {
            if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2">😴</p><p class="font-bold text-gray-400">Você está Offline</p><p class="text-xs">Ative o botão "Trabalhar" no topo.</p>`;
            await ficarOffline();
        }
    });
}

async function ficarOnline() {
    if (!auth.currentUser) {
        alert("Erro: Faça login novamente.");
        document.getElementById('online-toggle').checked = false;
        return;
    }
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            await setDoc(doc(db, "active_providers", auth.currentUser.uid), {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                tenant_id: 'atlivio_fsa_01', 
                profissao: "Prestador Atlivio",
                last_seen: serverTimestamp()
            });
        }, (error) => {
            alert("Erro de GPS: " + error.message);
            document.getElementById('online-toggle').checked = false;
        });
    } else {
        alert("Seu navegador não suporta GPS.");
    }
}

async function ficarOffline() {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, "active_providers", auth.currentUser.uid));
}

// 2. PRESTADOR: ESCUTAR CHAMADOS
function escutarMeusChamados() {
    if(!auth.currentUser) return;

    const container = document.getElementById('lista-chamados');
    if(!container) {
        setTimeout(escutarMeusChamados, 1000);
        return;
    }

    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('lista-chamados');
        if (snap.empty) {
            lista.classList.add('hidden');
        } else {
            lista.classList.remove('hidden');
            lista.innerHTML = `<h3 class="font-black text-blue-900 text-xs uppercase mb-2">🔔 Pedidos</h3>`;
            snap.forEach(d => {
                const pedido = d.data();
                // SÓ MOSTRA O CHAT SE ESTIVER PAGO (RESERVED)
                if (pedido.status === 'reserved') {
                    lista.innerHTML += `
                    <div class="bg-green-50 p-4 rounded-xl border-l-4 border-green-600 shadow-md mb-2 animate-fadeIn">
                        <div class="flex justify-between items-start">
                            <div><p class="font-bold text-sm text-green-900">RESERVA PAGA! 💰</p><p class="text-[10px] text-green-700">Chat liberado.</p></div>
                        </div>
                        <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="w-full mt-3 bg-green-600 text-white py-2 rounded-lg font-bold text-xs uppercase shadow-sm">ABRIR CHAT</button>
                    </div>`;
                }
            });
        }
    });
}

window.aceitarChamado = (orderId, chatId, clientName) => {
    window.switchTab('chat');
    setTimeout(() => { 
        if(window.abrirChat) window.abrirChat(chatId, `Negociação com ${clientName}`); 
    }, 500);
};

// 3. CLIENTE: LISTA E NOVO FLUXO (ABRE MODAL)
let listenerPrestadoresAtivo = false;

function carregarPrestadoresOnline() {
    const listaContainer = document.getElementById('lista-prestadores-realtime');
    
    if(!listaContainer) {
        setTimeout(carregarPrestadoresOnline, 1000);
        return;
    }

    if(listenerPrestadoresAtivo) return;

    const q = query(collection(db, "active_providers")); 

    onSnapshot(q, (snap) => {
        listenerPrestadoresAtivo = true;
        listaContainer.innerHTML = ""; 
        
        if (snap.empty) {
            listaContainer.innerHTML = `
                <div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p class="text-2xl mb-2">🔍</p>
                    <p class="font-bold">Nenhum prestador online.</p>
                    <p class="text-[9px] mt-1 opacity-70">Fique online em outra conta para testar.</p>
                </div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full mb-2 flex items-center justify-center text-xl font-bold border border-blue-100">
                            ${p.email ? p.email.charAt(0).toUpperCase() : '?'}
                        </div>
                        <h4 class="font-bold text-xs text-blue-900 uppercase text-center leading-tight mb-1">${p.profissao || 'Profissional'}</h4>
                        <p class="text-[9px] text-gray-400 mb-3 truncate w-full text-center">${p.email}</p>
                        
                        <button onclick="abrirModalSolicitacao('${p.uid}', '${p.email}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition shadow-sm">
                            Solicitar
                        </button>
                    </div>`;
            });
        }
    });
}

// NOVA FUNÇÃO: ABRE O MODAL
window.abrirModalSolicitacao = (uid, email) => {
    if(!auth.currentUser) return alert("Faça login.");
    
    targetProviderId = uid;
    targetProviderEmail = email;
    
    document.getElementById('request-modal').classList.remove('hidden');
};

// NOVA FUNÇÃO: CONFIRMA E VAI PARA "PAGAMENTO" (SIMULADO POR ENQUANTO)
window.confirmarSolicitacao = async () => {
    const data = document.getElementById('req-date').value;
    const hora = document.getElementById('req-time').value;
    const local = document.getElementById('req-local').value;
    const valor = parseFloat(document.getElementById('req-value').value);

    if(!data || !hora || !local || !valor) return alert("Preencha tudo!");

    const btn = document.getElementById('btn-confirm-req');
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        // CÁLCULO FINAL PARA O BANCO DE DADOS
        const seguranca = valor * 0.30;
        const taxa = valor * 0.10;
        const reservaTotal = seguranca + taxa;

        // CRIA ID DO CHAT (MAS NÃO O CHAT AINDA)
        const ids = [auth.currentUser.uid, targetProviderId].sort();
        const chatRoomId = `${ids[0]}_${ids[1]}`;

        // CRIA PEDIDO PENDENTE DE PAGAMENTO
        await addDoc(collection(db, "orders"), {
            client_id: auth.currentUser.uid,
            client_email: auth.currentUser.email,
            provider_id: targetProviderId,
            provider_email: targetProviderEmail,
            
            // DADOS DO SERVIÇO
            service_date: data,
            service_time: hora,
            service_location: local,
            service_value: valor,
            
            // FINANCEIRO
            amount_total_reservation: reservaTotal,
            amount_security: seguranca,
            amount_fee: taxa,
            
            // STATUS DE TRAVA
            status: "pending_payment", // AINDA NÃO LIBERA O CHAT
            chat_id: chatRoomId,
            created_at: serverTimestamp()
        });

        document.getElementById('request-modal').classList.add('hidden');
        alert(`✅ Solicitação criada!\n\nAgora você iria para a tela de Pagamento da Reserva (R$ ${reservaTotal.toFixed(2)}). \n\nNo MVP, vamos simular que você pagou.`);
        
        // --- SIMULAÇÃO DE PAGAMENTO (MVP) ---
        // Aqui, futuramente, entraria o Stripe.
        // Hoje, vamos forçar a liberação só para você ver o fluxo.
        // EM PROD, ISSO SÓ RODA DEPOIS DO CALLBACK DO BANCO.
        
        // 1. Libera Chat
        const chatRef = doc(db, "chats", chatRoomId);
        await setDoc(chatRef, {
            participants: [auth.currentUser.uid, targetProviderId],
            mission_title: `Serviço: R$ ${valor} (Reserva Paga)`,
            last_message: "Reserva confirmada. Podem negociar.",
            updated_at: serverTimestamp(),
            is_service_chat: true
        });

        // 2. Atualiza Status do Pedido para RESERVED
        // (Isso faria aparecer na tela do prestador)
        // Precisaríamos do ID do documento que acabamos de criar...
        // Para simplificar o teste agora, vamos direto pro chat.
        
        window.switchTab('chat');
        setTimeout(() => { 
            if(window.abrirChat) window.abrirChat(chatRoomId, `Prestador: ${targetProviderEmail}`); 
            btn.innerText = "PAGAR RESERVA 🔒";
            btn.disabled = false;
        }, 500);

    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerText = "Erro";
        btn.disabled = false;
    }
};
