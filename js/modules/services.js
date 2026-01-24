import { db, auth } from '../app.js';
import { doc, setDoc, collection, query, where, onSnapshot, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Variáveis de Estado
const categoriasDisponiveis = ["Barman", "Garçom", "Segurança", "Limpeza", "Eletricista", "Encanador", "Montador", "Outros"];
let categoriaAtiva = 'Todos';
let meusServicos = [];

// --- EXPORTAÇÃO PARA O ESCOPO GLOBAL (Essencial para o index.html ver as funções) ---

window.renderMyServicesList = () => {
    const list = document.getElementById('my-services-list');
    if (!list) {
        console.warn("⚠️ Container 'my-services-list' não encontrado no DOM.");
        return;
    }
    
    if (meusServicos.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-300 py-4 italic text-xs">Nenhum serviço adicionado.</p>`;
        return;
    }

    list.innerHTML = meusServicos.map((srv, index) => `
        <div class="bg-gray-50 p-3 rounded-lg mb-2 flex justify-between border border-gray-100 items-center animate-fadeIn">
            <span class="font-bold text-blue-900 text-[10px]">${srv.category.toUpperCase()} - R$ ${srv.price}</span>
            <button onclick="window.removeServiceLocal(${index})" class="text-red-400 font-bold px-2 text-lg hover:text-red-600 transition-colors">×</button>
        </div>
    `).join('');
};

window.addServiceLocal = () => {
    const cat = document.getElementById('new-service-category')?.value;
    const price = document.getElementById('new-service-price')?.value;
    
    if (!cat || !price || price <= 0) {
        alert("⚠️ Por favor, selecione a categoria e um preço válido!");
        return;
    }
    
    meusServicos.push({ category: cat, price: parseFloat(price) });
    window.renderMyServicesList();
    
    // Limpa o campo de preço após adicionar
    const priceInput = document.getElementById('new-service-price');
    if(priceInput) priceInput.value = '';
};

window.removeServiceLocal = (index) => {
    meusServicos.splice(index, 1);
    window.renderMyServicesList();
};

window.saveServicesAndGoOnline = async () => {
    if (!auth.currentUser) return;
    
    try {
        // 1. Salva no perfil do usuário
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            services_offered: meusServicos 
        });

        // 2. Se o toggle estiver ativo, atualiza o radar imediatamente
        const toggle = document.getElementById('online-toggle');
        if (toggle && toggle.checked) {
            await window.alternarStatusOnline(true);
        }

        document.getElementById('provider-setup-modal')?.classList.add('hidden');
        alert("Configurações salvas com sucesso! ✅");
    } catch (e) {
        console.error("Erro ao salvar serviços:", e);
        alert("Erro ao salvar. Verifique sua conexão.");
    }
};

window.alternarStatusOnline = async (isOnline) => {
    if (!auth.currentUser) return;
    const activeRef = doc(db, "active_providers", auth.currentUser.uid);
    
    try {
        // Buscamos os dados atuais do usuário para garantir que o nome e foto vão para o radar
        const userDoc = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        await setDoc(activeRef, {
            is_online: isOnline,
            uid: auth.currentUser.uid,
            nome_profissional: userData.nome_profissional || auth.currentUser.displayName || "Profissional",
            foto_perfil: userData.photoURL || auth.currentUser.photoURL || "",
            last_seen: serverTimestamp(),
            services: meusServicos
        }, { merge: true });

        atualizarVisualRadar(isOnline);
    } catch (e) { 
        console.error("Erro ao mudar status:", e); 
    }
};

// --- FUNÇÕES AUXILIARES ---

function atualizarVisualRadar(isOnline) {
    const container = document.getElementById('pview-radar');
    if (!container) return;
    
    container.innerHTML = isOnline ? 
        `<div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center">
            <p class="text-6xl mb-4 animate-pulse">📡</p>
            <p class="font-bold text-lg text-green-500 uppercase">Buscando Clientes...</p>
            <p class="text-[10px]">Sua visibilidade está ativa no mapa</p>
        </div>` :
        `<div class="text-gray-400 mb-4 py-10 animate-fadeIn text-center">
            <p class="text-6xl mb-4">😴</p>
            <p class="font-bold text-lg uppercase text-gray-500">Você está Offline</p>
            <p class="text-[10px]">Ative o interruptor para receber chamados</p>
        </div>`;
}

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
    document.querySelectorAll('.filter-pill').forEach(btn => {
        const isActive = btn.innerText.toUpperCase() === cat.toUpperCase();
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('bg-blue-600', isActive);
        btn.classList.toggle('text-white', isActive);
    });
    carregarPrestadoresOnline();
};

function carregarPrestadoresOnline() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    const q = query(collection(db, "active_providers"), where("is_online", "==", true));
    
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        
        if (snap.empty) {
            container.innerHTML = `<div class="col-span-2 text-center text-gray-400 py-10">Procurando profissionais...</div>`;
            return;
        }

        snap.forEach(d => {
            const p = d.data();
            
            // Não mostrar eu mesmo na lista de contratação
            if (auth.currentUser && p.uid === auth.currentUser.uid) return;

            // Filtro por categoria
            const srv = (categoriaAtiva !== 'Todos') 
                ? p.services?.find(s => s.category === categoriaAtiva) 
                : p.services?.[0];

            if (!srv) return;

            container.innerHTML += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative mb-4 animate-fadeIn">
                    <div class="h-16 w-full bg-blue-600 relative">
                        <div class="absolute top-2 right-2 bg-green-500 text-[7px] text-white font-bold px-2 py-0.5 rounded-full shadow-sm">ONLINE</div>
                    </div>
                    <div class="absolute top-8 left-3 w-12 h-12 rounded-full border-4 border-white shadow overflow-hidden bg-gray-200">
                        <img src="${p.foto_perfil || 'https://ui-avatars.com/api/?name='+p.nome_profissional}" class="w-full h-full object-cover">
                    </div>
                    <div class="pt-5 pb-3 px-3">
                        <h4 class="font-black text-xs text-gray-800 truncate">${p.nome_profissional}</h4>
                        <p class="text-[9px] font-black text-blue-600 uppercase mb-1">${srv.category}</p>
                        <p class="text-[11px] font-black text-green-600">R$ ${srv.price.toFixed(2)}</p>
                        <button onclick="window.abrirModalSolicitacao('${p.uid}', '${p.nome_profissional}', '${srv.price}')" 
                                class="w-full mt-2 bg-blue-600 text-white py-1.5 rounded-lg text-[8px] font-bold uppercase shadow-sm active:scale-95 transition-transform">
                            Solicitar Agora
                        </button>
                    </div>
                </div>`;
        });
    });
}

// --- INITIALIZATION ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Carrega dados do perfil (serviços salvos)
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const d = userDoc.data();
            meusServicos = d.services_offered || [];
        }

        // Sincroniza o Toggle com o estado real no Firestore
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
    }
});
