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

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

// Exportações
export { app, db, auth, provider, storage };
window.db = db;
window.auth = auth;

// ============================================================================
// 🔔 CENTRAL DE NOTIFICAÇÕES (VERSÃO BLINDADA)
// ============================================================================

// 1. CRIA O CONTAINER VISUAL IMEDIATAMENTE (Não espera login)
(function criarContainerNotificacoes() {
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        div.className = 'fixed top-4 right-4 z-[9999] space-y-2 max-w-xs w-full pointer-events-none'; 
        document.body.appendChild(div);
        console.log("📦 Container de Notificações criado com sucesso.");
    }
})();

let unsubscribeNotifications = null;

// 2. INICIA O OUVINTE ASSIM QUE O LOGIN CONFIRMAR
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("👤 Usuário detectado. Iniciando ouvinte de notificações...");
        iniciarOuvinteNotificacoes(user.uid);
    } else {
        if(unsubscribeNotifications) unsubscribeNotifications();
    }
});

function iniciarOuvinteNotificacoes(uid) {
    if (unsubscribeNotifications) unsubscribeNotifications();

    // Escuta notificações NÃO LIDAS criadas recentemente
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
                
                // Filtro de tempo: Só mostra se foi criada nos últimos 2 minutos
                // Isso evita que notificações antigas não lidas pipoquem todas de vez no login
                const agora = new Date();
                const dataNotif = notif.created_at ? notif.created_at.toDate() : new Date();
                const diffSegundos = (agora - dataNotif) / 1000;

                if (diffSegundos < 120) { 
                    mostrarToast(notif.message, change.doc.id, notif.type);
                }
            }
        });
    }, (error) => {
        // Se der erro de permissão (index), avisa no console mas não trava o app
        if(error.code !== 'permission-denied') {
            console.warn("Erro no ouvinte de notificações:", error);
        }
    });
}

function mostrarToast(mensagem, docId, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return; // Segurança extra

    // Sons
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    if(tipo === 'money') audio.src = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'; 
    audio.volume = 0.5;
    audio.play().catch(() => {}); 

    // Cores e Ícones
    let bgClass = "bg-white border-l-4 border-blue-500 text-gray-800";
    let icon = "🔔";
    
    if (tipo === 'money') { bgClass = "bg-green-50 border-l-4 border-green-500 text-green-900"; icon = "💰"; }
    if (tipo === 'alert') { bgClass = "bg-red-50 border-l-4 border-red-500 text-red-900"; icon = "⚠️"; }
    if (tipo === 'success') { bgClass = "bg-blue-50 border-l-4 border-blue-500 text-blue-900"; icon = "✅"; }

    const toast = document.createElement('div');
    toast.className = `${bgClass} p-4 rounded-lg shadow-2xl flex items-start gap-3 transform translate-x-full transition-all duration-500 pointer-events-auto cursor-pointer mb-2 relative overflow-hidden`;
    
    // Barra de progresso visual
    toast.innerHTML = `
        <div class="text-xl mt-0.5 animate-bounce">${icon}</div>
        <div class="flex-1">
            <p class="text-xs font-bold leading-tight">${mensagem}</p>
            <p class="text-[9px] opacity-70 mt-1">Toque para fechar</p>
        </div>
        <div class="absolute bottom-0 left-0 h-1 bg-current opacity-20 w-full animate-shrink"></div>
    `;

    // Evento: Marcar como lida ao clicar
    toast.onclick = async () => {
        removeToast(toast);
        try {
            if(docId) await updateDoc(doc(db, "notifications", docId), { read: true });
        } catch(e) { console.log("Erro leitura db", e); }
    };

    container.appendChild(toast);

    // Entrada Suave
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });

    // Auto-remove após 6 segundos
    setTimeout(() => {
        if(document.body.contains(toast)) {
            removeToast(toast);
        }
    }, 6000);
}

function removeToast(el) {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => el.remove(), 500);
}

// CSS Injetado para animação da barra
const style = document.createElement('style');
style.innerHTML = `
    @keyframes shrink { from { width: 100%; } to { width: 0%; } }
    .animate-shrink { animation: shrink 6s linear forwards; }
`;
document.head.appendChild(style);

console.log("🔥 App Core V7.2 (Notificações Forçadas) Carregado.");
