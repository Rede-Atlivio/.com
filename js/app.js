import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { userProfile } from './auth.js'; 

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

// --- 1. SESSÃO (Gerar ID para visitantes) ---
let sessionId = sessionStorage.getItem('atlivio_session');
if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('atlivio_session', sessionId);
}

// --- 2. SENSOR DE LINKS (Rastreio) ---
(async function checkTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('trk');

    if (trackId) {
        console.log("📡 Link Detectado:", trackId);
        // Salva intenção de navegação
        try {
            const linkRef = doc(db, "tracked_links", trackId);
            const linkSnap = await getDoc(linkRef);
            
            if(linkSnap.exists()) {
                const data = linkSnap.data();
                sessionStorage.setItem('target_tab', data.target_tab);
                logEvent("TRAFFIC_SOURCE", { slug: trackId, source: data.source });
                updateDoc(linkRef, { clicks: increment(1) }).catch(()=>{});
            }
        } catch(e) { console.error(e); }
        
        // Limpa URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
})();

// --- 3. FUNÇÃO DE LOG (O CORAÇÃO DO RASTREIO) ---
export async function logEvent(eventName, details = {}) {
    const user = auth.currentUser;
    const isTest = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

    const payload = {
        event: eventName,
        user_id: user ? user.uid : 'visitante',
        user_email: user ? user.email : 'anonimo',
        profile_type: userProfile ? (userProfile.is_provider ? 'prestador' : 'cliente') : 'visitante',
        session_id: sessionId,
        source: details.source || "organic",
        details: details,
        is_test: isTest, // MODO TESTE AUTOMÁTICO
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "system_events"), payload);
        console.log(`📡 Evento Enviado: ${eventName}`, payload);
    } catch (e) {
        console.error("❌ Erro ao logar evento:", e);
    }
}

// Exposição Global
window.auth = auth;
window.db = db;
window.logEvent = logEvent;

export { app, auth, db, storage, provider };
