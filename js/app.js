import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// Imports de auth.js removidos para evitar ciclo

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

window.app = app; window.auth = auth; window.db = db; window.storage = storage; window.provider = provider;

let sessionId = sessionStorage.getItem('atlivio_session');
if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('atlivio_session', sessionId); }

// --- SENSOR DE LINKS CORRIGIDO ---
(async function checkTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('trk');

    if (trackId) {
        console.log("📡 Link Detectado:", trackId);
        try {
            const linkRef = doc(db, "tracked_links", trackId);
            
            // 1. Incrementa contador ATÔMICO (garantido pelo Firebase)
            await updateDoc(linkRef, { 
                clicks: increment(1),
                last_click: serverTimestamp() 
            });
            console.log("✅ Contador incrementado");

            // 2. Busca dados para redirecionamento
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                const linkData = linkSnap.data();
                
                // 3. Loga evento
                await addDoc(collection(db, "system_events"), {
                    event: "TRAFFIC_SOURCE",
                    slug: trackId,
                    details: { source: linkData.source, target: linkData.target_tab },
                    session_id: sessionId,
                    timestamp: serverTimestamp(),
                    is_test: window.location.hostname.includes('localhost')
                });

                sessionStorage.setItem('target_tab', linkData.target_tab);
                
                // 4. Limpa URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        } catch (e) {
            console.error("Erro sensor:", e);
        }
    }
})();

// --- LOG GLOBAL ---
window.logEvent = async function(eventName, details = {}) {
    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "system_events"), {
            event: eventName,
            user_id: user ? user.uid : 'visitante',
            user_email: user ? user.email : 'anonimo',
            session_id: sessionId,
            source: details.source || "organic",
            details: details,
            timestamp: serverTimestamp(),
            is_test: window.location.hostname.includes('localhost')
        });
    } catch (e) { console.error("Log error:", e); }
};

export { app, auth, db, storage, provider };
