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
let currentView = 'dashboard', dataMode = 'real', currentEditId = null, currentEditColl = null;
let currentCollectionName = '';

// --- LOGIN & CORE FUNCTIONS (Inalterados) ---
window.loginAdmin = async () => { try { const result = await signInWithPopup(auth, provider); checkAdmin(result.user); } catch (e) { document.getElementById('error-msg').innerText = e.message; document.getElementById('error-msg').classList.remove('hidden'); } };
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

window.switchView = (viewName) => {
    currentView = viewName;
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    document.getElementById('bulk-actions').classList.remove('visible');

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'generator') { document.getElementById('view-generator').classList.remove('hidden'); }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
    else if(viewName === 'analytics') { document.getElementById('view-analytics').classList.remove('hidden'); initAnalytics(); }
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

// --- BULK SELECTION (Inalterado) ---
window.toggleSelectAll = (src) => { document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = src.checked); window.updateBulkBar(); };
window.updateBulkBar = () => { const count = document.querySelectorAll('.row-checkbox:checked').length; const bar = document.getElementById('bulk-actions'); document.getElementById('bulk-count').innerText = count; if(count>0) bar.classList.add('visible'); else bar.classList.remove('visible'); };
window.deleteSelectedItems = async () => {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    if(!confirm(`Excluir ${checked.length} itens?`)) return;
    const batch = writeBatch(db);
    checked.forEach(cb => batch.delete(doc(db, currentCollectionName, cb.value)));
    await batch.commit();
    document.getElementById('bulk-actions').classList.remove('visible');
    loadList(currentView);
};

// --- LIST LOADING (Inalterado) ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true)); else constraints.push(where("is_demo", "!=", true)); 

    if(type === 'users') colName = "usuarios";
    else if(type === 'services') colName = "active_providers";
    else if(type === 'missions') colName = "missoes";
    else if(type === 'opps') colName = "oportunidades";
    else colName = type; 
    
    currentCollectionName = colName;
    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;

    if(type === 'users') { headers = [chk, "USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    else if (type === 'services') { headers = [chk, "NOME", "ONLINE", "DEMO?", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    else { headers = [chk, "ID", "DADOS", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||'Item'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    
    if(thead) thead.innerHTML = headers.join('');
    try { const q = query(collection(db, colName), ...constraints, limit(50)); const snap = await getDocs(q); tbody.innerHTML = ""; if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Nenhum item encontrado neste modo.</td></tr>"; snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5">${fields(d)}</tr>`; }); } catch(e) { tbody.innerHTML = `<tr><td colspan='6' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
}

// --- MASS GENERATOR (ATUALIZADO COM "LISTAS GENEROSAS") ---
window.runMassGenerator = async () => {
    const type = document.getElementById('gen-type').value;
    const qty = parseInt(document.getElementById('gen-qty').value);
    const statusEl = document.getElementById('gen-status');
    if(!confirm(`Gerar ${qty} itens SIMULADOS?`)) return;
    
    statusEl.innerText = "Gerando..."; statusEl.classList.remove('hidden');
    const batch = writeBatch(db);
    let collectionName = '';

    // --- LISTAS GENEROSAS (Baseado no seu Estudo) ---
    const servicesList = [
        {name: "Diarista Residencial (Exemplo)", cat: "Limpeza"}, {name: "Eletricista 24h (Modelo)", cat: "Reparos"},
        {name: "Designer Gráfico (Portfólio)", cat: "Design"}, {name: "Fotógrafo de Eventos (Demonstrativo)", cat: "Eventos"},
        {name: "Encanador Residencial (Offline)", cat: "Reparos"}, {name: "Técnico de Informática (Exemplo)", cat: "Tecnologia"},
        {name: "Professor Particular (Modelo)", cat: "Educação"}, {name: "Montador de Móveis (Exemplo)", cat: "Reparos"},
        {name: "Manicure Delivery (Agenda Fechada)", cat: "Beleza"}, {name: "Barbeiro em Domicílio (Exemplo)", cat: "Beleza"}
    ];
    
    const jobsList = [
        "Atendente de Loja", "Recepcionista", "Auxiliar Administrativo", "Vendedor Interno", 
        "Estoquista", "Operador de Caixa", "Social Media Júnior", "Designer Júnior", 
        "Auxiliar de Limpeza", "Motoboy", "Garçom", "Auxiliar de Produção"
    ];
    const jobTypes = ["CLT", "Freelancer", "Temporário", "Estágio"];

    const oppsList = [
        "Cashback Supermercado (Exemplo)", "Indique e Ganhe (Demonstrativo)", "App que paga por cadastro", 
        "Cupom de Desconto (Exemplo)", "Programa de Pontos", "Pesquisa Remunerada", 
        "Alerta Promocional (Exemplo)", "Parceria Local", "Desconto em Farmácia", "Cashback Combustível"
    ];

    const missionsList = [
        "Tirar foto de fachada (Exemplo)", "Gravar vídeo curto (Modelo)", "Avaliar Aplicativo (Teste)", 
        "Conferir preço no mercado (Exemplo)", "Fotografar cardápio (Modelo)"
    ];
    
    if (type === 'jobs') collectionName = 'jobs';
    else if (type === 'services') collectionName = 'active_providers';
    else if (type === 'missions') collectionName = 'missoes';
    else if (type === 'opps') collectionName = 'oportunidades';

    for (let i = 0; i < qty; i++) {
        const docRef = doc(collection(db, collectionName));
        let data = { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: true, visibility_score: 10 };

        if (type === 'services') {
            const item = servicesList[Math.floor(Math.random() * servicesList.length)];
            data.nome_profissional = item.name;
            data.categoria = item.cat;
            data.is_online = false; // Always offline for safety
            data.status = "indisponivel";
        } else if (type === 'jobs') {
            const job = jobsList[Math.floor(Math.random() * jobsList.length)];
            const jType = jobTypes[Math.floor(Math.random() * jobTypes.length)];
            data.titulo = `${job} (Banco de Talentos)`;
            data.status = "encerrada"; // Always closed
            data.tipo = jType;
            data.empresa = "Parceiro Confidencial";
            data.salario = "A combinar";
            data.descricao = "Esta é uma vaga demonstrativa para ilustrar o formato da plataforma. Inscrições encerradas.";
        } else if (type === 'opps') {
            data.titulo = oppsList[Math.floor(Math.random() * oppsList.length)];
            data.status = "analise"; // Safe status
            data.link = "#";
        } else {
            data.titulo = missionsList[Math.floor(Math.random() * missionsList.length)];
            data.status = "concluida"; // Always completed
            data.valor = (Math.random() * 20).toFixed(2);
        }
        batch.set(docRef, data);
    }

    try { await batch.commit(); statusEl.innerText = "✅ Feito!"; window.toggleDataMode('demo'); window.switchView(type); } 
    catch (e) { alert("Erro: " + e.message); }
};

// --- LINK GENERATOR (TEST vs REAL) ---
window.saveLinkToFirebase = async () => {
    let id = document.getElementById('linkName').value.trim().replace(/\s+/g, '-').toLowerCase();
    if(!id) return alert("Digite um nome.");
    const source = encodeURIComponent(document.getElementById('utmSource').value || 'direct');
    const isTest = document.getElementById('is-test-link').checked;
    
    // Add test flag to URL if selected
    const finalLink = `${SITE_URL}/?utm_source=${source}&ref=${id}${isTest ? '&mode=test' : ''}`;

    try {
        await setDoc(doc(db, "short_links", id), { target: finalLink, source: decodeURIComponent(source), is_test: isTest, created_at: serverTimestamp() });
        document.getElementById('finalLinkDisplay').innerText = finalLink;
        document.getElementById('link-result').classList.remove('hidden');
    } catch(e) { alert("Erro: " + e.message); }
};

// --- AUXILIARY FUNCTIONS (Unchanged) ---
window.openModalCreate = (type) => { /* ... (kept) ... */ };
window.openUniversalEditor = async (c,i) => { /* ... (kept) ... */ };
window.saveSettings = async () => { /* ... */ };
window.loadSettings = async () => { /* ... */ };
window.clearDatabase = async (s) => { /* ... */ };
window.generateDetailedPDF = async () => { /* ... */ };
function checkAdmin(u) { if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { document.getElementById('login-gate').classList.add('hidden'); document.getElementById('admin-sidebar').classList.remove('hidden'); document.getElementById('admin-main').classList.remove('hidden'); initDashboard(); } else { alert("ACESSO NEGADO."); signOut(auth); } }
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });
async function initDashboard() { /* ... */ }
async function initAnalytics() { /* ... */ }
