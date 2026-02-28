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

/* 💎 MOTOR DE EXIBIÇÃO MAESTRO V25 - DESIGN PREMIUM SLATE */
window.mostrarBarraNotificacao = (id, data) => {
    // Remove qualquer alerta anterior para não empilhar lixo na tela
    const existingAlert = document.getElementById('user-alert-bar');
    if(existingAlert) existingAlert.remove();

    const iconMap = { 'gift': '🎁', 'order': '🛠️', 'chat': '💬', 'wallet': '💰', 'canal': '📺', 'marketing': '🚀' };
    const icon = iconMap[data.type] || '🔔';
    const btnText = gerarTextoBotao(data.action);

    const div = document.createElement('div');
    div.id = 'user-alert-bar';
    
    // Classes: Slate Premium, Borda Azul, Sombras Pesadas e Posicionamento Fixo no Topo Central
    div.className = `fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] bg-slate-premium border-blue-atlivio border text-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-maestro animate-fade-down flex flex-col gap-3`;

    div.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="bg-blue-600/20 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-blue-500/30">
                <span class="text-xl">${icon}</span>
            </div>
            <div class="flex-1">
                <p class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Notificação Atlivio</p>
                <p class="text-xs font-bold leading-snug text-slate-100">${data.message}</p>
                ${data.credit_val > 0 ? `<p class="text-[9px] text-emerald-400 font-black mt-1">💰 + R$ ${data.credit_val} DISPONÍVEL</p>` : ''}
            </div>
            <button onclick="window.fecharNotificacao('${id}')" class="text-slate-500 hover:text-white transition">✕</button>
        </div>
        <div class="flex gap-2 mt-1">
            <button onclick="window.acaoNotificacao('${id}', '${data.action}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black py-2.5 rounded-xl transition shadow-lg uppercase tracking-wider">
                ${btnText}
            </button>
        </div>
    `;
    
    document.body.appendChild(div);

    // Toca o som de notificação que já existe no seu index.html
    const som = document.getElementById('notification-sound');
    if(som) som.play().catch(e => console.log("Áudio bloqueado pelo navegador"));
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
