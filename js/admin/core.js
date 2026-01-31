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
// INICIALIZAÇÃO SEGURA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Listeners com verificação de existência (Para não travar se o botão não existir)
    const safeListener = (id, event, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, func);
    };

    safeListener('btn-login', 'click', loginAdmin);
    safeListener('btn-logout', 'click', logoutAdmin);
    safeListener('mode-real', 'click', () => setDataMode('real'));
    safeListener('mode-demo', 'click', () => setDataMode('demo'));
    safeListener('btn-refresh', 'click', () => switchView(window.activeView));

    // Navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            switchView(e.currentTarget.getAttribute('data-view'));
        });
    });

    // VACINA ANTI-TRAVAMENTO (MODAL)
    const fecharTudo = () => {
        const modal = document.getElementById('modal-editor');
        const content = document.getElementById('modal-content');
        if (modal) modal.classList.add('hidden');
        if (content) {
            content.style.pointerEvents = 'auto';
            content.style.opacity = '1';
            content.innerHTML = '';
        }
    };
    window.fecharModalUniversal = fecharTudo;

    document.addEventListener('click', (e) => {
        if(e.target.closest('#btn-close-modal') || e.target.id === 'modal-editor') fecharTudo();
    });
    document.addEventListener('keydown', (e) => { if(e.key === "Escape") fecharTudo(); });

    // Monitor Auth
    onAuthStateChanged(auth, (user) => {
        if (user && user.email.toLowerCase() === ADMIN_EMAIL) unlockAdmin();
        else lockAdmin();
    });
});

function setDataMode(mode) {
    window.currentDataMode = mode;
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');
    if (btnReal && btnDemo) {
        if (mode === 'real') {
            btnReal.className = "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-lg transition";
            btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
        } else {
            btnReal.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
            btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold bg-purple-600 text-white shadow-lg transition";
        }
    }
    switchView(window.activeView);
}

async function loginAdmin() { try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message); } }
function logoutAdmin() { signOut(auth).then(() => location.reload()); }

function unlockAdmin() {
    const ids = ['login-gate', 'admin-sidebar', 'admin-main'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'login-gate') el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });
    switchView('dashboard');
}

function lockAdmin() {
    const ids = ['login-gate', 'admin-sidebar', 'admin-main'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'login-gate') el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

// ============================================================================
// ROTEADOR BLINDADO (AQUI ESTAVA O ERRO DE TRAVAMENTO)
// ============================================================================
window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando: ${viewName}`);
    
    // LISTA DE TODAS AS VIEWS POSSÍVEIS
    const allViews = [
        'view-dashboard', 'view-list', 'view-finance', 'view-automation', 
        'view-settings', 'view-support', 'view-audit', 'view-tutorials',
        'view-missions', 'view-opportunities' // Novas views que causavam erro se faltassem
    ];

    // 1. ESCONDER TUDO (COM SEGURANÇA)
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden'); // SÓ ESCONDE SE EXISTIR! (Isso previne o erro null)
    });
    
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();

    let moduleFile, containerId;
    
    // 2. DEFINIR ROTA
    if (viewName === 'dashboard') { moduleFile = './dashboard.js'; containerId = 'view-dashboard'; }
    else if (['users', 'services'].includes(viewName)) { moduleFile = './users.js'; containerId = 'view-list'; }
    else if (['jobs', 'vagas'].includes(viewName)) { moduleFile = './jobs.js'; containerId = 'view-list'; }
    else if (viewName === 'missions') { moduleFile = './missions.js'; containerId = 'view-list'; }
    else if (viewName === 'opportunities') { moduleFile = './opportunities.js'; containerId = 'view-list'; }
    else if (viewName === 'automation') { moduleFile = './automation.js'; containerId = 'view-automation'; }
    else if (viewName === 'finance') { moduleFile = './finance.js'; containerId = 'view-finance'; }
    else if (viewName === 'settings') { moduleFile = './settings.js'; containerId = 'view-settings'; }
    else if (viewName === 'support') { moduleFile = './support.js'; containerId = 'view-support'; }
    else if (viewName === 'audit') { moduleFile = './audit.js'; containerId = 'view-audit'; }
    else if (viewName === 'tutorials') { moduleFile = './tutorials.js'; containerId = 'view-tutorials'; }

    // 3. MOSTRAR CONTAINER (COM SEGURANÇA)
    if(containerId) {
        const el = document.getElementById(containerId);
        if(el) {
            el.classList.remove('hidden');
        } else {
            console.error(`❌ ERRO FATAL: Container HTML '${containerId}' não encontrado! Verifique admin.html`);
            // Se o container não existe, tenta jogar na lista genérica para não ficar tela preta
            const fallback = document.getElementById('view-list');
            if(fallback) fallback.classList.remove('hidden');
        }
    }

    // 4. CARREGAR JS
    if (moduleFile) {
        try {
            const module = await import(`${moduleFile}?v=${Date.now()}`);
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.warn(`⚠️ Módulo ${viewName} falhou ou não existe: ${e.message}`);
        }
    }
};
