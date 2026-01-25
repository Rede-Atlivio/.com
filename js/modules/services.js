import { db, auth } from '../app.js';
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- EXPONDO FUNÇÕES GLOBALMENTE (PARA O HTML LER) ---
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.addServiceLocal = addServiceLocal;
window.saveServicesAndGoOnline = saveServicesAndGoOnline;

// --- LÓGICA DAS ABAS DO CLIENTE ---
function switchServiceSubTab(tabName) {
    // 1. Atualiza botões
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const btn = document.getElementById(`subtab-${t}-btn`);
        const view = document.getElementById(`view-${t}`);
        if(t === tabName) {
            btn.classList.add('active');
            view.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            view.classList.add('hidden');
        }
    });

    // 2. Carrega conteúdo se necessário
    if (tabName === 'contratar') carregarCatalogoServicos();
    // (Futuro: carregarAndamento() e carregarHistorico())
}

// --- LÓGICA DAS ABAS DO PRESTADOR ---
function switchProviderSubTab(tabName) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const btn = document.getElementById(`ptab-${t}-btn`);
        const view = document.getElementById(`pview-${t}`);
        if(t === tabName) {
            btn.classList.add('active');
            view.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            view.classList.add('hidden');
        }
    });
}

// --- CATÁLOGO DE SERVIÇOS (COM LÓGICA DEMO/REAL) ---
export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    container.innerHTML = `<div class="col-span-2 text-center py-10"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando profissionais...</p></div>`;

    try {
        const q = query(
            collection(db, "active_providers"), 
            where("is_online", "==", true), 
            orderBy("visibility_score", "desc"), 
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum prestador na região agora.</div>`;
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            const isDemo = data.is_demo === true;
            
            // Lógica Visual
            const badge = isDemo ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200">Exemplo</span>` : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded">● Online</span>`;
            const opacity = isDemo ? "opacity-90" : "";
            
            // Botão Inteligente
            const btnAction = isDemo ? `onclick="alert('🚧 MODO DEMONSTRAÇÃO\\n\\nPerfil de exemplo.')"` : `onclick="alert('Em breve: Pedir Serviço Real')"`;
            const btnText = isDemo ? "Ver Exemplo" : "Solicitar";
            const btnClass = isDemo ? "bg-gray-700" : "bg-blue-600";

            container.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between ${opacity} animate-fadeIn">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full object-cover border border-gray-100">
                            <div><h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional}</h4>${badge}</div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <p class="text-[10px] text-gray-500 uppercase font-bold">${servico.category}</p>
                        <p class="text-xs font-black text-blue-900">R$ ${servico.price},00 <span class="text-[8px] font-normal text-gray-400">/est.</span></p>
                    </div>
                    <button ${btnAction} class="w-full ${btnClass} text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition">${btnText}</button>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro de conexão.</div>`;
    }
}

// --- GERENCIAMENTO DE PERFIL DO PRESTADOR ---
function abrirConfiguracaoServicos() {
    document.getElementById('provider-setup-modal').classList.remove('hidden');
}

let localServices = [];

function addServiceLocal() {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;

    if (!cat || !price) return alert("Preencha categoria e preço.");

    localServices.push({ category: cat, price: price, description: desc });
    renderMyServicesList();
    
    // Limpa campos
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
}

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    list.innerHTML = "";
    localServices.forEach((s, index) => {
        list.innerHTML += `<div class="bg-blue-50 p-2 rounded border border-blue-100 text-xs flex justify-between"><span><b>${s.category}</b> - R$ ${s.price}</span><button onclick="localServices.splice(${index},1); renderMyServicesList()" class="text-red-500 font-bold">X</button></div>`;
    });
}

async function saveServicesAndGoOnline() {
    const name = document.getElementById('setup-name').value;
    if (!name || localServices.length === 0) return alert("Preencha seu nome e adicione pelo menos um serviço.");

    try {
        const uid = auth.currentUser.uid;
        await setDoc(doc(db, "active_providers", uid), {
            nome_profissional: name,
            services: localServices,
            is_online: true,
            is_demo: false, // É real!
            visibility_score: 100, // Topo da lista
            last_seen: new Date().toISOString()
        }, { merge: true });

        // Atualiza perfil do usuário também
        await updateDoc(doc(db, "usuarios", uid), { nome_profissional: name });

        alert("✅ Você está ONLINE! Aguarde pedidos no Radar.");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        document.getElementById('online-toggle').checked = true;
        
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

// Auto-inicialização se estiver na aba
if(document.getElementById('sec-servicos') && !document.getElementById('sec-servicos').classList.contains('hidden')){
    carregarCatalogoServicos();
}
