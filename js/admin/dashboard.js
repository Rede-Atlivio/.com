import { collection, getDocs, query, where, orderBy, limit, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderAssistant } from "./assistant.js"; // 👈 IMPORTA A SECRETÁRIA

// Função para abrir/fechar o detalhe do usuário
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
    
    // 1. ESTRUTURA VISUAL (COM ÁREA DA SECRETÁRIA)
    container.innerHTML = `
        <div id="admin-assistant-widget"></div>

       <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div class="glass-panel p-4 border-l-2 border-blue-500">
                <p class="text-[9px] uppercase font-bold text-gray-400">👥 Usuários</p>
                <h3 class="text-xl font-black text-white" id="kpi-users">--</h3>
            </div>
            <div class="glass-panel p-4 border-l-2 border-emerald-500 bg-emerald-500/5 flex flex-col justify-between overflow-hidden">
                <div>
                    <p class="text-[9px] uppercase font-bold text-emerald-400">💰 Cofre Atlivio</p>
                    <h3 class="text-xl font-black text-emerald-400" id="kpi-cofre">R$ 0,00</h3>
                </div>
                <div id="mini-log-lucros" class="mt-2 space-y-1 h-12 overflow-y-auto custom-scrollbar border-t border-emerald-500/20 pt-1">
                    <p class="text-[7px] text-gray-500 uppercase font-bold">Aguardando taxas...</p>
                </div>
            </div>
            <div class="glass-panel p-4 border-l-2 border-amber-500">
                <p class="text-[9px] uppercase font-bold text-amber-400">🔐 Em Custódia</p>
                <h3 class="text-xl font-black text-amber-400" id="kpi-custodia">R$ 0,00</h3>
            </div>
            <div class="glass-panel p-4 border-l-2 border-slate-500">
                <p class="text-[9px] uppercase font-bold text-gray-400">💳 Saldo Clientes</p>
                <h3 class="text-xl font-black text-white" id="kpi-balance">R$ 0,00</h3>
            </div>
            <div class="glass-panel p-4 border-l-2 border-red-500">
                <p class="text-[9px] uppercase font-bold text-red-400">📉 Dívidas Totais</p>
                <h3 class="text-xl font-black text-red-400" id="kpi-dividas">R$ 0,00</h3>
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

            <div class="glass-panel p-0 flex flex-col h-[500px] overflow-hidden border border-amber-500/20">
                <div class="p-4 border-b border-gray-700 bg-amber-500/10 flex justify-between items-center">
                    <h4 class="font-bold text-white text-xs flex items-center gap-2">
                        <span class="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span> RADAR DE EXECUÇÃO
                    </h4>
                    <button onclick="window.liquidarTodasExpiradas()" class="text-[9px] bg-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-black px-2 py-1 rounded-lg font-black border border-amber-500/30 transition shadow-lg">⚡ LIQUIDAR TODAS (>12H)</button>
                </div>
                <div id="admin-monitor-radar" class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/20">
                    <p class="text-center text-gray-500 text-xs mt-10 italic">Aguardando dados críticos...</p>
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

        // 🚀 CHAMA A SECRETÁRIA PARA TRABALHAR
        renderAssistant('admin-assistant-widget');

        // =================================================================================
        // CARREGAMENTO DOS DADOS (CÓDIGO ANTERIOR MANTIDO IGUAL)
        // =================================================================================
        const usersSnap = await getDocs(collection(db, "usuarios"));
        
        let somaSaldoPositivo = 0;
        let somaDividasNegativas = 0;
        let somaCustodiaTotal = 0;
        let trafficStats = {}; 
        let userSourceMap = {};

        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            const valBal = Number(uData.wallet_balance || 0);
            const valRes = Number(uData.wallet_reserved || 0);
            
            if (valBal > 0) somaSaldoPositivo += valBal;
            else if (valBal < 0) somaDividasNegativas += Math.abs(valBal);
            
            somaCustodiaTotal += valRes;

            let source = uData.traffic_source || 'orgânico';
            if(source === 'direct') source = 'orgânico';
            trafficStats[source] = (trafficStats[source] || 0) + 1;
            userSourceMap[uDoc.id] = source;
        });

        // 🚀 ESCUTA REAL-TIME DO COFRE (Plataforma)
        onSnapshot(doc(db, "sys_finance", "receita_total"), (snapDoc) => {
            const total = snapDoc.exists() ? snapDoc.data().total_acumulado || 0 : 0;
            const elCofre = document.getElementById('kpi-cofre');
            if(elCofre) elCofre.innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        });

        // 🚀 LOG DE ÚLTIMOS LUCROS (TAXAS)
        const qTaxas = query(collection(db, "extrato_financeiro"), orderBy("timestamp", "desc"), limit(5));
        onSnapshot(qTaxas, (snapTaxas) => {
            const logContainer = document.getElementById('mini-log-lucros');
            if(!logContainer) return;
            logContainer.innerHTML = "";
            snapTaxas.forEach(d => {
                const data = d.data();
                if(data.tipo.includes("RESERVA") || data.tipo.includes("GANHO")) {
                    const valorAbs = Math.abs(data.valor);
                    logContainer.innerHTML += `
                        <div class="flex justify-between items-center text-[8px] animate-fadeIn">
                            <span class="text-gray-400 font-mono">${data.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || '--:--'}</span>
                            <span class="text-emerald-500 font-bold font-mono">+ R$ ${valorAbs.toFixed(2)}</span>
                        </div>`;
                }
            });
            if(logContainer.innerHTML === "") logContainer.innerHTML = `<p class="text-[7px] text-gray-500">Aguardando taxas...</p>`;
        });

        // Atualiza a Interface (Apenas IDs existentes no novo HTML de 5 colunas)
        if(document.getElementById('kpi-users')) document.getElementById('kpi-users').innerText = usersSnap.size;
        if(document.getElementById('kpi-custodia')) document.getElementById('kpi-custodia').innerText = `R$ ${somaCustodiaTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-balance')) document.getElementById('kpi-balance').innerText = `R$ ${somaSaldoPositivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-dividas')) document.getElementById('kpi-dividas').innerText = `R$ ${somaDividasNegativas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
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

        // 3. LIVE FEED
        const feedContainer = document.getElementById('live-feed-list');
        const qFeed = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
        
        onSnapshot(qFeed, (snap) => {
            if(snap.empty) return;
            const sessions = {};
            
            snap.forEach(d => {
                const evt = d.data();
                const uid = evt.uid || "visitante";
                if(!sessions[uid]) {
                    sessions[uid] = {
                        user: evt.user, uid: uid, lastTime: evt.timestamp,
                        actions: [], source: userSourceMap[uid] || 'visitante'
                    };
                }
                sessions[uid].actions.push(evt);
            });

            feedContainer.innerHTML = "";
            Object.values(sessions).forEach(sessao => {
                const timeStr = sessao.lastTime ? sessao.lastTime.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--';
                const qtdAcoes = sessao.actions.length;
                let badgeClass = "bg-gray-700 text-gray-300";
                if(sessao.source.includes('zap')) badgeClass = "bg-green-900 text-green-300 border border-green-700";
                if(sessao.source.includes('teste')) badgeClass = "bg-amber-900 text-amber-300 border border-amber-700";

                const actionsHtml = sessao.actions.map(a => {
                    let icon = '🖱️';
                    if(a.details.includes('tab-')) icon = '📑';
                    if(a.action === 'Cadastro') icon = '🆕';
                    const t = a.timestamp ? a.timestamp.toDate().toLocaleTimeString([],{second:'2-digit'}) : '';
                    return `<div class="flex items-center gap-2 text-[10px] text-gray-400 border-l border-gray-700 pl-2 ml-1"><span class="font-mono text-gray-600">${t}</span><span>${icon} ${a.details.replace('Botão:', '')}</span></div>`;
                }).join('');

                feedContainer.innerHTML += `
                    <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-sm animate-fadeIn">
                        <div class="flex justify-between items-center mb-1">
                            <div class="flex items-center gap-2"><span class="font-mono text-xs text-blue-400">${timeStr}</span><span class="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${badgeClass}">${sessao.source}</span></div>
                            <button id="btn-feed-${sessao.uid}" onclick="window.toggleFeed('${sessao.uid}')" class="text-[9px] font-bold text-blue-400 hover:text-white uppercase transition bg-black/20 px-2 py-1 rounded">▼ EXPANDIR</button>
                        </div>
                        <div class="flex justify-between items-end"><p class="text-xs font-bold text-white truncate max-w-[150px]" title="${sessao.user}">${sessao.user.split('@')[0]}</p><p class="text-[9px] text-gray-400">${qtdAcoes} ações recentes</p></div>
                        <div id="feed-details-${sessao.uid}" class="hidden mt-3 space-y-1 bg-black/20 p-2 rounded">${actionsHtml}</div>
                    </div>`;
            });
        });

        // 🚀 MOTOR DO RADAR ADMIN: Monitora In Progress e Dispute
        const qRadar = query(collection(db, "orders"), where("status", "in", ["in_progress", "dispute"]), orderBy("created_at", "desc"));
        onSnapshot(qRadar, (snap) => {
            const radarContainer = document.getElementById('admin-monitor-radar');
            if(!radarContainer) return;
            radarContainer.innerHTML = "";

            if(snap.empty) {
                radarContainer.innerHTML = `<div class="p-10 text-center opacity-30 uppercase font-black text-[10px]">Céu Limpo ☀️</div>`;
                return;
            }

            snap.forEach(d => {
                const p = d.data();
                const isDispute = p.status === 'dispute';
                const inicio = p.real_start?.toDate ? p.real_start.toDate() : new Date(p.real_start);
                const decorridoH = Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60));
                
                radarContainer.innerHTML += `
                    <div class="p-3 rounded-xl border ${isDispute ? 'border-red-500 bg-red-900/10' : 'border-slate-700 bg-slate-800/50'} animate-fade">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[9px] font-black ${isDispute ? 'text-red-500' : 'text-blue-400'} uppercase">${isDispute ? '⚖️ DISPUTA' : '🛠️ EM EXECUÇÃO'}</span>
                            <span class="text-[10px] font-mono text-white font-bold">R$ ${p.offer_value}</span>
                        </div>
                        <p class="text-xs font-bold text-white truncate">${p.provider_name} ➔ ${p.client_name}</p>
                        <div class="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                            <span class="text-[9px] font-bold ${decorridoH >= 12 ? 'text-amber-500 animate-pulse' : 'text-gray-500'}">${decorridoH}h decorridas</span>
                            <div class="flex gap-1.5">
                                <button onclick="window.switchView('audit'); setTimeout(() => window.buscarPedidoAuditoria('${d.id}'), 300)" class="bg-slate-700 p-1.5 rounded text-white" title="Investigar Chat">🕵️</button>
                                <button onclick="window.finalizarManualmente('${d.id}')" class="flex-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-[8px] font-black uppercase rounded transition border border-blue-500/30">Pagar ✅</button>
                                <button onclick="window.reembolsarManualmente('${d.id}')" class="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-[8px] font-black uppercase rounded transition border border-red-500/30">Reembolsar ♻️</button>
                            </div>
                        </div>
                    </div>`;
            });
        });

    } catch(e) { console.error("Erro Dashboard:", e); }
}
// ⚡ MOTOR DE LIQUIDAÇÃO EM MASSA (ATLIVIO ADMIN V55)
window.liquidarTodasExpiradas = async () => {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    if (!confirm("⚠️ AÇÃO EM MASSA: Deseja liquidar TODOS os serviços com mais de 12h de atraso agora?")) return;

    try {
        const q = query(collection(window.db, "orders"), where("system_step", "==", 3), where("status", "==", "in_progress"));
        const snap = await getDocs(q);
        let cont = 0;

        for (const d of snap.docs) {
            const p = d.data();
            const inicio = p.real_start?.toDate ? p.real_start.toDate() : new Date(p.real_start);
            const decorridoH = (Date.now() - inicio.getTime()) / (1000 * 60 * 60);

            if (decorridoH >= 12) {
                console.log(`📡 Liquidando Automático: ${d.id}`);
                await window.finalizarManualmente(d.id); // Reutiliza a ponte que já criamos
                cont++;
            }
        }
        alert(`✅ SUCESSO: ${cont} serviços foram liquidados e pagos aos prestadores.`);
        window.switchView('dashboard');
    } catch (e) { alert("Erro na varredura: " + e.message); }
};
