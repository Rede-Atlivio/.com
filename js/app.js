import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Configuração oficial Atlivio
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

export { app, auth, db, storage, provider };

// ============================================================================
// 👇 CARREGAMENTO DOS MÓDULOS (O Cérebro do Site)
// Aqui conectamos todas as funcionalidades novas que criamos
// ============================================================================

import './auth.js';                  // Gerencia Login, Perfil e Saldo Financeiro
import './modules/services.js';      // Lista de Prestadores e Serviços
import './modules/jobs.js';          // Vagas de Emprego
import './modules/opportunities.js'; // Robô de Ofertas e Afiliados
import './modules/chat.js';          // <--- NOVO: Chat, Pedidos e Segurança (Token)
import { checkOnboarding } from './modules/onboarding.js';

console.log("✅ Sistema Atlivio Carregado: App + Todos os Módulos.");
auth.onAuthStateChanged((user) => {
    if (user) {
        checkOnboarding(user); // <--- O GATILHO QUE LEVANTA O MURO
    }
});
