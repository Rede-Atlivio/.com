import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-dashboard');
    
    // Renderiza a estrutura (Skeleton) com a NOVA seção de Analytics
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="glass-panel p-5 border-l-2 border-blue-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">USUÁRIOS TOTAIS</p>
                <h3 class="text-2xl font-black text-white" id="kpi-users"><div class="loader w-4 h-4 border-white"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-green-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">PRESTADORES ONLINE</p>
                <h3 class="text-2xl font-black text-green-400" id="kpi-providers"><div class="loader w-4 h-4 border-green-500"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-purple-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">VAGAS ATIVAS</p>
                <h3 class="text-2xl font-black text-white" id="kpi-jobs"><div class="loader w-4 h-4 border-white"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-amber-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">SALDO EM CARTEIRAS</p>
                <h3 class="text-2xl font-black text-amber-400" id="kpi-balance"><div class="loader w-4 h-4 border-amber-500"></div></h3>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-panel p-6 col-span-1 md:col-span-2">
                <h4 class="font-bold text-white mb-4 flex items-center gap-2">
                    📊 Fontes de Tráfego (Links Inteligentes)
                </h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="text-gray-400 uppercase border-b border-gray-700">
                            <tr>
                                <th class="pb-2">Origem (?ref=)</th>
                                <th class="pb-2 text-right">Usuários</th>
                                <th class="pb-2 text-right">%</th>
                                <th class="pb-2 text-right">Barra</th>
                            </tr>
                        </thead>
                        <tbody id="analytics-table-body" class="text-gray-300">
                            <tr><td colspan="4" class="py-4 text-center">Calculando dados...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-panel p-6 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-gray-300 mb-4 border-b border-gray-700 pb-2">📡 Status do Sistema</h4>
                    <div id="chart-status" class="text-xs text-gray-500 space-y-2">Carregando métricas...</div>
                </div>
                <div class="mt-6 text-center opacity-50">
                    <p class="text-[10px] uppercase">Versão do Painel</p>
                    <p class="font-bold text-blue-400">v16.0 (Analytics)</p>
                </div>
            </div>
        </div>
    `;
    
    try {
        const db = window.db;

        // =================================================================================
        // 1. CARREGAMENTO DE DADOS DO BANCO
        // =================================================================================
        
        // Buscar Usuários (Para KPI e Analytics)
        const usersSnap = await getDocs(collection(db, "usuarios"));
        
        // Buscar Prestadores Online
        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const providersSnap = await getDocs(qOnline);

        // Buscar Vagas Ativas
        const qJobs = query(collection(db, "jobs"), where("status", "==", "ativa"));
        const jobsSnap = await getDocs(qJobs);

        // =================================================================================
        // 2. CÁLCULOS KPI (Financeiro e Totais)
        // =================================================================================
        let totalSaldo = 0;
        let trafficStats = {}; // Objeto para contar origens: { 'zap': 10, 'instagram': 5 }

        usersSnap.forEach(doc => {
            const data = doc.data();
            
            // Soma Financeira
            const valor = parseFloat(data.wallet_balance || data.saldo || 0);
            totalSaldo += valor;

            // Contagem de Analytics (Item 39/40)
            // Se não tiver traffic_source, conta como 'orgânico/antigo'
            const source = data.traffic_source || 'antigo/direto';
            trafficStats[source] = (trafficStats[source] || 0) + 1;
        });

        // Atualiza KPIs no topo
        document.getElementById('kpi-users').innerText = usersSnap.size;
        document.getElementById('kpi-balance').innerText = `R$ ${totalSaldo.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-providers').innerText = providersSnap.size;
        document.getElementById('kpi-jobs').innerText = jobsSnap.size;

        // =================================================================================
        // 3. RENDERIZAÇÃO DA TABELA ANALYTICS (NOVO)
        // =================================================================================
        const tbody = document.getElementById('analytics-table-body');
        tbody.innerHTML = "";

        // Converte o objeto trafficStats em array ordenado
        const sortedTraffic = Object.entries(trafficStats)
            .sort(([,a], [,b]) => b - a); // Ordena do maior para o menor

        const totalUsers = usersSnap.size || 1; // Evita divisão por zero

        sortedTraffic.forEach(([origem, count]) => {
            const percent = ((count / totalUsers) * 100).toFixed(1);
            
            // Define cor da barra baseada na origem
            let colorClass = 'bg-gray-600';
            if(origem.includes('zap') || origem.includes('whatsapp')) colorClass = 'bg-green-500';
            if(origem.includes('insta')) colorClass = 'bg-pink-500';
            if(origem.includes('google')) colorClass = 'bg-blue-500';
            if(origem === 'antigo/direto') colorClass = 'bg-slate-700';

            tbody.innerHTML += `
                <tr class="border-b border-gray-800 last:border-0 hover:bg-white/5 transition">
                    <td class="py-3 font-bold text-white">${origem}</td>
                    <td class="py-3 text-right font-mono">${count}</td>
                    <td class="py-3 text-right text-[10px] text-gray-400">${percent}%</td>
                    <td class="py-3 pl-4">
                        <div class="w-full bg-gray-800 rounded-full h-1.5">
                            <div class="${colorClass} h-1.5 rounded-full" style="width: ${percent}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        });

        // =================================================================================
        // 4. ATUALIZAÇÃO DO STATUS
        // =================================================================================
        document.getElementById('chart-status').innerHTML = `
            <p>✅ Banco de Dados: <b>CONECTADO</b></p>
            <p>👥 Ticket Médio: <b>R$ ${(usersSnap.size > 0 ? totalSaldo / usersSnap.size : 0).toFixed(2)}</b></p>
            <p class="mt-2 text-[10px] text-blue-300">Rastreando <b>${Object.keys(trafficStats).length}</b> origens diferentes.</p>
        `;

    } catch(e) { 
        console.error("Erro Dashboard:", e);
        document.getElementById('chart-status').innerHTML = `<span class="text-red-400">Erro: ${e.message}</span>`;
    }
}
