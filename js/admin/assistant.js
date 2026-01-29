import { collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function renderAssistant(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Mensagem de Carregamento (Skeleton)
    container.innerHTML = `
        <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-lg mb-6 flex items-start gap-4 animate-pulse">
            <div class="h-12 w-12 bg-slate-700 rounded-full"></div>
            <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-700 rounded w-1/4"></div>
                <div class="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
        </div>
    `;

    try {
        const db = window.db;

        // 2. Consulta ao Banco (Paralela para ser rápido)
        const qProviders = query(collection(db, "active_providers"), where("status", "==", "em_analise"));
        const qTickets = query(collection(db, "support_tickets"), where("read", "==", false));
        // Futuro: const qReports = query(collection(db, "reports"), where("status", "==", "pending"));

        const [snapProv, snapTick] = await Promise.all([
            getCountFromServer(qProviders),
            getCountFromServer(qTickets)
        ]);

        const countProv = snapProv.data().count;
        const countTick = snapTick.data().count;

        // 3. Define o Humor da Secretária
        const hora = new Date().getHours();
        let saudacao = "Bom dia";
        if (hora >= 12) saudacao = "Boa tarde";
        if (hora >= 18) saudacao = "Boa noite";

        let htmlContent = "";
        let icon = "👩‍💼";
        let statusColor = "border-blue-500";

        if (countProv === 0 && countTick === 0) {
            // Tudo Limpo
            htmlContent = `
                <div>
                    <h3 class="text-white font-bold text-lg">${saudacao}, Chefe!</h3>
                    <p class="text-gray-400 text-sm">Tudo tranquilo por aqui. Nenhum pendência urgente.</p>
                </div>
                <div class="ml-auto bg-green-900/30 px-3 py-1 rounded border border-green-500/50 text-green-400 text-xs font-bold">
                    ✅ SISTEMA OTIMIZADO
                </div>
            `;
            icon = "☕";
            statusColor = "border-green-500";
        } else {
            // Tem Trabalho
            icon = "🚨";
            statusColor = "border-amber-500";
            
            let avisos = [];
            if (countProv > 0) avisos.push(`<b class="text-white">${countProv}</b> novos prestadores para analisar.`);
            if (countTick > 0) avisos.push(`<b class="text-white">${countTick}</b> mensagens de suporte.`);

            htmlContent = `
                <div>
                    <h3 class="text-white font-bold text-lg flex items-center gap-2">Atenção, Chefe!</h3>
                    <div class="text-gray-300 text-sm mt-1 space-y-1">
                        ${avisos.map(a => `<p>• ${a}</p>`).join('')}
                    </div>
                    <div class="flex gap-2 mt-3">
                        ${countProv > 0 ? `<button onclick="document.querySelector('[data-view=\\'users\\']').click()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold transition">🔍 Ver Cadastros</button>` : ''}
                        ${countTick > 0 ? `<button onclick="document.querySelector('[data-view=\\'support\\']').click()" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-bold transition">💬 Ver Suporte</button>` : ''}
                    </div>
                </div>
            `;
        }

        // 4. Renderiza Final
        container.innerHTML = `
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 border-l-4 ${statusColor} shadow-lg mb-6 flex items-start gap-4 animate-fade">
                <div class="text-4xl bg-slate-800 p-2 rounded-full border border-slate-700 shadow-inner">${icon}</div>
                <div class="flex-1 flex items-start justify-between">
                    ${htmlContent}
                </div>
            </div>
        `;

    } catch (e) {
        console.error("Erro Assistente:", e);
        container.innerHTML = ""; // Esconde se der erro
    }
}
