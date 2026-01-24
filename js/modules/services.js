import { db, auth } from '../app.js';
import { userProfile } from '../auth.js'; // IMPORTANTE: Importando o perfil para pegar o nome
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

// --- CORREÇÃO CRÍTICA AQUI: Enviar Nome e Foto ao ficar Online ---
window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    
    // Garante que temos um nome, seja do perfil carregado ou do Auth do Google
    const nomeParaSalvar = userProfile?.nome_profissional || userProfile?.displayName || auth.currentUser.displayName || "Prestador";
    const fotoParaSalvar = userProfile?.photoURL || auth.currentUser.photoURL || "";

    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    try {
        await setDoc(activeRef, {
            is_online: isOnline,
            uid: auth.currentUser.uid,
            nome_profissional: nomeParaSalvar, // <--- SALVANDO O NOME
            foto_perfil: fotoParaSalvar,       // <--- SALVANDO A FOTO
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
    carregarPrestadoresOnline();
};

// --- 5. CATÁLOGO EM TEMPO REAL ---
function carregarPrestadoresOnline() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;
    
    // Consulta básica
    const q = query(collection(db, "active_providers"), where("is_online", "==", true));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = snap.empty ? `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>` : "";
        
        snap.forEach(d => {
            const p = d.data();
            // Filtra o próprio usuário
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;
            
            // Filtra por categoria
            const srv = (categoriaAtiva !== 'Todos') ? p.services?.find(s => s.category === categoriaAtiva) : p.services?.[0];
            
            if (!srv) return;
            
            // Tratamento de segurança para dados undefined
            const nomeExibicao = p.nome_profissional || "Prestador Atlivio";
            const fotoExibicao = p.foto_perfil || `https://ui-avatars.com/api/?name=${nomeExibicao}&background=random`;

            container.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4 animate-fadeIn">
                <div class="h-16 w-full bg-blue-600 relative">
                    <div class="absolute top-2 right-2 bg-green-500 text-[7px] text-white font-bold px-2 py-0.5 rounded-full">ONLINE</div>
                </div>
                <div class="absolute top-8 left-3 w-12 h-12 rounded-full border-4 border-white shadow bg-white overflow-hidden">
                    <img src="${fotoExibicao}" class="w-full h-full object-cover">
                </div>
                <div class="pt-5 pb-3 px-3">
                    <h4 class="font-black text-xs text-gray-800 truncate">${nomeExibicao}</h4>
                    <p class="text-[9px] font-black text-green-600">A partir de R$ ${srv.price}</p>
                    
                    <button onclick="window.abrirModalSolicitacao('${p.uid}', '${nomeExibicao}', '${srv.price}')" class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase shadow-sm hover:bg-blue-700 transition">Solicitar</button>
                </div>
            </div>`;
        });
    });
}

// --- 6. INICIALIZAÇÃO E SINCRONIA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
            
            // Atualiza visual do Header
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
        carregarPrestadoresOnline();
        window.switchServiceSubTab('contratar');
    }
});
