import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// --- EXPORTAR PARA WINDOW ---
window.auth = auth;
window.db = db;
let chartInstance = null;

let currentView = 'dashboard', dataMode = 'real', currentEditId = null, currentEditColl = null;

window.loginAdmin = async () => {
    const loader = document.getElementById('loading-login'), errMsg = document.getElementById('error-msg');
    if (loader) loader.classList.remove('hidden'); if (errMsg) errMsg.classList.add('hidden');
    try { const result = await signInWithPopup(auth, provider); checkAdmin(result.user); } 
    catch (e) { console.error(e); if (loader) loader.classList.add('hidden'); if (errMsg) { errMsg.innerText = "Erro: " + e.message; errMsg.classList.remove('hidden'); } }
};

window.logoutAdmin = () => signOut(auth).then(() => location.reload());

window.switchView = (viewName) => {
    currentView = viewName;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
    ['view-dashboard', 'view-list', 'view-finance'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = viewName.toUpperCase();
    if(viewName === 'dashboard') { const d = document.getElementById('view-dashboard'); if(d) d.classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'finance') { const f = document.getElementById('view-finance'); if(f) f.classList.remove('hidden'); }
    else { const l = document.getElementById('view-list'); if(l) l.classList.remove('hidden'); loadList(viewName); }
};

window.toggleDataMode = (mode) => {
    dataMode = mode;
    const btnReal = document.getElementById('btn-mode-real'), btnDemo = document.getElementById('btn-mode-demo');
    if (btnReal) btnReal.className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    if (btnDemo) btnDemo.className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    window.forceRefresh();
};

window.forceRefresh = () => { if(currentView === 'dashboard') initDashboard(); else loadList(currentView); };
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
            let inputHtml = typeof val === 'boolean' ? 
                `<div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700"><label class="inp-label">${key}</label><input type="checkbox" id="field-${key}" ${val?'checked':''} class="w-4 h-4 accent-blue-600"></div>` :
                `<div><label class="inp-label">${key}</label><input type="${typeof val==='number'?'number':'text'}" id="field-${key}" value="${val}" class="inp-editor"></div>`;
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
        let coll = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : type));
        await addDoc(collection(db, coll), { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: dataMode === 'demo', titulo: 'Novo Item', status: 'rascunho' });
    };
};

async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    if(!tbody) return; tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    
    if(type === 'users') { colName = "usuarios"; headers = ["USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3 font-mono text-green-400">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('usuarios', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('usuarios', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else if (type === 'services') { colName = "active_providers"; headers = ["NOME", "ONLINE", "DEMO?", "AÇÕES"]; fields = (d) => `<td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('active_providers', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('active_providers', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else { colName = type; headers = ["ID", "DADOS", "AÇÕES"]; fields = (d) => `<td class="p-3 font-mono text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||'Item'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${type}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('${type}', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    
    if(thead) thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');
    try { const q = query(collection(db, colName), ...constraints, limit(50)); const snap = await getDocs(q); tbody.innerHTML = ""; if(snap.empty) tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Vazio.</td></tr>"; snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; }); if(typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) { tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    const btnAdd = document.getElementById('btn-add-new'); if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

async function initDashboard() {
    // 1. KPIs
    try { 
        const snapUsers = await getCountFromServer(collection(db, "usuarios")); 
        document.getElementById('kpi-users').innerText = snapUsers.data().count;
        
        const snapProv = await getCountFromServer(collection(db, "active_providers"));
        document.getElementById('kpi-providers').innerText = snapProv.data().count;

        const snapOrders = await getCountFromServer(collection(db, "orders"));
        document.getElementById('kpi-orders').innerText = snapOrders.data().count;
        
        // Simulação para Feed (Real-time seria onSnapshot, mas gastaria quota)
        const feed = document.getElementById('live-feed');
        if(feed) feed.innerHTML = `<div class="p-2 border-l border-green-500 bg-green-500/10 mb-2">Painel Iniciado com Sucesso <span class="float-right opacity-50 text-[10px]">${new Date().toLocaleTimeString()}</span></div>`;

    } catch(e) { console.log("Dash error", e); }

    // 2. Gráfico
    const ctx = document.getElementById('mainChart');
    if(ctx) {
        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Usuários', 'Prestadores', 'Pedidos'],
                datasets: [{
                    data: [
                        parseInt(document.getElementById('kpi-users').innerText) || 1, 
                        parseInt(document.getElementById('kpi-providers').innerText) || 1,
                        parseInt(document.getElementById('kpi-orders').innerText) || 1
                    ],
                    backgroundColor: ['#3b82f6', '#10b981', '#a855f7'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono' } } } } }
        });
    }
}
