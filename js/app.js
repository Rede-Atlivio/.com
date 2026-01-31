import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Configuração
const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };

// 1. INICIALIZAÇÃO (Cria as ferramentas)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // <--- AGORA SIM, CRIAMOS O STORAGE
const provider = new GoogleAuthProvider();

// 2. EXPOSIÇÃO GLOBAL (Para o HTML e Robôs verem)
window.auth = auth;
window.db = db;
window.storage = storage; // <--- Agora funciona porque 'storage' existe
window.provider = provider;

// 3. EXPORTAÇÃO (Para os arquivos .js verem)
export { app, auth, db, storage, provider };

// CARREGAMENTO DOS MÓDULOS
import './auth.js';                
import './modules/auth_sms.js';    
import './modules/services.js';     
import './modules/jobs.js';         
import './modules/opportunities.js'; 

// 🚨 ORDEM CRÍTICA AQUI 👇
import './modules/chat.js';      // 1º: Carrega o sistema base de chat (Serviços)
import './modules/job_chat.js';  // 2º: Carrega o plugin de Vagas (que se conecta ao base)

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';

console.log("✅ App Carregado com Storage.");

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário detectado:", user.uid);
        checkOnboarding(user);
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
    }
});

window.abrirConfiguracoes = abrirConfiguracoes;
