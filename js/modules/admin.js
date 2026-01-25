import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuração (Mesma do app.js)
const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// ESTADO GLOBAL
let currentView = 'dashboard';
let dataMode = 'real'; // 'real' ou 'demo'
let liveListener = null;
let mainChart = null;

// --- 1. AUTENTICAÇÃO ---
document.getElementById('btn-login-admin').addEventListener('click', async () => {
    document.getElementById('loading-login').classList.remove('hidden');
    try {
        const result = await signInWithPopup(auth, provider);
        checkAdmin(result.user);
    } catch (e) {
        showError("Erro login: " + e.message);
    }
});

function checkAdmin(user) {
    if(user.email.toLowerCase().trim() === ADMIN_EMAIL) {
        document.getElementById('login-gate').classList.add('hidden');
        document.getElementById('admin-sidebar').classList.remove('hidden');
        document.getElementById('admin-main').classList.remove('hidden');
        initDashboard();
    } else {
        showError("ACESSO NEGADO. Este e-mail não é administrador.");
        signOut(auth);
    }
    document.getElementById('loading-login').classList.add('hidden');
}

onAuthStateChanged(auth, (user) => {
    if(user) checkAdmin(user);
});

window.logoutAdmin = () => signOut(auth).then(() => location.reload());

function showError(msg) {
    const el = document.getElementById('error-msg');
    el.innerText = msg;
    el.classList.remove('hidden');
}

// --- 2. NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    // UI Update
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Hide all views
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-list').classList.add('hidden');
    document.getElementById('view-finance').classList.add('hidden');

    // Title Update
    document.getElementById('page-title').innerText = viewName.toUpperCase();

    // Logic Switch
    if(viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        initDashboard();
    } else if(viewName === 'finance') {
        document.getElementById('view-finance').classList.remove('hidden');
        loadFinance();
    } else {
        document.getElementById('view-list').classList.remove('hidden');
        loadList(viewName);
    }
};

window.toggleDataMode = (mode) => {
    dataMode = mode;
    document.getElementById('btn-mode-real').className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white transition" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
    document.getElementById('btn-mode-demo').className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white transition" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
    
    // Reload current view
    if(currentView === 'dashboard') initDashboard();
    else if(currentView === 'finance') loadFinance();
    else loadList(currentView);
};

window.forceRefresh = () => {
    if(currentView === 'dashboard') initDashboard();
    else loadList(currentView);
};

// --- 3. DASHBOARD LOGIC ---
async function initDashboard() {
    // KPIs
    const collUsers = collection(db, "usuarios");
    const snapUsers = await getCountFromServer(collUsers);
    document.getElementById('kpi-users').innerText = snapUsers.data().count;

    const qProviders = query(collection(db, "active_providers"), where("is_online", "==", true));
    const snapProv = await getDocs(qProviders);
    document.getElementById('kpi-providers').innerText = snapProv.size;

    // Chart
    renderChart();

    // Live Feed
    if(liveListener) liveListener(); // Unsubscribe old
    const qFeed = query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(20));
    
    liveListener = onSnapshot(qFeed, (snap) => {
        const feed = document.getElementById('live-feed');
        feed.innerHTML = "";
        snap.forEach(d => {
            const log = d.data();
            const time = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            const color = log.type === 'DANGER' ? 'text-red-400' : 'text-blue-400';
            feed.innerHTML += `
                <div class="border-l-2 border-slate-700 pl-3 py-1 hover:bg-white/5 transition">
                    <p class="text-[10px] text-gray-500 font-bold">${time} // ${log.admin || 'System'}</p>
                    <p class="${color}">${log.action}</p>
                    <p class="text-gray-400 truncate">${log.details || ''}</p>
                </div>
            `;
        });
    });
}

function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(mainChart) mainChart.destroy();
    
    // Fake data for demo visual, replace with real Aggregation if needed
    mainChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Serviços', 'Tarefas', 'Produtos'],
            datasets: [{
                data: [55, 30, 15],
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } }
    });
}

// --- 4. LISTAS CRUD GENÉRICAS ---
async function loadList(type) {
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";

    let colName, fields, headers;
    let constraints = [];

    // Filtro Demo vs Real
    if (dataMode === 'demo') {
        constraints.push(where("is_demo", "==", true));
    } else {
        // Em modo real, mostramos tudo ou filtramos 'is_demo' == false se quiser limpar a vista
        // Por padrão, vamos mostrar tudo no Real para controle, mas destacar visualmente
    }

    if(type === 'users') {
        colName = "usuarios";
        headers = ["NOME/EMAIL", "TIPO", "SALDO", "STATUS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3">
                <div class="font-bold text-white">${d.displayName || 'Sem Nome'}</div>
                <div class="text-gray-500">${d.email}</div>
                ${d.is_demo ? '<span class="text-[9px] bg-amber-500/20 text-amber-500 px-1 rounded">DEMO</span>' : ''}
            </td>
            <td class="p-3">${d.is_provider ? '<span class="text-blue-400">Prestador</span>' : '<span class="text-green-400">Cliente</span>'}</td>
            <td class="p-3 font-mono">R$ ${(d.saldo || 0).toFixed(2)}</td>
            <td class="p-3">${d.is_blocked ? '<span class="text-red-500">BLOQUEADO</span>' : '<span class="text-green-500">ATIVO</span>'}</td>
            <td class="p-3 flex gap-2">
                <button onclick="editUser('${d.id}')" class="text-blue-400 hover:text-white"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="toggleBlock('${d.id}', ${d.is_blocked})" class="${d.is_blocked ? 'text-green-400' : 'text-red-400'}"><i data-lucide="${d.is_blocked ? 'unlock' : 'lock'}" size="14"></i></button>
            </td>
        `;
    } else if (type === 'services') {
        colName = "active_providers";
        headers = ["PRESTADOR", "SERVIÇOS", "STATUS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 flex items-center gap-2">
                <img src="${d.foto_perfil || 'https://ui-avatars.com/api/?name=X'}" class="w-8 h-8 rounded-full">
                <div>${d.nome_profissional}</div>
                ${d.is_seed ? '<span class="text-[9px] bg-amber-500/20 text-amber-500 px-1 rounded">DEMO</span>' : ''}
            </td>
            <td class="p-3 text-gray-400">${d.services ? d.services.map(s => s.category).join(', ') : '-'}</td>
            <td class="p-3">${d.is_online ? '<span class="text-green-400">ONLINE</span>' : '<span class="text-gray-500">OFFLINE</span>'}</td>
            <td class="p-3">
                <button onclick="deleteItem('active_providers', '${d.id}')" class="text-red-400 hover:text-white"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else if (type === 'missions') {
        colName = "missoes";
        headers = ["TÍTULO", "RECOMPENSA", "STATUS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3">
                <div class="font-bold text-white">${d.titulo}</div>
                <div class="text-[10px] text-gray-500">${d.descricao}</div>
            </td>
            <td class="p-3 text-green-400 font-bold">R$ ${d.recompensa}</td>
            <td class="p-3">${d.status}</td>
            <td class="p-3 flex gap-2">
                <button onclick="deleteItem('missoes', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else if (type === 'jobs') {
        colName = "jobs";
        headers = ["EMPRESA", "CARGO", "CANDIDATOS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3">${d.company_name}</td>
            <td class="p-3 font-bold text-white">${d.titulo}</td>
            <td class="p-3">${d.candidatos_count || 0}</td>
            <td class="p-3"><button onclick="deleteItem('jobs', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>
        `;
    } else if (type === 'links') {
        colName = "short_links";
        headers = ["SLUG (ID)", "DESTINO", "CLIQUES", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-mono text-blue-400">${d.id}</td>
            <td class="p-3 text-gray-500 truncate max-w-[150px]">${d.target}</td>
            <td class="p-3 font-bold text-white">${d.clicks || 0}</td>
            <td class="p-3"><button onclick="deleteItem('short_links', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button></td>
        `;
    }

    // Render Headers
    thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');

    // Fetch Data
    const q = query(collection(db, colName), ...constraints, limit(50));
    const snap = await getDocs(q);
    
    tbody.innerHTML = "";
    if(snap.empty) {
        tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Nenhum registro encontrado.</td></tr>";
    }

    snap.forEach(docSnap => {
        const d = { id: docSnap.id, ...docSnap.data() };
        tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`;
    });
    
    lucide.createIcons();

    // Configura botão NOVO
    document.getElementById('btn-add-new').onclick = () => openModalCreate(type);
}

// --- 5. EDITOR E MODAIS ---
window.openModalCreate = (type) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    modal.classList.remove('hidden');
    title.innerText = "NOVO " + type.slice(0, -1).toUpperCase(); // Remove 's' plural
    
    content.innerHTML = "";
    
    if(type === 'missions') {
        content.innerHTML = `
            <input type="text" id="inp-title" placeholder="Título da Missão" class="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs">
            <textarea id="inp-desc" placeholder="Descrição" class="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs"></textarea>
            <input type="number" id="inp-val" placeholder="Valor (Ex: 5.00)" class="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs">
            <label class="flex items-center gap-2 text-gray-400 text-xs"><input type="checkbox" id="inp-demo"> Marcar como DEMONSTRAÇÃO (Simulado)</label>
        `;
        window.saveCallback = async () => {
            await addDoc(collection(db, "missoes"), {
                titulo: document.getElementById('inp-title').value,
                descricao: document.getElementById('inp-desc').value,
                recompensa: document.getElementById('inp-val').value,
                status: 'aberto',
                tenant_id: 'atlivio_fsa_01',
                is_demo: document.getElementById('inp-demo').checked,
                created_at: serverTimestamp()
            });
        };
    } else if (type === 'links') {
        content.innerHTML = `
            <input type="text" id="inp-slug" placeholder="Slug (ex: promocao-natal)" class="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs">
            <input type="text" id="inp-target" placeholder="Link Destino (https://...)" class="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs">
        `;
        window.saveCallback = async () => {
            const slug = document.getElementById('inp-slug').value;
            await updateDoc(doc(db, "short_links", slug), { // Use updateDoc/setDoc logic here
                target: document.getElementById('inp-target').value,
                clicks: 0,
                created_at: serverTimestamp()
            }); // Note: should probably be setDoc for custom IDs
        };
    }
    // Adicionar outros tipos conforme necessidade
};

window.saveModalData = async () => {
    try {
        if(window.saveCallback) await window.saveCallback();
        alert("✅ Salvo com sucesso!");
        closeModal();
        forceRefresh();
        logAction("CREATE", `Criou item em ${currentView}`);
    } catch(e) {
        alert("Erro: " + e.message);
    }
};

window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');

// --- 6. AÇÕES DE ITENS ---
window.deleteItem = async (coll, id) => {
    if(!confirm("⚠️ Tem certeza? Isso não pode ser desfeito.")) return;
    try {
        await deleteDoc(doc(db, coll, id));
        forceRefresh();
        logAction("DELETE", `Apagou ${id} de ${coll}`);
    } catch(e) { alert(e.message); }
};

window.editUser = async (uid) => {
    const newBal = prompt("Novo Saldo (use ponto, ex: 10.50):");
    if(newBal) {
        try {
            await updateDoc(doc(db, "usuarios", uid), { saldo: parseFloat(newBal) });
            alert("Saldo Atualizado!");
            forceRefresh();
            logAction("FINANCE", `Alterou saldo de ${uid} para ${newBal}`);
        } catch(e) { alert("Erro de Permissão (Verifique Rules): " + e.message); }
    }
};

window.toggleBlock = async (uid, currentStatus) => {
    try {
        await updateDoc(doc(db, "usuarios", uid), { is_blocked: !currentStatus });
        forceRefresh();
    } catch(e) { alert(e.message); }
};

// --- 7. LOGS E AUDITORIA ---
async function logAction(action, details) {
    await addDoc(collection(db, "admin_logs"), {
        admin: auth.currentUser.email,
        action, details,
        timestamp: serverTimestamp(),
        type: action === 'DELETE' ? 'DANGER' : 'INFO'
    });
}

// Inicializa Ícones
lucide.createIcons();
