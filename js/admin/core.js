import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

window.auth = auth;
window.db = db;
window.currentDataMode = 'real';
window.activeView = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    if(btnLogin) btnLogin.addEventListener('click', loginAdmin);
    if(btnLogout) btnLogout.addEventListener('click', logoutAdmin);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const view = e.currentTarget.getAttribute('data-view');
            switchView(view);
        });
    });

    // Real vs Demo
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');
    if(btnReal && btnDemo) {
        btnReal.onclick = () => setDataMode('real');
        btnDemo.onclick = () => setDataMode('demo');
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if(btnRefresh) btnRefresh.addEventListener('click', () => switchView(window.activeView));

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
    if(mode === 'real') {
        btnReal.classList.replace('text-gray-400', 'bg-emerald-600'); btnReal.classList.add('text-white');
        btnDemo.classList.replace('bg-purple-600', 'text-gray-400'); btnDemo.classList.remove('text-white');
    } else {
        btnDemo.classList.replace('text-gray-400', 'bg-purple-600'); btnDemo.classList.add('text-white');
        btnReal.classList.replace('bg-emerald-600', 'text-gray-400'); btnReal.classList.remove('text-white');
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

window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando: ${viewName}`);
    
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();

    let moduleFile, containerId;
    
    // MAPEAMENTO DE ROTAS
    if (viewName === 'dashboard') { moduleFile = './dashboard.js'; containerId = 'view-dashboard'; }
    else if (['users', 'services'].includes(viewName)) { moduleFile = './users.js'; containerId = 'view-list'; }
    else if (['jobs', 'vagas'].includes(viewName)) { moduleFile = './jobs.js'; containerId = 'view-list'; }
    else if (viewName === 'missions') { moduleFile = './missions.js'; containerId = 'view-list'; } // Nova Rota
    else if (viewName === 'automation') { moduleFile = './automation.js'; containerId = 'view-automation'; }
    else if (viewName === 'finance') { moduleFile = './finance.js'; containerId = 'view-finance'; }
    else if (viewName === 'settings') { moduleFile = './settings.js'; containerId = 'view-settings'; }
    else if (viewName === 'support') { moduleFile = './support.js'; containerId = 'view-support'; }
    else if (viewName === 'audit') { moduleFile = './audit.js'; containerId = 'view-audit'; }
    else if (viewName === 'tutorials') { moduleFile = './tutorials.js'; containerId = 'view-tutorials'; }

    if(containerId) document.getElementById(containerId).classList.remove('hidden');

    if (moduleFile) {
        try {
            const module = await import(`${moduleFile}?v=${Date.now()}`); // Cache Buster
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.error(e);
            alert(`Erro no módulo ${viewName}: ${e.message}`);
        }
    }
};
