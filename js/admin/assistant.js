import { collection, query, where, getCountFromServer, getDocs, orderBy, limit, Timestamp, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FUNÇÃO GLOBAL PARA LIMPAR (EXPOSTA PARA O HTML USAR)
window.limparNotificacoes = async () => {
    const btn = document.getElementById('btn-clear-notif');
    if(btn) { btn.innerText = "🧹 Limpando..."; btn.disabled = true; }

    const db = window.db;
    const batch = writeBatch(db);
    
    // Pega todas as notificações não lidas
    const q = query(collection(db, "notifications"), where("read", "==", false));
    const snap = await getDocs(q);

    snap.forEach(documento => {
        batch.update(doc(db, "notifications", documento.id), { read: true });
    });

    await batch.commit();
    
    // Recarrega a secretária
    const { renderAssistant } = await import('./assistant.js?v=' + Date.now());
    renderAssistant('assistant-container');
    
    // Feedback visual
    alert("✨ Todas as notificações foram marcadas como lidas!");
    location.reload(); // Recarrega para limpar visualmente
};

export async function renderAssistant(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Loading Skeleton
    container.innerHTML = `
        <div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg mb-6 flex items-start gap-4 animate-pulse">
            <div class="h-12 w-12 bg-slate-700 rounded-full"></div>
            <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-700 rounded w-1/3"></div>
                <div class="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
        </div>
    `;

    try {
        const db = window.db;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const timestampHoje = Timestamp.fromDate(hoje);

       // 🔍 QUERIES V2026.PRO (Incluindo Missões e PIX)
        const qUsersToday = query(collection(db, "usuarios"), where("created_at", ">=", timestampHoje));
        const qProvToday = query(collection(db, "active_providers"), where("created_at", ">=", timestampHoje));
        const qAnalise = query(collection(db, "active_providers"), where("status", "==", "em_analise"));
        const qTickets = query(collection(db, "support_tickets"), where("read", "==", false), where("sender", "==", "user"));
        const qNotificacoes = query(collection(db, "notifications"), where("read", "==", false), orderBy("created_at", "desc"), limit(5));
        
        // 💰 Monitor de Pagamento em REAL (PIX Pendente)
        const qPixPendentes = query(collection(db, "mission_submissions"), where("status", "==", "approved_pending_pix"));
        // 📸 Monitor de Auditoria (Missões que aguardam seu OK)
        const qMissaoAnalise = query(collection(db, "mission_submissions"), where("status", "==", "pending"));
        // ⚖️ Monitor de Disputas B2B (Gil, aqui a IA vigia as brigas entre B2B e Usuário)
        const qDisputasB2B = query(collection(db, "mission_submissions"), where("status", "==", "b2b_rejected"));
        
        // 🚀 MONITORAMENTO ATLIVIO (Fase 2)
        const qDisputas = query(collection(db, "orders"), where("status", "==", "dispute"));
        const dozeHorasAtras = new Date(Date.now() - (12 * 60 * 60 * 1000));
        const qAtrasados = query(collection(db, "orders"), where("status", "==", "in_progress"), where("real_start", "<=", Timestamp.fromDate(dozeHorasAtras)));

        // Execução Global das Contagens (V2026.B2B_Update)
        const [snapUsers, snapProv, snapAnalise, snapTickets, snapNotif, snapDisputas, snapAtrasados, snapPix, snapMisAnalise, snapDisputasB2B] = await Promise.all([
            getCountFromServer(qUsersToday),
            getCountFromServer(qProvToday),
            getCountFromServer(qAnalise),
            getCountFromServer(qTickets),
            getDocs(qNotificacoes),
            getCountFromServer(qDisputas),
            getCountFromServer(qAtrasados),
            getCountFromServer(qPixPendentes),
            getCountFromServer(qMissaoAnalise),
            getCountFromServer(qDisputasB2B)
        ]);

        const newUsers = snapUsers.data().count;
        const newProvs = snapProv.data().count;
        const pendingAnalise = snapAnalise.data().count;
        const pendingTickets = snapTickets.data().count;
        const totalDisputas = snapDisputas.data().count;
        const totalAtrasados = snapAtrasados.data().count;
        const totalPix = snapPix.data().count;
        const totalMisAnalise = snapMisAnalise.data().count;
        
        let notifTexts = [];
        snapNotif.forEach(doc => {
            const data = doc.data();
            let icon = "🔔";
            if(data.type === 'success') icon = "🎉";
            if(data.type === 'warning') icon = "⚠️";
            if(data.type === 'error') icon = "⛔";
            notifTexts.push(`${icon} ${data.message}`);
        });

        // Lógica de Exibição
        const hora = new Date().getHours();
        let saudacao = hora < 12 ? "Bom dia" : (hora < 18 ? "Boa tarde" : "Boa noite");
        let insights = [];
        let statusColor = "border-l-4 border-blue-500";
        let icon = "📊";

        // Se tiver notificações, elas têm prioridade visual
        if (notifTexts.length > 0) {
            notifTexts.forEach(txt => insights.push(`<span class="text-white font-semibold text-xs">${txt}</span>`));
            statusColor = "border-l-4 border-purple-500";
            icon = "📬";
        } else {
            // Se não tem notificação, mostra métricas
            if (newUsers > 0 || newProvs > 0) {
                insights.push(`🚀 <b>Crescimento:</b> +${newUsers} usuários e +${newProvs} prestadores hoje.`);
            }
           if (totalPix > 0) {
                insights.push(`💰 <b>URGENTE:</b> ${totalPix} pagamentos em PIX pendentes.`);
                statusColor = "border-l-4 border-emerald-500"; icon = "💵";
            }
            if (totalMisAnalise > 0) {
                insights.push(`📸 <b>MISSÕES:</b> ${totalMisAnalise} envios aguardando auditoria.`);
                if(totalPix === 0) statusColor = "border-l-4 border-blue-400";
            }
            if (pendingAnalise > 0) {
                insights.push(`⚠️ <b>PRESTADORES:</b> ${pendingAnalise} perfis para aprovar.`);
                if(totalPix === 0 && totalMisAnalise === 0) statusColor = "border-l-4 border-yellow-500";
            }
            if (pendingTickets > 0) {
                insights.push(`💬 <b>Suporte:</b> ${pendingTickets} tickets de chat abertos.`);
            }
            if (totalDisputas > 0) {
                insights.push(`⚖️ <b>DISPUTAS:</b> ${totalDisputas} serviços aguardando mediação.`);
                statusColor = "border-l-4 border-red-600"; icon = "🚨";
            }
            if (totalAtrasados > 0) {
                insights.push(`⏰ <b>ATRASO CRÍTICO:</b> ${totalAtrasados} serviços passaram de 12h.`);
                if(!totalDisputas) statusColor = "border-l-4 border-amber-600"; 
            }
        }

        if (insights.length === 0) {
            insights = ["💤 Tudo tranquilo. Nenhum alerta pendente."];
            statusColor = "border-l-4 border-green-500";
            icon = "☕";
        }

        // Renderiza
        container.innerHTML = `
            <div class="bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 ${statusColor} shadow-2xl mb-6 flex items-start gap-5 animate-fade relative overflow-hidden w-full border border-white/5">
                <div class="text-4xl bg-slate-800/50 p-3 rounded-full border border-slate-700 shadow-inner flex-shrink-0">
                    ${icon}
                </div>
                <div class="flex-1 w-full z-10">
                    <div class="flex justify-between items-start">
                        <h3 class="text-white font-bold text-lg mb-2 flex items-center gap-2">
                            ${saudacao}, Chefe.
                            ${notifTexts.length > 0 ? `<span class="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">NOVO</span>` : ''}
                        </h3>
                        <div class="flex gap-2">
                            ${notifTexts.length > 0 ? `<button id="btn-clear-notif" onclick="window.limparNotificacoes()" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded border border-white/10 transition">🧹 Limpar Avisos</button>` : ''}
                            <span class="text-[10px] text-gray-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                                ${new Date().toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 text-xs text-gray-300 max-h-[75px] overflow-y-auto custom-scrollbar pr-2 w-full">
                        ${insights.map(i => `
                            <div class="flex items-center gap-2 border-b border-white/5 pb-1.5 last:border-0 w-full group">
                                <span class="opacity-40 group-hover:opacity-100 transition-opacity">🕒</span>
                                <p class="flex-1 leading-relaxed">${i}</p>
                            </div>
                        `).join('')}
                    </div>

                    <div class="flex gap-2 mt-4">
                        ${pendingAnalise > 0 ? `<button onclick="document.querySelector('[data-view=\\'active_providers\\']').click()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-lg flex items-center gap-2">🔍 Aprovar (${pendingAnalise})</button>` : ''}
                        ${pendingTickets > 0 ? `<button onclick="document.querySelector('[data-view=\\'support\\']').click()" class="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-lg flex items-center gap-2">💬 Tickets (${pendingTickets})</button>` : ''}
                    </div>
                </div> 
            </div>
        `;

    } catch (e) {
        console.error("Erro Assistente:", e);
        container.innerHTML = `<div class="p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-xs">Erro na IA: ${e.message}</div>`;
    }
}
// 🔐 SOLDAGEM GLOBAL V2026
// Gil, essa linha é o que permite que o Dashboard chame a secretária.
// Sem isso, o robô dá erro ❌ e você não vê os alertas de PIX.
window.renderAssistant = renderAssistant;
