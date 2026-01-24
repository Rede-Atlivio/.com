import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. DEFINIÇÕES GLOBAIS (TOPO ABSOLUTO PARA EVITAR ERRO) ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];
let listenerAtivo = false;

// --- 2. FUNÇÕES DE NAVEGAÇÃO E INTERFACE ---
window.switchServiceSubTab = (tab) => { 
    ['contratar', 'andamento', 'historico'].forEach(t => { 
        const v = document.getElementById(`view-${t}`); 
        const b = document.getElementById(`subtab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`view-${tab}`); 
    const targetB = document.getElementById(`subtab-${tab}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

window.switchProviderSubTab = (tabName) => { 
    ['radar', 'ativos', 'historico'].forEach(t => { 
        const v = document.getElementById(`pview-${t}`); 
        const b = document.getElementById(`ptab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`pview-${tabName}`); 
    const targetB = document.getElementById(`ptab-${tabName}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

window.renderizarFiltros = () => {
    const container = document.getElementById('category-filters');
    if(!container) return;
    let html = `<button onclick="filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase">Todos</button>`;
    categoriasDisponiveis.forEach(cat => {
        html += `<button onclick="filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase">${cat}</button>`;
    });
    container.innerHTML = html;
};

window.filtrarCategoria = (cat) => {
    categoriaAtiva = cat;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toUpperCase() === cat.toUpperCase());
    });
    carregarPrestadoresOnline(true);
};

// --- 3. LÓGICA DO RADAR E STATUS ---

function atualizarVisualRadar(isOnline) {
    const container = document.getElementById('pview-radar');
    if (!container) return;
    if (isOnline) {
        container.innerHTML = `<div id="status-msg" class="text-gray-400 mb-4 py-10 animate-fadeIn text-center"><p class="text-6xl mb-4 animate-pulse">📡</p><p class="font-bold text-lg text-green-500 uppercase">Buscando Clientes...</p><p class="text-xs text-gray-400 mt-2">Você está visível no catálogo agora.</p></div>`;
    } else {
        container.innerHTML = `<div id="status-msg" class="text-gray-400 mb-4 py-10 animate-fadeIn text-center"><p class="text-6xl mb-4">😴</p><p class="font-bold text-lg uppercase">Você está Offline</p><p class="text-xs mt-2">Ligue o botão para agendamentos ou chamados.</p></div>`;
    }
}

async function alternarStatusOnline(isOnline) {
    if (!auth.currentUser) return;
    try {
        const activeRef = doc(db, "active_providers", auth.currentUser.uid);
        if (isOnline) {
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const data = userDoc.data() || {};
            await setDoc(activeRef, {
                uid: auth.currentUser.uid,
                is_online: true,
                nome_profissional: data.nome_profissional || data.displayName || "Prestador",
                foto_perfil: data.photoURL || auth.currentUser.photoURL,
                services: data.services_offered || [],
                categories: (data.services_offered || []).map(s => s.category),
                last_seen: serverTimestamp()
            }, { merge: true });
            document.getElementById('online-sound')?.play().catch(()=>{});
        } else {
            await updateDoc(activeRef, { is_online: false, last_seen: serverTimestamp() });
        }
        atualizarVisualRadar(isOnline);
    } catch (e) {
        console.error("Erro status:", e);
        document.getElementById('online-toggle').checked = !isOnline;
    }
}

// --- 4. CARREGAMENTO DO CATÁLOGO (CLIENTE) ---

function carregarPrestadoresOnline(forcar = false) {
    const container = document.getElementById('lista-prestadores-realtime');
    if(!container || (listenerAtivo && !forcar)) return;

    let q = query(collection(db, "active_providers"), orderBy("is_online", "desc"));
    if (categoriaAtiva !== 'Todos') {
        q = query(collection(db, "active_providers"), where("categories", "array-contains", categoriaAtiva), orderBy("is_online", "desc"));
    }

    onSnapshot(q, (snap) => {
        listenerAtivo = true;
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>`;
            return;
        }
        snap.forEach(d => {
            const p = d.data();
            if(auth.currentUser && p.uid === auth.currentUser.uid) return;
            const srv = (categoriaAtiva !== 'Todos') ? p.services?.find(s => s.category === categoriaAtiva) : p.services?.[0];
            if(!srv) return;

            container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative" onclick="window.abrirPerfilPublico('${p.uid}')">
                <div class="h-20 w-full bg-blue-600 relative">
                    <div class="absolute top-2 right-2 ${p.is_online ? 'bg-green-500' : 'bg-yellow-400'} text-[7px] text-white font-bold px-2 py-0.5 rounded-full">${p.is_online ? 'ONLINE' : 'AGENDAMENTO'}</div>
                </div>
                <div class="absolute top-10 left-3 w-14 h-14 rounded-full border-4 border-white shadow bg-white overflow-hidden">
                    <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name='+p.nome_profissional}" class="w-full h-full object-cover">
                </div>
                <div class="pt-6 pb-3 px-3 text-left">
                    <h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional}</h4>
                    <p class="text-[9px] font-black text-green-600 mt-1">R$ ${srv.price}</p>
                    <button onclick="event.stopPropagation(); window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase">Solicitar</button>
                </div>
            </div>`;
        });
    });
}

// --- 5. MONITOR DE ESTADO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.renderizarFiltros();
        window.switchServiceSubTab('contratar');
        carregarPrestadoresOnline();
        
        const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
        const toggle = document.getElementById('online-toggle');
        
        const onlineNoBanco = activeSnap.exists() && activeSnap.data().is_online;
        if(toggle) {
            toggle.checked = onlineNoBanco;
            toggle.onchange = (e) => alternarStatusOnline(e.target.checked);
        }
        atualizarVisualRadar(onlineNoBanco);
    }
});

window.abrirConfiguracaoServicos = () => document.getElementById('provider-setup-modal')?.classList.remove('hidden');
