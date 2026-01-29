import { collection, query, where, getCountFromServer, getDocs, orderBy, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function renderAssistant(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Loading Skeleton (Visual enquanto ela pensa)
    container.innerHTML = `
        <div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg mb-6 flex items-start gap-4 animate-pulse">
            <div class="h-12 w-12 bg-slate-700 rounded-full"></div>
            <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-700 rounded w-1/3"></div>
                <div class="h-3 bg-slate-700 rounded w-1/2"></div>
                <div class="h-3 bg-slate-700 rounded w-1/4 mt-2"></div>
            </div>
        </div>
    `;

    try {
        const db = window.db;

        // =================================================================================
        // 📊 ANÁLISE TEMPORAL (O QUE ACONTECEU HOJE?)
        // =================================================================================
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zera o relógio para pegar desde o início do dia
        const timestampHoje = Timestamp.fromDate(hoje);

        // Queries de Performance
        const qUsersToday = query(collection(db, "usuarios"), where("created_at", ">=", timestampHoje));
        const qProvToday = query(collection(db, "active_providers"), where("created_at", ">=", timestampHoje));
        
        // Queries de Pendências
        const qAnalise = query(collection(db, "active_providers"), where("status", "==", "em_analise"));
        const qTickets = query(collection(db, "support_tickets"), where("read", "==", false), where("sender", "==", "user"));

        // Executa tudo em paralelo (Performance Máxima)
        const [snapUsers, snapProv, snapAnalise, snapTickets] = await Promise.all([
            getCountFromServer(qUsersToday),
            getCountFromServer(qProvToday),
            getCountFromServer(qAnalise),
            getCountFromServer(qTickets)
        ]);

        const newUsers = snapUsers.data().count;
        const newProvs = snapProv.data().count;
        const pendingAnalise = snapAnalise.data().count;
        const pendingTickets = snapTickets.data().count;

        // =================================================================================
        // 🤖 CÉREBRO: DECIDINDO O QUE FALAR
        // =================================================================================
        const hora = new Date().getHours();
        let saudacao = hora < 12 ? "Bom dia" : (hora < 18 ? "Boa tarde" : "Boa noite");
        
        let insights = [];
        let statusColor = "border-l-4 border-blue-500";
        let icon = "📊"; // Ícone padrão de gráfico

        // 1. Análise de Crescimento (O BOM)
        if (newUsers > 0 || newProvs > 0) {
            insights.push(`🚀 <b>Crescimento Hoje:</b> Entraram <span class="text-green-400 font-bold">+${newUsers} usuários</span> e <span class="text-green-400 font-bold">+${newProvs} prestadores</span>.`);
        } else {
            insights.push(`📉 <b>Movimento Baixo:</b> Nenhum cadastro novo hoje ainda.`);
        }

        // 2. Análise de Operação (O TRABALHO)
        if (pendingAnalise > 0) {
            insights.push(`⚠️ <b>Gargalo Operacional:</b> Você tem <span class="text-yellow-400 font-bold">${pendingAnalise} perfis</span> aguardando aprovação.`);
            statusColor = "border-l-4 border-yellow-500";
            icon = "⚡";
        }

        // 3. Análise de Suporte (O PROBLEMA)
        if (pendingTickets > 0) {
            insights.push(`💬 <b>Atenção ao Cliente:</b> <span class="text-red-400 font-bold">${pendingTickets} mensagens</span> de suporte não lidas.`);
            statusColor = "border-l-4 border-red-500";
            icon = "🚨";
        }

        // Se estiver tudo zerado e limpo
        if (newUsers === 0 && pendingAnalise === 0 && pendingTickets === 0) {
            insights = ["💤 O sistema está calmo. Aproveite para planejar o marketing."];
            statusColor = "border-l-4 border-green-500";
            icon = "☕";
        }

        // =================================================================================
        // 🎨 RENDERIZAÇÃO FINAL
        // =================================================================================
        container.innerHTML = `
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 ${statusColor} shadow-lg mb-6 flex flex-col md:flex-row items-start gap-4 animate-fade relative overflow-hidden">
                <div class="text-4xl bg-slate-800/50 p-3 rounded-full border border-slate-700 shadow-inner flex-shrink-0">
                    ${icon}
                </div>

                <div class="flex-1 w-full z-10">
                    <div class="flex justify-between items-start">
                        <h3 class="text-white font-bold text-lg mb-2">${saudacao}, Chefe.</h3>
                        <span class="text-[10px] text-gray-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                            ${new Date().toLocaleDateString()}
                        </span>
                    </div>
                    
                    <div class="space-y-2 text-sm text-gray-300">
                        ${insights.map(i => `<p class="border-b border-white/5 pb-1 last:border-0">${i}</p>`).join('')}
                    </div>

                    <div class="flex gap-2 mt-4">
                        ${pendingAnalise > 0 ? `<button onclick="document.querySelector('[data-view=\\'active_providers\\']').click()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-lg flex items-center gap-2">🔍 Aprovar (${pendingAnalise})</button>` : ''}
                        ${pendingTickets > 0 ? `<button onclick="document.querySelector('[data-view=\\'support\\']').click()" class="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-lg flex items-center gap-2">💬 Responder (${pendingTickets})</button>` : ''}
                        ${(pendingAnalise === 0 && pendingTickets === 0) ? `<button class="bg-slate-700 text-gray-400 px-4 py-1.5 rounded text-xs font-bold cursor-default opacity-50">Nada pendente</button>` : ''}
                    </div>
                </div>

                <div class="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none"></div>
            </div>
        `;

    } catch (e) {
        console.error("Erro Assistente V2:", e);
        container.innerHTML = `<div class="p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-xs">Erro na IA: ${e.message}</div>`;
    }
}
