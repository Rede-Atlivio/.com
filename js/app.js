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

// Exportações Globais
export { app, db, auth, provider, storage };
window.db = db;
window.auth = auth;

// ============================================================================
// 🔔 CENTRAL DE NOTIFICAÇÕES (ITEM 33)
// ============================================================================
let unsubscribeNotifications = null;

// Inicia o "Carteiro" quando o usuário loga
auth.onAuthStateChanged((user) => {
    if (user) {
        iniciarOuvinteNotificacoes(user.uid);
    } else {
        if(unsubscribeNotifications) unsubscribeNotifications();
    }
});

function iniciarOuvinteNotificacoes(uid) {
    if (unsubscribeNotifications) unsubscribeNotifications();

    // Cria container de toasts se não existir
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        div.className = 'fixed top-4 right-4 z-[9999] space-y-2 max-w-xs w-full pointer-events-none'; // Pointer events none para clicar através se vazio
        document.body.appendChild(div);
    }

    // Escuta notificações NÃO LIDAS
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
                // Só mostra se for recente (menos de 1 minuto) para não explodir notificações antigas no login
                const agora = new Date();
                const dataNotif = notif.created_at ? notif.created_at.toDate() : new Date();
                const diffSegundos = (agora - dataNotif) / 1000;

                if (diffSegundos < 60) {
                    mostrarToast(notif.message, change.doc.id, notif.type);
                }
            }
        });
    }, (error) => {
        console.warn("Erro notificações:", error);
    });
}

function mostrarToast(mensagem, docId, tipo = 'info') {
    const container = document.getElementById('toast-container');
    
    // Sons
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    if(tipo === 'money') audio.src = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'; // Som de moeda
    audio.volume = 0.5;
    audio.play().catch(() => {}); // Ignora erro de autoplay

    // Cores
    let bgClass = "bg-white border-l-4 border-blue-500 text-gray-800";
    let icon = "🔔";
    
    if (tipo === 'money') { bgClass = "bg-green-50 border-l-4 border-green-500 text-green-900"; icon = "💰"; }
    if (tipo === 'alert') { bgClass = "bg-red-50 border-l-4 border-red-500 text-red-900"; icon = "⚠️"; }
    if (tipo === 'success') { bgClass = "bg-blue-50 border-l-4 border-blue-500 text-blue-900"; icon = "✅"; }

    const toast = document.createElement('div');
    toast.className = `${bgClass} p-4 rounded shadow-2xl flex items-start gap-3 transform translate-x-full transition-all duration-500 pointer-events-auto cursor-pointer`;
    toast.innerHTML = `
        <div class="text-xl mt-0.5">${icon}</div>
        <div class="flex-1">
            <p class="text-xs font-bold leading-tight">${mensagem}</p>
            <p class="text-[9px] opacity-70 mt-1">Toque para fechar</p>
        </div>
    `;

    // Evento de clique para marcar como lida
    toast.onclick = async () => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
        try {
            await updateDoc(doc(db, "notifications", docId), { read: true });
        } catch(e) { console.log("Erro ao marcar lida", e); }
    };

    container.appendChild(toast);

    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });

    // Auto-remove após 6 segundos
    setTimeout(() => {
        if(document.body.contains(toast)) {
            toast.click();
        }
    }, 6000);
}

// Inicialização Global
console.log("🔥 App Core V7.1 (Notificações) Carregado.");
