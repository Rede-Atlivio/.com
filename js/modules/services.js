import { db, auth } from '../app.js';
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LISTA GIGANTE (MANTIDA) ---
const CATEGORIAS_MEGA_PACK = {
    "🏡 SERVIÇOS DOMÉSTICOS": ["Diarista / Limpeza", "Passadeira", "Cozinheira", "Jardineiro", "Piscineiro", "Babá", "Cuidador", "Dog Walker"],
    "🛠️ MANUTENÇÃO": ["Eletricista", "Encanador", "Pedreiro", "Pintor", "Montador", "Marido de Aluguel", "Chaveiro", "Climatização"],
    "💻 TECNOLOGIA": ["Formatador PC", "Técnico Celular", "Designer", "Editor Vídeo", "Dev", "Suporte TI"],
    "💅 BELEZA": ["Manicure", "Cabeleireiro", "Barbeiro", "Maquiadora", "Depilação"],
    "🚗 AUTO": ["Mecânico", "Borracheiro", "Lava Jato", "Motorista"],
    "📚 AULAS": ["Professor Particular", "Personal Trainer", "Consultor"]
};

let localServices = [];

// --- EXPOSIÇÃO GLOBAL (CRUCIAL) ---
window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.addServiceLocal = addServiceLocal;
window.saveServicesAndGoOnline = saveServicesAndGoOnline;
window.removerServicoLocal = removerServicoLocal;

// --- INICIALIZAÇÃO ---
export function inicializarModuloServicos() {
    console.log("🛠️ Services.js Carregado!");
    
    // Popula Categorias
    const select = document.getElementById('new-service-category');
    if(select) {
        select.innerHTML = `<option value="" disabled selected>Categoria...</option>`;
        for (const [grupo, itens] of Object.entries(CATEGORIAS_MEGA_PACK)) {
            let html = `<optgroup label="${grupo}">`;
            itens.forEach(i => html += `<option value="${i}">${i}</option>`);
            html += `</optgroup>`;
            select.innerHTML += html;
        }
    }
}

// Ouve o login do Auth.js para atualizar a foto
window.addEventListener('perfilCarregado', () => {
    const user = auth.currentUser;
    const perfil = window.userProfile;
    
    if(user && perfil) {
        const nome = perfil.nome_profissional || perfil.displayName || "Usuário";
        const foto = perfil.photoURL || user.photoURL || "https://ui-avatars.com/api/?background=random";
        
        ['header-user-name', 'provider-header-name'].forEach(id => {
            const el = document.getElementById(id); if(el) el.innerText = nome;
        });
        ['header-user-pic', 'provider-header-pic'].forEach(id => {
            const el = document.getElementById(id); if(el) el.src = foto;
        });
    }
});

// --- FUNÇÕES DE ABAS ---
function switchServiceSubTab(tab) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const btn = document.getElementById(`subtab-${t}-btn`);
        const view = document.getElementById(`view-${t}`);
        if(btn) btn.classList.toggle('active', t===tab);
        if(view) view.classList.toggle('hidden', t!==tab);
    });
    if(tab === 'contratar') carregarCatalogoServicos();
}

function switchProviderSubTab(tab) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const btn = document.getElementById(`ptab-${t}-btn`);
        const view = document.getElementById(`pview-${t}`);
        if(btn) btn.classList.toggle('active', t===tab);
        if(view) view.classList.toggle('hidden', t!==tab);
    });
}

// --- PERFIL PRESTADOR ---
async function abrirConfiguracaoServicos() {
    document.getElementById('provider-setup-modal').classList.remove('hidden');
    if(auth.currentUser) {
        const snap = await getDoc(doc(db, "active_providers", auth.currentUser.uid));
        if(snap.exists()) {
            const d = snap.data();
            document.getElementById('setup-name').value = d.nome_profissional || "";
            localServices = d.services || [];
            renderMyServicesList();
        }
    }
}

function addServiceLocal() {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;
    if(!cat || !price) return alert("Preencha os dados.");
    localServices.push({category: cat, price: price, description: desc});
    renderMyServicesList();
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
}

function removerServicoLocal(idx) {
    localServices.splice(idx, 1);
    renderMyServicesList();
}

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    list.innerHTML = localServices.map((s, i) => `
        <div class="bg-blue-50 p-2 rounded mb-2 flex justify-between">
            <span class="text-xs"><b>${s.category}</b> - R$ ${s.price}</span>
            <button onclick="removerServicoLocal(${i})" class="text-red-500 font-bold">X</button>
        </div>`).join('') || '<p class="text-center text-xs text-gray-400">Vazio</p>';
}

async function saveServicesAndGoOnline() {
    const name = document.getElementById('setup-name').value;
    if(!name || !localServices.length) return alert("Preencha tudo.");
    
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "active_providers", uid), {
        nome_profissional: name,
        services: localServices,
        is_online: true,
        is_demo: false,
        visibility_score: 100,
        last_seen: new Date().toISOString(),
        foto_perfil: window.userProfile?.photoURL || null
    }, { merge: true });
    
    await updateDoc(doc(db, "usuarios", uid), { nome_profissional: name, is_provider: true });
    
    alert("✅ Online!");
    document.getElementById('provider-setup-modal').classList.add('hidden');
    document.getElementById('online-toggle').checked = true;
    window.dispatchEvent(new CustomEvent('perfilCarregado')); // Atualiza foto na hora
}

export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    container.innerHTML = `<div class="loader mx-auto"></div>`;
    
    const q = query(collection(db, "active_providers"), where("is_online", "==", true), orderBy("visibility_score", "desc"), limit(20));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    if(snap.empty) { container.innerHTML = `<p class="text-center text-xs text-gray-400">Ninguém online.</p>`; return; }
    
    snap.forEach(d => {
        const data = d.data();
        const s = data.services[0] || {category: "Geral", price: 0};
        const isDemo = data.is_demo;
        
        container.innerHTML += `
            <div class="bg-white p-3 rounded-xl shadow-sm mb-2 border ${isDemo ? 'opacity-80' : ''}">
                <div class="flex gap-2 items-center mb-2">
                    <img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full">
                    <div>
                        <h4 class="font-bold text-xs">${data.nome_profissional}</h4>
                        ${isDemo ? '<span class="text-[9px] bg-gray-100 px-1 rounded">Exemplo</span>' : '<span class="text-[9px] text-green-600">● Online</span>'}
                    </div>
                </div>
                <p class="text-xs mb-2"><b>${s.category}</b> - R$ ${s.price}</p>
                <button class="w-full py-1 rounded text-xs font-bold text-white ${isDemo ? 'bg-gray-400' : 'bg-blue-600'}" 
                    onclick="${isDemo ? "alert('Demo')" : `alert('Em breve')`}">
                    ${isDemo ? 'Ver Exemplo' : 'Solicitar'}
                </button>
            </div>`;
    });
}

// Inicializa direto
inicializarModuloServicos();
