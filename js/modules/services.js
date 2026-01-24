import { db, auth } from '../app.js';
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, addDoc, getDoc, updateDoc, increment, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. VARIÁVEIS GLOBAIS ---
let targetProviderEmail = null;
let orderIdParaAvaliar = null;
let providerIdParaAvaliar = null;
let listenerPrestadoresAtivo = false;
let categoriaAtiva = 'Todos';
let meusServicos = []; 
let basePriceAtual = 0; 
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];

// --- 2. FUNÇÕES DE INTERFACE (DEFINIDAS ANTES DE USAR) ---

window.renderizarFiltros = () => {
    const container = document.getElementById('category-filters');
    if(!container) return;
    let html = `<button onclick="filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">Todos</button>`;
    categoriasDisponiveis.forEach(cat => {
        html += `<button onclick="filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase shadow-sm hover:bg-blue-50">${cat}</button>`;
    });
    container.innerHTML = html;
};

window.filtrarCategoria = (cat) => {
    categoriaAtiva = cat;
    document.querySelectorAll('.filter-pill').forEach(btn => {
        if(btn.innerText.toUpperCase() === cat.toUpperCase()) {
            btn.classList.add('active'); btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('active'); btn.classList.add('text-gray-500');
        }
    });
    carregarPrestadoresOnline(true);
};

async function renderizarCabecalhoUsuario(user) {
    if(!user) return;
    try {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        const data = docSnap.data() || {};
        const nomeFinal = data.nome_profissional || data.displayName || user.displayName || "Usuário";
        const fotoFinal = data.photoURL || user.photoURL;

        const idsNomes = ['header-user-name', 'provider-header-name'];
        const idsFotos = ['header-user-pic', 'provider-header-pic'];

        idsNomes.forEach(id => { const el = document.getElementById(id); if(el) el.innerText = nomeFinal; });
        idsFotos.forEach(id => { const el = document.getElementById(id); if(el) el.src = fotoFinal; });
        
        const headerContainer = document.getElementById('user-header-services');
        if(headerContainer) headerContainer.classList.remove('hidden');
    } catch (e) { console.error("Erro cabecalho:", e); }
}

// --- 3. NAVEGAÇÃO ---

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

// --- 4. LÓGICA ONLINE/OFERTAS ---

function carregarPrestadoresOnline(forcar = false) {
    const container = document.getElementById('lista-prestadores-realtime');
    if(!container) return;
    if(listenerPrestadoresAtivo && !forcar) return;

    let q = query(collection(db, "active_providers"), orderBy("is_online", "desc"), orderBy("last_seen", "desc"));
    if (categoriaAtiva !== 'Todos') {
        q = query(collection(db, "active_providers"), where("categories", "array-contains", categoriaAtiva), orderBy("is_online", "desc"));
    }

    onSnapshot(q, (snap) => {
        listenerPrestadoresAtivo = true;
        container.innerHTML = "";
        if (snap.empty) {
            container.innerHTML = `<div class="col-span-2 text-center text-gray-400 py-10">Nenhum prestador encontrado.</div>`;
            return;
        }
        snap.forEach(d => {
            const p = d.data();
            if(auth.currentUser && p.uid === auth.currentUser.uid) return;
            const srv = (categoriaAtiva !== 'Todos') ? p.services.find(s => s.category === categoriaAtiva) : p.services[0];
            if(!srv) return;

            const statusColor = p.is_online ? 'bg-green-500' : 'bg-yellow-400';
            const statusTxt = p.is_online ? 'ONLINE' : 'AGENDAMENTO';

            container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative transition cursor-pointer" onclick="abrirPerfilPublico('${p.uid}')">
                <div class="h-20 w-full bg-gradient-to-r from-blue-900 to-blue-600 relative">
                    <div class="absolute top-2 right-2 ${statusColor} text-[8px] text-white font-bold px-2 py-0.5 rounded-full">${statusTxt}</div>
                </div>
                <div class="absolute top-10 left-3 w-16 h-16 rounded-full border-4 border-white shadow-md bg-white overflow-hidden z-10">
                    <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name='+p.nome_profissional}" class="w-full h-full object-cover">
                </div>
                <div class="pt-8 pb-3 px-3">
                    <h4 class="font-black text-sm text-gray-800 truncate">${p.nome_profissional}</h4>
                    <span class="text-[8px] text-blue-600 font-bold uppercase">${srv.category}</span>
                    <div class="flex justify-between items-center mt-3">
                        <p class="text-sm font-black text-green-600">R$ ${srv.price}</p>
                        <button onclick="event.stopPropagation(); abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase">Solicitar</button>
                    </div>
                </div>
            </div>`;
        });
    });
}

function configurarBotaoOnline() {
    const toggle = document.getElementById('online-toggle');
    if(!toggle) return;
    toggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
            const data = userDoc.data();
            if (data?.services_offered?.length > 0) {
                meusServicos = data.services_offered;
                await ficarOnline(data.nome_profissional || data.displayName);
            } else {
                e.target.checked = false;
                alert("Adicione serviços primeiro!");
                window.abrirConfiguracaoServicos();
            }
        } else { await ficarOffline(); }
    });
}

async function ficarOnline(nome) {
    const updateData = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        is_online: true,
        nome_profissional: nome,
        foto_perfil: auth.currentUser.photoURL,
        services: meusServicos.filter(s => s.visible !== false),
        categories: meusServicos.filter(s => s.visible !== false).map(s => s.category),
        last_seen: serverTimestamp()
    };
    await setDoc(doc(db, "active_providers", auth.currentUser.uid), updateData, { merge: true });
    document.getElementById('online-sound')?.play().catch(()=>{});
}

async function ficarOffline() {
    await updateDoc(doc(db, "active_providers", auth.currentUser.uid), { is_online: false, last_seen: serverTimestamp() });
}

// --- 5. MONITOR DE ESTADO ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // ESSA ORDEM É O SEGREDO DO DESTRAVAMENTO
        window.renderizarFiltros(); 
        await renderizarCabecalhoUsuario(user);
        
        // Ativa listeners de dados
        carregarPrestadoresOnline();
        configurarBotaoOnline();
        
        // Verifica se já estava online
        const snap = await getDoc(doc(db, "active_providers", user.uid));
        if(snap.exists() && snap.data().is_online) {
            const toggle = document.getElementById('online-toggle');
            if(toggle) toggle.checked = true;
        }

        // Inicializa abas
        window.switchServiceSubTab('contratar');
    }
});

// Tornar funções CRUD globais
window.abrirConfiguracaoServicos = () => document.getElementById('provider-setup-modal')?.classList.remove('hidden');
