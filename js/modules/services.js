import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIÁVEL PARA GUARDAR QUEM ESTAMOS CONTRATANDO
let targetProviderId = null;
let targetProviderEmail = null;

// --- INICIALIZAÇÃO ---
setTimeout(() => {
    configurarBotaoOnline();
    carregarPrestadoresOnline(); 
    escutarMeusChamados(); // Visão do Prestador
    escutarMeusPedidos();  // Visão do Cliente (NOVO)
    
    const tabServicos = document.getElementById('tab-servicos');
    if(tabServicos) {
        tabServicos.addEventListener('click', () => {
            carregarPrestadoresOnline();
        });
    }
}, 1000);

// ======================================================
// 1. PRESTADOR: FICAR ONLINE & RECEBER CHAMADOS
// ======================================================

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

// --- VISÃO DO PRESTADOR: GERENCIAR PEDIDOS ---
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
        lista.innerHTML = ""; // Limpa para evitar duplicidade visual
        
        if (snap.empty) {
            lista.classList.add('hidden');
        } else {
            lista.classList.remove('hidden');
            lista.innerHTML = `<h3 class="font-black text-blue-900 text-xs uppercase mb-2">🔔 Gerenciador de Pedidos</h3>`;
            
            snap.forEach(d => {
                const pedido = d.data();
                
                // CARD 1: PEDIDO RESERVADO (PAGO) - MOSTRA CAMPO DE VALIDAÇÃO
                if (pedido.status === 'reserved') {
                    lista.innerHTML += `
                    <div class="bg-green-50 p-4 rounded-xl border-l-4 border-green-600 shadow-md mb-4 animate-fadeIn">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <p class="font-bold text-sm text-green-900">RESERVA PAGA! 💰</p>
                                <p class="text-[10px] text-green-700">Cliente: ${pedido.client_email}</p>
                            </div>
                            <span class="text-xl">🔒</span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2 mb-3">
                            <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">
                                💬 Abrir Chat
                            </button>
                            <div class="text-center">
                                <p class="text-[8px] text-gray-500 uppercase font-bold">A receber fora:</p>
                                <p class="font-black text-gray-800">R$ ${(pedido.service_value - pedido.amount_total_reservation).toFixed(2)}</p>
                            </div>
                        </div>

                        <div class="bg-white p-3 rounded-lg border border-green-200">
                            <label class="text-[9px] font-bold text-gray-500 uppercase block mb-1">Finalizar Serviço (Peça o código ao cliente)</label>
                            <div class="flex gap-2">
                                <input type="tel" id="token-${d.id}" placeholder="0000" maxlength="4" class="w-16 text-center font-black text-lg border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none text-gray-800">
                                <button onclick="validarTokenPrestador('${d.id}', ${pedido.service_value})" class="flex-1 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition">
                                    VALIDAR & RECEBER
                                </button>
                            </div>
                        </div>
                    </div>`;
                }
                
                // CARD 2: PEDIDO CONCLUÍDO
                else if (pedido.status === 'completed') {
                    lista.innerHTML += `
                    <div class="bg-gray-100 p-3 rounded-xl border border-gray-200 opacity-70 mb-2">
                        <p class="font-bold text-xs text-gray-600">✅ Serviço Finalizado</p>
                        <p class="text-[10px] text-gray-400">${pedido.service_date} - ${pedido.client_email}</p>
                    </div>`;
                }
            });
        }
    });
}

// --- LÓGICA DE VALIDAÇÃO (PRESTADOR) ---
window.validarTokenPrestador = async (orderId, valorTotal) => {
    const input = document.getElementById(`token-${orderId}`);
    const tokenDigitado = input.value.trim();

    if(tokenDigitado.length !== 4) return alert("O código deve ter 4 dígitos.");

    const btn = event.target;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if(!orderSnap.exists()) throw new Error("Pedido não encontrado.");
        
        const realToken = orderSnap.data().finalization_code;

        if (tokenDigitado === realToken) {
            // SUCESSO!
            
            // 1. Atualiza Pedido
            await updateDoc(orderRef, {
                status: 'completed',
                completed_at: serverTimestamp()
            });

            // 2. Libera Saldo na Carteira (Simulação de Valor Liberado)
            // No MVP, liberamos o valor simbólico da reserva (R$ 30) ou o total. 
            // Vamos liberar o valor da "Segurança" que estava travado.
            const valorLiberado = orderSnap.data().amount_security || 0;
            
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
                saldo: increment(valorLiberado)
            });

            alert(`✅ SUCESSO!\n\nCódigo Validado Corretamente.\nServiço Encerrado.\n\nR$ ${valorLiberado.toFixed(2)} liberados na sua carteira.`);
            
        } else {
            alert("❌ CÓDIGO INVÁLIDO.\nPeça ao cliente o código de 4 dígitos que aparece na tela dele.");
            input.value = "";
            btn.innerText = "VALIDAR & RECEBER";
            btn.disabled = false;
        }

    } catch (e) {
        alert("Erro: " + e.message);
        btn.innerText = "Erro";
        btn.disabled = false;
    }
};

window.aceitarChamado = (orderId, chatId, clientName) => {
    window.switchTab('chat');
    setTimeout(() => { 
        if(window.abrirChat) window.abrirChat(chatId, `Negociação com ${clientName}`); 
    }, 500);
};


// ======================================================
// 2. CLIENTE: BUSCAR, CONTRATAR E GERAR TOKEN
// ======================================================

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

// --- NOVA FUNÇÃO: CLIENTE VÊ SEUS PEDIDOS E GERA TOKEN ---
function escutarMeusPedidos() {
    if(!auth.currentUser) return;
    
    // Injeta container de "Meus Pedidos" se não existir
    const parent = document.getElementById('servicos-cliente');
    if(parent && !document.getElementById('meus-pedidos-container')) {
        const div = document.createElement('div');
        div.id = 'meus-pedidos-container';
        div.className = "mb-6 hidden"; 
        parent.insertBefore(div, parent.firstChild); // Coloca no topo
    }
    
    const container = document.getElementById('meus-pedidos-container');
    if(!container) return; // Segurança

    const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid), where("status", "==", "reserved"));

    onSnapshot(q, (snap) => {
        if(snap.empty) {
            container.classList.add('hidden');
            container.innerHTML = "";
        } else {
            container.classList.remove('hidden');
            container.innerHTML = `<h3 class="font-black text-gray-800 text-xs uppercase mb-2">Meus Serviços em Andamento</h3>`;
            
            snap.forEach(d => {
                const pedido = d.data();
                const temCodigo = pedido.finalization_code ? true : false;
                
                container.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border-l-4 border-yellow-400 shadow-sm mb-2">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${pedido.provider_email}</span>
                            <span class="text-[9px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold">EM ANDAMENTO</span>
                        </div>
                        <h4 class="font-black text-gray-800 text-sm mb-3">R$ ${pedido.service_value}</h4>
                        
                        <div class="flex gap-2">
                            <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.provider_email}')" class="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-[10px] uppercase">
                                Chat
                            </button>
                            <button onclick="gerarTokenCliente('${d.id}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">
                                ${temCodigo ? 'VER CÓDIGO 🔑' : 'FINALIZAR SERVIÇO ✅'}
                            </button>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- LÓGICA DE GERAR TOKEN (CLIENTE) ---
window.gerarTokenCliente = async (orderId) => {
    const btn = event.target;
    btn.disabled = true;

    try {
        const orderRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(orderRef);
        
        let code = docSnap.data().finalization_code;

        // Se não tem código, gera um novo
        if (!code) {
            code = Math.floor(1000 + Math.random() * 9000).toString(); // Gera 4 dígitos (ex: 4821)
            await updateDoc(orderRef, { finalization_code: code });
        }

        alert(`🔑 CÓDIGO DE FINALIZAÇÃO: ${code}\n\nINSTRUÇÃO:\nSó passe este código ao prestador quando o serviço estiver 100% concluído.\nAssim que ele validar, o serviço encerra.`);
        btn.innerText = "VER CÓDIGO 🔑";
        btn.disabled = false;

    } catch (e) {
        alert("Erro: " + e.message);
        btn.disabled = false;
    }
};


// ======================================================
// 3. FLUXO DE SOLICITAÇÃO (MODAL)
// ======================================================

window.abrirModalSolicitacao = (uid, email) => {
    if(!auth.currentUser) return alert("Faça login.");
    targetProviderId = uid;
    targetProviderEmail = email;
    document.getElementById('request-modal').classList.remove('hidden');
};

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
        const seguranca = valor * 0.30;
        const taxa = valor * 0.10;
        const reservaTotal = seguranca + taxa;

        const ids = [auth.currentUser.uid, targetProviderId].sort();
        const chatRoomId = `${ids[0]}_${ids[1]}`;

        await addDoc(collection(db, "orders"), {
            client_id: auth.currentUser.uid,
            client_email: auth.currentUser.email,
            provider_id: targetProviderId,
            provider_email: targetProviderEmail,
            service_date: data,
            service_time: hora,
            service_location: local,
            service_value: valor,
            amount_total_reservation: reservaTotal,
            amount_security: seguranca,
            amount_fee: taxa,
            status: "reserved", // MVP: Já cria como reservado para pular pagamento real
            chat_id: chatRoomId,
            created_at: serverTimestamp()
        });

        // Feedback Visual
        document.getElementById('request-modal').classList.add('hidden');
        alert(`✅ Reserva Confirmada!\n\nValor Pago (Simulado): R$ ${reservaTotal.toFixed(2)}\nChat Liberado!`);
        
        // Cria Sala de Chat
        const chatRef = doc(db, "chats", chatRoomId);
        await setDoc(chatRef, {
            participants: [auth.currentUser.uid, targetProviderId],
            mission_title: `Serviço: R$ ${valor} (Reserva Paga)`,
            last_message: "Reserva confirmada. Podem negociar.",
            updated_at: serverTimestamp(),
            is_service_chat: true
        });

        window.switchTab('chat');
        setTimeout(() => { 
            if(window.abrirChat) window.abrirChat(chatRoomId, `Prestador: ${targetProviderEmail}`); 
            btn.innerText = "PAGAR RESERVA 🔒";
            btn.disabled = false;
        }, 500);

    } catch (e) {
        console.error(e);
        alert("Erro técnico: " + e.message);
        btn.innerText = "Tentar Novamente";
        btn.disabled = false;
    }
};
