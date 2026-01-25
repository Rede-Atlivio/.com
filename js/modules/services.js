import { db, auth } from '../app.js';
import { userProfile } from '../auth.js'; // Importa perfil para corrigir a foto
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LISTA GLOBAL DE CATEGORIAS (FÍSICO + DIGITAL) ---
const CATEGORIAS_GLOBAIS = [
    "--- SERVIÇOS DOMÉSTICOS ---",
    "Diarista / Limpeza", "Passadeira", "Cozinheira", "Jardineiro", "Piscineiro", "Babá / Cuidador", "Passeador de Cães",
    "--- MANUTENÇÃO & OBRAS ---",
    "Eletricista", "Encanador", "Pedreiro", "Pintor", "Montador de Móveis", "Marido de Aluguel", "Gesseiro", "Serralheiro", "Vidraceiro", "Chaveiro", "Climatização / Ar Condicionado",
    "--- BELEZA & ESTÉTICA ---",
    "Cabeleireiro", "Barbeiro", "Manicure / Pedicure", "Maquiadora", "Depilação", "Esteticista", "Massoterapeuta", "Tatuador",
    "--- FESTAS & EVENTOS ---",
    "Garçom", "Barman / Bartender", "Copeira", "Churrasqueiro", "DJ / Músico", "Fotógrafo", "Decorador", "Segurança / Porteiro", "Recepcionista de Eventos",
    "--- DIGITAL & TECNOLOGIA ---",
    "Designer Gráfico", "Editor de Vídeo", "Gestor de Tráfego", "Social Media", "Programador / Dev", "Suporte Técnico (TI)", "Formatador de PC", "Assistência Celular",
    "--- AULAS & CONSULTORIA ---",
    "Professor Particular", "Personal Trainer", "Consultor Financeiro", "Tradutor", "Psicólogo", "Advogado", "Contador"
];

// --- VARIÁVEIS LOCAIS ---
let localServices = [];

// --- EXPOSIÇÃO GLOBAL (CORRIGE O ERRO "QUEBROU") ---
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.addServiceLocal = addServiceLocal;
window.saveServicesAndGoOnline = saveServicesAndGoOnline;
window.removerServicoLocal = removerServicoLocal; // Nova função para deletar

// --- 1. CARREGAMENTO INICIAL (CORRIGE FOTO "CARREGANDO") ---
export async function inicializarModuloServicos() {
    console.log("🛠️ Módulo de Serviços Iniciado");
    
    // Preenche o Select de Categorias
    const select = document.getElementById('new-service-category');
    if(select) {
        select.innerHTML = `<option value="" disabled selected>Selecione uma Categoria...</option>`;
        CATEGORIAS_GLOBAIS.forEach(cat => {
            if(cat.startsWith("---")) {
                select.innerHTML += `<option disabled class="bg-gray-100 font-bold text-blue-900">${cat}</option>`;
            } else {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            }
        });
    }

    // Se usuário já estiver logado, atualiza header
    if(auth.currentUser && userProfile) {
        atualizarHeaderPrestador();
    }
}

function atualizarHeaderPrestador() {
    const nomeEl = document.getElementById('provider-header-name');
    const fotoEl = document.getElementById('provider-header-pic');
    
    if(nomeEl) nomeEl.innerText = userProfile.nome_profissional || userProfile.displayName || "Prestador";
    if(fotoEl) fotoEl.src = userProfile.photoURL || "https://ui-avatars.com/api/?background=random";
}

// --- 2. GERENCIAMENTO DE ABAS (CLIENTE) ---
function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const btn = document.getElementById(`subtab-${t}-btn`);
        const view = document.getElementById(`view-${t}`);
        if(!btn || !view) return; // Segurança contra erro
        
        if(t === tabName) {
            btn.classList.add('active');
            view.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            view.classList.add('hidden');
        }
    });

    if (tabName === 'contratar') carregarCatalogoServicos();
}

// --- 3. GERENCIAMENTO DE ABAS (PRESTADOR) ---
function switchProviderSubTab(tabName) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const btn = document.getElementById(`ptab-${t}-btn`);
        const view = document.getElementById(`pview-${t}`);
        if(!btn || !view) return;

        if(t === tabName) {
            btn.classList.add('active');
            view.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            view.classList.add('hidden');
        }
    });
}

// --- 4. CATÁLOGO DE SERVIÇOS (VITRINE) ---
export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;

    container.innerHTML = `<div class="col-span-2 text-center py-10"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando profissionais...</p></div>`;

    try {
        const q = query(collection(db, "active_providers"), where("is_online", "==", true), orderBy("visibility_score", "desc"), limit(20));
        const snapshot = await getDocs(q);
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum prestador online na região.</div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            const isDemo = data.is_demo === true;
            
            // Visual
            const badge = isDemo ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200">Exemplo</span>` : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded">● Online</span>`;
            const opacity = isDemo ? "opacity-90" : "";
            const btnAction = isDemo ? `onclick="alert('ℹ️ MODO DEMO: Perfil demonstrativo.')"` : `onclick="alert('Em breve: Pedido Real')"`;
            const btnText = isDemo ? "Ver Exemplo" : "Solicitar";
            const btnClass = isDemo ? "bg-gray-700" : "bg-blue-600";

            container.innerHTML += `
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between ${opacity} animate-fadeIn">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random&name=' + data.nome_profissional}" class="w-8 h-8 rounded-full object-cover border border-gray-100">
                            <div><h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional}</h4>${badge}</div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <p class="text-[10px] text-gray-500 uppercase font-bold">${servico.category}</p>
                        <p class="text-xs font-black text-blue-900">R$ ${servico.price},00 <span class="text-[8px] font-normal text-gray-400">/est.</span></p>
                    </div>
                    <button ${btnAction} class="w-full ${btnClass} text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition shadow-sm">${btnText}</button>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro ao carregar.</div>`;
    }
}

// --- 5. CONFIGURAÇÃO DE PERFIL (MODAL) ---
async function abrirConfiguracaoServicos() {
    const modal = document.getElementById('provider-setup-modal');
    if(modal) modal.classList.remove('hidden');
    
    // Carrega dados existentes do Firestore
    if(auth.currentUser) {
        try {
            const docSnap = await getDoc(doc(db, "active_providers", auth.currentUser.uid));
            if(docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('setup-name').value = data.nome_profissional || "";
                localServices = data.services || [];
                renderMyServicesList();
                
                // Atualiza botão se já estiver online
                const btn = document.querySelector('#provider-setup-modal button.bg-green-600');
                if(data.is_online) {
                    btn.innerText = "ATUALIZAR DADOS 🔄";
                    btn.classList.replace('bg-green-600', 'bg-blue-600');
                }
            }
        } catch(e) { console.log("Primeiro acesso prestador."); }
    }
}

function addServiceLocal() {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;

    if (!cat || !price) return alert("Selecione uma categoria e informe o preço.");

    localServices.push({ category: cat, price: price, description: desc });
    renderMyServicesList();
    
    // Limpa campos
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
}

function removerServicoLocal(index) {
    localServices.splice(index, 1);
    renderMyServicesList();
}

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    list.innerHTML = "";
    
    if(localServices.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>`;
        return;
    }

    localServices.forEach((s, index) => {
        list.innerHTML += `
            <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center mb-2 animate-fadeIn">
                <div>
                    <p class="font-bold text-xs text-blue-900">${s.category}</p>
                    <p class="text-[10px] text-gray-500">R$ ${s.price},00 - ${s.description || 'Sem descrição'}</p>
                </div>
                <button onclick="removerServicoLocal(${index})" class="text-red-500 font-bold text-xs p-2 hover:bg-red-50 rounded">X</button>
            </div>`;
    });
}

async function saveServicesAndGoOnline() {
    const name = document.getElementById('setup-name').value;
    if (!name || localServices.length === 0) return alert("Preencha seu nome e adicione pelo menos um serviço.");

    const btn = document.querySelector('#provider-setup-modal button.bg-green-600') || document.querySelector('#provider-setup-modal button.bg-blue-600');
    const txtOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        const uid = auth.currentUser.uid;
        
        // Grava no Active Providers (Radar)
        await setDoc(doc(db, "active_providers", uid), {
            nome_profissional: name,
            services: localServices,
            is_online: true,
            is_demo: false,
            visibility_score: 100, // Reais têm prioridade
            last_seen: new Date().toISOString(),
            foto_perfil: userProfile.photoURL || null
        }, { merge: true });

        // Atualiza perfil do usuário
        await updateDoc(doc(db, "usuarios", uid), { 
            nome_profissional: name,
            is_provider: true 
        });

        // Atualiza a interface imediatamente
        atualizarHeaderPrestador();
        
        alert("✅ Perfil Atualizado! Você está visível no Radar.");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        
        // Liga o botão visualmente
        const toggle = document.getElementById('online-toggle');
        if(toggle) toggle.checked = true;
        
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
}

// INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', inicializarModuloServicos);
