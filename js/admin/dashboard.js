import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-dashboard');
    
    // 1. ESTRUTURA VISUAL
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
                <h4 class="font-bold text-white mb-4 flex items-center gap-2">📊 Fontes de Tráfego</h4>
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

            <div class="glass-panel p-0 flex flex-col h-[400px] overflow-hidden">
                <div class="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h4 class="font-bold text-white text-xs flex items-center gap-2">
                        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> AO VIVO
                    </h4>
                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Feed Real-Time</span>
                </div>
                
                <div id="live-feed-list" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <p class="text-center text-gray-500 text-xs mt-10">Aguardando ações...</p>
                </div>
            </div>
        </div>
    `;
    
    try {
        const db = window.db;

        // =================================================================================
        // 2. CARREGAMENTO DOS DADOS ESTÁTICOS (KPIS + ANALYTICS)
        // =================================================================================
        const usersSnap = await getDocs(collection(db, "usuarios"));
        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const providersSnap = await getDocs(qOnline);
        const qJobs = query(collection(db, "jobs"), where("status", "==", "ativa"));
        const jobsSnap = await getDocs(qJobs);

        let totalSaldo = 0;
        let trafficStats = {}; 

        usersSnap.forEach(doc => {
            const data = doc.data();
            const valor = parseFloat(data.wallet_balance || data.saldo || 0);
            totalSaldo += valor;
            let source = data.traffic_source || 'orgânico';
            if(source === 'direct') source = 'orgânico';
            trafficStats[source] = (trafficStats[source] || 0) + 1;
        });

        document.getElementById('kpi-users').innerText = usersSnap.size;
        document.getElementById('kpi-balance').innerText = `R$ ${totalSaldo.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-providers').innerText = providersSnap.size;
        document.getElementById('kpi-jobs').innerText = jobsSnap.size;

        const tbody = document.getElementById('analytics-table-body');
        tbody.innerHTML = "";
        const sortedTraffic = Object.entries(trafficStats).sort(([,a], [,b]) => b - a); 
        const totalUsers = usersSnap.size || 1; 

        sortedTraffic.forEach(([origem, count]) => {
            const percent = ((count / totalUsers) * 100).toFixed(1);
            let colorClass = 'bg-gray-600';
            if(origem.includes('zap') || origem.includes('whats')) colorClass = 'bg-green-500';
            if(origem.includes('insta')) colorClass = 'bg-pink-500';
            if(origem.includes('teste')) colorClass = 'bg-amber-500';
            if(origem === 'orgânico') colorClass = 'bg-slate-700';

            tbody.innerHTML += `
                <tr class="border-b border-gray-800 last:border-0 hover:bg-white/5 transition">
                    <td class="py-3 font-bold text-white capitalize">${origem.replace(/_/g, ' ')}</td>
                    <td class="py-3 text-right font-mono">${count}</td>
                    <td class="py-3 text-right text-[10px] text-gray-400">${percent}%</td>
                    <td class="py-3 pl-4"><div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden"><div class="${colorClass} h-1.5 rounded-full" style="width: ${percent}%"></div></div></td>
                </tr>
            `;
        });

        // =================================================================================
        // 3. ATIVAÇÃO DO LIVE FEED (LISTENER REAL-TIME)
        // =================================================================================
        const feedContainer = document.getElementById('live-feed-list');
        const qFeed = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(20));
        
        onSnapshot(qFeed, (snap) => {
            if(snap.empty) return;
            
            feedContainer.innerHTML = "";
            snap.forEach(d => {
                const evt = d.data();
                const time = evt.timestamp ? evt.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : '...';
                
                // Ícones baseados na ação
                let icon = '🖱️';
                if(evt.action.includes('Contratar')) icon = '🤝';
                if(evt.action.includes('Cadastro')) icon = '👤';
                if(evt.action.includes('Login')) icon = '🔑';
                if(evt.action.includes('Vaga')) icon = '💼';

                feedContainer.innerHTML += `
                    <div class="flex gap-3 items-start animate-fadeIn border-b border-gray-800 pb-2 last:border-0">
                        <div class="mt-1 opacity-70 text-sm">${icon}</div>
                        <div>
                            <p class="text-[10px] font-mono text-blue-400 mb-0.5">${time}</p>
                            <p class="text-xs font-bold text-white leading-tight">${evt.details}</p>
                            <p class="text-[9px] text-gray-500 mt-0.5 truncate max-w-[150px]">${evt.user}</p>
                        </div>
                    </div>
                `;
            });
        });

    } catch(e) { 
        console.error("Erro Dashboard:", e);
    }
}
