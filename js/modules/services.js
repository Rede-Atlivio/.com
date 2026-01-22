import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let onlineListener = null;

// --- INICIALIZAÇÃO ---
// Chamado automaticamente quando o módulo carrega
setTimeout(() => {
    configurarBotaoOnline();
    if (userProfile && !userProfile.is_provider) {
        carregarPrestadoresOnline(); // Se for cliente, carrega a lista
    }
}, 2000); // Delay pequeno para garantir que auth carregou

// --- LÓGICA DO PRESTADOR (Botão Online) ---
function configurarBotaoOnline() {
    const toggle = document.getElementById('online-toggle');
    if(!toggle) return;

    // Recupera estado anterior (se o cara fechou o app sem querer)
    // O ideal seria checar no banco, mas por enquanto vamos forçar offline no inicio para evitar bugs
    toggle.checked = false;

    toggle.addEventListener('change', async (e) => {
        const statusMsg = document.getElementById('status-msg');
        
        if (e.target.checked) {
            // FICAR ONLINE
            if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2 animate-pulse">📡</p><p class="font-bold text-green-500">Buscando Clientes...</p>`;
            await ficarOnline();
        } else {
            // FICAR OFFLINE
            if(statusMsg) statusMsg.innerHTML = `<p class="text-4xl mb-2">😴</p><p class="font-bold text-gray-400">Você está Offline</p>`;
            await ficarOffline();
        }
    });
}

async function ficarOnline() {
    if (!auth.currentUser) return;
    
    // Pega localização
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            // Grava na coleção 'active_providers' (Essa é a tabela do Uber)
            await setDoc(doc(db, "active_providers", auth.currentUser.uid), {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                lat: lat,
                lng: lng,
                tenant_id: userProfile.tenant_id || 'default',
                profissao: "Prestador Atlivio", // Futuro: Pegar do perfil
                last_seen: serverTimestamp()
            });
            console.log("Status: ONLINE no banco de dados.");
        });
    }
}

async function ficarOffline() {
    if (!auth.currentUser) return;
    // Remove da tabela do Uber
    await deleteDoc(doc(db, "active_providers", auth.currentUser.uid));
    console.log("Status: OFFLINE removido do banco.");
}

// --- LÓGICA DO CLIENTE (Ver quem está perto) ---
function carregarPrestadoresOnline() {
    const container = document.getElementById('servicos-cliente');
    // Procura a div onde vamos injetar a lista
    let listaContainer = document.getElementById('lista-prestadores-realtime');
    
    if(!listaContainer) {
        listaContainer = document.createElement('div');
        listaContainer.id = 'lista-prestadores-realtime';
        listaContainer.className = 'grid grid-cols-2 gap-3 mt-4';
        container.appendChild(listaContainer);
    }

    // Busca quem está na mesma "cidade" (tenant_id)
    const q = query(collection(db, "active_providers")); 
    // Nota: Removi o filtro de tenant por enquanto para você ver funcionando no teste

    onSnapshot(q, (snap) => {
        listaContainer.innerHTML = "";
        if (snap.empty) {
            listaContainer.innerHTML = `<div class="col-span-2 text-center text-gray-400 text-xs py-4">Nenhum prestador online agora.</div>`;
        } else {
            snap.forEach(d => {
                const p = d.data();
                // Renderiza o Card do Prestador
                listaContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center relative overflow-hidden">
                        <div class="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div class="w-12 h-12 bg-gray-200 rounded-full mb-2 flex items-center justify-center text-xl">👷</div>
                        <h4 class="font-bold text-xs text-blue-900 uppercase">${p.profissao}</h4>
                        <p class="text-[9px] text-gray-500 mb-3">Próximo a você</p>
                        <button onclick="iniciarContratacao('${d.id}')" class="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase">Chamar</button>
                    </div>
                `;
            });
        }
    });
}

window.iniciarContratacao = (providerId) => {
    alert(`Funcionalidade em desenvolvimento!\nID do Prestador: ${providerId}\n\nAqui abriria o Chat direto.`);
    // Próximo passo: Criar documento na coleção 'orders' e redirecionar pro chat
};
