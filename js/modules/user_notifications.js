// js/modules/user_notifications.js
// 1. IMPORTAÇÃO DO MOTOR CENTRAL
import { db, auth } from '../config.js'; 

import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                // Se não existir, cria um círculo vermelho flutuante no topo
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
        // -------------------------------------

        // Remove alertas antigos para não acumular na tela
        const existingAlert = document.getElementById('user-alert-bar');
        if(existingAlert) existingAlert.remove();

        // Se não houver nada novo, encerra aqui
        if (snap.empty) return;

        // 🧠 FILTRO INTELIGENTE V28: Não interrompe o usuário se ele já estiver no lugar certo
        const notif = snap.docs[0];
        const dados = notif.data();
        const abaAtual = window.abaAtual || 'servicos';

        // Mapeamento de silêncio: Se a notificação é de chat e estou no chat, silencie.
        const jaEstaNoLugar = (dados.action === 'chat' && abaAtual === 'chat') || 
                              (dados.action === 'wallet' && abaAtual === 'ganhar') ||
                              (dados.action === 'services' && abaAtual === 'servicos');

        if (jaEstaNoLugar) {
            console.log(`🔕 Notificação de ${dados.action} silenciada: Usuário já está na aba.`);
            // Opcional: Marcar como lido automaticamente se quiser limpar o banco
            // window.fecharNotificacao(notif.id); 
            return;
        }

        mostrarBarraNotificacao(notif.id, dados);
    }); // <--- ISSO FECHA O ONSNAPSHOT
} // <--- ISSO FECHA A FUNÇÃO ESCUTARNOTIFICACOES

window.mostrarBarraNotificacao = (id, data) => {
    // 🛡️ CORES E ÍCONES DINÂMICOS (Inclusão de Pedidos e Chat)
    const bgColorMap = {
        'gift': 'bg-green-600',
        'order': 'bg-blue-700',
        'chat': 'bg-indigo-600',
        'wallet': 'bg-emerald-600',
        'canal': 'bg-red-600'
    };
    const iconMap = {
        'gift': '🎁',
        'order': '🛠️',
        'chat': '💬',
        'wallet': '💰',
        'canal': '📺'
    };

    const bgColor = bgColorMap[data.type] || 'bg-slate-800';
    const icon = iconMap[data.type] || '🔔';
    const btnText = gerarTextoBotao(data.action);
    const div = document.createElement('div');
    div.id = 'user-alert-bar';
    div.className = `${bgColor} text-white px-4 py-3 shadow-lg flex items-center justify-between fixed top-0 w-full z-[100] animate-fadeIn`;
    div.style.marginTop = "60px"; // Ajuste para não ficar em cima do Header do site se tiver

    div.innerHTML = `
        <div class="flex items-center gap-3 flex-1">
            <span class="text-2xl animate-bounce">${icon}</span>
            <div>
                <p class="font-bold text-sm uppercase text-white/90">Nova Mensagem</p>
                <p class="text-xs font-medium">${data.message}</p>
                ${data.credit_val > 0 ? `<p class="text-[10px] bg-white/20 inline-block px-1 rounded mt-1">💰 + R$ ${data.credit_val} Recebidos</p>` : ''}
            </div>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="window.acaoNotificacao('${id}', '${data.action}')" class="bg-white text-gray-900 text-[10px] font-bold px-3 py-2 rounded-lg shadow hover:bg-gray-100 whitespace-nowrap">
                ${btnText}
            </button>
            <button onclick="window.fecharNotificacao('${id}')" class="text-white/70 hover:text-white px-2">✕</button>
        </div>
    `;
    
    document.body.appendChild(div);
}

function gerarTextoBotao(action) {
    if(action === 'wallet') return "VER CARTEIRA ➔";
    if(action === 'services') return "VER SERVIÇOS ➔";
    if(action === 'jobs') return "VER VAGAS ➔";
    if(action === 'missoes') return "VER AGORA ➔";
    if(action === 'oportunidades') return "VER AGORA ➔";
    if(action === 'produtos') return "VER AGORA ➔";
    if(action === 'canal') return "ASSISTIR AGORA 📺";
    return "OK, ENTENDI";
}
// Ações Globais
window.fecharNotificacao = async (id) => {
    document.getElementById('user-alert-bar').remove();
    try {
        await updateDoc(doc(db, "user_notifications", id), { read: true });
    } catch(e) { console.error(e); }
};

// 🚀 AÇÃO DE NOTIFICAÇÃO COM VIGILANTE INTEGRADO (V3.1)
// 📜 MOTOR DE RENDERIZAÇÃO DO HISTÓRICO (V1.0)
window.carregarHistoricoNotificacoes = async () => {
    const lista = document.getElementById('lista-historico-notificacoes');
    const uid = auth.currentUser?.uid;
    
    if (!lista || !uid) return;

    // Sinaliza que está carregando
    lista.innerHTML = '<p class="text-center text-gray-400 text-xs animate-pulse py-10">Buscando mensagens no arquivo...</p>';

    try {
        const { collection, getDocs, query, where, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // Busca as últimas 20 notificações do usuário
        const q = query(
            collection(db, "user_notifications"),
            where("userId", "==", uid),
            orderBy("created_at", "desc"),
            limit(20)
        );

        const snap = await getDocs(q);

        if (snap.empty) {
            lista.innerHTML = '<p class="text-center text-gray-400 text-xs italic py-10">Nenhuma mensagem encontrada.</p>';
            return;
        }

        const iconMap = { 'gift': '🎁', 'order': '🛠️', 'chat': '💬', 'wallet': '💰', 'canal': '📺' };

        lista.innerHTML = snap.docs.map(doc => {
            const d = doc.data();
            const dataFormatada = d.created_at?.toDate().toLocaleDateString('pt-BR') || 'Recente';
            
            return `
                <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-start gap-4">
                    <div class="text-2xl">${iconMap[d.type] || '🔔'}</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <p class="text-[10px] font-black text-blue-600 uppercase">${d.type}</p>
                            <p class="text-[8px] text-gray-400 font-bold">${dataFormatada}</p>
                        </div>
                        <p class="text-xs text-gray-700 font-medium mt-1">${d.message}</p>
                        <button onclick="window.switchTab('${d.action}')" class="mt-3 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">
                            Ver detalhes ➔
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        lista.innerHTML = '<p class="text-center text-red-400 text-xs py-10">Erro ao carregar mensagens.</p>';
    }
};
