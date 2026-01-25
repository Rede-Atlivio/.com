import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let liveListener = null;
let mainChart = null;
let currentEditId = null;
let currentEditColl = null;

// --- 1. LOGIN ROBUSTO (GLOBAL) ---
window.loginAdmin = async () => {
    const loader = document.getElementById('loading-login');
    loader.classList.remove('hidden');
    try {
        const result = await signInWithPopup(auth, provider);
        checkAdmin(result.user);
    } catch (e) {
        alert("Erro no Login: " + e.message);
        console.error(e);
        loader.classList.add('hidden');
    }
};

window.logoutAdmin = () => signOut(auth).then(() => location.reload());

function checkAdmin(user) {
    if(user.email.toLowerCase().trim() === ADMIN_EMAIL) {
        document.getElementById('login-gate').classList.add('hidden');
        document.getElementById('admin-sidebar').classList.remove('hidden');
        document.getElementById('admin-main').classList.remove('hidden');
        initDashboard();
    } else {
        alert("ACESSO NEGADO. E-mail não autorizado.");
        signOut(auth);
    }
}

onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });

// --- 2. EDITOR UNIVERSAL (A MÁGICA) ---
window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    currentEditId = id;
    currentEditColl = collectionName;
    
    modal.classList.remove('hidden');
    title.innerText = `EDITAR: ${collectionName.toUpperCase()}`;
    content.innerHTML = `<p class="text-center text-gray-500">Carregando dados...</p>`;

    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            content.innerHTML = `<p class="text-red-500">Documento não encontrado.</p>`;
            return;
        }

        const data = docSnap.data();
        content.innerHTML = ""; // Limpa loading

        // Gera inputs dinamicamente baseado nos dados
        Object.keys(data).sort().forEach(key => {
            const val = data[key];
            let inputType = "text";
            let displayVal = val;
            
            // Ignora campos de sistema complexos ou timestamp
            if (key === 'created_at' || key === 'updated_at') return;

            if (typeof val === 'number') inputType = "number";
            if (typeof val === 'boolean') {
                // Checkbox para booleanos
                content.innerHTML += `
                    <div class="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                        <label class="text-[10px] text-gray-400 uppercase font-bold">${key}</label>
                        <input type="checkbox" id="field-${key}" ${val ? 'checked' : ''} class="w-4 h-4 accent-blue-600">
                    </div>
                `;
            } else {
                // Inputs normais
                content.innerHTML += `
                    <div>
                        <label class="text-[10px] text-gray-400 uppercase font-bold block mb-1">${key}</label>
                        <input type="${inputType}" id="field-${key}" value="${displayVal}" class="inp-editor" ${key==='id'?'disabled':''}>
                    </div>
                `;
            }
        });
        
        // Define o callback de salvamento para usar esses inputs
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
            await updateDoc(docRef, updates);
        };

    } catch (e) {
        content.innerHTML = `<p class="text-red-500">Erro ao carregar: ${e.message}</p>`;
    }
};

// --- 3. LISTAS (Atualizadas para usar o Editor) ---
async function loadList(type) {
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";

    let colName, headers, fields;
    let constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));

    // Definição das colunas
    if(type === 'users') {
        colName = "usuarios";
        headers = ["USUÁRIO", "TIPO", "SALDO", "STATUS", "EDITAR"];
        fields = (d) => `
            <td class="p-3">
                <div class="font-bold text-white">${d.displayName || 'Sem Nome'}</div>
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
        headers = ["NOME", "ONLINE?", "SERVIÇOS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-bold text-white">${d.nome_profissional}</td>
            <td class="p-3">${d.is_online ? '🟢 Sim' : '🔴 Não'}</td>
            <td class="p-3 text-gray-500 text-xs">${d.services ? d.services.length : 0} ativos</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('active_providers', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('active_providers', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else if (type === 'missions') {
        colName = "missoes";
        headers = ["TÍTULO", "VALOR", "STATUS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-bold text-white">${d.titulo}</td>
            <td class="p-3 text-green-400">R$ ${d.recompensa}</td>
            <td class="p-3 uppercase text-[10px]">${d.status}</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('missoes', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('missoes', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    } else {
        // Fallback genérico para outras abas
        colName = type; 
        headers = ["ID", "DADOS", "AÇÕES"];
        fields = (d) => `
            <td class="p-3 font-mono text-xs">${d.id}</td>
            <td class="p-3 text-gray-500">...</td>
            <td class="p-3 flex gap-2">
                <button onclick="openUniversalEditor('${type}', '${d.id}')" class="text-blue-400"><i data-lucide="edit-2" size="14"></i></button>
                <button onclick="deleteItem('${type}', '${d.id}')" class="text-red-400"><i data-lucide="trash" size="14"></i></button>
            </td>
        `;
    }

    // Render
    thead.innerHTML = headers.map(h => `<th class="p-3">${h}</th>`).join('');
    
    try {
        const q = query(collection(db, colName), ...constraints, limit(50));
        const snap = await getDocs(q);
        
        tbody.innerHTML = "";
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='5' class='p-4 text-center text-gray-500'>Vazio.</td></tr>";
        
        snap.forEach(docSnap => {
            const d = { id: docSnap.id, ...docSnap.data() };
            tbody.innerHTML += `<tr class="table-row border-b border-white/5">${fields(d)}</tr>`;
        });
        lucide.createIcons();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan='5' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`;
    }
    
    // Configura botão Novo
    document.getElementById('btn-add-new').onclick = () => openModalCreate(type);
}

// --- 4. MODAL GENÉRICO ---
window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');

window.saveModalData = async () => {
    try {
        if(window.saveCallback) await window.saveCallback();
        alert("✅ Salvo!");
        closeModal();
        forceRefresh();
    } catch(e) { alert("Erro: " + e.message); }
};

window.deleteItem = async (coll, id) => {
    if(!confirm("Apagar item?")) return;
    try {
        await deleteDoc(doc(db, coll, id));
        forceRefresh();
    } catch(e) { alert(e.message); }
};

// --- 5. DASHBOARD & UTILS ---
window.switchView = (viewName) => {
    currentView = viewName;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-list').classList.add('hidden');
    document.getElementById('view-finance').classList.add('hidden');
    document.getElementById('page-title').innerText = viewName.toUpperCase();

    if(viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        initDashboard();
    } else if(viewName === 'finance') {
        document.getElementById('view-finance').classList.remove('hidden');
    } else {
        document.getElementById('view-list').classList.remove('hidden');
        loadList(viewName);
    }
};

window.toggleDataMode = (mode) => {
    dataMode = mode;
    document.getElementById('btn-mode-real').className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    document.getElementById('btn-mode-demo').className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    forceRefresh();
};

window.forceRefresh = () => {
    if(currentView === 'dashboard') initDashboard();
    else loadList(currentView);
};

// CRIAÇÃO SIMPLES (Mantido do anterior para criar Demo)
window.openModalCreate = (type) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = "NOVO ITEM";
    
    // Simplificado: Cria com dados padrão e manda editar depois
    content.innerHTML = `<p class="text-center text-gray-400">Clique em SALVAR para criar um item em branco e depois edite.</p>`;
    
    window.saveCallback = async () => {
        let coll = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : type));
        await addDoc(collection(db, coll), {
            created_at: serverTimestamp(),
            is_demo: dataMode === 'demo',
            status: 'rascunho',
            titulo: 'Novo Item'
        });
    };
};

async function initDashboard() {
    const collUsers = collection(db, "usuarios");
    const snapUsers = await getCountFromServer(collUsers);
    document.getElementById('kpi-users').innerText = snapUsers.data().count;
    // (Restante do dash igual ao anterior)
}
