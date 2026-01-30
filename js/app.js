import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Configuração oficial Atlivio (SUAS CHAVES REAIS)
const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// Inicialização
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
window.firebaseApp = app;

// 🚨 AQUI ESTAVA O ERRO DE "SYNTAX ERROR": 
// Precisamos exportar essas variáveis explicitamente para os outros arquivos (wallet.js, services.js) usarem.
export { app, auth, db, storage, provider };

// ============================================================================
// 👇 CARREGAMENTO DOS MÓDULOS (O Cérebro do Site)
// ============================================================================

// Nota: Certifique-se que estes arquivos existem e estão na pasta certa
import './auth.js';                  
import './modules/services.js';      
import './modules/jobs.js';          
import './modules/opportunities.js'; 
import './modules/chat.js';          
// import './modules/wallet.js'; // O wallet geralmente é carregado sob demanda ou aqui, se der erro, descomente.

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js'; 

console.log("✅ Sistema Atlivio Carregado: App + Todos os Módulos.");

auth.onAuthStateChanged((user) => {
    if (user) {
        // Verifica se o checkOnboarding existe antes de chamar
        if (typeof checkOnboarding === 'function') {
            checkOnboarding(user); 
        }
    }
});

// EXPOR GLOBALMENTE PARA O BOTÃO FUNCIONAR
window.abrirConfiguracoes = abrirConfiguracoes;
