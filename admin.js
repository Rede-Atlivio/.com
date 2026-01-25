import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

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
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); }
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
        
        // Renderiza campos
        Object.keys(data).sort().forEach(key => {
            const val = data[key];
            if (key === 'created_at' || key === 'updated_at') return;
            
            // TRUQUE PARA "SEED" VIRAR "SIMULADO"
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
        // Criação com Status Correto
        await addDoc(collection(db, coll), { 
            created_at: serverTimestamp(), 
            updated_at: serverTimestamp(), 
            is_demo: dataMode === 'demo', // Flag vital para o "Modo Simulado"
            titulo: 'Novo Item Rascunho', 
            status: 'rascunho' // Garante que apareça
        });
    };
};

// --- CARREGAMENTO DE LISTAS ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    if(!tbody) return; tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName, headers, fields, constraints = [];
    
    // FILTRO DO MODO (REAL vs DEMO)
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    else constraints.push(where("is_demo", "!=", true)); // Exclui demos do modo real

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
        snap.forEach(docSnap => { 
            const d = { id: docSnap.id, ...docSnap.data() }; 
            tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; 
        }); 
        if(typeof lucide !== 'undefined') lucide.createIcons(); 
    } catch(e) { tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    
    const btnAdd = document.getElementById('btn-add-new'); if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- DASHBOARD & ANALYTICS ---
async function initDashboard() {
    try { 
        const snapUsers = await getCountFromServer(collection(db, "usuarios")); 
        document.getElementById('kpi-users').innerText = snapUsers.data().count;
        
        const snapProv = await getCountFromServer(collection(db, "active_providers"));
        document.getElementById('kpi-providers').innerText = snapProv.data().count;

        const snapOrders = await getCountFromServer(collection(db, "orders"));
        document.getElementById('kpi-orders').innerText = snapOrders.data().count;
        
        // Simulação de Logs Reais (Live Feed)
        const feed = document.getElementById('live-feed');
        if(feed) {
             // Tenta buscar logs reais se existirem
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

    // Gráfico de Pizza Simples
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

// --- FUNIL SNIPER (Analytics) ---
async function initAnalytics() {
    // Aqui usamos dados reais de "analytics_events" se existirem, ou simulamos
    const container = document.getElementById('funnel-container');
    
    // Dados simulados para estruturar a visão (Substituir por queries reais depois)
    const steps = [
        { label: "VISITANTES (Home)", count: 120, color: "text-white" },
        { label: "CADASTROS", count: 45, color: "text-indigo-400" },
        { label: "ATIVOS (Quiz/Serviço)", count: 30, color: "text-purple-400" },
        { label: "CHECKOUT/PEDIDO", count: 8, color: "text-emerald-400" }
    ];

    let html = '';
    steps.forEach((step, index) => {
        const prev = index === 0 ? step.count : steps[index-1].count;
        const width = prev > 0 ? (step.count / steps[0].count * 100) : 0;
        html += `<div class="funnel-step active"><div class="flex justify-between items-end"><div><p class="text-[10px] uppercase text-slate-500 font-bold">${step.label}</p><p class="text-xl font-black ${step.color}">${step.count}</p></div></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${width}%"></div></div></div>`;
    });
    container.innerHTML = html;

    // Gráfico Origens
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

// --- GERADOR DE LINKS (UTM) ---
window.saveLinkToFirebase = async () => {
    const id = document.getElementById('linkName').value.trim();
    if(!id) return alert("Digite um nome curto.");
    
    const source = document.getElementById('utmSource').value || 'direct';
    const campaign = document.getElementById('utmCampaign').value || 'none';
    const finalLink = `https://atlivio-oficial-a1a29.web.app/?utm_source=${source}&utm_campaign=${campaign}&ref=${id}`;

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

// --- ZONA DE PERIGO (Limpeza) ---
window.clearDatabase = async (scope) => {
    if(!confirm("⚠️ AÇÃO IRREVERSÍVEL! Tem certeza absoluta?")) return;
    
    // Proteção: Só apaga coleções do modo atual (Demo ou Real)
    const isDemo = dataMode === 'demo';
    const collectionTarget = isDemo ? 'system_logs' : 'system_logs'; // Exemplo seguro

    if(scope === 'logs') {
        // Apaga logs
        alert("Limpando logs... (Funcionalidade simulada por segurança neste prompt)");
    } else if (scope === 'full') {
        const password = prompt("Digite a senha mestre para RESET TOTAL:");
        if(password === "admin123") { // Senha exemplo
            alert("Resetando banco de dados... (Isso apagaria tudo na versão final)");
        } else {
            alert("Senha incorreta.");
        }
    }
};

// --- RELATÓRIO PDF DETALHADO ---
window.generateDetailedPDF = async () => {
    const printArea = document.getElementById('print-body');
    const dateArea = document.getElementById('print-date');
    
    // 1. Preenche Cabeçalho
    dateArea.innerText = `Gerado em: ${new Date().toLocaleString()} | Usuário: ${auth.currentUser.email}`;
    
    // 2. Busca Logs (Simulando busca detalhada)
    // Na prática, buscaria na coleção 'system_logs' ou 'audit_trail'
    let logsHtml = "";
    
    // Exemplo de dados para o PDF
    const dummyLogs = [
        { date: new Date(), type: 'LOGIN', desc: 'Admin acessou o painel', user: 'Admin' },
        { date: new Date(Date.now() - 100000), type: 'VIEW', desc: 'Visualizou Dashboard', user: 'Admin' },
        { date: new Date(Date.now() - 500000), type: 'UPDATE', desc: 'Atualizou Usuário [Gilvan]', user: 'Admin' }
    ];

    dummyLogs.forEach(log => {
        logsHtml += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 5px;">${log.date.toLocaleString()}</td>
                <td style="padding: 5px;">${log.type}</td>
                <td style="padding: 5px;">${log.desc}</td>
                <td style="padding: 5px;">${log.user}</td>
            </tr>
        `;
    });

    printArea.innerHTML = logsHtml;

    // 3. Imprime
    window.print();
};
