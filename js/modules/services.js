import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURAÇÕES ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let meusServicos = [];

// --- FUNÇÕES DE INTERFACE ---
function atualizarVisualRadar(isOnline) {
    const container = document.getElementById('pview-radar');
    if (!container) return;
    container.innerHTML = isOnline ? 
        `<div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center"><p class="text-6xl mb-4 animate-pulse">📡</p><p class="font-bold text-lg text-green-500 uppercase">Buscando Clientes...</p></div>` :
        `<div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center"><p class="text-6xl mb-4">😴</p><p class="font-bold text-lg uppercase text-gray-500">Você está Offline</p></div>`;
}

// --- EXPOSIÇÃO GLOBAL (O QUE RESOLVE OS BOTÕES) ---
window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    if (!cat || !price) return alert("Selecione categoria e preço!");
    meusServicos.push({ category: cat, price: parseFloat(price) });
    renderMyServicesList();
};

window.removeServiceLocal = (index) => {
    meusServicos.splice(index, 1);
    renderMyServicesList();
};

window.salvarConfiguracoesPrestador = async () => {
    if (!auth.currentUser) return;
    const btn = document.querySelector('button.bg-green-600');
    if (btn) btn.innerText = "SALVANDO...";

    try {
        // Atualiza Perfil do Usuário
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            services_offered: meusServicos
        });

        // Fica Online no Radar
        await window.alternarStatusOnline(true);
        
        document.getElementById('provider-setup-modal')?.classList.add('hidden');
        alert("Configurações salvas e você está ONLINE! 🚀");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    } finally {
        if (btn) btn.innerHTML = "SALVAR E FICAR ONLINE 📡";
    }
};

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    await setDoc(activeRef, {
        is_online: isOnline,
        uid: auth.currentUser.uid,
        last_seen: serverTimestamp(),
        services: meusServicos
    }, { merge: true });
    
    const toggle = document.getElementById('online-toggle');
    if (toggle) toggle.checked = isOnline;
    atualizarVisualRadar(isOnline);
};

window.abrirConfiguracaoServicos = () => {
    document.getElementById('provider-setup-modal')?.classList.remove('hidden');
    renderMyServicesList();
};

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if (!list) return;
    list.innerHTML = meusServicos.length === 0 ? `<p class="text-center text-gray-300 py-4 italic text-xs">Nenhum serviço adicionado.</p>` : "";
    meusServicos.forEach((srv, index) => {
        list.innerHTML += `<div class="bg-gray-50 p-3 rounded mb-2 flex justify-between border border-gray-100 items-center">
            <span class="font-bold text-blue-900 text-xs">${srv.category} - R$ ${srv.price}</span>
            <button onclick="window.removeServiceLocal(${index})" class="text-red-400 font-bold px-2 text-lg">&times;</button>
        </div>`;
    });
}

// --- INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            meusServicos = userDoc.data().services_offered || [];
        }
        const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
        const statusReal = activeSnap.exists() && activeSnap.data().is_online === true;
        atualizarVisualRadar(statusReal);
    }
});
