import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Função para abrir/fechar o detalhe do usuário (Exposta no Window)
window.toggleFeed = (uid) => {
    const el = document.getElementById(`feed-details-${uid}`);
    const btn = document.getElementById(`btn-feed-${uid}`);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btn.innerText = "▲ FECHAR";
        btn.classList.add('text-red-400');
    } else {
        el.classList.add('hidden');
        btn.innerText = "▼ EXPANDIR";
        btn.classList.remove('text-red-400');
    }
};

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

            <div class="glass-panel p-0 flex flex-col h-[500px] overflow-hidden">
                <div class="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
                    <h4 class="font-bold text-white text-xs flex items-center gap-2">
                        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> SESSÕES AO VIVO
                    </h4>
                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Tempo Real</span>
                </div>
                
                <div id="live-feed-list" class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/20">
                    <p class="text-center text-gray-500 text-xs mt-10">Monitorando...</p>
                </div>
            </div>
        </div>
    `;
    
    try {
        const db = window.db;

        // =================================================================================
        // 2. CARREGAMENTO DOS DADOS ESTÁTICOS
        // =================================================================================
        const usersSnap = await getDocs(collection(db, "usuarios"));
        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const providersSnap = await getDocs(qOnline);
        const qJobs = query(collection(db, "jobs"), where("status", "==", "ativa"));
        const jobsSnap = await getDocs(qJobs);

        let totalSaldo = 0;
        let trafficStats = {}; 

        // Mapa auxiliar para saber a origem de cada usuário pelo ID
        let userSourceMap = {};

        usersSnap.forEach(doc => {
            const data = doc.data();
            const valor = parseFloat(data.wallet_balance || data.saldo || 0);
            totalSaldo += valor;
            
            let source = data.traffic_source || 'orgânico';
            if(source === 'direct') source = 'orgânico';
            
            trafficStats[source] = (trafficStats[source] || 0) + 1;
            
            // Guarda a origem para usar no feed
            userSourceMap[doc.id] = source;
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
            if(origem.includes('zap')) colorClass = 'bg-green-500';
            if(origem.includes('insta')) colorClass = 'bg-pink-500';
            if(origem.includes('teste')) colorClass = 'bg-amber-500';

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
        // 3. LIVE FEED AGRUPADO (Sessão por Usuário)
        // =================================================================================
        const feedContainer = document.getElementById('live-feed-list');
        const qFeed = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
        
        onSnapshot(qFeed, (snap) => {
            if(snap.empty) return;
            
            // Lógica de Agrupamento
            const sessions = {};
            
            snap.forEach(d => {
                const evt = d.data();
                const uid = evt.uid || "visitante";
                
                if(!sessions[uid]) {
                    sessions[uid] = {
                        user: evt.user,
                        uid: uid,
                        lastTime: evt.timestamp,
                        actions: [],
                        source: userSourceMap[uid] || 'visitante'
                    };
                }
                sessions[uid].actions.push(evt);
            });

            // Renderização
            feedContainer.innerHTML = "";
            
            Object.values(sessions).forEach(sessao => {
                const timeStr = sessao.lastTime ? sessao.lastTime.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--';
                const qtdAcoes = sessao.actions.length;
                
                // Badge de Origem
                let badgeClass = "bg-gray-700 text-gray-300";
                if(sessao.source.includes('zap')) badgeClass = "bg-green-900 text-green-300 border border-green-700";
                if(sessao.source.includes('teste')) badgeClass = "bg-amber-900 text-amber-300 border border-amber-700";

                // Ícones na lista interna
                const actionsHtml = sessao.actions.map(a => {
                    let icon = '🖱️';
                    if(a.details.includes('tab-')) icon = '📑';
                    if(a.action === 'Cadastro') icon = '🆕';
                    
                    const t = a.timestamp ? a.timestamp.toDate().toLocaleTimeString([],{second:'2-digit'}) : '';
                    return `<div class="flex items-center gap-2 text-[10px] text-gray-400 border-l border-gray-700 pl-2 ml-1">
                        <span class="font-mono text-gray-600">${t}</span>
                        <span>${icon} ${a.details.replace('Botão:', '')}</span>
                    </div>`;
                }).join('');

                feedContainer.innerHTML += `
                    <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-sm animate-fadeIn">
                        <div class="flex justify-between items-center mb-1">
                            <div class="flex items-center gap-2">
                                <span class="font-mono text-xs text-blue-400">${timeStr}</span>
                                <span class="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${badgeClass}">${sessao.source}</span>
                            </div>
                            <button id="btn-feed-${sessao.uid}" onclick="window.toggleFeed('${sessao.uid}')" class="text-[9px] font-bold text-blue-400 hover:text-white uppercase transition bg-black/20 px-2 py-1 rounded">
                                ▼ EXPANDIR
                            </button>
                        </div>
                        
                        <div class="flex justify-between items-end">
                            <p class="text-xs font-bold text-white truncate max-w-[150px]" title="${sessao.user}">${sessao.user.split('@')[0]}</p>
                            <p class="text-[9px] text-gray-400">${qtdAcoes} ações recentes</p>
                        </div>

                        <div id="feed-details-${sessao.uid}" class="hidden mt-3 space-y-1 bg-black/20 p-2 rounded">
                            ${actionsHtml}
                        </div>
                    </div>
                `;
            });
        });

    } catch(e) { 
        console.error("Erro Dashboard:", e);
    }
}
