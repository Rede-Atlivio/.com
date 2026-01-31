import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURAÇÃO FIREBASE
const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// 2. EXPOR GLOBAIS
window.auth = auth;
window.db = db;
window.currentDataMode = 'real';
window.activeView = 'dashboard';

// ============================================================================
// 3. INICIALIZAÇÃO, LISTENERS E VACINA ANTI-TRAVAMENTO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Auth Listeners
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogin) btnLogin.addEventListener('click', loginAdmin);
    if(btnLogout) btnLogout.addEventListener('click', logoutAdmin);

    // Navegação Sidebar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const view = e.currentTarget.getAttribute('data-view');
            switchView(view);
        });
    });

    // Toggle Real/Demo
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');
    if(btnReal && btnDemo) {
        btnReal.addEventListener('click', () => setDataMode('real'));
        btnDemo.addEventListener('click', () => setDataMode('demo'));
    }

    // Refresh
    const btnRefresh = document.getElementById('btn-refresh');
    if(btnRefresh) btnRefresh.addEventListener('click', () => switchView(window.activeView));

    // --- 💉 VACINA UNIVERSAL (ANTI-TRAVAMENTO) ---
    // Isso garante que o modal feche e DESTRAVE a tela, não importa o que aconteça
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');

    window.fecharModalUniversal = () => {
        if(modal) modal.classList.add('hidden');
        if(content) {
            content.style.pointerEvents = 'auto'; // Destrava o mouse
            content.style.opacity = '1';          // Restaura a cor
            content.innerHTML = '';               // Limpa o lixo
        }
    };

    // 1. Clique no X (Funciona mesmo se o botão for recriado dinamicamente)
    document.addEventListener('click', (e) => {
        if(e.target.closest('#btn-close-modal')) {
            window.fecharModalUniversal();
        }
    });

    // 2. Clique Fora (No fundo preto)
    if(modal) {
        modal.addEventListener('click', (e) => {
            if(e.target === modal) window.fecharModalUniversal();
        });
    }

    // 3. Tecla ESC
    document.addEventListener('keydown', (e) => {
        if(e.key === "Escape") window.fecharModalUniversal();
    });
    // ----------------------------------------------

    // Monitor de Autenticação
    onAuthStateChanged(auth, (user) => {
        if (user && user.email.toLowerCase() === ADMIN_EMAIL) {
            unlockAdmin();
        } else {
            lockAdmin();
        }
    });
});

// ============================================================================
// 4. FUNÇÕES AUXILIARES
// ============================================================================
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
    switchView(window.activeView);
}

async function loginAdmin() { try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message); } }
function logoutAdmin() { signOut(auth).then(() => location.reload()); }

function unlockAdmin() {
    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('admin-sidebar').classList.remove('hidden');
    document.getElementById('admin-main').classList.remove('hidden');
    switchView('dashboard');
}

function lockAdmin() {
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('admin-sidebar').classList.add('hidden');
    document.getElementById('admin-main').classList.add('hidden');
}

// ============================================================================
// 5. ROTEADOR DE MÓDULOS (COMPLETO)
// ============================================================================
window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando módulo: ${viewName}`);
    
    // Esconde todas as views
    ['view-dashboard', 'view-list', 'view-finance', 'view-automation', 'view-settings', 'view-support', 'view-audit', 'view-tutorials'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    
    // Atualiza Título
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();

    let moduleFile, containerId;
    
    // --- MAPA DE ROTAS ---
    if (viewName === 'dashboard') { 
        moduleFile = './dashboard.js'; 
        containerId = 'view-dashboard'; 
    }
    else if (['users', 'services', 'active_providers'].includes(viewName)) { 
        moduleFile = './users.js'; 
        containerId = 'view-list'; 
    }
    else if (['jobs', 'vagas'].includes(viewName)) { 
        moduleFile = './jobs.js'; 
        containerId = 'view-list'; 
    }
    else if (viewName === 'missions') { 
        moduleFile = './missions.js'; 
        containerId = 'view-list'; 
    }
    else if (viewName === 'opportunities') { 
        moduleFile = './opportunities.js'; 
        containerId = 'view-list'; 
    }
    else if (viewName === 'automation') { 
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
    else if (viewName === 'tutorials') {
        moduleFile = './tutorials.js';
        containerId = 'view-tutorials';
    }

    // Mostra o container correto
    if(containerId) {
        const el = document.getElementById(containerId);
        if(el) el.classList.remove('hidden');
    }

    // Carrega o JS Dinamicamente
    if (moduleFile) {
        try {
            // Cache busting para evitar código velho
            const module = await import(`${moduleFile}?v=${Date.now()}`);
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.error(e);
            // alert(`Erro ao carregar ${viewName}: ${e.message}`); // Silenciado para não incomodar
        }
    }
};
