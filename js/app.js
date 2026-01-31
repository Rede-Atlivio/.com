import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. CONFIGURAÇÃO
const firebaseConfig = { 
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", 
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com", 
    projectId: "atlivio-oficial-a1a29", 
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", 
    messagingSenderId: "887430049204", 
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1" 
};

// 2. INICIALIZAÇÃO IMEDIATA
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

// 🚨 3. EXPORTAÇÕES CRÍTICAS (ANTES DE IMPORTAR MÓDULOS)
export { app, auth, db, storage, provider };

// Exposição Global
window.auth = auth;
window.db = db;
window.storage = storage;

// ============================================================================
// 4. CARREGAMENTO DOS MÓDULOS (Agora é seguro importar)
// ============================================================================
import './auth.js';
import './modules/auth_sms.js';
import './modules/services.js';
import './modules/jobs.js';
import './modules/opportunities.js';
import './modules/chat.js';
import './modules/reviews.js';

// Importa a carteira e extrai a função de monitoramento
import { iniciarMonitoramentoCarteira } from './modules/wallet.js';

import { checkOnboarding } from './modules/onboarding.js';
import { abrirConfiguracoes } from './modules/profile.js';
import { iniciarSistemaNotificacoes } from './modules/user_notifications.js';

window.abrirConfiguracoes = abrirConfiguracoes;

console.log("✅ App Carregado: Sistema Híbrido Online.");

// Inicia CRM
if(iniciarSistemaNotificacoes) iniciarSistemaNotificacoes(); 

// 5. MONITORAMENTO DE LOGIN (O CÉREBRO)
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário online:", user.uid);
        
        // Inicia sistemas dependentes de usuário
        checkOnboarding(user); 
        
        // ✅ AQUI é o lugar certo para iniciar a carteira
        if(iniciarMonitoramentoCarteira) iniciarMonitoramentoCarteira();
        
        const loginScreen = document.getElementById('auth-container');
        if(loginScreen) loginScreen.classList.add('hidden');
        
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('hidden');
    }
});
