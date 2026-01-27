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

// ============================================================================
// 🚨 O PULO DO GATO (MANTÉM TUDO FUNCIONANDO)
// ============================================================================

// 1. Para os ARQUIVOS NOVOS (Modules) importarem sem erro
export { app, auth, db, storage, provider };

// 2. Para o CONSOLE, AUDITOR e SCRIPTS ANTIGOS (Não removemos nada!)
window.app = app;
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

// ============================================================================
// 👇 CARREGAMENTO DOS MÓDULOS
// ============================================================================

import './auth.js';                 // Login e Perfil
import './modules/services.js';     // Serviços
import './modules/jobs.js';         // Vagas e Candidaturas
import './modules/opportunities.js';// Oportunidades (Onde tudo começou)
import './modules/chat.js';         // Chat

console.log("✅ Sistema Atlivio Carregado: Híbrido (Module + Global).");
