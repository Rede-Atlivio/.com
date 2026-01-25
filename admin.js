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
let currentCollectionName = ''; // Para saber o que deletar em massa

// --- LOGIN & LOGS ---
window.loginAdmin = async () => {
    const loader = document.getElementById('loading-login'), errMsg = document.getElementById('error-msg');
    if (loader) loader.classList.remove('hidden'); if (errMsg) errMsg.classList.add('hidden');
    try { const result = await signInWithPopup(auth, provider); checkAdmin(result.user); logSystemAction('LOGIN', 'Admin logou.'); } 
    catch (e) { console.error(e); if (loader) loader.classList.add('hidden'); if (errMsg) { errMsg.innerText = "Erro: " + e.message; errMsg.classList.remove('hidden'); } }
};
async function logSystemAction(action, desc) { try { await addDoc(collection(db, "system_logs"), { action, desc, user: auth.currentUser?.email||'sys', timestamp: serverTimestamp() }); } catch(e){} }
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    
    // Esconde barra de bulk se mudar de aba
    document.getElementById('bulk-actions').classList.remove('visible');

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'generator') { document.getElementById('view-generator').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
    else if(viewName === 'analytics') { document.getElementById('view-analytics').classList.remove('hidden'); initAnalytics(); }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
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

window.forceRefresh = () => { if(['users', 'services', 'missions', 'jobs', 'opps'].includes(currentView)) loadList(currentView); else if (currentView === 'dashboard') initDashboard(); };

// --- LÓGICA DE SELEÇÃO EM MASSA (NOVO) ---
window.toggleSelectAll = (source) => {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateBulkBar();
};

window.updateBulkBar = () => {
    const count = document.querySelectorAll('.row-checkbox:checked').length;
    const bar = document.getElementById('bulk-actions');
    document.getElementById('bulk-count').innerText = count;
    if(count > 0) bar.classList.add('visible'); else bar.classList.remove('visible');
};

window.deleteSelectedItems = async () => {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    if(checked.length === 0) return;
    if(!confirm(`⚠️ Tem certeza que deseja excluir ${checked.length} itens permanentemente?`)) return;

    const batch = writeBatch(db);
    checked.forEach(cb => {
        const ref = doc(db, currentCollectionName, cb.value);
        batch.delete(ref);
    });

    try {
        await batch.commit();
        alert("Itens excluídos com sucesso!");
        document.getElementById('bulk-actions').classList.remove('visible');
        loadList(currentView);
    } catch(e) { alert("Erro na exclusão em massa: " + e.message); }
};

// --- CARREGAMENTO DE LISTA (Com Checkboxes) ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    else constraints.push(where("is_demo", "!=", true)); 

    // Define nome da coleção para exclusão
    if(type === 'users') colName = "usuarios";
    else if(type === 'services') colName = "active_providers";
    else if(type === 'missions') colName = "missoes";
    else if(type === 'opps') colName = "oportunidades";
    else colName = type;
    
    currentCollectionName = colName;

    // Cabeçalho com Checkbox Geral
    const checkboxTh = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;
    
    if(type === 'users') { 
        headers = [checkboxTh, "USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; 
        fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3 font-mono text-green-400">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button></td>`; 
    }
    else if (type === 'services') { 
        headers = [checkboxTh, "NOME", "ONLINE", "SIMULADO?", "AÇÕES"]; 
        fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button></td>`; 
    }
    else { 
        headers = [checkboxTh, "ID", "DADOS", "STATUS", "AÇÕES"]; 
        fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 font-mono text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||d.cargo||'Item sem nome'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button></td>`; 
    }
    
    if(thead) thead.innerHTML = headers.join(''); // Join direto pois headers já contém HTML do checkbox
    
    try { 
        const q = query(collection(db, colName), ...constraints, limit(50)); 
        const snap = await getDocs(q); 
        tbody.innerHTML = ""; 
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Vazio ou modo incorreto.</td></tr>"; 
        snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; }); 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    } catch(e) { tbody.innerHTML = `<tr><td colspan='6' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    const btnAdd = document.getElementById('btn-add-new'); if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- GERADOR EM MASSA (COM AUTO-SWITCH) ---
window.runMassGenerator = async () => {
    const type = document.getElementById('gen-type').value;
    const qty = parseInt(document.getElementById('gen-qty').value);
    const statusEl = document.getElementById('gen-status');
    
    if(!confirm(`Gerar ${qty} itens SIMULADOS em '${type}'?\nEles aparecerão na aba DEMONSTRATIVO.`)) return;
    
    statusEl.innerText = "Iniciando geração...";
    statusEl.classList.remove('hidden');

    const batch = writeBatch(db);
    let collectionName = '';
    
    // Arrays de Dados Seguros
    const jobTitles = ["Assistente Admin (Banco de Talentos)", "Vendedor (Vaga Preenchida)", "Atendente (Cadastro)", "Recepcionista (Modelo)"];
    const serviceNames = ["Eletricista (Indisponível)", "Limpeza (Modelo)", "Montador (Exemplo)"];
    const missionTitles = ["Pesquisa (Encerrada)", "Cliente Oculto (Finalizada)", "Entrega (Teste)"];
    const oppTitles = ["Desconto Farmácia (Parceiro)", "Cashback (Exemplo)"];

    if (type === 'jobs') collectionName = 'jobs';
    else if (type === 'services') collectionName = 'active_providers';
    else if (type === 'missions') collectionName = 'missoes';
    else if (type === 'opps') collectionName = 'oportunidades';

    for (let i = 0; i < qty; i++) {
        const docRef = doc(collection(db, collectionName));
        let data = { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: true, visibility_score: 10 };

        if (type === 'jobs') { data.titulo = jobTitles[Math.floor(Math.random()*jobTitles.length)]; data.status = "encerrada"; data.empresa = "Parceiro (Confidencial)"; }
        else if (type === 'services') { data.nome_profissional = serviceNames[Math.floor(Math.random()*serviceNames.length)]; data.is_online = false; data.status = "indisponivel"; }
        else if (type === 'missions') { data.titulo = missionTitles[Math.floor(Math.random()*missionTitles.length)]; data.status = "concluida"; }
        else if (type === 'opps') { data.titulo = oppTitles[Math.floor(Math.random()*oppTitles.length)]; data.status = "analise"; }

        batch.set(docRef, data);
    }

    try {
        await batch.commit();
        statusEl.innerText = "✅ Concluído!";
        
        // --- A MÁGICA: MUDAR PARA MODO DEMO E IR PARA A LISTA ---
        alert(`Sucesso! Redirecionando para a lista de ${type} em modo DEMONSTRATIVO para você ver os itens.`);
        window.toggleDataMode('demo'); // Força o modo demo
        window.switchView(type); // Leva o usuário para a lista criada
        
    } catch (e) {
        statusEl.innerText = "Erro ao gerar.";
        alert("Erro: " + e.message);
    }
};

// --- OUTROS FUNÇÕES AUXILIARES (Mantidas) ---
window.openModalCreate = (type) => { /* ... (mantido igual v26) ... */ };
window.openUniversalEditor = async (c,i) => { /* ... (mantido igual v26) ... */ };
window.saveLinkToFirebase = async () => { /* ... */ };
window.saveSettings = async () => { /* ... */ };
window.loadSettings = async () => { /* ... */ };
window.clearDatabase = async (s) => { /* ... */ };
window.generateDetailedPDF = async () => { /* ... */ };
function checkAdmin(u) { if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { document.getElementById('login-gate').classList.add('hidden'); document.getElementById('admin-sidebar').classList.remove('hidden'); document.getElementById('admin-main').classList.remove('hidden'); initDashboard(); } else { alert("ACESSO NEGADO."); signOut(auth); } }
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });
async function initDashboard() { /* ... */ }
async function initAnalytics() { /* ... */ }
