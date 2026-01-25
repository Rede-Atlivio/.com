import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// EXPOSIÇÃO GLOBAL
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

// --- NOVO: SISTEMA DE RASTREAMENTO (INTEGRAÇÃO ADMIN) ---
export async function logEvent(eventName, details = {}) {
    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "system_events"), {
            event: eventName, // Ex: 'LOGIN', 'SOLICITOU_SERVICO'
            user_id: user ? user.uid : 'anonimo',
            user_email: user ? user.email : 'anonimo',
            details: details, // Objeto com dados extras (valor, categoria, etc)
            timestamp: serverTimestamp(),
            is_test: window.location.hostname.includes('localhost') // Marca se é teste local
        });
        console.log(`📡 Evento Registrado: ${eventName}`);
    } catch (e) {
        console.error("Erro ao logar evento:", e);
    }
}
window.logEvent = logEvent; // Expõe para usar no HTML se precisar

export { app, auth, db, storage, provider };
