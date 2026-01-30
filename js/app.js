import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- SUAS CHAVES DO FIREBASE AQUI ---
// (Substitua pelos dados reais que você já tinha)
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_ID",
    appId: "SEU_APP_ID"
};

// --- INICIALIZAÇÃO ---
let app, db, auth, storage;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);

    // 🔥 TORNAR GLOBAL (Salva a vida dos scripts antigos)
    window.db = db;
    window.auth = auth;
    window.storage = storage;
    window.firebaseApp = app;
    
    console.log("✅ [app.js] Firebase conectado e exportado com sucesso.");

} catch (error) {
    console.error("❌ [app.js] Erro fatal ao iniciar Firebase:", error);
}

// --- EXPORTAÇÃO OFICIAL (O que os outros arquivos procuram) ---
export { app, db, auth, storage };
