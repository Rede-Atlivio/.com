import { db, auth } from '../app.js';
import { userProfile } from '../auth.js'; 
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CATEGORIAS_MEGA_PACK = {
    "🏡 SERVIÇOS DOMÉSTICOS": ["Diarista / Limpeza", "Passadeira", "Lavadeira", "Cozinheira", "Jardineiro", "Piscineiro", "Babá / Cuidador Infantil", "Cuidador de Idosos", "Passeador de Cães (Dog Walker)", "Adestrador", "Organizador Pessoal"],
    "🛠️ MANUTENÇÃO & OBRAS": ["Eletricista", "Encanador", "Pedreiro", "Pintor", "Montador de Móveis", "Marido de Aluguel", "Gesseiro", "Serralheiro", "Vidraceiro", "Chaveiro", "Climatização", "Desentupidora", "Dedetizador"],
    "💅 BELEZA & ESTÉTICA": ["Cabeleireiro", "Barbeiro", "Manicure / Pedicure", "Maquiadora", "Design de Sobrancelhas", "Depilação", "Esteticista", "Massoterapeuta", "Tatuador"],
    "🎉 FESTAS & EVENTOS": ["Garçom", "Barman", "Copeira", "Churrasqueiro", "DJ / Músico", "Fotógrafo", "Videomaker", "Decorador", "Segurança", "Recepcionista"],
    "💻 DIGITAL & TECNOLOGIA": ["Designer Gráfico", "Editor de Vídeo", "Gestor de Tráfego", "Social Media", "Programador", "Suporte Técnico", "Formatador de PC", "Conserto de Celular"],
    "🚗 AUTO & MOTOS": ["Mecânico", "Eletricista Auto", "Borracheiro", "Funilaria", "Lava Jato", "Martelinho de Ouro", "Instalador de Som", "Motorista Particular"],
    "📚 AULAS & CONSULTORIA": ["Professor Particular", "Professor de Inglês", "Personal Trainer", "Instrutor de Música", "Consultor Financeiro", "Psicólogo", "Advogado", "Contador"]
};

let localServices = [];

window.switchServiceSubTab = switchServiceSubTab;
window.switchProviderSubTab = switchProviderSubTab;
window.abrirConfiguracaoServicos = abrirConfiguracaoServicos;
window.addServiceLocal = addServiceLocal;
window.saveServicesAndGoOnline = saveServicesAndGoOnline;
window.removerServicoLocal = removerServicoLocal;

export async function inicializarModuloServicos() {
    const select = document.getElementById('new-service-category');
    if(select) {
        select.innerHTML = `<option value="" disabled selected>🔍 Selecione uma Categoria...</option>`;
        for (const [grupo, itens] of Object.entries(CATEGORIAS_MEGA_PACK)) {
            let groupHtml = `<optgroup label="${grupo}" style="font-weight:bold; color:#1e3a8a;">`;
            itens.forEach(item => { groupHtml += `<option value="${item}" style="color:#333;">${item}</option>`; });
            groupHtml += `</optgroup>`;
            select.innerHTML += groupHtml;
        }
    }
    setTimeout(() => {
        const user = auth.currentUser;
        if(user) {
            const nome = userProfile?.nome_profissional || user.displayName || "Usuário";
            const foto = userProfile?.photoURL || user.photoURL || "https://ui-avatars.com/api/?background=random";
            const els = ['header-user-name', 'provider-header-name'];
            const pics = ['header-user-pic', 'provider-header-pic'];
            els.forEach(id => { const el = document.getElementById(id); if(el) el.innerText = nome; });
            pics.forEach(id => { const el = document.getElementById(id); if(el) el.src = foto; });
        }
    }, 1500);
}

function switchServiceSubTab(tabName) {
    ['contratar', 'andamento', 'historico'].forEach(t => {
        const btn = document.getElementById(`subtab-${t}-btn`);
        const view = document.getElementById(`view-${t}`);
        if(btn && view) {
            if(t === tabName) { btn.classList.add('active'); view.classList.remove('hidden'); }
            else { btn.classList.remove('active'); view.classList.add('hidden'); }
        }
    });
    if (tabName === 'contratar') carregarCatalogoServicos();
}

function switchProviderSubTab(tabName) {
    ['radar', 'ativos', 'historico'].forEach(t => {
        const btn = document.getElementById(`ptab-${t}-btn`);
        const view = document.getElementById(`pview-${t}`);
        if(btn && view) {
            if(t === tabName) { btn.classList.add('active'); view.classList.remove('hidden'); }
            else { btn.classList.remove('active'); view.classList.add('hidden'); }
        }
    });
}

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
                renderMyServicesList();
            }
        } catch(e) {}
    }
}

function addServiceLocal() {
    const cat = document.getElementById('new-service-category').value;
    const price = document.getElementById('new-service-price').value;
    const desc = document.getElementById('new-service-desc').value;
    if (!cat || !price) return alert("Selecione uma categoria e informe o preço.");
    localServices.push({ category: cat, price: price, description: desc });
    renderMyServicesList();
    document.getElementById('new-service-price').value = "";
    document.getElementById('new-service-desc').value = "";
}

function removerServicoLocal(index) {
    if(confirm("Remover este serviço?")) {
        localServices.splice(index, 1);
        renderMyServicesList();
    }
}

function renderMyServicesList() {
    const list = document.getElementById('my-services-list');
    if(!list) return;
    list.innerHTML = "";
    if(localServices.length === 0) { list.innerHTML = `<p class="text-center text-gray-300 text-xs italic py-4">Nenhum serviço adicionado.</p>`; return; }
    localServices.forEach((s, index) => {
        list.innerHTML += `<div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center mb-2 shadow-sm"><div><p class="font-bold text-xs text-blue-900">${s.category}</p><p class="text-[10px] text-gray-500">R$ ${s.price},00 ${s.description ? '- ' + s.description : ''}</p></div><button onclick="removerServicoLocal(${index})" class="bg-white border border-red-200 text-red-500 font-bold text-xs w-8 h-8 rounded-full">✕</button></div>`;
    });
}

async function saveServicesAndGoOnline() {
    const name = document.getElementById('setup-name').value;
    if (!name || localServices.length === 0) return alert("Preencha nome e serviços.");
    const btn = document.querySelector('#provider-setup-modal button.bg-green-600');
    if(btn) { btn.innerText = "Salvando..."; btn.disabled = true; }
    try {
        const uid = auth.currentUser.uid;
        await setDoc(doc(db, "active_providers", uid), {
            nome_profissional: name, services: localServices, is_online: true, is_demo: false, visibility_score: 100, last_seen: new Date().toISOString(), foto_perfil: userProfile?.photoURL || null
        }, { merge: true });
        await updateDoc(doc(db, "usuarios", uid), { nome_profissional: name, is_provider: true });
        alert("✅ Perfil Salvo! Você está ONLINE.");
        document.getElementById('provider-setup-modal').classList.add('hidden');
        const toggle = document.getElementById('online-toggle');
        if(toggle) toggle.checked = true;
        const tabGanhar = document.getElementById('tab-ganhar');
        if(tabGanhar) tabGanhar.classList.remove('hidden');
    } catch (e) { alert("Erro: " + e.message); } 
    finally { if(btn) { btn.innerText = "SALVAR E FICAR ONLINE 📡"; btn.disabled = false; } }
}

export async function carregarCatalogoServicos() {
    const container = document.getElementById('lista-prestadores-realtime');
    if (!container) return;
    container.innerHTML = `<div class="col-span-2 text-center py-10"><div class="loader mx-auto"></div></div>`;
    try {
        const q = query(collection(db, "active_providers"), where("is_online", "==", true), orderBy("visibility_score", "desc"), limit(20));
        const snapshot = await getDocs(q);
        container.innerHTML = "";
        if (snapshot.empty) { container.innerHTML = `<div class="col-span-2 text-center text-gray-400 text-xs">Nenhum prestador na região.</div>`; return; }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const servico = data.services && data.services.length > 0 ? data.services[0] : { category: "Geral", price: 0 };
            const isDemo = data.is_demo === true;
            const badge = isDemo ? `<span class="bg-gray-100 text-gray-500 text-[8px] px-2 py-0.5 rounded border">Exemplo</span>` : `<span class="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded">● Online</span>`;
            const btnAction = isDemo ? `onclick="alert('ℹ️ Modo Demo.')"` : `onclick="alert('Em breve: Pedido Real')"`;
            container.innerHTML += `<div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between animate-fadeIn"><div class="flex items-start justify-between mb-2"><div class="flex items-center gap-2"><img src="${data.foto_perfil || 'https://ui-avatars.com/api/?background=random'}" class="w-8 h-8 rounded-full border"><div><h4 class="font-bold text-xs text-gray-800 line-clamp-1">${data.nome_profissional}</h4>${badge}</div></div></div><div class="mb-3"><p class="text-[10px] text-gray-500 font-bold">${servico.category}</p><p class="text-xs font-black text-blue-900">R$ ${servico.price},00</p></div><button ${btnAction} class="w-full ${isDemo ? 'bg-gray-700' : 'bg-blue-600'} text-white py-2 rounded-lg text-[9px] font-black uppercase">${isDemo ? 'Ver Exemplo' : 'Solicitar'}</button></div>`;
        });
    } catch (e) { container.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs">Erro de conexão.</div>`; }
}

if(document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', inicializarModuloServicos); } else { inicializarModuloServicos(); }
