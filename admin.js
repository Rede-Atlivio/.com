import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// --- CONFIGURAÇÃO DO SEU SITE (LINK CORRIGIDO) ---
// Se mudar o nome da pasta no GitHub, atualize aqui:
const SITE_URL = "https://rede-atlivio.github.io/painel-financeiro-borges"; 

// EXPORTS
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
    
    // Esconde todas as views
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings'].forEach(id => { 
        const el = document.getElementById(id); if (el) el.classList.add('hidden'); 
    });
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = viewName.toUpperCase();

    // Mostra a view correta
    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'analytics') { document.getElementById('view-analytics').classList.remove('hidden'); initAnalytics(); }
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

            let inputHtml = typeof val === 'boolean' ? 
                `<div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700"><label class="inp-label">${label}</label><input type="checkbox" id="field-${key}" ${val?'checked':''} class="w-4 h-4 accent-blue-600"></div>` :
                `<div><label class="inp-label">${label}</label><input type="${typeof val==='number'?'number':'text'}" id="field-${key}" value="${val}" class="inp-editor"></div>`;
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
        await addDoc(collection(db, coll), { 
            created_at: serverTimestamp(), 
            updated_at: serverTimestamp(), 
            is_demo: dataMode === 'demo',
            titulo: 'Novo Item Rascunho', 
            status: 'rascunho'
        });
    };
};

async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    if(!tbody) return; tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    else constraints.push(where("is_demo", "!=", true)); 

    if(type === 'users') { colName = "usuarios"; headers = ["USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3 font-mono text-green-400">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('usuarios', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('usuarios', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else if (type === 'services') { colName = "active_providers"; headers = ["NOME", "ONLINE", "SIMULADO?", "AÇÕES"]; fields = (d) => `<td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('active_providers', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('active_providers', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; }
    else { 
        colName = type === 'opps' ? 'oportunidades' : type; 
        if(type === 'missions') colName = 'missoes';
        headers = ["ID", "DADOS", "STATUS", "AÇÕES"]; 
        fields = (d) => `<td class="p-3 font-mono text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||'Item'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3 flex gap-2"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button><button onclick="window.deleteItem('${colName}', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>`; 
    }
    
    if(thead) thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');
    try { 
        const q = query(collection(db, colName), ...constraints, limit(50)); 
        const snap = await getDocs(q); 
        tbody.innerHTML = ""; 
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Vazio ou sem permissão.</td></tr>"; 
        snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; }); 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    } catch(e) { tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    const btnAdd = document.getElementById('btn-add-new'); if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- DASHBOARD ---
async function initDashboard() {
    try { 
        const snapUsers = await getCountFromServer(collection(db, "usuarios")); 
        document.getElementById('kpi-users').innerText = snapUsers.data().count;
        
        const snapProv = await getCountFromServer(collection(db, "active_providers"));
        document.getElementById('kpi-providers').innerText = snapProv.data().count;

        const snapOrders = await getCountFromServer(collection(db, "orders"));
        document.getElementById('kpi-orders').innerText = snapOrders.data().count;
        
        const feed = document.getElementById('live-feed');
        if(feed) {
             const logsQ = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(10));
             const logsSnap = await getDocs(logsQ);
             let logHtml = "";
             if(!logsSnap.empty) {
                 logsSnap.forEach(l => {
                    const ld = l.data();
                    const time = ld.timestamp ? new Date(ld.timestamp.seconds*1000).toLocaleTimeString() : '-';
                    logHtml += `<div class="p-2 border-l border-blue-500 bg-blue-500/10 mb-2 rounded flex justify-between"><span class="text-white">${ld.action}</span> <span class="opacity-50 text-[10px]">${time}</span></div>`;
                 });
             } else {
                 logHtml = `<div class="p-2 border-l border-green-500 bg-green-500/10 mb-2">Painel Iniciado com Sucesso <span class="float-right opacity-50 text-[10px]">${new Date().toLocaleTimeString()}</span></div>`;
             }
             feed.innerHTML = logHtml;
        }
    } catch(e) { console.log("Dash error", e); }

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

async function initAnalytics() {
    // Simulação Visual (Dados mockados para MVP)
    const container = document.getElementById('funnel-container');
    const steps = [
        { label: "VISITANTES (Home)", count: 120, color: "text-white" },
        { label: "CADASTROS", count: 45, color: "text-indigo-400" },
        { label: "ATIVOS", count: 30, color: "text-purple-400" },
        { label: "CONVERSÃO", count: 8, color: "text-emerald-400" }
    ];
    let html = '';
    steps.forEach((step, index) => {
        const width = (step.count / steps[0].count * 100);
        html += `<div class="funnel-step active"><div class="flex justify-between items-end"><div><p class="text-[10px] uppercase text-slate-500 font-bold">${step.label}</p><p class="text-xl font-black ${step.color}">${step.count}</p></div></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${width}%"></div></div></div>`;
    });
    container.innerHTML = html;

    const ctxSrc = document.getElementById('sourceChart');
    if(ctxSrc) {
        if(sourceChartInstance) sourceChartInstance.destroy();
        sourceChartInstance = new Chart(ctxSrc, { 
            type: 'doughnut', 
            data: { labels: ['Instagram', 'Google', 'Direto'], datasets: [{ data: [55, 30, 15], backgroundColor: ['#f43f5e', '#3b82f6', '#10b981'], borderWidth:0 }] }, 
            options: { plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } } 
        });
    }
}

// --- GERADOR DE LINKS (CORRIGIDO PARA GITHUB PAGES) ---
window.saveLinkToFirebase = async () => {
    const id = document.getElementById('linkName').value.trim();
    if(!id) return alert("Digite um nome curto.");
    
    const source = document.getElementById('utmSource').value || 'direct';
    const campaign = document.getElementById('utmCampaign').value || 'none';
    
    // CORREÇÃO: Usa o SITE_URL definido no topo
    const finalLink = `${SITE_URL}/?utm_source=${source}&utm_campaign=${campaign}&ref=${id}`;

    try {
        await setDoc(doc(db, "short_links", id), {
            target: finalLink,
            source: source,
            campaign: campaign,
            clicks: 0,
            created_at: serverTimestamp()
        });
        document.getElementById('finalLinkDisplay').innerText = finalLink;
        document.getElementById('link-result').classList.remove('hidden');
    } catch(e) { alert("Erro ao salvar link: " + e.message); }
};

// --- CONFIGURAÇÕES GLOBAIS (REAL) ---
window.saveSettings = async () => {
    const msg = document.getElementById('conf-global-msg').value;
    try {
        // Grava na coleção 'settings' documento 'global'
        await setDoc(doc(db, "settings", "global"), {
            top_message: msg,
            updated_at: serverTimestamp(),
            updated_by: auth.currentUser.email
        }, { merge: true });
        alert("✅ Configurações salvas no Banco de Dados!");
    } catch(e) {
        alert("Erro ao salvar: " + e.message);
    }
};

window.loadSettings = async () => {
    try {
        const docSnap = await getDoc(doc(db, "settings", "global"));
        if(docSnap.exists()) {
            document.getElementById('conf-global-msg').value = docSnap.data().top_message || "";
        }
    } catch(e) { console.log("Sem configs ainda."); }
    
    // Conectar o botão de salvar dinamicamente
    const btn = document.querySelector('#view-settings button');
    if(btn) btn.onclick = window.saveSettings;
};

// --- ZONA DE PERIGO (COM SENHA) ---
window.clearDatabase = async (scope) => {
    if(!confirm("⚠️ AÇÃO IRREVERSÍVEL! Isso pode quebrar a plataforma. Tem certeza?")) return;
    
    if(scope === 'logs') {
        alert("Limpando logs locais da sessão...");
        console.clear();
    } else if (scope === 'full') {
        // SENHA MESTRE AQUI
        const password = prompt("Digite a senha mestre para RESET TOTAL:");
        
        if(password === "admin123") { 
            const confirm2 = prompt("Digite 'DELETAR' para confirmar:");
            if(confirm2 === 'DELETAR') {
                try {
                    // Exemplo de deleção em massa (apaga usuários simulados)
                    const batch = writeBatch(db);
                    const q = query(collection(db, "usuarios"), where("is_demo", "==", true));
                    const snap = await getDocs(q);
                    snap.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    alert("♻️ Dados SIMULADOS foram apagados com sucesso.");
                    window.forceRefresh();
                } catch(e) {
                    alert("Erro ao limpar: " + e.message);
                }
            }
        } else {
            alert("❌ Senha incorreta.");
        }
    }
};

window.generateDetailedPDF = async () => {
    const printArea = document.getElementById('print-body');
    const dateArea = document.getElementById('print-date');
    dateArea.innerText = `Gerado em: ${new Date().toLocaleString()} | Usuário: ${auth.currentUser.email}`;
    
    const logsQ = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(20));
    const logsSnap = await getDocs(logsQ);
    let logsHtml = "";
    
    if(!logsSnap.empty) {
        logsSnap.forEach(l => {
            const ld = l.data();
            logsHtml += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 5px;">${new Date(ld.timestamp.seconds*1000).toLocaleString()}</td><td style="padding: 5px;">LOG</td><td style="padding: 5px;">${ld.action}</td><td style="padding: 5px;">Sistema</td></tr>`;
        });
    } else {
        logsHtml = "<tr><td colspan='4'>Sem logs recentes.</td></tr>";
    }

    printArea.innerHTML = logsHtml;
    window.print();
};
