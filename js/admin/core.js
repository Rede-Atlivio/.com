import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// EXPOR GLOBAIS
window.auth = auth;
window.db = db;
window.currentDataMode = 'real';
window.activeView = 'dashboard';

// ============================================================================
// 1. INICIALIZAÇÃO E AUTH
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth Listeners
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogin) btnLogin.addEventListener('click', loginAdmin);
    if(btnLogout) btnLogout.addEventListener('click', logoutAdmin);

    // Navegação (Garante que o clique funcione)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const view = e.currentTarget.getAttribute('data-view');
            switchView(view);
        });
    });

    // MODO DE DADOS (REAL vs DEMO)
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');

    if(btnReal && btnDemo) {
        btnReal.addEventListener('click', () => setDataMode('real'));
        btnDemo.addEventListener('click', () => setDataMode('demo'));
    }

    // Refresh
    const btnRefresh = document.getElementById('btn-refresh');
    if(btnRefresh) btnRefresh.addEventListener('click', () => switchView(window.activeView));

    // Monitor Auth
    onAuthStateChanged(auth, (user) => {
        if (user && user.email.toLowerCase() === ADMIN_EMAIL) {
            unlockAdmin();
        } else {
            lockAdmin();
        }
    });
});

function setDataMode(mode) {
    window.currentDataMode = mode;
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');

    if (mode === 'real') {
        btnReal.className = "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white transition shadow-lg";
        btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
    } else {
        btnReal.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
        btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold bg-purple-600 text-white transition shadow-lg";
    }
    
    console.log(`🔄 Modo alterado para: ${mode.toUpperCase()}`);
    switchView(window.activeView);
}

async function loginAdmin() { try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message); } }
function logoutAdmin() { signOut(auth).then(() => location.reload()); }

function unlockAdmin() {
    const gate = document.getElementById('login-gate');
    const side = document.getElementById('admin-sidebar');
    const main = document.getElementById('admin-main');
    
    if(gate) gate.classList.add('hidden');
    if(side) side.classList.remove('hidden');
    if(main) main.classList.remove('hidden');
    
    switchView('dashboard');
}

function lockAdmin() {
    const gate = document.getElementById('login-gate');
    const side = document.getElementById('admin-sidebar');
    const main = document.getElementById('admin-main');

    if(gate) gate.classList.remove('hidden');
    if(side) side.classList.add('hidden');
    if(main) main.classList.add('hidden');
}

// ============================================================================
// 2. ROTEADOR DE MÓDULOS (CORRIGIDO)
// ============================================================================
window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando módulo: ${viewName}`);
    
    // UI Cleanup
    ['view-dashboard', 'view-list', 'view-finance', 'view-automation', 'view-settings', 'view-support', 'view-audit'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();

    // Mapeamento
    let moduleFile, containerId;
    
    if (viewName === 'dashboard') { 
        moduleFile = './dashboard.js'; 
        containerId = 'view-dashboard'; 
    }
    // ✅ ROTA CORRIGIDA PARA USUÁRIOS E SERVIÇOS
    else if (['users', 'services', 'active_providers'].includes(viewName)) { 
        // Importante: Como core.js está em /js/admin/, o users.js (vizinho) é ./users.js
        moduleFile = './users.js'; 
        containerId = 'view-list'; 
    }
    else if (['jobs', 'candidatos', 'missions', 'opps'].includes(viewName)) {
        moduleFile = './jobs.js';
        containerId = 'view-list';
    }
    else if (['automation'].includes(viewName)) { 
        moduleFile = './automation.js'; 
        containerId = 'view-automation'; 
    }
    else if (viewName === 'finance') { 
        moduleFile = './finance.js'; 
        containerId = 'view-finance'; 
    }
    else if (viewName === 'settings') { 
        moduleFile = './settings.js'; 
        containerId = 'view-settings'; 
    }
    else if (viewName === 'support') {
        moduleFile = './support.js';
        containerId = 'view-support';
    }
    else if (viewName === 'audit') {
        moduleFile = './audit.js';
        containerId = 'view-audit';
    }

    if(containerId) {
        const el = document.getElementById(containerId);
        if(el) el.classList.remove('hidden');
    }

    if (moduleFile) {
        try {
            // Cache busting
            const module = await import(`${moduleFile}?v=${Date.now()}`);
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.error(e);
            // alert(`Erro ao carregar ${viewName}: ${e.message}`); // Comentado para não travar se faltar arquivo
        }
    }
};
