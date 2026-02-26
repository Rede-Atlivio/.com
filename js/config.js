// ============================================================================
// ARQUIVO MESTRE DE CONFIGURAÇÃO (js/config.js)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 1. SUAS CHAVES DO FIREBASE
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
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

// 3. EXPOSIÇÃO GLOBAL
window.app = app; // <--- ADICIONE ESTA LINHA
window.auth = auth;
window.db = db;
window.storage = storage;

// 🚨 CORREÇÃO V35: Inclusão de INCREMENT para o Ad-Engine
import { 
    doc, getDoc, getDocs, collection, query, where, orderBy, limit, 
    updateDoc, addDoc, onSnapshot, serverTimestamp, runTransaction, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.firebaseModules = { 
    doc, getDoc, getDocs, collection, query, where, orderBy, limit, 
    updateDoc, addDoc, onSnapshot, serverTimestamp, runTransaction, 
    increment, arrayUnion // Adicionado arrayUnion para as Tags
};

// 4. EXPORTAÇÃO (Para os outros arquivos importarem daqui)
export { app, auth, db, storage, provider };
// Mata qualquer tentativa de arquivos antigos recriarem o radar antigo
window.SERVICOS_PADRAO = window.SERVICOS_PADRAO || [];
