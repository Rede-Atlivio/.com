import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
let onlineListener = null;

setTimeout(() => {
    configurarBotaoOnline();
    if (userProfile && !userProfile.is_provider) {
        carregarPrestadoresOnline();
    }
    if (userProfile && userProfile.is_provider) {
        escutarMeusChamados();
    }
}, 2000);

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
    if (!auth.currentUser) return;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            await setDoc(doc(db, "active_providers", auth.currentUser.uid), {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                tenant_id: userProfile.tenant_id || 'default',
                profissao: "Prestador Atlivio",
                last_seen: serverTimestamp()
            });
        });
    } else {
        alert("Ative o GPS para trabalhar!");
        document.getElementById('online-toggle').checked = false;
    }
}

async function ficarOffline() {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, "active_providers", auth.currentUser.uid));
}

// 2. PRESTADOR: ESCUTAR CHAMADOS
function escutarMeusChamados() {
    const container = document.getElementById('lista-chamados');
    if(!container) return;
    const q = query(collection(db, "orders"), where("provider_id", "==", auth.currentUser.uid), where("status", "==", "open"));

    onSnapshot(q, (snap) => {
        const lista = document.getElementById('lista-chamados');
        if (snap.empty) {
            lista.classList.add('hidden');
        } else {
            lista.classList.remove('hidden');
            lista.innerHTML = `<h3 class="font-black text-blue-900 text-xs uppercase mb-2">🔔 Novos Chamados!</h3>`;
            snap.forEach(d => {
                const pedido = d.data();
                lista.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border-l-4 border-blue-600 shadow-md mb-2 animate-fadeIn">
                        <div class="flex justify-between items-start">
                            <div><p class="font-bold text-sm text-gray-800">Novo Cliente</p><p class="text-[10px] text-gray-500">Quer negociar serviço.</p></div>
                            <span class="text-xl">👋</span>
                        </div>
                        <button onclick="aceitarChamado('${d.id}', '${pedido.chat_id}', '${pedido.client_email}')" class="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg font-bold text-xs uppercase shadow-sm">Responder Agora</button>
                    </div>`;
            });
        }
    });
}

window.aceitarChamado = (orderId, chatId, clientName) => {
    window.switchTab('chat');
    setTimeout(() => { if(window.abrirChat) window.abrirChat(chatId, `Cliente: ${clientName}`); }, 500);
};

// 3. CLIENTE: VER PRESTADORES (COM CORREÇÃO DE VISIBILIDADE)
function carregarPrestadoresOnline() {
    const listaContainer = document.getElementById('lista-prestadores-realtime');
    if(!listaContainer) return;
    const q = query(collection(db, "active_providers")); 

    onSnapshot(q, (snap) => {
        listaContainer.innerHTML = "";
        if (snap.empty) {
            listaContainer.innerHTML = `<div class="col-span-2 text-center text-gray-400 text-xs py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p class="text-2xl mb-2">🔍</p>Nenhum prestador online na sua região agora.</div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                
                // --- CORREÇÃO: Removi o filtro que escondia você de si mesmo para testes ---
                // if(auth.currentUser && p.uid === auth.currentUser.uid) return; 

                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative group hover:shadow-md transition">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-blue-50 text-blue-500 rounded-full mb-2 flex items-center justify-center text-xl font-bold border border-blue-100">
                            ${p.email.charAt(0).toUpperCase()}
                        </div>
                        <h4 class="font-bold text-xs text-blue-900 uppercase text-center leading-tight mb-1">${p.profissao || 'Profissional'}</h4>
                        <p class="text-[9px] text-gray-400 mb-3 truncate w-full text-center">${p.email}</p>
                        <button onclick="iniciarContratacao('${p.uid}', '${p.email}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition">Chamar</button>
                    </div>`;
            });
        }
    });
}

window.iniciarContratacao = async (providerId, providerEmail) => {
    if(!confirm(`Deseja iniciar uma conversa com ${providerEmail}?`)) return;
    const btn = event.target;
    const textoOriginal = btn.innerText;
    btn.innerText = "Criando sala...";
    btn.disabled = true;

    try {
        const ids = [auth.currentUser.uid, providerId].sort();
        const chatRoomId = `${ids[0]}_${ids[1]}`;
        const chatRef = doc(db, "chats", chatRoomId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [auth.currentUser.uid, providerId],
                mission_title: "Negociação de Serviço",
                last_message: "Chat iniciado pelo cliente.",
                updated_at: serverTimestamp(),
                is_service_chat: true
            });
        }

        await addDoc(collection(db, "orders"), {
            client_id: auth.currentUser.uid,
            client_email: auth.currentUser.email,
            provider_id: providerId,
            provider_email: providerEmail,
            status: "open",
            chat_id: chatRoomId,
            created_at: serverTimestamp()
        });

        window.switchTab('chat');
        setTimeout(() => {
            if(window.abrirChat) window.abrirChat(chatRoomId, `Prestador: ${providerEmail}`);
            btn.innerText = textoOriginal;
            btn.disabled = false;
        }, 500);

    } catch (e) {
        alert("Erro ao conectar: " + e.message);
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
};
