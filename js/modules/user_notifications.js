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

/* 💎 MOTOR DE EXIBIÇÃO MAESTRO V26 - DESIGN SLATE-900 REFINADO */
window.mostrarBarraNotificacao = (id, data) => {
    // Limpeza de cache visual para evitar sobreposição
    const existingAlert = document.getElementById('user-alert-bar');
    if(existingAlert) existingAlert.remove();

    // Mapeamento de Ícones e Identidade Visual Atlivio
    const iconMap = { 'gift': '🎁', 'order': '🛠️', 'chat': '💬', 'wallet': '💰', 'canal': '📺', 'marketing': '🚀' };
    const icon = iconMap[data.type] || '🔔';
    const btnText = gerarTextoBotao(data.action);

    const div = document.createElement('div');
    div.id = 'user-alert-bar';
    
    // Classes: Slate-900 (Quase Preto), Borda Fina Azul, Sombra Soft 50%, Posicionamento Centralizado
    div.className = `fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[380px] bg-[#0f172a] border border-blue-500/40 text-white p-5 rounded-[24px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] z-[999999] animate-fade-down flex flex-col gap-4`;

    div.innerHTML = `
        <div class="flex items-start gap-4">
            <div class="bg-blue-600 w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                <span class="text-xl">${icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em] mb-1">Notificação Oficial</p>
                    <button onclick="window.fecharNotificacao('${id}')" class="text-slate-500 hover:text-white transition-colors p-1 -mt-1 -mr-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <p class="text-[13px] font-bold leading-tight text-slate-100 break-words">${data.message}</p>
                ${data.credit_val > 0 ? `<p class="text-[10px] text-emerald-400 font-black mt-1.5 flex items-center gap-1">💰 R$ ${data.credit_val} DISPONÍVEL</p>` : ''}
            </div>
        </div>
        <div class="flex gap-2">
            <button onclick="window.acaoNotificacao('${id}', '${data.action}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-3 rounded-xl transition-all shadow-lg uppercase tracking-widest active:scale-[0.98]">
                ${btnText}
            </button>
        </div>
    `;
    
    document.body.appendChild(div);

    // Sistema de Alerta Sonoro Híbrido
    const som = document.getElementById('notification-sound');
    if(som) {
        som.volume = 0.5;
        som.play().catch(() => console.log("🔇 Áudio aguardando interação do usuário."));
    }
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
/* 🧼 FAXINA MAESTRO: Remove o balão e marca como lido no Firebase */
window.fecharNotificacao = async (id) => {
    const alerta = document.getElementById('user-alert-bar');
    if(alerta) alerta.remove(); // Remove o balão da tela na hora para o usuário sentir rapidez
    
    try {
        // Busca a referência correta do documento na coleção que vimos no seu banco
        const notifRef = doc(db, "user_notifications", id);
        await updateDoc(notifRef, { read: true });
    } catch(e) { 
        console.error("Erro ao limpar notificação:", e); 
    }
};

// 🚀 AÇÃO DE NOTIFICAÇÃO COM VIGILANTE INTEGRADO (V3.1)
window.acaoNotificacao = async (id, action) => {
    console.log(`🎯 [Vigilante] Processando ação: ${action}`);
    
    // 1. Marca como lida no Firebase para o badge sumir
    await window.fecharNotificacao(id); 

    // 2. Identifica o perfil atual para aplicar a trava de segurança
    const isPrestador = window.userProfile?.is_provider === true;
    const exclusivasPrestador = ['missoes', 'radar', 'ativos']; 
    const exclusivasCliente = ['loja', 'contratar'];

    // 🛡️ ANALISADOR DE INTENÇÃO: Verifica se a ordem do Admin é compatível com o perfil atual
    const bloqueio = (isPrestador && exclusivasCliente.includes(action)) || 
                     (!isPrestador && exclusivasPrestador.includes(action));

    if (bloqueio) {
        console.warn(`🚩 [Vigilante] Bloqueando ação incompatível: ${action}`);
        
        // Abre o Modal de Troca de Identidade que já temos no HTML
        const modal = document.getElementById('modal-troca-identidade');
        const txt = document.getElementById('txt-perfil-atual');
        if (modal && txt) {
            txt.innerText = isPrestador ? "PRESTADOR para CLIENTE" : "CLIENTE para PRESTADOR";
            modal.classList.remove('hidden');
        }
        return; 
    }

    // ✅ MAPEAMENTO: Traduz os termos do Admin para os IDs de abas que o Maestro entende
    const mapaAbas = { 
        'wallet': 'ganhar', 
        'services': 'servicos', 
        'jobs': 'empregos', 
        'produtos': 'loja' 
    };
    
    const abaDestino = mapaAbas[action] || action;
    
    // 🎼 MAESTRO: Executa a navegação final
    if (window.switchTab) {
        window.switchTab(abaDestino);
    }
};
// 📜 MOTOR DE RENDERIZAÇÃO DO HISTÓRICO (V1.0)
window.carregarHistoricoNotificacoes = async () => {
    const lista = document.getElementById('lista-historico-notificacoes');
    const uid = auth.currentUser?.uid;
    
    if (!lista || !uid) return;

   // Sinaliza que está carregando
    lista.innerHTML = '<p class="text-center text-gray-400 text-xs animate-pulse py-10">Buscando mensagens no arquivo...</p>';

    try {
        // 🚀 IMPORTAÇÃO EXPANDIDA: Adicionado writeBatch para limpeza em massa
        const { collection, getDocs, query, where, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🛡️ MODO SEGURO: Faxina automática removida para evitar loop de processos.
        
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
