import { db, auth } from '../app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIÁVEIS DE CONTEXTO
let targetProviderId = null;
let targetProviderEmail = null;
let orderIdParaAvaliar = null;
let providerIdParaAvaliar = null;
let clientIdParaAvaliar = null;

// --- INICIALIZAÇÃO SEGURA (CORREÇÃO DO ERRO) ---
// Carrega dados públicos imediatamente
carregarPrestadoresOnline();

// Carrega dados privados APENAS quando o login confirma
onAuthStateChanged(auth, (user) => {
    if (user) {
        configurarBotaoOnline();
        escutarMeusChamados(); 
        escutarMeusPedidos();  
    }
});

// Gatilho da Aba
const tabServicos = document.getElementById('tab-servicos');
if(tabServicos) {
    tabServicos.addEventListener('click', () => {
        carregarPrestadoresOnline();
    });
}

// ======================================================
// 1. PRESTADOR
// ======================================================

function configurarBotaoOnline() {
    const toggle = document.getElementById('online-toggle');
    if(!toggle) return;
    
    // Recupera estado anterior se possível ou reseta
    // Por segurança no MVP, resetamos visualmente
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
    if (!auth.currentUser) return;
    
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

function escutarMeusChamados() {
    if(!auth.currentUser) return;

    const container = document.getElementById('lista-chamados');
    if(!container) return;

    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid));
    let isInitialLoad = true;

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('lista-chamados');
        lista.innerHTML = "";
        
        if (snap.empty) {
            lista.classList.add('hidden');
        } else {
            lista.classList.remove('hidden');
            lista.innerHTML = `<h3 class="font-black text-blue-900 text-xs uppercase mb-2">🔔 Gerenciador de Pedidos</h3>`;
            
            // Som apenas para NOVOS pedidos
            snap.docChanges().forEach(change => {
                if (change.type === "added" && !isInitialLoad) {
                    const audio = document.getElementById('notification-sound');
                    if(audio && change.doc.data().status === 'reserved') audio.play().catch(e => console.log("Som bloqueado"));
                }
            });
            isInitialLoad = false;

            snap.forEach(d => {
                const pedido = d.data();
                
                if (pedido.status === 'reserved') {
                    lista.innerHTML += `
                    <div class="bg-green-50 p-4 rounded-xl border-l-4 border-green-600 shadow-md mb-4 animate-fadeIn">
                        <div class="flex justify-between items-start mb-2">
                            <div><p class="font-bold text-sm text-green-900">RESERVA PAGA! 💰</p><p class="text-[10px] text-green-700">Cliente: ${pedido.client_email}</p></div>
                            <span class="text-xl">🔒</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mb-3">
                            <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">💬 Abrir Chat</button>
                            <div class="text-center"><p class="text-[8px] text-gray-500 uppercase font-bold">A receber fora:</p><p class="font-black text-gray-800">R$ ${(pedido.service_value - pedido.amount_total_reservation).toFixed(2)}</p></div>
                        </div>
                        <div class="bg-white p-3 rounded-lg border border-green-200">
                            <label class="text-[9px] font-bold text-gray-500 uppercase block mb-1">Finalizar Serviço (Peça o código ao cliente)</label>
                            <div class="flex gap-2">
                                <input type="tel" id="token-${d.id}" placeholder="0000" maxlength="4" class="w-16 text-center font-black text-lg border-2 border-gray-200 rounded-lg focus:border-green-500 outline-none text-gray-800">
                                <button onclick="validarTokenPrestador('${d.id}', ${pedido.service_value})" class="flex-1 bg-green-600 text-white font-bold text-xs rounded-lg hover:bg-green-700 transition">VALIDAR</button>
                            </div>
                        </div>
                    </div>`;
                }
                else if (pedido.status === 'completed') {
                    const botaoAvaliar = !pedido.client_reviewed 
                        ? `<button onclick="abrirModalAvaliacao('${d.id}', '${pedido.client_id}', 'cliente')" class="mt-2 w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold text-[10px] uppercase hover:bg-blue-200">⭐ AVALIAR CLIENTE</button>` 
                        : `<p class="text-[9px] text-green-600 font-bold mt-2 text-center">✅ Avaliação enviada</p>`;

                    lista.innerHTML += `
                    <div class="bg-gray-100 p-3 rounded-xl border border-gray-200 opacity-90 mb-2">
                        <p class="font-bold text-xs text-gray-600">✅ Serviço Finalizado</p>
                        <p class="text-[10px] text-gray-400">${pedido.service_date} - ${pedido.client_email}</p>
                        ${botaoAvaliar}
                    </div>`;
                }
            });
        }
    });
}

window.validarTokenPrestador = async (orderId, valorTotal) => {
    const input = document.getElementById(`token-${orderId}`);
    const tokenDigitado = input.value.trim();
    if(tokenDigitado.length !== 4) return alert("O código deve ter 4 dígitos.");

    const btn = event.target;
    btn.innerText = "...";
    btn.disabled = true;

    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if(!orderSnap.exists()) throw new Error("Erro.");
        
        if (tokenDigitado === orderSnap.data().finalization_code) {
            await updateDoc(orderRef, { status: 'completed', completed_at: serverTimestamp() });
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { saldo: increment(orderSnap.data().amount_security || 0) });
            alert(`✅ SUCESSO!\nServiço Encerrado.\nSaldo liberado.`);
        } else {
            alert("❌ CÓDIGO INVÁLIDO.");
            input.value = "";
            btn.innerText = "VALIDAR";
            btn.disabled = false;
        }
    } catch (e) { alert("Erro: " + e.message); btn.disabled = false; }
};

window.aceitarChamado = (orderId, chatId, clientName) => {
    window.switchTab('chat');
    setTimeout(() => { if(window.abrirChat) window.abrirChat(chatId, `Negociação com ${clientName}`); }, 500);
};

// ======================================================
// 2. CLIENTE
// ======================================================

let listenerPrestadoresAtivo = false;

function carregarPrestadoresOnline() {
    const listaContainer = document.getElementById('lista-prestadores-realtime');
    // Se o elemento não existe (está em outra aba), não força.
    if(!listaContainer) return; 

    // Evita duplicidade
    if(listenerPrestadoresAtivo) return;

    const q = query(collection(db, "active_providers")); 

    onSnapshot(q, (snap) => {
        listenerPrestadoresAtivo = true;
        listaContainer.innerHTML = ""; 
        
        if (snap.empty) {
            listaContainer.innerHTML = `<div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p class="text-2xl mb-2">🔍</p><p class="font-bold">Nenhum prestador online.</p></div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full mb-2 flex items-center justify-center text-xl font-bold border border-blue-100">${p.email ? p.email.charAt(0).toUpperCase() : '?'}</div>
                        <h4 class="font-bold text-xs text-blue-900 uppercase text-center leading-tight mb-1">${p.profissao || 'Profissional'}</h4>
                        <button onclick="abrirModalSolicitacao('${p.uid}', '${p.email}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition shadow-sm mt-2">Solicitar</button>
                    </div>`;
            });
        }
    });
}

function escutarMeusPedidos() {
    if(!auth.currentUser) return;
    
    const parent = document.getElementById('servicos-cliente');
    if(parent) {
        if(!document.getElementById('meus-pedidos-ativos')) {
            const div = document.createElement('div'); div.id = 'meus-pedidos-ativos'; div.className = "mb-4"; parent.insertBefore(div, parent.firstChild);
        }
        if(!document.getElementById('meus-pedidos-historico')) {
            const div = document.createElement('div'); div.id = 'meus-pedidos-historico'; div.className = "mt-4 border-t pt-4"; parent.appendChild(div);
        }
    }
    
    const containerAtivos = document.getElementById('meus-pedidos-ativos');
    const containerHistorico = document.getElementById('meus-pedidos-historico');
    if(!containerAtivos || !containerHistorico) return;

    const q = query(collection(db, "orders"), where("client_id", "==", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        containerAtivos.innerHTML = "";
        containerHistorico.innerHTML = "";
        let temAtivos = false, temHistorico = false;

        snap.forEach(d => {
            const pedido = d.data();
            const temCodigo = pedido.finalization_code ? true : false;
            
            if (pedido.status === 'reserved') {
                temAtivos = true;
                containerAtivos.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border-l-4 border-yellow-400 shadow-sm mb-2">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[10px] font-bold uppercase text-gray-500">Prestador: ${pedido.provider_email}</span>
                            <span class="text-[9px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold">EM ANDAMENTO</span>
                        </div>
                        <h4 class="font-black text-gray-800 text-sm mb-3">R$ ${pedido.service_value}</h4>
                        <div class="flex gap-2">
                            <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.provider_email}')" class="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-[10px] uppercase">Chat</button>
                            <button onclick="gerarTokenCliente('${d.id}')" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase shadow-sm">${temCodigo ? 'VER CÓDIGO 🔑' : 'FINALIZAR SERVIÇO ✅'}</button>
                        </div>
                    </div>`;
            } else if (pedido.status === 'completed') {
                temHistorico = true;
                const btnReview = !pedido.provider_reviewed
                    ? `<button onclick="abrirModalAvaliacao('${d.id}', '${pedido.provider_id}', 'prestador')" class="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg font-bold text-[10px] uppercase hover:bg-blue-700 animate-pulse">⭐ AVALIAR PRESTADOR</button>`
                    : `<p class="text-[9px] text-green-600 font-bold mt-2 text-center">✅ Avaliado</p>`;

                containerHistorico.innerHTML += `
                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-2">
                        <div class="flex justify-between items-center"><span class="text-[10px] font-bold text-gray-500">Finalizado</span><span class="text-[9px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">R$ ${pedido.service_value}</span></div>
                        <p class="text-xs font-bold text-gray-700 mt-1">${pedido.provider_email}</p>
                        ${btnReview}
                    </div>`;
                
                if(!pedido.provider_reviewed) setTimeout(() => abrirModalAvaliacao(d.id, pedido.provider_id, 'prestador'), 1500);
            }
        });
        if(temAtivos) containerAtivos.insertAdjacentHTML('afterbegin', `<h3 class="font-black text-gray-800 text-xs uppercase mb-2">Em Andamento</h3>`);
        if(temHistorico) containerHistorico.insertAdjacentHTML('afterbegin', `<h3 class="font-black text-gray-400 text-xs uppercase mb-2 mt-4 border-t pt-4">Histórico</h3>`);
    });
}

// --- FUNÇÕES COMPARTILHADAS ---
window.abrirModalAvaliacao = (orderId, targetId, tipo) => {
    orderIdParaAvaliar = orderId;
    if(tipo === 'prestador') {
        providerIdParaAvaliar = targetId;
        clientIdParaAvaliar = null;
        if(document.getElementById('review-title')) document.getElementById('review-title').innerText = "Avaliar Prestador";
    } else {
        clientIdParaAvaliar = targetId;
        providerIdParaAvaliar = null;
        if(document.getElementById('review-title')) document.getElementById('review-title').innerText = "Avaliar Cliente";
    }
    document.getElementById('review-modal').classList.remove('hidden');
};

window.enviarAvaliacao = async () => {
    let stars = 0;
    document.querySelectorAll('.rate-star.active').forEach(s => stars = Math.max(stars, s.getAttribute('data-val')));
    if(stars === 0) return alert("Selecione pelo menos 1 estrela.");

    const comment = document.getElementById('review-comment').value.trim();
    const tags = [];
    document.querySelectorAll('.tag-select.selected').forEach(t => tags.push(t.innerText));
    const recommend = document.querySelector('input[name="recommend"]:checked').value === 'yes';

    const btn = event.target;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        const updateData = {};
        let targetUserId = "";
        if (providerIdParaAvaliar) { updateData.provider_reviewed = true; targetUserId = providerIdParaAvaliar; } 
        else { updateData.client_reviewed = true; targetUserId = clientIdParaAvaliar; }

        await addDoc(collection(db, "reviews"), {
            order_id: orderIdParaAvaliar,
            target_user_id: targetUserId,
            reviewer_id: auth.currentUser.uid,
            stars: parseInt(stars),
            tags: tags,
            comment: comment,
            recommended: recommend,
            created_at: serverTimestamp()
        });

        await updateDoc(doc(db, "orders", orderIdParaAvaliar), updateData);
        document.getElementById('review-modal').classList.add('hidden');
        alert("✅ Avaliação Enviada!");
    } catch (e) { alert("Erro: " + e.message); btn.innerText = "Tentar Novamente"; btn.disabled = false; }
};

window.gerarTokenCliente = async (orderId) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(orderRef);
        let code = docSnap.data().finalization_code;
        if (!code) {
            code = Math.floor(1000 + Math.random() * 9000).toString(); 
            await updateDoc(orderRef, { finalization_code: code });
        }
        alert(`🔑 CÓDIGO DE FINALIZAÇÃO: ${code}`);
    } catch (e) { alert("Erro: " + e.message); }
};

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
    btn.innerText = "...";
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
            status: "reserved",
            chat_id: chatRoomId,
            client_reviewed: false, 
            provider_reviewed: false, 
            created_at: serverTimestamp()
        });

        document.getElementById('request-modal').classList.add('hidden');
        alert(`✅ Reserva Confirmada!\nChat Liberado!`);
        
        const chatRef = doc(db, "chats", chatRoomId);
        await setDoc(chatRef, {
            participants: [auth.currentUser.uid, targetProviderId],
            mission_title: `Serviço: R$ ${valor}`,
            last_message: "Reserva confirmada.",
            updated_at: serverTimestamp(),
            is_service_chat: true
        });

        window.switchTab('chat');
        setTimeout(() => { 
            if(window.abrirChat) window.abrirChat(chatRoomId, `Negociação`); 
            btn.innerText = "PAGAR RESERVA 🔒";
            btn.disabled = false;
        }, 500);
    } catch (e) { console.error(e); alert("Erro técnico."); btn.disabled = false; }
};
