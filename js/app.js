import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, updateDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
    authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
    projectId: "atlivio-oficial-a1a29",
    storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
    messagingSenderId: "887430049204",
    appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

export { app, db, auth, provider, storage };
window.db = db;
window.auth = auth;

// ============================================================================
// 📱 PWA INSTALLER (BOTÃO ROXO)
// ============================================================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install-app');
    if(btnInstall) {
        btnInstall.classList.remove('hidden');
        btnInstall.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                btnInstall.classList.add('hidden');
            }
        };
    }
});

// ============================================================================
// 🔔 CENTRAL DE NOTIFICAÇÕES (VISUAL CORRIGIDO)
// ============================================================================

// 1. Cria o Container com Z-INDEX EXTREMO (Igual ao teste que funcionou)
(function criarContainerNotificacoes() {
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        // Z-Index 99999 para ficar acima de tudo
        div.className = 'fixed top-5 right-5 z-[99999] space-y-3 max-w-sm w-full pointer-events-none'; 
        document.body.appendChild(div);
    }
})();

let unsubscribeNotifications = null;

// 2. Listener do Banco
auth.onAuthStateChanged((user) => {
    if (user) {
        iniciarOuvinteNotificacoes(user.uid);
    }
});

function iniciarOuvinteNotificacoes(uid) {
    if (unsubscribeNotifications) unsubscribeNotifications();

    const q = query(
        collection(db, "notifications"), 
        where("uid", "==", uid), 
        where("read", "==", false),
        orderBy("created_at", "desc"),
        limit(5)
    );

    unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const notif = change.doc.data();
                const agora = new Date();
                const dataNotif = notif.created_at ? notif.created_at.toDate() : new Date();
                const diffSegundos = (agora - dataNotif) / 1000;

                // Mostra se for recente (< 2 min) ou se não tiver data (criado agora)
                if (!notif.created_at || diffSegundos < 120) { 
                    mostrarToast(notif.message, change.doc.id, notif.type);
                }
            }
        });
    });
}

function mostrarToast(mensagem, docId, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    // Sons
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    if(tipo === 'money') audio.src = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'; 
    audio.play().catch(() => {}); 

    // Estilos Visuais (Baseados no teste de sucesso)
    let borderClass = "border-blue-500";
    let icon = "🔔";
    
    if (tipo === 'money') { borderClass = "border-emerald-500"; icon = "💰"; }
    if (tipo === 'alert') { borderClass = "border-red-500"; icon = "⚠️"; }
    if (tipo === 'success') { borderClass = "border-green-500"; icon = "✅"; }

    const toast = document.createElement('div');
    // Classes Tailwind para replicar o visual do teste
    toast.className = `bg-white border-l-4 ${borderClass} p-4 rounded shadow-2xl flex items-center gap-3 transform translate-x-full transition-all duration-500 pointer-events-auto cursor-pointer mb-2`;
    
    toast.innerHTML = `
        <div class="text-2xl">${icon}</div>
        <div class="flex-1">
            <p class="text-sm font-bold text-gray-800 leading-tight">${mensagem}</p>
            <p class="text-[10px] text-gray-400 mt-1">Toque para fechar</p>
        </div>
    `;

    toast.onclick = async () => {
        removeToast(toast);
        try { if(docId) await updateDoc(doc(db, "notifications", docId), { read: true }); } catch(e) {}
    };

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });

    setTimeout(() => { if(document.body.contains(toast)) removeToast(toast); }, 6000);
}

function removeToast(el) {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => el.remove(), 500);
}

console.log("🔥 App Core V8.0 (Visual Fix) Carregado.");
