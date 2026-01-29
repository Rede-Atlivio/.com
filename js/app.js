import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ============================================================
// 1. CONFIGURAÇÃO (SUAS CHAVES REAIS)
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

console.log("🔥 Inicializando Firebase V18.2...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider(); // CORREÇÃO CRÍTICA: Instancia o provedor

// EXPORTAÇÃO GLOBAL (Vital para módulos Vanilla JS)
window.app = app;
window.db = db;
window.auth = auth;
window.storage = storage;
window.provider = provider;

// ============================================================
// 2. SISTEMA DE NOTIFICAÇÕES (TOASTS) - Item 33
// ============================================================
window.showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-xs px-4 pointer-events-none';
        document.body.appendChild(container);
    }

    const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-amber-500' };
    const colorClass = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.className = `${colorClass} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between animate-fadeIn transition-all duration-500 pointer-events-auto`;
    toast.innerHTML = `<span class="text-xs font-bold mr-2">${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.remove();
    }, 4000);
};

// ============================================================
// 3. BIG BROTHER (ANALYTICS) - Item 42
// ============================================================
window.logEvent = async (action, details = {}) => {
    try {
        const uid = auth.currentUser ? auth.currentUser.uid : 'anonimo';
        // Grava sem await para não travar a tela
        addDoc(collection(db, "system_events"), {
            action: action, details: details, uid: uid, timestamp: serverTimestamp()
        }).catch(err => console.warn("Log falhou", err));
    } catch (e) {}
};

// ============================================================
// 4. FUNÇÕES DE UI (LEGADO MANTIDO)
// ============================================================
window.toggleDisplay = (id, show) => {
    const el = document.getElementById(id);
    if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
};

window.switchTab = window.switchTab || function(tabName) {
    document.querySelectorAll('main > section').forEach(el => el.classList.add('hidden'));
    const alvo = document.getElementById(`sec-${tabName}`);
    if(alvo) alvo.classList.remove('hidden');
    
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-900', 'active');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-gray-400');
        activeBtn.classList.add('border-blue-600', 'text-blue-900', 'active');
    }
    
    // Hooks para carregar conteúdo ao trocar de aba
    if(tabName === 'servicos' && window.carregarPrestadores) window.carregarPrestadores();
    if(tabName === 'ganhar' && window.carregarCarteira) window.carregarCarteira();
};

window.addEventListener('error', (e) => console.error("🚨 Erro Global:", e.message));

console.log("✅ Sistema Atlivio Carregado (V18.2 Stable)");

export { app, db, auth, provider };
