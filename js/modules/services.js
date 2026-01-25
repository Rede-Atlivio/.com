import { db, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURAÇÕES ---
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];

// --- 2. GATILHO VISUAL DO RADAR ---
function atualizarVisualRadar(isOnline) {
    const container = document.getElementById('pview-radar');
    if (!container) return;
    
    if (isOnline) {
        container.innerHTML = `
            <div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center">
                <p class="text-6xl mb-4 animate-pulse">📡</p>
                <p class="font-bold text-lg text-green-500 uppercase">Buscando Clientes...</p>
                <p class="text-[10px] text-gray-400 mt-2">Você está visível no catálogo agora.</p>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center">
                <p class="text-6xl mb-4">😴</p>
                <p class="font-bold text-lg uppercase text-gray-500">Você está Offline</p>
                <p class="text-[10px] mt-2 text-gray-400">Ative o botão "Trabalhar" no topo.</p>
            </div>`;
    }
}

// --- 3. EXPOSIÇÃO GLOBAL ---
window.switchServiceSubTab = (tab) => {
    ['contratar', 'andamento', 'historico', 'carteira'].forEach(t => {
        document.getElementById(`view-${t}`)?.classList.toggle('hidden', t !== tab);
        document.getElementById(`subtab-${t}-btn`)?.classList.toggle('active', t === tab);
    });
};

window.switchProviderSubTab = (tabName) => {
    ['radar', 'ativos', 'historico', 'carteira'].forEach(t => {
        const view = document.getElementById(`pview-${t}`);
        const btn = document.getElementById(`ptab-${t}-btn`);
        if (view) view.classList.toggle('hidden', t !== tabName);
        if (btn) btn.classList.toggle('active', t === tabName);
    });
};

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    
    const nomeParaSalvar = userProfile?.nome_profissional || userProfile?.displayName || auth.currentUser.displayName || "Prestador";
    const fotoParaSalvar = userProfile?.photoURL || auth.currentUser.photoURL || "";
    // Banner padrão por enquanto
    const bannerParaSalvar = userProfile?.bannerURL || "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=500&q=60"; 

    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        await setDoc(activeRef, {
            is_online: isOnline,
            uid: auth.currentUser.uid,
            nome_profissional: nomeParaSalvar,
            foto_perfil: fotoParaSalvar,
            banner_url: bannerParaSalvar,
            last_seen: serverTimestamp(),
            services: meusServicos
        }, { merge: true });
        
        atualizarVisualRadar(isOnline);
    } catch (e) { console.error("Erro ao alternar status:", e); }
};

window.abrirConfiguracaoServicos = () => {
    document.getElementById('provider-setup-modal')?.classList.remove('hidden');
    renderMyServicesList();
};

// --- 4. GESTÃO DE SERVIÇOS ---
window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    if (!cat || !price) return alert("Selecione categoria e preço!");
    meusServicos.push({ category: cat, price: parseFloat(price) });
    renderMyServicesList();
};

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if (!list) return;
    list.innerHTML = meusServicos.length === 0 ? `<p class="text-center text-gray-300 py-4 italic">Nenhum serviço.</p>` : "";
    meusServicos.forEach((srv, index) => {
        list.innerHTML += `<div class="bg-gray-50 p-3 rounded mb-2 flex justify-between border border-gray-100">
            <span class="font-bold text-blue-900 text-xs">${srv.category} - R$ ${srv.price}</span>
            <button onclick="window.removeServiceLocal(${index})" class="text-red-400 font-bold px-2">&times;</button>
        </div>`;
    });
}

window.removeServiceLocal = (index) => { meusServicos.splice(index, 1); renderMyServicesList(); };

window.renderizarFiltros = () => {
    const container = document.getElementById('category-filters');
    if(!container) return;
    let html = `<button onclick="window.filtrarCategoria('Todos')" class="filter-pill active px-4 py-2 rounded-full border border-blue-100 bg-white text-blue-900 text-[10px] font-bold uppercase shadow-sm">Todos</button>`;
    categoriasDisponiveis.forEach(cat => {
        html += `<button onclick="window.filtrarCategoria('${cat}')" class="filter-pill px-4 py-2 rounded-full border border-blue-100 bg-white text-gray-500 text-[10px] font-bold uppercase shadow-sm">${cat}</button>`;
    });
    container.innerHTML = html;
};

window.filtrarCategoria = (cat) => {
    categoriaAtiva = cat;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.toggle('active', btn.innerText.toUpperCase() === cat.toUpperCase()));
    carregarPrestadores();
};

// --- 5. CATÁLOGO HÍBRIDO (ONLINE E OFFLINE) ---
function carregarPrestadores() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;
    
    // Agora buscamos TODOS os prestadores ativos na tabela (Online e Offline)
    const q = query(collection(db, "active_providers"));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = snap.empty ? `<div class="col-span-2 text-center text-gray-400 py-10">Nenhum profissional encontrado.</div>` : "";
        
        let prestadores = [];
        snap.forEach(d => prestadores.push(d.data()));

        // Ordenação: Online primeiro, depois Offline
        prestadores.sort((a, b) => (a.is_online === b.is_online) ? 0 : a.is_online ? -1 : 1);

        prestadores.forEach(p => {
            // Filtra o próprio usuário
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;
            
            // Filtra por categoria
            const srv = (categoriaAtiva !== 'Todos') ? p.services?.find(s => s.category === categoriaAtiva) : p.services?.[0];
            if (!srv) return;
            
            // Dados Visuais
            const nomeExibicao = p.nome_profissional || "Prestador";
            const fotoExibicao = p.foto_perfil || `https://ui-avatars.com/api/?name=${nomeExibicao}&background=random`;
            // Banner padrão se não tiver
            const bannerExibicao = p.banner_url || "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=500&q=60";

            // Lógica Online/Offline
            const isOnline = p.is_online;
            const statusBadge = isOnline 
                ? `<div class="absolute top-2 right-2 bg-green-500 text-[7px] text-white font-bold px-2 py-0.5 rounded-full z-10 shadow">ONLINE</div>`
                : `<div class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[7px] text-white font-bold px-2 py-0.5 rounded-full z-10 shadow">OFFLINE</div>`;
            
            const cardBg = isOnline ? "bg-white" : "bg-yellow-50 opacity-90"; // Amarelinho se offline
            const btnText = isOnline ? "SOLICITAR AGORA" : "AGENDAR 📅";
            const btnColor = isOnline ? "bg-blue-600 hover:bg-blue-700" : "bg-yellow-600 hover:bg-yellow-700";

            container.innerHTML += `
            <div class="${cardBg} rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4 animate-fadeIn group">
                <div class="h-20 w-full relative">
                    <img src="${bannerExibicao}" class="w-full h-full object-cover opacity-90">
                    <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
                    ${statusBadge}
                </div>
                
                <div class="absolute top-12 left-3 w-14 h-14 rounded-full border-4 border-white shadow-md bg-white overflow-hidden">
                    <img src="${fotoExibicao}" class="w-full h-full object-cover">
                </div>
                
                <div class="pt-8 pb-3 px-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-black text-xs text-gray-800 truncate max-w-[120px]">${nomeExibicao}</h4>
                            <p class="text-[9px] text-gray-400 uppercase font-bold">${srv.category}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[8px] text-gray-400">A partir de</p>
                            <p class="text-sm font-black text-green-600">R$ ${srv.price}</p>
                        </div>
                    </div>
                    
                    <button onclick="window.abrirModalSolicitacao('${p.uid}', '${nomeExibicao}', '${srv.price}')" class="w-full mt-3 ${btnColor} text-white py-2 rounded-lg text-[9px] font-black uppercase shadow-sm transition transform active:scale-95">
                        ${btnText}
                    </button>
                </div>
            </div>`;
        });
    });
}

// --- 6. INICIALIZAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            
            // Header Info
            const nomeDisplay = d.nome_profissional || user.displayName;
            document.querySelectorAll('#header-user-name, #provider-header-name').forEach(el => el.innerText = nomeDisplay);
            document.querySelectorAll('#header-user-pic, #provider-header-pic').forEach(el => el.src = d.photoURL || user.photoURL);
        }

        const activeSnap = await getDoc(doc(db, "active_providers", user.uid));
        const statusReal = activeSnap.exists() && activeSnap.data().is_online === true;

        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            toggle.checked = statusReal;
            toggle.onchange = (e) => window.alternarStatusOnline(e.target.checked);
        }

        atualizarVisualRadar(statusReal);
        window.renderizarFiltros();
        carregarPrestadores(); // Chama a nova função híbrida
        window.switchServiceSubTab('contratar');
    }
});
