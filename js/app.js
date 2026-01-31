import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. CONFIGURAÇÃO (Sua chave oficial)
const firebaseConfig = { 
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", 
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com", 
    projectId: "atlivio-oficial-a1a29", 
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", 
    messagingSenderId: "887430049204", 
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1" 
};

// 2. INICIALIZAÇÃO
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // ✅ Storage criado corretamente
const provider = new GoogleAuthProvider();

// 3. EXPOSIÇÃO GLOBAL (Para HTML e Debug)
window.auth = auth;
window.db = db;
window.storage = storage; // ✅ Storage exposto
window.provider = provider;

// 4. EXPORTAÇÃO (Para módulos .js)
export { app, auth, db, storage, provider };

// ============================================================================
// 👇 CARREGAMENTO DOS MÓDULOS (O Cérebro do Site)
// ============================================================================

import './auth.js';                // Auth Core
import './modules/auth_sms.js';    // SMS & Máscara
import './modules/services.js';    // Marketplace de Serviços
import './modules/jobs.js';        // Vagas de Emprego & Upload PDF
import './modules/opportunities.js'; // Afiliados

// 🚨 ORDEM CRÍTICA DE CHAT 🚨
import './modules/chat.js';      // 1º: Base (Serviços)

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';

console.log("✅ App Carregado: Sistema Híbrido Online.");

// 5. MONITORAMENTO DE LOGIN
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário online:", user.uid);
        checkOnboarding(user); // Verifica nome e termos
        
        // Remove tela de login
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
    }
});

// Expõe menu de perfil
window.abrirConfiguracoes = abrirConfiguracoes;
