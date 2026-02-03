// 1. IMPORTAÇÃO DO MOTOR CENTRAL
import { db, auth } from '../config.js'; 
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- EXPOSIÇÃO GLOBAL PARA O SISTEMA ---

window.iniciarSistemaNotificacoes = () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("🔔 Iniciando escuta de notificações pessoais...");
            window.escutarNotificacoes(user.uid);
        }
    });
};

window.escutarNotificacoes = (uid) => {
    // Busca notificações NÃO LIDAS (read == false)
    const q = query(
        collection(db, "user_notifications"), 
        where("userId", "==", uid), 
        where("read", "==", false),
        orderBy("created_at", "desc")
    );

    onSnapshot(q, (snap) => {
        // --- 🛡️ INJEÇÃO DO CONTADOR (BADGE) ---
        let badge = document.getElementById('notif-badge');
        const total = snap.size;

        if (total > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'notif-badge';
                badge.className = "fixed top-2 right-4 bg-red-600 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-lg z-[101] animate-pulse";
                document.body.appendChild(badge);
            }
            badge.innerText = total;
            badge.classList.remove('hidden');
        } else if (badge) {
            badge.classList.add('hidden');
        }

        // Remove alertas antigos
        const existingAlert = document.getElementById('user-alert-bar');
        if(existingAlert) existingAlert.remove();

        if (snap.empty) return;

        // Exibe a mais recente no banner
        const notif = snap.docs[0];
        window.mostrarBarraNotificacao(notif.id, notif.data());
    });
};

window.mostrarBarraNotificacao = (id, data) => {
    const bgColorMap = {
        'gift': 'bg-green-600',
        'order': 'bg-blue-700',
        'chat': 'bg-indigo-600',
        'wallet': 'bg-emerald-600'
    };
    const iconMap = {
        'gift': '🎁',
        'order': '🛠️',
        'chat': '💬',
        'wallet': '💰'
    };

    const bgColor = bgColorMap[data.type] || 'bg-slate-800';
    const icon = iconMap[data.type] || '🔔';
    
    const div = document.createElement('div');
    div.id = 'user-alert-bar';
    div.className = `${bgColor} text-white px-4 py-3 shadow-lg flex items-center justify-between fixed top-0 w-full z-[100] animate-fadeIn`;
    div.style.marginTop = "60px";

    div.innerHTML = `
        <div class="flex items-center gap-3 flex-1">
            <span class="text-2xl animate-bounce">${icon}</span>
            <div>
                <p class="font-bold text-sm uppercase text-white/90">Nova Mensagem</p>
                <p class="text-xs font-medium">${data.message}</p>
                ${data.credit_val > 0 ? `<p class="text-[10px] bg-white/20 inline-block px-1 rounded mt-1">💰 + R$ ${data.credit_val}</p>` : ''}
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="window.acaoNotificacao('${id}', '${data.action}')" class="bg-white text-gray-900 text-[10px] font-bold px-3 py-2 rounded-lg shadow hover:bg-gray-100 whitespace-nowrap uppercase">
                ${data.action || 'OK'}
            </button>
            <button onclick="window.fecharNotificacao('${id}')" class="text-white/70 hover:text-white px-2">✕</button>
        </div>
    `;
    
    document.body.appendChild(div);
};

window.fecharNotificacao = async (id) => {
    const barra = document.getElementById('user-alert-bar');
    if(barra) barra.remove();
    try {
        await updateDoc(doc(db, "user_notifications", id), { read: true });
    } catch(e) { console.error(e); }
};

window.acaoNotificacao = async (id, action) => {
    await window.fecharNotificacao(id);
    if(action === 'wallet') document.getElementById('tab-perfil')?.click();
    else if(action === 'services') document.getElementById('tab-servicos')?.click();
    else if(action === 'jobs' && window.carregarInterfaceEmpregos) window.carregarInterfaceEmpregos();
};
