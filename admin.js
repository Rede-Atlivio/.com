import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// --- URL CORRIGIDA (AGORA APONTA PARA A PASTA .COM) ---
const SITE_URL = "https://rede-atlivio.github.io/.com"; 

window.auth = auth;
window.db = db;
let chartInstance = null;
let currentView = 'dashboard', dataMode = 'real', currentEditId = null, currentEditColl = null;
let currentCollectionName = '';

// --- LOGIN ---
window.loginAdmin = async () => { try { await signInWithPopup(auth, provider); checkAdmin(auth.currentUser); } catch (e) { alert(e.message); } };
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    document.getElementById('bulk-actions').classList.remove('visible');

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'generator') { document.getElementById('view-generator').classList.remove('hidden'); }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
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

window.forceRefresh = () => { if(['users', 'services', 'missions', 'jobs', 'opps'].includes(currentView)) loadList(currentView); else if (currentView === 'dashboard') initDashboard(); };

// --- CRIAÇÃO DIRETA (SEM TRAVAMENTO) ---
window.openModalCreate = (type) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    modal.classList.remove('hidden');
    title.innerText = "CRIAR NOVO ITEM";
    content.innerHTML = ""; 

    const fields = [
        { key: 'titulo', label: 'Título / Nome', type: 'text' },
        { key: 'descricao', label: 'Descrição', type: 'text' },
        { key: 'status', label: 'Status (ativo/inativo)', type: 'text', val: 'ativo' },
        { key: 'is_demo', label: 'É Demonstração?', type: 'checkbox', val: dataMode === 'demo' }
    ];

    if(type === 'jobs') fields.push({ key: 'salario', label: 'Salário', type: 'text' });
    if(type === 'missions' || type === 'services') fields.push({ key: 'valor', label: 'Valor (R$)', type: 'number' });
    if(type === 'opps') fields.push({ key: 'link', label: 'Link Externo', type: 'text' });

    fields.forEach(f => {
        let inputHtml = f.type === 'checkbox' ? 
            `<div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700 mb-2"><label class="inp-label">${f.label}</label><input type="checkbox" id="new-${f.key}" ${f.val?'checked':''} class="w-4 h-4 accent-blue-600"></div>` :
            `<div class="mb-2"><label class="inp-label">${f.label}</label><input type="${f.type}" id="new-${f.key}" value="${f.val||''}" class="inp-editor"></div>`;
        content.innerHTML += inputHtml;
    });

    window.saveCallback = async () => {
        let coll = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
        const newData = { created_at: serverTimestamp(), updated_at: serverTimestamp() };
        fields.forEach(f => {
            const el = document.getElementById(`new-${f.key}`);
            if(el) newData[f.key] = f.type === 'checkbox' ? el.checked : (f.type === 'number' ? parseFloat(el.value) : el.value);
        });
        if(newData.titulo) newData.nome = newData.titulo; 
        if(newData.titulo && type === 'services') newData.nome_profissional = newData.titulo;
        await addDoc(collection(db, coll), newData);
    };
};

// --- EDITOR UNIVERSAL ---
window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    currentEditId = id; currentEditColl = collectionName;
    modal.classList.remove('hidden'); title.innerText = "EDITAR ITEM";
    content.innerHTML = `<p class="text-center text-gray-500 animate-pulse">Carregando...</p>`;
    
    try {
        const docSnap = await getDoc(doc(db, collectionName, id));
        if (!docSnap.exists()) return;
        const data = docSnap.data(); content.innerHTML = ""; 
        
        Object.keys(data).sort().forEach(key => {
            const val = data[key];
            if (key === 'created_at' || key === 'updated_at') return;
            let inputHtml = typeof val === 'boolean' ? 
                `<div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700 mb-2"><label class="inp-label">${key}</label><input type="checkbox" id="field-${key}" ${val?'checked':''} class="w-4 h-4 accent-blue-600"></div>` :
                `<div class="mb-2"><label class="inp-label">${key}</label><input type="${typeof val==='number'?'number':'text'}" id="field-${key}" value="${val}" class="inp-editor"></div>`;
            content.innerHTML += inputHtml;
        });

        window.saveCallback = async () => {
            const updates = { updated_at: serverTimestamp() };
            Object.keys(data).forEach(key => {
                if (key === 'created_at' || key === 'updated_at') return;
                const field = document.getElementById(`field-${key}`);
                if (field) updates[key] = field.type === 'checkbox' ? field.checked : (field.type === 'number' ? parseFloat(field.value) : field.value);
            });
            await updateDoc(doc(db, collectionName, id), updates);
        };
    } catch (e) { alert(e.message); }
};

window.saveModalData = async () => {
    try { if(window.saveCallback) await window.saveCallback(); alert("✅ Salvo!"); window.closeModal(); window.forceRefresh(); } 
    catch(e) { alert("Erro: " + e.message); }
};

// --- GERADOR DE LINKS CORRIGIDO ---
window.saveLinkToFirebase = async () => {
    const idInput = document.getElementById('linkName');
    let id = idInput.value.trim().replace(/\s+/g, '-').toLowerCase();
    
    if(!id) return alert("Digite um nome para o link.");
    idInput.value = id;

    const source = document.getElementById('utmSource').value || 'direct';
    const isTest = document.getElementById('is-test-link').checked;
    
    // AQUI ESTÁ A CORREÇÃO: Usa SITE_URL correto
    const finalLink = `${SITE_URL}/?utm_source=${source}&ref=${id}${isTest ? '&mode=test' : ''}`;

    try {
        await setDoc(doc(db, "short_links", id), {
            target: finalLink,
            source: source,
            is_test: isTest,
            clicks: 0,
            created_at: serverTimestamp()
        });
        document.getElementById('finalLinkDisplay').innerText = finalLink;
        document.getElementById('link-result').classList.remove('hidden');
        alert("✅ Link Gerado!");
    } catch(e) { alert("Erro no Firebase: " + e.message); }
};

// --- LISTAGEM ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
    currentCollectionName = colName;
    
    let constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    else constraints.push(where("is_demo", "!=", true)); 

    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;
    let headers = [chk, "ID", "DADOS", "STATUS", "AÇÕES"];
    let fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 text-xs text-gray-500">${d.id.substring(0,6)}</td><td class="p-3 font-bold text-white">${d.titulo||d.nome||d.nome_profissional||'Sem Nome'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`;

    if(type === 'users') { headers = [chk, "NOME", "TIPO", "SALDO", "STATUS", "AÇÕES"]; }
    
    if(thead) thead.innerHTML = headers.join('');
    
    try {
        const q = query(collection(db, colName), ...constraints, limit(50));
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Vazio.</td></tr>";
        snap.forEach(docSnap => { 
            const d = { id: docSnap.id, ...docSnap.data() }; 
            tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; 
        });
    } catch(e) { tbody.innerHTML = `<tr><td colspan='6' class='text-red-500 p-4'>Erro: ${e.message}</td></tr>`; }
    
    const btnAdd = document.getElementById('btn-add-new'); 
    if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- MASS GENERATOR ---
window.runMassGenerator = async () => {
    const type = document.getElementById('gen-type').value;
    const qty = parseInt(document.getElementById('gen-qty').value);
    const statusEl = document.getElementById('gen-status');
    if(!confirm(`Gerar ${qty} itens SIMULADOS?`)) return;
    statusEl.innerText = "Gerando..."; statusEl.classList.remove('hidden');
    const batch = writeBatch(db);
    let collectionName = type === 'jobs' ? 'jobs' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : 'oportunidades'));

    const oppsRich = [{title: "Alerta Promocional iFood (Exemplo)", desc: "Cupom especial.", type: "alerta", badge: "🔴 Alerta"}, {title: "Cashback Supermercado (Modelo)", desc: "Dinheiro de volta.", type: "cashback", badge: "🟢 Cashback"}];
    const jobsRich = ["Vendedor", "Atendente", "Estoquista", "Recepcionista"];
    
    for(let i=0; i<qty; i++) {
        const docRef = doc(collection(db, collectionName));
        let data = { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: true, visibility_score: 10 };
        
        if(type === 'opps') {
            const item = oppsRich[Math.floor(Math.random()*oppsRich.length)];
            data.titulo = item.title; data.descricao = item.desc; data.tipo_visual = item.type; data.badge_text = item.badge; data.status = "analise"; data.link = "#";
        } else if (type === 'jobs') {
            data.titulo = `${jobsRich[Math.floor(Math.random()*jobsRich.length)]} (Banco de Talentos)`;
            data.status = "encerrada"; data.empresa = "Parceiro"; data.salario = "A combinar";
        } else if (type === 'services') {
            data.nome_profissional = "Profissional Modelo"; data.is_online = false; data.status = "indisponivel";
        } else {
            data.titulo = "Missão Teste (Concluída)"; data.status = "concluida"; data.valor = "10.00";
        }
        batch.set(docRef, data);
    }
    await batch.commit(); statusEl.innerText = "✅ Feito!"; window.toggleDataMode('demo'); window.switchView(type);
};

// --- OUTROS ---
window.toggleSelectAll = (src) => { document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = src.checked); window.updateBulkBar(); };
window.updateBulkBar = () => { const count = document.querySelectorAll('.row-checkbox:checked').length; const bar = document.getElementById('bulk-actions'); document.getElementById('bulk-count').innerText = count; if(count>0) bar.classList.add('visible'); else bar.classList.remove('visible'); };
window.deleteSelectedItems = async () => { const checked = document.querySelectorAll('.row-checkbox:checked'); if(!confirm("Excluir?")) return; const batch = writeBatch(db); checked.forEach(cb => batch.delete(doc(db, currentCollectionName, cb.value))); await batch.commit(); document.getElementById('bulk-actions').classList.remove('visible'); loadList(currentView); };
window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');
window.saveSettings = async () => { const msg = document.getElementById('conf-global-msg').value; await setDoc(doc(db, "settings", "global"), { top_message: msg }, {merge:true}); alert("Salvo!"); };
window.loadSettings = async () => { try { const d = await getDoc(doc(db, "settings", "global")); if(d.exists()) document.getElementById('conf-global-msg').value = d.data().top_message||""; } catch(e){} };
window.clearDatabase = async () => { if(confirm("Apagar TUDO do modo DEMO?")) { const batch = writeBatch(db); const q = query(collection(db, "usuarios"), where("is_demo", "==", true)); const s = await getDocs(q); s.forEach(d=>batch.delete(d.ref)); await batch.commit(); alert("Limpo!"); } };
function checkAdmin(u) { if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { document.getElementById('login-gate').classList.add('hidden'); document.getElementById('admin-sidebar').classList.remove('hidden'); document.getElementById('admin-main').classList.remove('hidden'); initDashboard(); } else { alert("ACESSO NEGADO."); signOut(auth); } }
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });
async function initDashboard() { try { const u = await getCountFromServer(collection(db, "usuarios")); document.getElementById('kpi-users').innerText = u.data().count; } catch(e){} }
async function initAnalytics() {}
