import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- CONFIGURAÇÃO OFICIAL (BLAZE) ---
const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// INICIALIZAÇÃO
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// EXPORTAÇÃO PARA OUTROS MÓDULOS
export { app, auth, db, storage, provider };

// --- SISTEMA DE ABAS (MAESTRO) ---
window.switchTab = (tab) => {
    // Lista de abas estáveis (sem produtos/loja para não travar)
    const abas = ['oportunidades', 'missoes', 'servicos', 'ganhar', 'admin', 'chat'];

    // Esconde todas
    abas.forEach(t => {
        const section = document.getElementById(`sec-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        
        if (section) section.classList.add('hidden');
        if (btn) {
            // Remove estilo ativo (cinza)
            btn.className = "flex-1 py-4 px-4 text-[10px] font-black border-b-2 border-transparent text-gray-400 hover:text-gray-600 uppercase italic transition-colors";
        }
    });

    // Mostra a escolhida
    const activeSec = document.getElementById(`sec-${tab}`);
    const activeBtn = document.getElementById(`tab-${tab}`);
    
    if (activeSec) activeSec.classList.remove('hidden');
    if (activeBtn) {
        // Adiciona estilo ativo (Azul)
        activeBtn.className = "flex-1 py-4 px-4 text-[10px] font-black border-b-2 border-blue-600 text-blue-600 uppercase italic transition-colors";
    }
};
