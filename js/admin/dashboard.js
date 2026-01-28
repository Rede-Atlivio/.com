import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-dashboard');
    
    // 1. ESTRUTURA VISUAL (SKELETON)
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
                                <th class="pb-2 text-right">Visual</th>
                            </tr>
                        </thead>
                        <tbody id="analytics-table-body" class="text-gray-300">
                            <tr><td colspan="4" class="py-4 text-center text-gray-500">Analisando dados...</td></tr>
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
                    <p class="font-bold text-blue-400">v16.1 (Analytics Ativo)</p>
                </div>
            </div>
        </div>
    `;
    
    try {
        const db = window.db;

        // =================================================================================
        // 2. CARREGAMENTO DE DADOS (AGORA COM ANALYTICS)
        // =================================================================================
        
        const usersSnap = await getDocs(collection(db, "usuarios"));
        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const providersSnap = await getDocs(qOnline);
        const qJobs = query(collection(db, "jobs"), where("status", "==", "ativa"));
        const jobsSnap = await getDocs(qJobs);

        // =================================================================================
        // 3. PROCESSAMENTO DE DADOS
        // =================================================================================
        let totalSaldo = 0;
        let trafficStats = {}; // { 'zap': 10, 'testedia28': 1 }

        usersSnap.forEach(doc => {
            const data = doc.data();
            
            // Soma Financeira
            const valor = parseFloat(data.wallet_balance || data.saldo || 0);
            totalSaldo += valor;

            // Contagem de Analytics (O SEGREDO ESTÁ AQUI)
            // Lê o campo traffic_source que gravamos no auth.js
            let source = data.traffic_source || 'orgânico';
            
            // Normaliza nomes para ficar bonito no gráfico
            if(source === 'direct') source = 'orgânico';
            
            trafficStats[source] = (trafficStats[source] || 0) + 1;
        });

        // =================================================================================
        // 4. ATUALIZAÇÃO DA TELA
        // =================================================================================
        
        // KPIs
        document.getElementById('kpi-users').innerText = usersSnap.size;
        document.getElementById('kpi-balance').innerText = `R$ ${totalSaldo.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-providers').innerText = providersSnap.size;
        document.getElementById('kpi-jobs').innerText = jobsSnap.size;

        // Tabela Analytics
        const tbody = document.getElementById('analytics-table-body');
        tbody.innerHTML = "";

        // Ordena: Quem trouxe mais gente fica no topo
        const sortedTraffic = Object.entries(trafficStats)
            .sort(([,a], [,b]) => b - a); 

        const totalUsers = usersSnap.size || 1; 

        sortedTraffic.forEach(([origem, count]) => {
            const percent = ((count / totalUsers) * 100).toFixed(1);
            
            // Cores dinâmicas para as barras
            let colorClass = 'bg-gray-600';
            if(origem.includes('zap') || origem.includes('whats')) colorClass = 'bg-green-500';
            if(origem.includes('insta')) colorClass = 'bg-pink-500';
            if(origem.includes('teste')) colorClass = 'bg-amber-500';
            if(origem === 'orgânico') colorClass = 'bg-slate-700';

            tbody.innerHTML += `
                <tr class="border-b border-gray-800 last:border-0 hover:bg-white/5 transition">
                    <td class="py-3 font-bold text-white capitalize">
                        ${origem.replace(/_/g, ' ')} </td>
                    <td class="py-3 text-right font-mono">${count}</td>
                    <td class="py-3 text-right text-[10px] text-gray-400">${percent}%</td>
                    <td class="py-3 pl-4">
                        <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div class="${colorClass} h-1.5 rounded-full" style="width: ${percent}%"></div>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Status
        document.getElementById('chart-status').innerHTML = `
            <p>✅ Banco de Dados: <b>SINCRONIZADO</b></p>
            <p>👥 Ticket Médio: <b>R$ ${(usersSnap.size > 0 ? totalSaldo / usersSnap.size : 0).toFixed(2)}</b></p>
            <p class="mt-2 text-[10px] text-green-400">Rastreando <b>${Object.keys(trafficStats).length}</b> canais de aquisição.</p>
        `;

    } catch(e) { 
        console.error("Erro Dashboard:", e);
        document.getElementById('chart-status').innerHTML = `<span class="text-red-400">Erro: ${e.message}</span>`;
    }
}
