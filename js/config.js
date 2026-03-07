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

// 🛡️ VERSÃO FINAL MAESTRO: Centralização de módulos e Motor de Escala (Contagem e Massa)
import { 
    doc, getDoc, getDocs, collection, query, where, orderBy, limit, 
    updateDoc, addDoc, onSnapshot, serverTimestamp, runTransaction, 
    increment, arrayUnion, writeBatch,
    getCountFromServer // 📊 Necessário para contar milhões de usuários sem custo alto
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Exposição Global para os Robôs de Teste e Automação
window.firebaseModules = { 
    doc, getDoc, getDocs, collection, query, where, orderBy, limit, 
    updateDoc, addDoc, onSnapshot, serverTimestamp, runTransaction, 
    increment, arrayUnion, writeBatch,
    getCountFromServer // 🚀 Habilita o Robô de Estresse
};

// 4. EXPORTAÇÃO (Para os outros arquivos importarem daqui)
export { app, auth, db, storage, provider };
// Mata qualquer tentativa de arquivos antigos recriarem o radar antigo
window.SERVICOS_PADRAO = window.SERVICOS_PADRAO || [];
// 🔑 CHAVE MESTRA PUSH (VAPID) V27: Chave real gerada no Console Firebase para autorizar notificações externas
export const VAPID_KEY = "BCw5YpjLvlm9UPEJOQNGocnpXdllamtPomsgoxVBbSlw68tu32THnvt6daIVsg8hBUtjS4pPn2FrxBXtN9-Ebv8";
