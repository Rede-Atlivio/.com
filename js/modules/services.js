import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURAÇÕES ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let meusServicos = [];

// --- 2. FUNÇÕES DE RENDERIZAÇÃO (RESTAURADAS) ---
window.renderMyServicesList = () => {
    const list = document.getElementById('my-services-list');
    if (!list) return;
    
    list.innerHTML = meusServicos.length === 0 ? 
        `<p class="text-center text-gray-300 py-4 italic text-xs">Nenhum serviço adicionado.</p>` : "";

    meusServicos.forEach((srv, index) => {
        list.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-lg mb-2 flex justify-between border border-gray-100 items-center">
                <span class="font-bold text-blue-900 text-xs">${srv.category} - R$ ${srv.price}</span>
                <button onclick="window.removeServiceLocal(${index})" class="text-red-400 font-bold px-2 text-lg">×</button>
            </div>`;
    });
};

// --- 3. EXPOSIÇÃO GLOBAL (O QUE RESOLVE O MODAL) ---
window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    if (!cat || !price) return alert("Selecione categoria e preço!");
    meusServicos.push({ category: cat, price: parseFloat(price) });
    window.renderMyServicesList();
};

window.removeServiceLocal = (index) => {
    meusServicos.splice(index, 1);
    window.renderMyServicesList();
};

window.saveServicesAndGoOnline = async () => {
    if (!auth.currentUser) return;
    const btn = document.querySelector('button.bg-green-600');
    if (btn) btn.innerText = "SALVANDO...";

    try {
        // Atualiza a lista no perfil do Firestore
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            services_offered: meusServicos
        });

        // Tenta ativar o status online se o botão permitir
        const toggle = document.getElementById('online-toggle');
        if (toggle && toggle.checked) {
            await window.alternarStatusOnline(true);
        }

        document.getElementById('provider-setup-modal')?.classList.add('hidden');
        alert("Serviços atualizados com sucesso! ✅");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar dados.");
    } finally {
        if (btn) btn.innerHTML = "SALVAR E FICAR ONLINE 📡";
    }
};

window.abrirConfiguracaoServicos = () => {
    document.getElementById('provider-setup-modal')?.classList.remove('hidden');
    window.renderMyServicesList();
};

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        await setDoc(activeRef, {
            is_online: isOnline,
            uid: auth.currentUser.uid,
            last_seen: serverTimestamp(),
            services: meusServicos
        }, { merge: true });
        
        // Função visual do Radar
        const radar = document.getElementById('pview-radar');
        if (radar) {
            radar.innerHTML = isOnline ? 
                `<div class="text-center py-10 animate-pulse"><p class="text-6xl mb-4">📡</p><p class="text-green-500 font-bold uppercase">Buscando Clientes...</p></div>` :
                `<div class="text-center py-10"><p class="text-6xl mb-4">😴</p><p class="text-gray-500 font-bold uppercase">Você está Offline</p></div>`;
        }
    } catch (e) { console.error(e); }
};

// --- 4. INICIALIZAÇÃO DE PERFIL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            
            // Corrige o problema da foto carregando e nome
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = d.nome_profissional || user.displayName);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => {
                el.src = d.photoURL || user.photoURL || 'https://ui-avatars.com/api/?name=' + (d.nome_profissional || 'User');
            });
        }
        
        // Sincroniza o botão online com o banco
        const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
        const statusReal = activeSnap.exists() && activeSnap.data().is_online === true;
        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            toggle.checked = statusReal;
            toggle.onchange = (e) => window.alternarStatusOnline(e.target.checked);
        }
    }
});
