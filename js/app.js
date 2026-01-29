// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// CONFIGURAÇÃO DO FIREBASE (Sua config original)
const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// INICIALIZAÇÃO
console.log("🔥 Inicializando Firebase Core...");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// EXPORTAÇÃO GLOBAL (CRUCIAL PARA OS MÓDULOS FUNCIONAREM)
// Isso permite que onboarding.js, auth.js e outros acessem o banco sem importar tudo de novo
window.app = app;
window.db = db;
window.auth = auth;
window.storage = storage;

// Prevenção de Cache agressivo em desenvolvimento
if (window.location.hostname === "localhost" || window.location.hostname.includes("127.0.0.1")) {
    console.log("🔧 Modo Dev: Cache desativado.");
}

// Listener Global de Erros (Para capturar falhas silenciosas)
window.addEventListener('error', function(event) {
    console.error("🚨 Erro Global Detectado:", event.message, "em", event.filename, ":", event.lineno);
});

console.log("✅ Sistema Atlivio Carregado: App + Core.");

export { app, db, auth, provider }; // Provider pode ser null se não usado no Google, mantido para compatibilidade
var provider = null; // Placeholder se não usar Google AuthProvider aqui
