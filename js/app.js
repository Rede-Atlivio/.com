import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { userProfile } from './auth.js'; // Importa perfil para saber se é prestador/cliente

const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// --- 1. GESTÃO DE SESSÃO ---
let sessionId = sessionStorage.getItem('atlivio_session');
if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('atlivio_session', sessionId);
}

// --- 2. LOG DE INTELIGÊNCIA (Enriquecido) ---
export async function logEvent(eventName, details = {}) {
    try {
        const user = auth.currentUser;
        
        // Contexto Automático
        const context = {
            event: eventName,
            user_id: user ? user.uid : 'anonimo',
            user_email: user ? user.email : 'anonimo',
            profile_type: userProfile ? (userProfile.is_provider ? 'prestador' : 'cliente') : 'visitante',
            session_id: sessionId,
            screen: document.querySelector('.active')?.innerText || 'home', // Tenta pegar aba ativa
            source: details.source || "organic",
            details: details,
            timestamp: serverTimestamp(),
            is_test: window.location.hostname.includes('localhost')
        };

        // 1. Salva o Evento no Log Geral
        await addDoc(collection(db, "system_events"), context);

        // 2. Incrementa Estatísticas do Usuário (Se logado)
        if (user) {
            const statsRef = doc(db, "usuarios", user.uid);
            // Atualiza estatísticas sem sobrescrever o doc
            updateDoc(statsRef, {
                "stats.events_count": increment(1),
                "stats.last_active": serverTimestamp()
            }).catch(() => {}); // Ignora erro se doc não existir ainda
        }

    } catch (e) {
        console.error("Silent Log Error:", e);
    }
}

// Exposição Global
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;
window.logEvent = logEvent;

export { app, auth, db, storage, provider };
