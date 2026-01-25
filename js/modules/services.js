import { db, auth } from '../app.js';
import { userProfile } from '../auth.js'; 
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. LISTA GIGANTE DE CATEGORIAS (MUNDIAL) ---
const CATEGORIAS_MEGA_PACK = {
    "🏡 SERVIÇOS DOMÉSTICOS": [
        "Diarista / Limpeza", "Passadeira", "Lavadeira", "Cozinheira", "Jardineiro", 
        "Piscineiro", "Babá / Cuidador Infantil", "Cuidador de Idosos", "Passeador de Cães (Dog Walker)", 
        "Adestrador", "Organizador Pessoal (Personal Organizer)"
    ],
    "🛠️ MANUTENÇÃO & OBRAS": [
        "Eletricista", "Encanador", "Pedreiro", "Pintor", "Montador de Móveis", 
        "Marido de Aluguel", "Gesseiro", "Serralheiro", "Vidraceiro", "Chaveiro", 
        "Climatização / Ar Condicionado", "Desentupidora", "Dedetizador", "Impermeabilizador", "Telhadista"
    ],
    "💅 BELEZA & ESTÉTICA": [
        "Cabeleireiro", "Barbeiro", "Manicure / Pedicure", "Maquiadora", "Design de Sobrancelhas", 
        "Depilação", "Esteticista", "Massoterapeuta", "Tatuador", "Podólogo"
    ],
    "🎉 FESTAS & EVENTOS": [
        "Garçom", "Barman / Bartender", "Copeira", "Churrasqueiro", "DJ / Músico", 
        "Fotógrafo", "Videomaker", "Decorador", "Segurança / Porteiro", "Recepcionista de Eventos", 
        "Animador de Festas", "Confeiteira (Bolos/Doces)", "Buffet Completo"
    ],
    "💻 DIGITAL & TECNOLOGIA": [
        "Designer Gráfico", "Editor de Vídeo", "Gestor de Tráfego", "Social Media", 
        "Programador / Dev", "Suporte Técnico (TI)", "Formatador de PC", "Conserto de Celular", 
        "Redator / Copywriter", "Tradutor", "Digitador"
    ],
    "🚗 AUTO & MOTOS": [
        "Mecânico", "Eletricista Auto", "Borracheiro", "Funilaria e Pintura", 
        "Lava Jato / Higienização", "Martelinho de Ouro", "Instalador de Som/Insulfilm", "Motorista Particular"
    ],
    "📚 AULAS & CONSULTORIA": [
        "Professor Particular (Escolar)", "Professor de Inglês/Idiomas", "Personal Trainer", 
        "Instrutor de Música", "Consultor Financeiro", "Psicólogo", "Advogado", "Contador", "Nutricionista"
    ]
};

// --- VARIÁVEIS LOCAIS ---
let localServices = [];

// --- EXPOSIÇÃO GLOBAL (ISSENCIAL PARA NÃO TRAVAR O HTML) ---
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.addServiceLocal = addServiceLocal;
window.saveServicesAndGoOnline = saveServicesAndGoOnline;
window.removerServicoLocal = removerServicoLocal;

// --- 2. INICIALIZAÇÃO E CORREÇÃO DE PERFIL ---
export async function inicializarModuloServicos() {
    console.log("🛠️ Módulo de Serviços Iniciado (V33.0)");
    
    // 1. Popula o Select de Categorias
    const select = document.getElementById('new-service-category');
    if(select) {
        select.innerHTML = `<option value="" disabled selected>🔍 Selecione uma Categoria...</option>`;
        for (const [grupo, itens] of Object.entries(CATEGORIAS_MEGA_PACK)) {
            let groupHtml = `<optgroup label="${grupo}" style="font-weight:bold; color:#1e3a8a;">`;
            itens.forEach(item => {
                groupHtml += `<option value="${item}" style="color:#333;">${item}</option>`;
            });
            groupHtml += `</optgroup>`;
            select.innerHTML += groupHtml;
        }
    }

    // 2. Corrige a Foto "Carregando..."
    setTimeout(() => {
        const user = auth.currentUser;
        if(user) {
            const nomeExibicao = userProfile?.nome_profissional || user.displayName || "Usuário";
            const fotoExibicao = userProfile?.photoURL || user.photoURL || "https://ui-avatars.com/api/?background=random";

            // Atualiza Header do Cliente
            const hName = document.getElementById('header-user-name');
            const hPic = document.getElementById('header-user-pic');
            if(hName) hName.innerText = nomeExibicao;
            if(hPic) hPic.src = fotoExibicao;

            // Atualiza Header do Prestador
            const pName = document.getElementById('provider-header-name');
            const pPic = document.getElementById('provider-header-pic');
            if(pName) pName.innerText = nomeExibicao;
            if(pPic) pPic.src = fotoExibicao;
        }
    }, 1500); // Pequeno delay para garantir que o auth carregou
}

// --- 3. ABAS E NAVEGAÇÃO ---
function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const btn = document.getElementById(`subtab-${t}-btn`);
        const view = document.getElementById(`view-${t}`);
        if(!btn || !view) return;
        
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

// --- 4. GESTÃO DE SERVIÇOS DO PRESTADOR ---
async function abrirConfiguracaoServicos() {
    const modal = document.getElementById('provider-setup-modal');
    if(modal) modal.classList.remove('hidden');
    
    if(auth.currentUser) {
        try {
            const docSnap = await getDoc(doc(db, "active_providers", auth.currentUser.uid));
            if(docSnap.exists()) {
                const data = docSnap.data();
                document.getElementById('setup-name').value = data.nome_profissional || "";
                localServices = data.services || [];
                renderMyServicesList(); // Mostra a lista existente
            }
        } catch(e) { console.log("Primeiro acesso."); }
    }
}

function addServiceLocal() {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;

    if (!cat || !price) return alert("Selecione uma categoria e informe o preço.");

    // Adiciona ao array local
    localServices.push({ category: cat, price: price, description: desc });
    
    // Atualiza a visualização IMEDIATAMENTE
    renderMyServicesList();
    
    // Limpa campos
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
}

function removerServicoLocal(index) {
    if(confirm("Remover este serviço da lista?")) {
        localServices.splice(index, 1);
        renderMyServicesList();
    }
}

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if(!list) return;
    
    list.innerHTML = "";
    
    if(localServices.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>`;
        return;
    }

    localServices.forEach((s, index) => {
        list.innerHTML += `
            <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center mb-2 animate-fadeIn shadow-sm">
                <div>
                    <p class="font-bold text-xs text-blue-900">${s.category}</p>
                    <p class="text-[10px] text-gray-500">R$ ${s.price},00 ${s.description ? '- ' + s.description : ''}</p>
                </div>
                <button onclick="removerServicoLocal(${index})" class="bg-white border border-red-200 text-red-500 font-bold text-xs w-8 h-8 rounded-full hover:bg-red-50 transition flex items-center justify-center shadow-sm">
                    ✕
                </button>
            </div>`;
    });
}

async function saveServicesAndGoOnline() {
    const name = document.getElementById('setup-name').value;
    if (!name || localServices.length === 0) return alert("Preencha seu nome e adicione serviços.");

    const btn = document.querySelector('#provider-setup-modal button.bg-green-600');
    if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }

    try {
        const uid = auth.currentUser.uid;
        
        await setDoc(doc(db, "active_providers", uid), {
            nome_profissional: name,
            services: localServices,
            is_online: true,
            is_demo: false,
            visibility_score: 100,
            last_seen: new Date().toISOString(),
            foto_perfil: userProfile?.photoURL || null
        }, { merge: true });

        await updateDoc(doc(db, "usuarios", uid), { 
            nome_profissional: name,
            is_provider: true 
        });

        alert("✅ Perfil Salvo! Você está ONLINE.");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        
        // Atualiza UI
        const toggle = document.getElementById('online-toggle');
        if(toggle) toggle.checked = true;
        atualizarHeaderPrestador();
        
        // Revela a aba carteira se necessário
        const tabGanhar = document.getElementById('tab-ganhar');
        if(tabGanhar) tabGanhar.classList.remove('hidden');

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        if(btn) { btn.innerText = "SALVAR E FICAR ONLINE 📡"; btn.disabled = false; }
    }
}

// --- 5. CATÁLOGO DE SERVIÇOS (VITRINE) ---
// Mantida a versão anterior que já estava com a lógica de segurança Demo/Real
export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;
    container.innerHTML = `<div class="col-span-2 text-center py-10"><div class="loader mx-auto mb-2 border-blue-200 border-t-blue-600"></div><p class="text-[9px] text-gray-400">Buscando profissionais...</p></div>`;
    try {
        const q = query(collection(db, "active_providers"), where("is_online", "==", true), orderBy("visibility_score", "desc"), limit(20));
        const snapshot = await getDocs(q);
        container.innerHTML = "";
        if (snapshot.empty) { container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Nenhum prestador na região.</div>`; return; }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            const isDemo = data.is_demo === true;
            const badge = isDemo ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border border-gray-200">Exemplo</span>` : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded">● Online</span>`;
            const btnAction = isDemo ? `onclick="alert('ℹ️ MODO DEMO: Perfil demonstrativo.')"` : `onclick="alert('Em breve: Pedido Real')"`;
            const btnText = isDemo ? "Ver Exemplo" : "Solicitar";
            const btnClass = isDemo ? "bg-gray-700" : "bg-blue-600";
            container.innerHTML += `<div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between animate-fadeIn"><div class="flex items-start justify-between mb-2"><div class="flex items-center gap-2"><img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full object-cover border border-gray-100"><div><h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional}</h4>${badge}</div></div></div><div class="mb-3"><p class="text-[10px] text-gray-500 uppercase font-bold">${servico.category}</p><p class="text-xs font-black text-blue-900">R$ ${servico.price},00 <span class="text-[8px] font-normal text-gray-400">/est.</span></p></div><button ${btnAction} class="w-full ${btnClass} text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition shadow-sm">${btnText}</button></div>`;
        });
    } catch (e) { container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro de conexão.</div>`; }
}

// Inicializador Automático
if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarModuloServicos);
} else {
    inicializarModuloServicos();
}
