import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- IMPORTAÇÃO CRÍTICA: MÓDULO DE SERVIÇOS ---
// Isso garante que a lógica de serviços e perfil carregue junto com o site
import { inicializarModuloServicos } from './modules/services.js';

// Configuração oficial Atlivio
const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// EXPOSIÇÃO GLOBAL (Obrigatório para os scripts de teste e console funcionarem)
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

// --- INICIALIZAÇÃO AUTOMÁTICA DO SISTEMA ---
window.addEventListener('load', () => {
    console.log("🚀 App Carregado. Iniciando módulos...");
    
    // Chama o módulo que preenche o perfil e as categorias
    if(typeof inicializarModuloServicos === 'function') {
        inicializarModuloServicos();
    } else {
        console.warn("⚠️ Aviso: Módulo de serviços não carregou a tempo.");
    }
});

export { app, auth, db, storage, provider };
