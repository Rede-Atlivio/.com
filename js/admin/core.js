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

// EXPOR PARA O CONSOLE (Para seus testes funcionarem)
window.auth = auth;
window.db = db;
window.core = {}; // Namespace para funções globais

// ESTADO GLOBAL
const state = {
    currentModule: null,
    currentUser: null
};

// ============================================================================
// 1. SISTEMA DE LOGIN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Listeners de Login/Logout
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');

    if(btnLogin) btnLogin.addEventListener('click', loginAdmin);
    if(btnLogout) btnLogout.addEventListener('click', logoutAdmin);

    // Listener de Navegação (Menu Lateral)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active de todos
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            // Adiciona ao clicado
            const target = e.currentTarget;
            target.classList.add('active');
            // Navega
            const view = target.getAttribute('data-view');
            switchView(view);
        });
    });

    // Monitorar Auth
    onAuthStateChanged(auth, (user) => {
        if (user && user.email.toLowerCase() === ADMIN_EMAIL) {
            state.currentUser = user;
            unlockAdmin();
        } else {
            lockAdmin();
        }
    });
});

async function loginAdmin() {
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        alert("Erro no login: " + e.message);
    }
}

function logoutAdmin() {
    signOut(auth).then(() => location.reload());
}

function unlockAdmin() {
    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('admin-sidebar').classList.remove('hidden');
    document.getElementById('admin-main').classList.remove('hidden');
    // Carrega Dashboard por padrão
    switchView('dashboard');
}

function lockAdmin() {
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('admin-sidebar').classList.add('hidden');
    document.getElementById('admin-main').classList.add('hidden');
}

// ============================================================================
// 2. ROTEADOR DE MÓDULOS (LOADER DINÂMICO)
// ============================================================================
window.switchView = async function(viewName) {
    console.log(`🔄 Navegando para: ${viewName}`);
    
    // 1. Esconde todas as views
    const containers = ['view-dashboard', 'view-list', 'view-finance', 'view-automation', 'view-settings'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // 2. Atualiza Título
    document.getElementById('page-title').innerText = viewName.toUpperCase();

    // 3. Carrega o Módulo Correspondente
    try {
        let moduleFile = '';
        let containerId = '';

        if (viewName === 'dashboard') {
            moduleFile = './dashboard.js';
            containerId = 'view-dashboard';
        } 
        else if (['users', 'services'].includes(viewName)) {
            moduleFile = './users.js';
            containerId = 'view-list';
        }
        else if (['jobs', 'candidatos', 'missions'].includes(viewName)) {
            moduleFile = './jobs.js';
            containerId = 'view-list';
        }
        else if (viewName === 'finance') {
            moduleFile = './finance.js';
            containerId = 'view-finance';
        }
        else if (viewName === 'automation' || viewName === 'opps') { // Opps agora é gerenciado pelo robo/automation
            moduleFile = './automation.js';
            containerId = 'view-automation';
        }
        else if (viewName === 'settings') {
            moduleFile = './settings.js';
            containerId = 'view-settings';
        }

        // Mostra o container
        if(containerId) document.getElementById(containerId).classList.remove('hidden');

        // Importação Dinâmica
        if (moduleFile) {
            const module = await import(moduleFile);
            if (module.init) {
                await module.init(viewName); // Inicia o módulo passando o contexto (ex: 'users' ou 'services')
            }
        }

    } catch (e) {
        console.error(`❌ Erro ao carregar módulo ${viewName}:`, e);
        // alert(`Erro ao carregar módulo: ${e.message}`);
    }
};
