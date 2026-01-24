import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURAÇÕES E CATEGORIAS ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];
let basePriceAtual = 0;
let targetProviderEmail = null;

// --- 2. EXPOSIÇÃO GLOBAL PARA BOTÕES DO HTML ---
window.switchServiceSubTab = (tab) => { 
    ['contratar', 'andamento', 'historico'].forEach(t => { 
        const v = document.getElementById(`view-${t}`); 
        const b = document.getElementById(`subtab-${t}-btn`); 
        if(v) v.classList.toggle('hidden', t !== tab);
        if(b) b.classList.toggle('active', t === tab);
    });
};

window.switchProviderSubTab = (tabName) => { 
    ['radar', 'ativos', 'historico'].forEach(t => { 
        const v = document.getElementById(`pview-${t}`); 
        const b = document.getElementById(`ptab-${t}-btn`); 
        if(v) v.classList.toggle('hidden', t !== tabName);
        if(b) b.classList.toggle('active', t === tabName);
    });
};

window.renderizarFiltros = () => {
    const container = document.getElementById('category-filters');
    if(!container) return;
    let html = `<button onclick="filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase shadow-sm">Todos</button>`;
    categoriasDisponiveis.forEach(cat => {
        html += `<button onclick="filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase shadow-sm">${cat}</button>`;
    });
    container.innerHTML = html;
};

window.filtrarCategoria = (cat) => {
    categoriaAtiva = cat;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        const isMatch = btn.innerText.toUpperCase() === cat.toUpperCase();
        btn.classList.toggle('active', isMatch);
        btn.classList.toggle('text-blue-900', isMatch);
    });
    carregarPrestadoresOnline();
};

window.abrirConfiguracaoServicos = () => {
    document.getElementById('provider-setup-modal')?.classList.remove('hidden');
    renderMyServicesList();
};

// --- 3. GESTÃO DE SERVIÇOS DO PRESTADOR ---
window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    const desc = document.getElementById('new-service-desc')?.value || "";
    if (!cat || !price) return alert("Preencha categoria e preço!");
    meusServicos.push({ category: cat, price: parseFloat(price), description: desc, visible: true });
    renderMyServicesList();
    document.getElementById('new-service-category').value = "";
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
};

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if (!list) return;
    list.innerHTML = meusServicos.length === 0 ? `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>` : "";
    meusServicos.forEach((srv, index) => {
        list.innerHTML += `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2">
            <div><span class="block font-bold text-xs text-blue-900">${srv.category}</span><span class="text-[10px] font-bold text-green-600">R$ ${srv.price.toFixed(2)}</span></div>
            <button onclick="window.removeServiceLocal(${index})" class="text-red-400 font-bold px-2">&times;</button>
        </div>`;
    });
}

window.removeServiceLocal = (index) => { meusServicos.splice(index, 1); renderMyServicesList(); };

// --- 4. FLUXO DE CLIENTE E RADAR ---
function carregarPrestadoresOnline() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;
    const q = query(collection(db, "active_providers"), where("is_online", "==", true));
    onSnapshot(q, (snap) => {
        container.innerHTML = snap.empty ? `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>` : "";
        snap.forEach(d => {
            const p = d.data();
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;
            const srv = (categoriaAtiva !== 'Todos') ? p.services?.find(s => s.category === categoriaAtiva) : p.services?.[0];
            if (!srv) return;
            container.innerHTML += `<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4">
                <div class="h-16 w-full bg-blue-600 relative"><div class="absolute top-2 right-2 bg-green-500 text-[7px] text-white font-bold px-2 py-0.5 rounded-full">ONLINE</div></div>
                <div class="absolute top-8 left-3 w-12 h-12 rounded-full border-4 border-white shadow bg-white overflow-hidden"><img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name=' + p.nome_profissional}" class="w-full h-full object-cover"></div>
                <div class="pt-5 pb-3 px-3"><h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional}</h4><p class="text-[9px] font-black text-green-600">R$ ${srv.price}</p>
                <button onclick="window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase shadow-sm">Solicitar</button></div>
            </div>`;
        });
    });
}

// --- 5. INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = d.nome_profissional || user.displayName);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => el.src = d.photoURL || user.photoURL);
        }
        window.renderizarFiltros();
        carregarPrestadoresOnline();
        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
            toggle.checked = activeSnap.exists() && activeSnap.data().is_online;
            toggle.onchange = (e) => window.alternarStatusOnline(e.target.checked);
        }
    }
});

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        if (isOnline) {
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const d = userDoc.data() || {};
            await setDoc(activeRef, { uid: auth.currentUser.uid, is_online: true, nome_profissional: d.nome_profissional || auth.currentUser.displayName, foto_perfil: d.photoURL || auth.currentUser.photoURL, services: meusServicos, categories: meusServicos.map(s => s.category), last_seen: serverTimestamp() }, { merge: true });
        } else {
            await updateDoc(activeRef, { is_online: false, last_seen: serverTimestamp() });
        }
    } catch (e) { console.error(e); }
};
