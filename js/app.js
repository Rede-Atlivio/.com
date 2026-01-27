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

// 1. Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// 2. EXPOSIÇÃO GLOBAL (Essencial para o Console e Scripts antigos)
window.app = app;
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

// 3. EXPORTAÇÃO (Para os Módulos Modernos - auth.js, jobs.js, etc)
export { app, auth, db, storage, provider };

console.log("🔥 Firebase (app.js) Iniciado com Sucesso!");
// REMOVIDO: Imports automáticos para evitar Dependência Circular.
// O index.html cuidará de carregar os módulos.
