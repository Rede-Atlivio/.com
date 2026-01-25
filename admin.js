import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";
const SITE_URL = "https://rede-atlivio.github.io/painel-financeiro-borges"; 

window.auth = auth;
window.db = db;
let chartInstance = null;
let sourceChartInstance = null;
let currentView = 'dashboard', dataMode = 'real', currentEditId = null, currentEditColl = null;

// --- LOGIN ---
window.loginAdmin = async () => {
    const loader = document.getElementById('loading-login'), errMsg = document.getElementById('error-msg');
    if (loader) loader.classList.remove('hidden'); if (errMsg) errMsg.classList.add('hidden');
    try { const result = await signInWithPopup(auth, provider); checkAdmin(result.user); } 
    catch (e) { console.error(e); if (loader) loader.classList.add('hidden'); if (errMsg) { errMsg.innerText = "Erro: " + e.message; errMsg.classList.remove('hidden'); } }
};

window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => { 
        const el = document.getElementById(id); if (el) el.classList.add('hidden'); 
    });
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = viewName.toUpperCase();

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'analytics') { document.getElementById('view-analytics').classList.remove('hidden'); initAnalytics(); }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
    else if(viewName === 'generator') { document.getElementById('view-generator').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
    else if(viewName === 'finance') { document.getElementById('view-finance').classList.remove('hidden'); }
    else { document.getElementById('view-list').classList.remove('hidden'); loadList(viewName); }
};

window.toggleDataMode = (mode) => {
    dataMode = mode;
    const btnReal = document.getElementById('btn-mode-real'), btnDemo = document.getElementById('btn-mode-demo');
    if (btnReal) btnReal.className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    if (btnDemo) btnDemo.className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    window.forceRefresh();
};

window.forceRefresh = () => { 
    if(currentView === 'dashboard') initDashboard(); 
    else if(currentView === 'analytics') initAnalytics();
    else if(currentView === 'settings') loadSettings();
    else if(['users', 'services', 'missions', 'jobs', 'opps'].includes(currentView)) loadList(currentView);
};

// --- FUNÇÕES DE EDIÇÃO ---
window.closeModal = () => { const modal = document.getElementById('modal-editor'); if (modal) modal.classList.add('hidden'); };

window.saveModalData = async () => {
    try { if(window.saveCallback) await window.saveCallback(); alert("✅ Atualizado!"); window.closeModal(); window.forceRefresh(); } 
    catch(e) { alert("Erro ao salvar: " + e.message); }
};

window.deleteItem = async (coll, id) => {
    if(!confirm("⚠️ Apagar permanentemente?")) return;
    try { await deleteDoc(doc(db, coll, id)); window.forceRefresh(); } catch(e) { alert(e.message); }
};

function checkAdmin(user) {
    if(user.email.toLowerCase().trim() === ADMIN_EMAIL) {
        document.getElementById('login-gate').classList.add('hidden');
        document.getElementById('admin-sidebar').classList.remove('hidden');
        document.getElementById('admin-main').classList.remove('hidden');
        initDashboard();
    } else { alert("ACESSO NEGADO."); signOut(auth); }
}
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });

window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    if(!modal) return;
    currentEditId = id; currentEditColl = collectionName;
    modal.classList.remove('hidden'); if(title) title.innerText = `EDITAR: ${collectionName.toUpperCase()}`;
    if(content) content.innerHTML = `<p class="text-center text-gray-500 animate-pulse">Carregando...</p>`;
    try {
        const docRef = doc(db, collectionName, id), docSnap = await getDoc(docRef);
        if (!docSnap.exists()) { if(content) content.innerHTML = `<p class="text-red-500">Item não encontrado.</p>`; return; }
        const data = docSnap.data(); if(content) content.innerHTML = ""; 
        Object.keys(data).sort().forEach(key => {
            const val = data[key];
            if (key === 'created_at' || key === 'updated_at') return;
            let label = key;
            if(key === 'is_demo' || key === 'is_seed') label = 'É Simulado/Demonstrativo?';
            if(key === 'visibility_score') label = 'Ordem de Destaque (0-100)';
            let inputHtml = typeof val === 'boolean' ? `<div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700"><label class="inp-label">${label}</label><input type="checkbox" id="field-${key}" ${val?'checked':''} class="w-4 h-4 accent-blue-600"></div>` : `<div><label class="inp-label">${label}</label><input type="${typeof val==='number'?'number':'text'}" id="field-${key}" value="${val}" class="inp-editor"></div>`;
            if(content) content.innerHTML += inputHtml;
        });
        window.saveCallback = async () => {
            const updates = {};
            Object.keys(data).forEach(key => {
                if (key === 'created_at' || key === 'updated_at') return;
                const field = document.getElementById(`field-${key}`);
                if (field) { updates[key] = field.type === 'checkbox' ? field.checked : (field.type === 'number' ? parseFloat(field.value) : field.value); }
            });
            updates.updated_at = serverTimestamp(); await updateDoc(docRef, updates);
        };
    } catch (e) { if(content) content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
};

window.openModalCreate = (type) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    if(!modal) return; modal.classList.remove('hidden'); if(title) title.innerText = "NOVO ITEM";
    if(content) content.innerHTML = `<p class="text-center text-gray-400">Salve para criar o rascunho.</p>`;
    window.saveCallback = async () => {
        let coll = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
        await addDoc(collection(db, coll), { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: dataMode === 'demo', titulo: 'Novo Item Rascunho', nome: 'Novo Item', status: 'rascunho' });
    };
};

async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    if(!tbody) return; tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true)); else constraints.push(where("is_demo", "!=", true)); 
    if(type === 'users') { colName = "usuarios"; headers = ["USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3 font-mono text-green-400">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('usuarios', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('usuarios', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else if (type === 'services') { colName = "active_providers"; headers = ["NOME", "ONLINE", "SIMULADO?", "AÇÕES"]; fields = (d) => `<td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('active_providers', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('active_providers', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else { colName = type === 'opps' ? 'oportunidades' : (type === 'missions' ? 'missoes' : type); headers = ["ID", "DADOS", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3 font-mono text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||d.cargo||'Item sem nome'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('${colName}', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    if(thead) thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');
    try { const q = query(collection(db, colName), ...constraints, limit(50)); const snap = await getDocs(q); tbody.innerHTML = ""; if(snap.empty) tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Vazio.</td></tr>"; snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; }); if(typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) { tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    const btnAdd = document.getElementById('btn-add-new'); if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- GERADOR EM MASSA (O CÉREBRO) ---
window.runMassGenerator = async () => {
    const type = document.getElementById('gen-type').value;
    const qty = parseInt(document.getElementById('gen-qty').value);
    const cat = document.getElementById('gen-cat').value;
    const statusEl = document.getElementById('gen-status');
    
    if(!confirm(`Gerar ${qty} itens SIMULADOS em '${type}'?\nIsso vai povoar a plataforma.`)) return;
    
    statusEl.innerText = "Iniciando geração...";
    statusEl.classList.remove('hidden');

    const batch = writeBatch(db);
    let collectionName = '';
    
    // Arrays de Dados (Segurança: Termos profissionais e genéricos)
    const jobTitles = ["Assistente Administrativo (Banco de Talentos)", "Vendedor Externo (Vaga Preenchida)", "Atendente de Loja (Cadastro)", "Recepcionista (Modelo)", "Estagiário de Marketing (Exemplo)"];
    const serviceNames = ["Eletricista Residencial (Indisponível)", "Limpeza Pós-Obra (Modelo)", "Montador de Móveis (Exemplo)", "Técnico de Informática (Offline)"];
    const missionTitles = ["Pesquisa de Preço (Encerrada)", "Cliente Oculto (Finalizada)", "Entrega Rápida (Teste)", "Foto de Fachada (Modelo)"];
    const oppTitles = ["Desconto em Farmácias (Parceiro)", "Cashback Supermercado (Exemplo)", "Indique e Ganhe (Demonstrativo)"];

    if (type === 'jobs') collectionName = 'jobs';
    else if (type === 'services') collectionName = 'active_providers';
    else if (type === 'missions') collectionName = 'missoes';
    else if (type === 'opps') collectionName = 'oportunidades';

    for (let i = 0; i < qty; i++) {
        const docRef = doc(collection(db, collectionName));
        let data = {
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: true, // A TABUA DE SALVAÇÃO
            visibility_score: 10 // Baixo score para ficar no final
        };

        if (type === 'jobs') {
            data.titulo = jobTitles[Math.floor(Math.random() * jobTitles.length)];
            data.empresa = "Empresa Parceira (Confidencial)";
            data.status = "encerrada"; // Status que bloqueia
            data.salario = "A combinar";
            data.descricao = "Esta é uma vaga demonstrativa para ilustrar o formato da plataforma.";
        } else if (type === 'services') {
            data.nome_profissional = serviceNames[Math.floor(Math.random() * serviceNames.length)];
            data.is_online = false; // Força offline
            data.categoria = "Serviços Gerais";
            data.status = "indisponivel";
        } else if (type === 'missions') {
            data.titulo = missionTitles[Math.floor(Math.random() * missionTitles.length)];
            data.valor = (Math.random() * 50).toFixed(2);
            data.status = "concluida"; // Já nasce concluída
        } else if (type === 'opps') {
            data.titulo = oppTitles[Math.floor(Math.random() * oppTitles.length)];
            data.link = "#";
            data.status = "analise";
        }

        batch.set(docRef, data);
    }

    try {
        await batch.commit();
        statusEl.innerText = "✅ Concluído! Conteúdo gerado.";
        alert(`Sucesso! ${qty} itens gerados em '${collectionName}'.\nEles estão marcados como 'Demonstrativo' e não competem com reais.`);
    } catch (e) {
        statusEl.innerText = "Erro ao gerar.";
        alert("Erro: " + e.message);
    }
};

// --- OUTROS ---
async function initDashboard() {
    try { const snapUsers = await getCountFromServer(collection(db, "usuarios")); document.getElementById('kpi-users').innerText = snapUsers.data().count; const snapProv = await getCountFromServer(collection(db, "active_providers")); document.getElementById('kpi-providers').innerText = snapProv.data().count; const snapOrders = await getCountFromServer(collection(db, "orders")); document.getElementById('kpi-orders').innerText = snapOrders.data().count; } catch(e) {}
    const ctx = document.getElementById('mainChart'); if(ctx && !chartInstance) { chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Usuários', 'Prestadores', 'Pedidos'], datasets: [{ data: [1, 1, 1], backgroundColor: ['#3b82f6', '#10b981', '#a855f7'] }] } }); }
}
async function initAnalytics() { /* ... código do analytics mantido ... */ }
window.saveLinkToFirebase = async () => { /* ... código de links mantido ... */ };
window.saveSettings = async () => { /* ... código de settings mantido ... */ };
window.loadSettings = async () => { /* ... */ };
window.clearDatabase = async (scope) => { /* ... */ };
window.generateDetailedPDF = async () => { /* ... */ };
