import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Configuração
const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// EXPOSIÇÃO GLOBAL
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

export { app, auth, db, storage, provider };

// CARREGAMENTO DOS MÓDULOS
import './auth.js';                // Google Login e Lógica de Perfil
import './modules/auth_sms.js';    // <--- ADICIONADO: Lógica de SMS e Máscara
import './modules/services.js';     
import './modules/jobs.js';         
import './modules/opportunities.js'; 
import './modules/chat.js';         
import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';

console.log("✅ App Carregado.");

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário detectado:", user.uid);
        checkOnboarding(user);
        
        // Esconde tela de login se estiver visível
        const loginScreen = document.getElementById('login-screen'); // Ajuste o ID se for diferente
        if(loginScreen) loginScreen.classList.add('hidden');
    }
});

window.abrirConfiguracoes = abrirConfiguracoes;
