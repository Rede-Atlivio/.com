import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let currentView = 'dashboard';
let dataMode = 'real';
let currentEditId = null;
let currentEditColl = null;

// --- INICIALIZAR FUNÇÕES GLOBAIS ---
function initGlobalFunctions() {
    window.loginAdmin = loginAdmin;
    window.logoutAdmin = logoutAdmin;
    window.openUniversalEditor = openUniversalEditor;
    window.closeModal = closeModal;
    window.saveModalData = saveModalData;
    window.deleteItem = deleteItem;
    window.switchView = switchView;
    window.toggleDataMode = toggleDataMode;
    window.forceRefresh = forceRefresh;
    window.openModalCreate = openModalCreate;
}

// --- 1. LOGIN ROBUSTO (GLOBAL) ---
async function loginAdmin() {
    const loader = document.getElementById('loading-login');
    const errMsg = document.getElementById('error-msg');
    
    if (!loader || !errMsg) {
        console.error('Elementos de login não encontrados');
        return;
    }
    
    loader.classList.remove('hidden');
    errMsg.classList.add('hidden');
    
    try {
        const result = await signInWithPopup(auth, provider);
        checkAdmin(result.user);
    } catch (e) {
        console.error(e);
        loader.classList.add('hidden');
        errMsg.innerText = "Erro: " + e.message;
        errMsg.classList.remove('hidden');
    }
}

function logoutAdmin() {
    signOut(auth).then(() => location.reload());
}

function checkAdmin(user) {
    if(user.email.toLowerCase().trim() === ADMIN_EMAIL) {
        const loginGate = document.getElementById('login-gate');
        const adminSidebar = document.getElementById('admin-sidebar');
        const adminMain = document.getElementById('admin-main');
        
        if (loginGate) loginGate.classList.add('hidden');
        if (adminSidebar) adminSidebar.classList.remove('hidden');
        if (adminMain) adminMain.classList.remove('hidden');
        initDashboard();
    } else {
        alert("ACESSO NEGADO. Apenas Administrador.");
        signOut(auth);
    }
}

onAuthStateChanged(auth, (user) => { 
    if(user) checkAdmin(user); 
});

// --- 2. EDITOR UNIVERSAL (PODER TOTAL) ---
async function openUniversalEditor(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    if (!modal || !content || !title) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    currentEditId = id;
    currentEditColl = collectionName;
    
    modal.classList.remove('hidden');
    title.innerText = `EDITAR: ${collectionName.toUpperCase()}`;
    content.innerHTML = `<p class="text-center text-gray-500 animate-pulse">Carregando dados do banco...</p>`;

    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            content.innerHTML = `<p class="text-red-500">Documento não existe ou foi apagado.</p>`;
            return;
        }

        const data = docSnap.data();
        content.innerHTML = ""; 

        Object.keys(data).sort().forEach(key => {
            const val = data[key];
            if (key === 'created_at' || key === 'updated_at') return;

            let inputHtml = '';
            
            if (typeof val === 'boolean') {
                inputHtml = `
                    <div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                        <label class="inp-label">${key}</label>
                        <input type="checkbox" id="field-${key}" ${val ? 'checked' : ''} class="w-4 h-4 accent-blue-600">
                    </div>`;
            } else {
                let type = typeof val === 'number' ? 'number' : 'text';
                inputHtml = `
                    <div>
                        <label class="inp-label">${key}</label>
                        <input type="${type}" id="field-${key}" value="${val}" class="inp-editor">
                    </div>`;
            }
            content.innerHTML += inputHtml;
        });
        
        window.saveCallback = async () => {
            const updates = {};
            Object.keys(data).forEach(key => {
                if (key === 'created_at' || key === 'updated_at') return;
                const field = document.getElementById(`field-${key}`);
                if (field) {
                    if (field.type === 'checkbox') updates[key] = field.checked;
                    else if (field.type === 'number') updates[key] = parseFloat(field.value);
                    else updates[key] = field.value;
                }
            });
            updates.updated_at = serverTimestamp();
            await updateDoc(docRef, updates);
        };

    } catch (e) {
        content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`;
    }
}

// --- 3. CRUD LISTAS ---
async function loadList(type) {
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-header');
    
    if (!tbody || !thead) {
        console.error('Elementos da tabela não encontrados');
        return;
    }
    
    tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";

    let colName, headers, fields;
    let constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));

    if(type === 'users') {
        colName = "usuarios";
        headers = ["USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3">
                <div class="font-bold text-white">${d.displayName || 'Anon'}</div>
                <div class="text-gray-500">${d.email}</div>
            </td>
            <td class="p-3">${d.is_provider ? 'Prestador' : 'Cliente'}</td>
            <td class="p-3 font-mono text-green-400">R$ ${(d.saldo || 0).toFixed(2)}</td>
            <td class="p-3">${d.is_blocked ? '🔴' : '🟢'}</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('usuarios', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('usuarios', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else if (type === 'services') {
        colName = "active_providers";
        headers = ["NOME", "ONLINE", "DEMO?", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-bold text-white">${d.nome_profissional}</td>
            <td class="p-3">${d.is_online ? '🟢' : '⚪'}</td>
            <td class="p-3">${d.is_seed ? 'SIM' : '-'}</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('active_providers', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('active_providers', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else {
        colName = type; 
        headers = ["ID", "TÍTULO/DADOS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-mono text-xs text-gray-500">${d.id.substring(0,8)}...</td>
            <td class="p-3 font-bold text-white">${d.titulo || d.name || 'Sem título'}</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('${type}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('${type}', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    }

    thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');
    
    try {
        const q = query(collection(db, colName), ...constraints, limit(50));
        const snap = await getDocs(q);
        
        tbody.innerHTML = "";
        if(snap.empty) {
            tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Nenhum item encontrado.</td></tr>";
        } else {
            snap.forEach(docSnap => {
                const d = { id: docSnap.id, ...docSnap.data() };
                tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`;
            });
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`;
    }
    
    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) btnAddNew.onclick = () => openModalCreate(type);
}

// --- 4. FUNÇÕES GERAIS ---
function closeModal() {
    const modal = document.getElementById('modal-editor');
    if (modal) modal.classList.add('hidden');
}

async function saveModalData() {
    try {
        if(window.saveCallback) await window.saveCallback();
        alert("✅ Atualizado!");
        closeModal();
        forceRefresh();
    } catch(e) { 
        alert("Erro ao salvar: " + e.message); 
    }
}

async function deleteItem(coll, id) {
    if(!confirm("⚠️ Tem certeza? Essa ação é irreversível.")) return;
    try {
        await deleteDoc(doc(db, coll, id));
        forceRefresh();
    } catch(e) { 
        alert(e.message); 
    }
}

function switchView(viewName) {
    currentView = viewName;
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    ['view-dashboard', 'view-list', 'view-finance'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = viewName.toUpperCase();

    if(viewName === 'dashboard') {
        const viewDash = document.getElementById('view-dashboard');
        if (viewDash) viewDash.classList.remove('hidden');
        initDashboard();
    } else if(viewName === 'finance') {
        const viewFin = document.getElementById('view-finance');
        if (viewFin) viewFin.classList.remove('hidden');
    } else {
        const viewList = document.getElementById('view-list');
        if (viewList) viewList.classList.remove('hidden');
        loadList(viewName);
    }
}

function toggleDataMode(mode) {
    dataMode = mode;
    const btnModeReal = document.getElementById('btn-mode-real');
    const btnModeDemo = document.getElementById('btn-mode-demo');
    
    if (btnModeReal) {
        btnModeReal.className = mode === 'real' 
            ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" 
            : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    }
    if (btnModeDemo) {
        btnModeDemo.className = mode === 'demo' 
            ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" 
            : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    }
    forceRefresh();
}

function forceRefresh() {
    if(currentView === 'dashboard') initDashboard();
    else loadList(currentView);
}

function openModalCreate(type) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    
    if (!modal || !content || !modalTitle) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    modal.classList.remove('hidden');
    modalTitle.innerText = "NOVO ITEM";
    content.innerHTML = `<p class="text-center text-gray-400">Clique em SALVAR para criar um item em branco e depois edite para preencher.</p>`;
    
    window.saveCallback = async () => {
        let coll = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : type));
        await addDoc(collection(db, coll), {
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: dataMode === 'demo',
            titulo: 'Novo Item (Edite-me)',
            status: 'rascunho'
        });
    };
}

async function initDashboard() {
    try {
        const collUsers = collection(db, "usuarios");
        const snapUsers = await getCountFromServer(collUsers);
        const kpiUsers = document.getElementById('kpi-users');
        if (kpiUsers) kpiUsers.innerText = snapUsers.data().count;
    } catch(e) { 
        console.log("Dashboard init error", e); 
    }
}

// --- INICIALIZAR QUANDO DOCUMENT ESTIVER PRONTO ---
document.addEventListener('DOMContentLoaded', () => {
    initGlobalFunctions();
    console.log('✅ Admin Dashboard carregado com sucesso');
});

// Garantir que as funções estejam disponíveis globalmente
window.addEventListener('load', () => {
    initGlobalFunctions();
});
