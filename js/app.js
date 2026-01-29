// ... (Mantenha os imports e PWA igual ao anterior) ...

// ============================================================================
// 🔔 CENTRAL DE NOTIFICAÇÕES (MODO PERSISTENTE)
// ============================================================================

// 1. Container Visual (Visual do teste de força bruta, mas elegante)
(function criarContainerNotificacoes() {
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        div.className = 'fixed top-4 right-4 z-[999999] space-y-3 max-w-sm w-full pointer-events-none'; 
        document.body.appendChild(div);
    }
})();

let unsubscribeNotifications = null;

// 2. Inicia Listener
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
        where("read", "==", false), // Só mostra não lidas
        orderBy("created_at", "desc"),
        limit(5)
    );

    unsubscribeNotifications = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const notif = change.doc.data();
                
                // 🛑 REMOVI O FILTRO DE TEMPO! 
                // Agora ele mostra TUDO que for novo para a sessão
                console.log("🔔 Notificação recebida:", notif.message);
                mostrarToast(notif.message, change.doc.id, notif.type);
            }
        });
    }, (error) => {
        console.warn("Erro notificações:", error);
    });
}

function mostrarToast(mensagem, docId, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    // Sons
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
    if(tipo === 'money') audio.src = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'; 
    audio.play().catch(() => {}); 

    // Cores
    let borderClass = "border-blue-500";
    let icon = "🔔";
    if (tipo === 'money') { borderClass = "border-emerald-500"; icon = "💰"; }
    if (tipo === 'alert') { borderClass = "border-red-500"; icon = "⚠️"; }
    if (tipo === 'success') { borderClass = "border-green-500"; icon = "✅"; }

    const toast = document.createElement('div');
    toast.className = `bg-white border-l-4 ${borderClass} p-4 rounded shadow-2xl flex items-center gap-3 transform translate-x-full transition-all duration-500 pointer-events-auto cursor-pointer mb-2`;
    
    toast.innerHTML = `
        <div class="text-2xl">${icon}</div>
        <div class="flex-1">
            <p class="text-sm font-bold text-gray-800 leading-tight">${mensagem}</p>
            <p class="text-[10px] text-gray-400 mt-1">Toque para marcar como lida</p>
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

    // Remove visualmente após 8s, mas mantém no banco até clicar
    setTimeout(() => { if(document.body.contains(toast)) removeToast(toast); }, 8000);
}

function removeToast(el) {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => el.remove(), 500);
}
