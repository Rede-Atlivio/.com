import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

console.log("🔥 Inicializando Firebase...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// EXPORTAÇÃO GLOBAL (Vital para os módulos)
window.app = app;
window.db = db;
window.auth = auth;
window.storage = storage;

// ============================================================
// FUNÇÕES DE UI (RESTAURADAS PARA EVITAR QUEBRA)
// ============================================================

window.toggleDisplay = (id, show) => {
    const el = document.getElementById(id);
    if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
};

// Função genérica de troca de abas (Fallback se não houver no HTML)
window.switchTab = window.switchTab || function(tabName) {
    console.log("Navegando para:", tabName);
    document.querySelectorAll('main > section').forEach(el => el.classList.add('hidden'));
    const alvo = document.getElementById(`sec-${tabName}`);
    if(alvo) alvo.classList.remove('hidden');
    
    // Atualiza botões
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-900', 'active');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-gray-400');
        activeBtn.classList.add('border-blue-600', 'text-blue-900', 'active');
    }
};

window.addEventListener('error', (e) => console.error("🚨 Erro Global:", e.message));

console.log("✅ Sistema Atlivio Carregado (V16.5)");

export { app, db, auth };
var provider = null; 
export { provider };
