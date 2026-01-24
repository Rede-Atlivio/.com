import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. REGISTRO GLOBAL IMEDIATO (DESTRAVAMENTO) ---
// Registramos no window ANTES de qualquer lógica para garantir que o HTML as veja.

window.switchServiceSubTab = (tab) => { 
    const abas = ['contratar', 'andamento', 'historico'];
    abas.forEach(t => { 
        const v = document.getElementById(`view-${t}`); 
        const b = document.getElementById(`subtab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`view-${tab}`); 
    const targetB = document.getElementById(`subtab-${tab}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

window.switchProviderSubTab = (tabName) => { 
    const views = ['radar', 'ativos', 'historico']; 
    views.forEach(t => { 
        const v = document.getElementById(`pview-${t}`); 
        const b = document.getElementById(`ptab-${t}-btn`); 
        if(v) v.classList.add('hidden'); if(b) b.classList.remove('active'); 
    }); 
    const targetV = document.getElementById(`pview-${tabName}`); 
    const targetB = document.getElementById(`ptab-${tabName}-btn`); 
    if(targetV) targetV.classList.remove('hidden'); if(targetB) targetB.classList.add('active'); 
};

window.abrirConfiguracaoServicos = () => {
    const modal = document.getElementById('provider-setup-modal');
    if(modal) modal.classList.remove('hidden');
    // A renderização da lista será chamada pelo monitor de estado
};

// --- 2. VARIÁVEIS DE ESTADO ---
let categoriaAtiva = 'Todos';
let meusServicos = [];
let listenerPrestadoresAtivo = false;
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];

// --- 3. LÓGICA DE INTERFACE ---

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
        btn.classList.toggle('text-gray-500', !isMatch);
    });
    carregarPrestadoresOnline(true);
};

// --- 4. CARREGAMENTO DE DADOS (OFERTAS) ---

function carregarPrestadoresOnline(forcar = false) {
    const container = document.getElementById('lista-prestadores-realtime');
    if(!container) return;
    if(listenerPrestadoresAtivo && !forcar) return;

    // Busca simplificada para evitar erro de índice inicial
    let q = query(collection(db, "active_providers"), orderBy("is_online", "desc"));

    onSnapshot(q, (snap) => {
        listenerPrestadoresAtivo = true;
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
                    <div class="absolute top-2 right-2 ${p.is_online ? 'bg-green-500' : 'bg-yellow-400'} text-[7px] text-white font-bold px-2 py-0.5 rounded-full">
                        ${p.is_online ? 'ONLINE' : 'AGENDAMENTO'}
                    </div>
                </div>
                <div class="absolute top-10 left-3 w-14 h-14 rounded-full border-4 border-white shadow bg-white overflow-hidden">
                    <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name='+p.nome_profissional}" class="w-full h-full object-cover">
                </div>
                <div class="pt-6 pb-3 px-3">
                    <h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional || 'Profissional'}</h4>
                    <p class="text-[9px] font-black text-green-600 mt-1">R$ ${srv.price}</p>
                    <button onclick="event.stopPropagation(); window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase">Solicitar</button>
                </div>
            </div>`;
        });
    });
}

// --- 5. MONITOR DE ESTADO DO FIREBASE ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Inicializa UI
        window.renderizarFiltros();
        carregarPrestadoresOnline();
        
        // Sincroniza foto e nome do cabeçalho
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if(userDoc.exists()) {
            const d = userDoc.data();
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = d.nome_profissional || d.displayName || user.displayName);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => el.src = d.photoURL || user.photoURL);
            document.getElementById('user-header-services')?.classList.remove('hidden');
        }

        // Verifica status do botão online
        const activeDoc = await getDoc(doc(db, "active_providers", user.uid));
        if(activeDoc.exists() && activeDoc.data().is_online) {
            const toggle = document.getElementById('online-toggle');
            if(toggle) toggle.checked = true;
        }

        // Garante aba inicial
        window.switchServiceSubTab('contratar');
    }
});
