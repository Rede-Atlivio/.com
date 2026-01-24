import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURAÇÕES E CATEGORIAS ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];

// --- 2. EXPOSIÇÃO GLOBAL IMEDIATA (PARA O HTML ENXERGAR OS BOTÕES) ---

window.abrirConfiguracaoServicos = () => {
    const modal = document.getElementById('provider-setup-modal');
    if (modal) {
        modal.classList.remove('hidden');
        renderMyServicesList();
    }
};

window.switchServiceSubTab = (tab) => {
    const abas = ['contratar', 'andamento', 'historico', 'carteira'];
    abas.forEach(t => {
        document.getElementById(`view-${t}`)?.classList.toggle('hidden', t !== tab);
        document.getElementById(`subtab-${t}-btn`)?.classList.toggle('active', t === tab);
    });
};

window.switchProviderSubTab = (tabName) => {
    const abasP = ['radar', 'ativos', 'historico', 'carteira'];
    abasP.forEach(t => {
        document.getElementById(`pview-${t}`)?.classList.toggle('hidden', t !== tabName);
        document.getElementById(`ptab-${t}-btn`)?.classList.toggle('active', t === tabName);
    });
};

window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    if (!cat || !price) return alert("Selecione categoria e preço!");

    meusServicos.push({ category: cat, price: parseFloat(price), visible: true });
    renderMyServicesList();
};

window.removeServiceLocal = (index) => { meusServicos.splice(index, 1); renderMyServicesList(); };

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        if (isOnline) {
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const d = userDoc.data() || {};
            await setDoc(activeRef, {
                uid: auth.currentUser.uid,
                is_online: true,
                nome_profissional: d.nome_profissional || auth.currentUser.displayName,
                foto_perfil: d.photoURL || auth.currentUser.photoURL,
                services: meusServicos,
                categories: meusServicos.map(s => s.category),
                last_seen: serverTimestamp()
            }, { merge: true });
            document.getElementById('online-sound')?.play().catch(()=>{});
        } else {
            await updateDoc(activeRef, { is_online: false, last_seen: serverTimestamp() });
        }
    } catch (e) { console.error("Erro status:", e); }
};

// --- 3. LÓGICA DE INTERFACE ---

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if (!list) return;
    list.innerHTML = meusServicos.length === 0 ? `<p class="text-center text-gray-400 text-xs py-4">Nenhum serviço.</p>` : "";
    meusServicos.forEach((srv, index) => {
        list.innerHTML += `<div class="bg-gray-50 p-2 rounded mb-1 flex justify-between text-xs font-bold">
            <span>${srv.category} - R$ ${srv.price.toFixed(2)}</span>
            <button onclick="window.removeServiceLocal(${index})" class="text-red-500">❌</button>
        </div>`;
    });
}

function carregarPrestadoresOnline() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    const q = query(collection(db, "active_providers"), where("is_online", "==", true));
    onSnapshot(q, (snap) => {
        container.innerHTML = snap.empty ? `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>` : "";
        snap.forEach(d => {
            const p = d.data();
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;
            const srv = p.services?.[0];
            if (!srv) return;

            container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4">
                <div class="h-16 w-full bg-blue-600 relative">
                    <div class="absolute top-2 right-2 bg-green-500 text-[7px] text-white font-bold px-2 py-0.5 rounded-full">ONLINE</div>
                </div>
                <div class="absolute top-8 left-3 w-12 h-12 rounded-full border-4 border-white shadow bg-white overflow-hidden">
                    <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name=' + p.nome_profissional}" class="w-full h-full object-cover">
                </div>
                <div class="pt-5 pb-3 px-3">
                    <h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional}</h4>
                    <p class="text-[9px] font-black text-green-600">R$ ${srv.price}</p>
                    <button onclick="window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase">Solicitar</button>
                </div>
            </div>`;
        });
    });
}

// --- 4. MONITOR DE ESTADO ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = d.nome_profissional || user.displayName);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => el.src = d.photoURL || user.photoURL);
        }

        window.switchServiceSubTab('contratar');
        carregarPrestadoresOnline();

        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
            toggle.checked = activeSnap.exists() && activeSnap.data().is_online;
            toggle.onchange = (e) => window.alternarStatusOnline(e.target.checked);
        }
    }
});
