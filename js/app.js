import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// Removemos imports cíclicos de auth.js aqui para evitar travamento na inicialização
// O auth.js importará app.js, e não o contrário.

const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// 1. INICIALIZAÇÃO
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// 2. EXPOSIÇÃO GLOBAL (CRÍTICO PARA O SITE FUNCIONAR)
window.app = app;
window.auth = auth;
window.db = db;
window.storage = storage;
window.provider = provider;

console.log("✅ App Base Inicializado. DB Conectado.");

// 3. GESTÃO DE SESSÃO
let sessionId = sessionStorage.getItem('atlivio_session');
if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('atlivio_session', sessionId);
}

// 4. SENSOR DE LINKS (Fábrica de Links)
(async function checkTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('trk');

    if (trackId) {
        console.log("📡 Link Detectado:", trackId);
        try {
            const linkRef = doc(db, "tracked_links", trackId);
            const linkSnap = await getDoc(linkRef);

            if (linkSnap.exists()) {
                const linkData = linkSnap.data();

                // Loga o tráfego
                await addDoc(collection(db, "system_events"), {
                    event: "TRAFFIC_SOURCE",
                    slug: trackId,
                    details: { source: linkData.source, target: linkData.target_tab },
                    session_id: sessionId,
                    timestamp: serverTimestamp(),
                    is_test: window.location.hostname.includes('localhost')
                });

                // Incrementa contador
                updateDoc(linkRef, { clicks: increment(1) }).catch(()=>{});

                // Salva intenção para redirecionar após login
                sessionStorage.setItem('target_tab', linkData.target_tab);
                
                // Limpa a URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        } catch (e) {
            console.error("Erro no sensor:", e);
        }
    }
})();

// 5. FUNÇÃO DE LOG (GLOBAL)
window.logEvent = async function(eventName, details = {}) {
    try {
        const user = auth.currentUser;
        // Tenta pegar o perfil do localStorage ou window se disponível, senão assume visitante
        // Para simplificar e evitar dependência circular, pegamos básico aqui.
        
        const context = {
            event: eventName,
            user_id: user ? user.uid : 'visitante',
            user_email: user ? user.email : 'anonimo',
            session_id: sessionId,
            source: details.source || "organic",
            details: details,
            timestamp: serverTimestamp(),
            is_test: window.location.hostname.includes('localhost')
        };

        await addDoc(collection(db, "system_events"), context);

        if (user) {
            const statsRef = doc(db, "usuarios", user.uid);
            updateDoc(statsRef, {
                "stats.events_count": increment(1),
                "stats.last_active": serverTimestamp()
            }).catch(() => {});
        }
    } catch (e) {
        console.error("Silent Log Error:", e);
    }
};

export { app, auth, db, storage, provider };
