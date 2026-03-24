import { collection, getDocs, query, where, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 📊 INJEÇÃO DO MOTOR GRÁFICO (Chart.js)
const scriptChart = document.createElement('script');
scriptChart.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(scriptChart);
import { renderAssistant } from "./assistant.js"; // 👈 IMPORTA A SECRETÁRIA

// Função para abrir/fechar o detalhe do usuário no Feed Vivo
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

/**
 * 🏧 MOTOR DO BANCO CENTRAL: MESA DE TRABALHO FIXA
 * Esta função apenas preenche a lista, sem esconder os gráficos.
 */
window.abrirMesaTrabalhoPix = async () => {
    const feedback = document.getElementById('feedback-mesa-pix');
    if(!feedback) return;

    // Loader minimalista para não dar tranco visual
    feedback.innerHTML = `<div class="p-4 text-center"><div class="loader mx-auto border-emerald-500 w-5 h-5"></div></div>`;

    try {
        const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 📡 Busca em tempo real na fila de PIX
        const q = query(collection(window.db, "mission_submissions"), where("status", "==", "approved_pending_pix"), orderBy("approved_at", "desc"));
        const snap = await getDocs(q);
        
        if(snap.empty) {
            feedback.innerHTML = `<p class="text-center py-10 text-gray-500 text-[10px] italic uppercase tracking-widest opacity-50">☀️ Banco Central: Fila de PIX vazia.</p>`;
            return;
        }

        feedback.innerHTML = ""; // Limpa loader
        
        for (const d of snap.docs) {
            const m = d.data();
            // Busca dados do usuário (Chave PIX)
            const uSnap = await getDocs(query(collection(window.db, "usuarios"), where("uid", "==", m.user_id)));
            const u = !uSnap.empty ? uSnap.docs[0].data() : {};
            const pix = m.pix_key || u.pix_key || u.chave_pix || 'NÃO CADASTRADA';

            feedback.innerHTML += `
                <div class="bg-slate-800/40 border border-emerald-500/10 p-4 rounded-2xl flex justify-between items-center gap-4 animate-fade mb-2 hover:border-emerald-500/30 transition-all">
                    <div class="text-left">
                        <p class="text-[8px] font-black text-emerald-500 uppercase mb-1">${m.is_saque ? '🏧 RESGATE DE SALDO' : '🎯 MISSÃO B2B'}</p>
                        <h5 class="text-xs font-bold text-white">${m.user_name || 'Usuário'} ──▶ <span class="text-emerald-400">R$ ${parseFloat(m.reward).toFixed(2)}</span></h5>
                        <p class="text-[9px] text-gray-500 font-mono mt-1 italic">PIX: ${pix}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="navigator.clipboard.writeText('${pix}'); alert('Copiado!')" class="bg-slate-700 text-white p-2 rounded-lg text-[9px] font-black uppercase hover:bg-slate-600 transition">📋 Copiar</button>
                        <button onclick="window.finalizarPagamentoComprovanteDashboard('${d.id}')" class="bg-emerald-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95 hover:bg-emerald-500 transition">✅ Pagar</button>
                    </div>
                </div>
            `;
        }

    } catch(e) {
        console.error("Erro na Mesa de PIX:", e);
        feedback.innerHTML = `<p class="text-red-500 text-[9px] uppercase font-bold text-center">Erro na conexão financeira.</p>`;
    }
};

// 🏛️ FINALIZA O PROCESSO: MOVE DA FILA PARA O HISTÓRICO
window.confirmarPagamentoRealizado = async (docId) => {
    if(!confirm("Você confirma que já realizou o PIX no banco? Esta ação é irreversível.")) return;
    
    try {
        await updateDoc(doc(window.db, "mission_submissions", docId), {
            status: 'paid_real',
            finalized_at: serverTimestamp()
        });
        alert("✅ Pagamento registrado com sucesso!");
        window.abrirMesaTrabalhoPix(); // Recarrega a mesa
    } catch(e) {
        alert("Erro ao finalizar: " + e.message);
    }
};

export async function init() {
    // Define que os dados do dashboard (KPIs e Gráficos) entrarão apenas nesta div, preservando o Sentinela no topo
    const container = document.getElementById('dashboard-main-content');
    
   // ✅ SANEAMENTO V605: Garante que o Dashboard inicie limpo para receber os novos KPIs
    // Removemos a verificação de widgets legados para evitar o erro "Unexpected token"
    container.innerHTML = "";

       // Inicia a injeção do HTML. Repare que NÃO tem ponto e vírgula no final da linha, pois o texto continua.
    container.innerHTML += `
        <div id="mesa-pix-pendente" class="animate-fade mb-6">
            <div class="bg-slate-900 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-2xl">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-xl font-black text-white italic uppercase tracking-tighter">Fila de Pagamentos PIX 💰</h3>
                        <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Pague no seu banco e confirme aqui para limpar a fila.</p>
                    </div>
                    <span class="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-lg font-black uppercase animate-pulse">Monitoramento Real-time</span>
                </div>
                <div id="feedback-mesa-pix" class="space-y-3"></div>
            </div>
        </div>

        <div class="flex justify-between items-center mb-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
            <h3 class="text-[10px] font-black text-gray-500 uppercase ml-2">Fluxo de Caixa</h3>
            <div class="flex gap-2">
                <button onclick="window.filtrarPeriodoFinanceiro('mes')" id="btn-filtro-mes" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg transition">Mês Atual</button>
                <button onclick="window.filtrarPeriodoFinanceiro('ano')" id="btn-filtro-ano" class="bg-slate-800 text-gray-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-slate-700 transition">Acumulado Ano</button>
            </div>
        </div>

        <div id="grade-kpis-dashboard" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6 animate-fade">
            <div class="glass-panel p-4 border-t-2 border-blue-500">
                <p class="text-[8px] uppercase font-bold text-gray-500">👥 Base Total</p>
                <h3 class="text-lg font-black text-white" id="kpi-users">--</h3>
            </div>
            <div id="card-financeiro-atlivio" class="glass-panel p-4 border-t-2 border-emerald-500 bg-emerald-500/5 transition-all duration-500">
                <p class="text-[8px] uppercase font-bold text-emerald-400" id="lbl-lucro-real">🏦 CAIXA PIX (BANCÁRIO)</p>
                <h3 class="text-lg font-black text-emerald-400" id="kpi-cofre">R$ 0,00</h3>
                <canvas id="miniChartCaixa" style="max-height: 30px; width: 100%;"></canvas>
                <div id="mini-log-lucros" class="mt-1 h-8 overflow-hidden text-[7px]"></div>
            </div>
            <div class="glass-panel p-4 border-t-2 border-purple-500">
                <p class="text-[8px] uppercase font-bold text-purple-400">🎁 Investimento</p>
                <h3 class="text-lg font-black text-purple-300" id="kpi-investimento">R$ 0,00</h3>
                <p class="text-[6px] text-gray-600 uppercase">Bônus em Circulação</p>
            </div>
            <div class="glass-panel p-4 border-t-2 border-blue-400">
                <p class="text-[8px] uppercase font-bold text-blue-400">🔒 Em Custódia</p>
                <h3 class="text-lg font-black text-white" id="kpi-custodia">R$ 0,00</h3>
            </div>
           <div class="glass-panel p-4 border-t-2 border-slate-500">
                <p class="text-[8px] uppercase font-bold text-gray-400">💳 Saldo Disponível</p>
                <h3 class="text-lg font-black text-white" id="kpi-balance">R$ 0,00</h3>
            </div>
            <div class="glass-panel p-4 border-t-2 border-cyan-500 bg-cyan-500/5">
                <p class="text-[8px] uppercase font-bold text-cyan-400">❄️ Congelados (>1 Ano)</p>
                <h3 class="text-lg font-black text-white" id="kpi-frozen">R$ 0,00</h3>
                <p class="text-[6px] text-gray-500 uppercase">Aguardando Recarga</p>
            </div>
            <div class="glass-panel p-4 border-t-2 border-red-500">
                <p class="text-[8px] uppercase font-bold text-red-500">🔥 Risco / Dívida</p>
                <h3 class="text-lg font-black text-red-400" id="kpi-dividas">R$ 0,00</h3>
            </div>

            <div class="glass-panel p-4 border-t-2 border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                <p class="text-[8px] uppercase font-black text-amber-500">💎 Receita Atlivio</p>
                <h3 class="text-lg font-black text-white" id="kpi-taxas-total">R$ 0,00</h3>
                <p class="text-[6px] text-gray-500 uppercase">Lucro de Intermediação</p>
            </div>
            <div class="glass-panel p-4 border-t-2 border-orange-500 bg-orange-500/5">
                <p class="text-[8px] uppercase font-bold text-orange-400">⏳ Expira (30 dias)</p>
                <h3 class="text-lg font-black text-orange-400" id="kpi-expiracao">R$ 0,00</h3>
                <p class="text-[6px] text-gray-500 uppercase">Créditos Prestes a Vencer</p>
            </div>
        </div> 
    `;
        
       // 🚀 V606: Injeção Segura da Segunda Grade (Tráfego e Radar)
    container.innerHTML += `
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

      // 🚀 RESTAURANDO A ALMA DA SECRETÁRIA: 
        // Ela vai morar no topo fixo que criamos no admin.html
        renderAssistant('dash-assistant-area');

        // =================================================================================
        // CARREGAMENTO DOS DADOS (CÓDIGO ANTERIOR MANTIDO IGUAL)
        // =================================================================================
        const usersSnap = await getDocs(collection(db, "usuarios"));
        
        let somaSaldoPositivo = 0;
        let somaDividasNegativas = 0;
        let somaCustodiaTotal = 0;
        let trafficStats = {}; 
        let userSourceMap = {};

        let somaBonusTotal = 0; // Novo acumulador de investimento

        usersSnap.forEach(uDoc => {
            const uData = uDoc.data();
            const valBal = Number(uData.wallet_balance || 0); // Dinheiro Real
            const valBonus = Number(uData.wallet_bonus || 0); // Dinheiro Presente
            const valRes = Number(uData.wallet_reserved || 0); // Dinheiro em Custódia
            
            // 💰 1. Soma Patrimônio Real dos Clientes
            if (valBal > 0) somaSaldoPositivo += valBal;
            
            // 📉 2. Soma Inadimplência (Dívidas Técnicas)
            else if (valBal < 0) somaDividasNegativas += Math.abs(valBal);
            
            // 🎁 3. Soma Investimento de Marketing (Bônus não usado)
            somaBonusTotal += valBonus;
            
            // 🔒 4. Soma Reservas de Segurança
            somaCustodiaTotal += valRes;

            let source = uData.traffic_source || 'orgânico';
            if(source === 'direct') source = 'orgânico';
            trafficStats[source] = (trafficStats[source] || 0) + 1;
            userSourceMap[uDoc.id] = source;

            // 🕒 VARREDURA DE VALIDADE V2026: Monitora bônus que expiram em breve
            if(valBonus > 0) {
                // Futuramente: Injetar busca na subcoleção 'ledger' aqui
            }
        });

       // 🚀 ESCUTA REAL-TIME DO COFRE (Monitor de Saldo + Gráfico de Fluxo)
        let histCaixa = []; // Memória temporária para o desenho da linha
        onSnapshot(doc(db, "sys_finance", "receita_total"), (snapDoc) => {
            if (snapDoc.exists()) {
                const total = snapDoc.data().total_acumulado || 0;
                const elCofre = document.getElementById('kpi-cofre');
                const elCard = document.getElementById('card-financeiro-atlivio');
                const elLabel = document.getElementById('lbl-lucro-real');

                if (elCofre) {
                    elCofre.innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                    
                    // Alerta de cor para saldo negativo
                    if (total < 0) {
                        elCofre.style.color = "#ef4444";
                        if(elLabel) elLabel.style.color = "#f87171"; 
                        if(elCard) { elCard.style.borderColor = "#ef4444"; elCard.style.background = "rgba(239, 68, 68, 0.1)"; }
                    } else {
                        elCofre.style.color = "#10b981";
                        if(elLabel) elLabel.style.color = "#34d399";
                        if(elCard) { elCard.style.borderColor = "#10b981"; elCard.style.background = "rgba(16, 185, 129, 0.05)"; }
                    }

                    // 📈 ATUALIZAÇÃO DO MINI GRÁFICO (Linha de Tendência)
                    histCaixa.push(total);
                    if (histCaixa.length > 15) histCaixa.shift(); // Mantém apenas os últimos 15 pontos
                    if (window.atualizarMiniGraficoCaixa) window.atualizarMiniGraficoCaixa(histCaixa);
                }
            }
        });

        // 🛰️ SENSOR DE RECEITA: Escuta o cofre de taxas acumuladas (Chat + B2B)
        onSnapshot(doc(db, "sys_finance", "fees_b2b"), (snapFees) => {
            if (snapFees.exists()) {
                const totalAcumulado = snapFees.data().total_taxas_acumulado || 0;
                const elTaxas = document.getElementById('kpi-taxas-total');
                if (elTaxas) {
                    elTaxas.innerText = `R$ ${totalAcumulado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                }
            }
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
        // ✅ INJEÇÃO V604: Alimenta os 6 cards com a realidade do banco de dados
        if(document.getElementById('kpi-users')) document.getElementById('kpi-users').innerText = usersSnap.size;
        if(document.getElementById('kpi-custodia')) document.getElementById('kpi-custodia').innerText = `R$ ${somaCustodiaTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-balance')) document.getElementById('kpi-balance').innerText = `R$ ${somaSaldoPositivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-dividas')) document.getElementById('kpi-dividas').innerText = `R$ ${somaDividasNegativas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-investimento')) document.getElementById('kpi-investimento').innerText = `R$ ${somaBonusTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        if(document.getElementById('kpi-expiracao')) document.getElementById('kpi-expiracao').innerText = `R$ 0,00`; // Placeholder funcional
        
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

        // 🚀 MOTOR DO RADAR ADMIN: Monitora In Progress e Dispute (SEPARADOS)
        const qRadar = query(collection(db, "orders"), where("status", "in", ["in_progress", "dispute"]), orderBy("created_at", "desc"));
        onSnapshot(qRadar, (snap) => {
            const radarContainer = document.getElementById('admin-monitor-radar');
            if(!radarContainer) return;
            radarContainer.innerHTML = "";

            if(snap.empty) {
                radarContainer.innerHTML = `<div class="p-10 text-center opacity-30 uppercase font-black text-[10px]">Céu Limpo ☀️</div>`;
                return;
            }

            let htmlDisputas = `<p class="text-[9px] font-black text-red-500 mb-2 border-b border-red-500/20 pb-1">⚖️ DISPUTAS ATIVAS</p>`;
            let htmlAndamento = `<p class="text-[9px] font-black text-blue-400 mt-4 mb-2 border-b border-blue-400/20 pb-1">🛠️ EM EXECUÇÃO</p>`;
            let temDisputa = false;
            let temAndamento = false;

            snap.forEach(d => {
                const p = d.data();
                const isDispute = p.status === 'dispute';
                const inicio = p.real_start?.toDate ? p.real_start.toDate() : new Date(p.real_start);
                const decorridoH = Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60));
                
                const cardHtml = `
                    <div class="p-3 rounded-xl border ${isDispute ? 'border-red-500 bg-red-900/10' : 'border-slate-700 bg-slate-800/50'} animate-fade mb-2">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-[8px] font-black ${isDispute ? 'text-red-500' : 'text-blue-400'} uppercase">${isDispute ? 'DISPUTA' : 'ANDAMENTO'}</span>
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

                if(isDispute) { htmlDisputas += cardHtml; temDisputa = true; }
                else { htmlAndamento += cardHtml; temAndamento = true; }
            });

            radarContainer.innerHTML = (temDisputa ? htmlDisputas : "") + (temAndamento ? htmlAndamento : "");
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

// 🔐 SOLDAGEM MAESTRO: Garante que as funções financeiras existam globalmente para o robô e o sistema
window.showPixWorkdesk = window.abrirMesaTrabalhoPix;
window.processarPagamentoMissao = window.confirmarPagamentoRealizado;
window.renderPixList = window.abrirMesaTrabalhoPix;

// 📊 MOTOR DE DESENHO: FLUXO DE CAIXA EM TEMPO REAL
let meuGraficoCaixa = null;
window.atualizarMiniGraficoCaixa = (dados) => {
    const ctx = document.getElementById('miniChartCaixa');
    if (!ctx || !window.Chart) return;

    if (meuGraficoCaixa) {
        meuGraficoCaixa.data.datasets[0].data = dados;
        meuGraficoCaixa.update('none'); // Update suave sem travar o PC
        return;
    }

    meuGraficoCaixa = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dados.map(() => ""), // Sem textos no fundo para não poluir
            datasets: [{
                data: dados,
                borderColor: '#10b981',
                borderWidth: 2,
                pointRadius: 0, // Linha pura, estilo batimento cardíaco
                fill: true,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4 // Linha curva suave
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
};

// =============================================================================
// 🏦 MOTOR DO BANCO CENTRAL V2026 (MIGRADO DO MISSIONS)
// =============================================================================

/**
 * 📅 FILTRAGEM TEMPORAL DE LUCROS
 * Permite alternar a visão entre o mês atual e o acumulado do ano.
 */
window.filtrarPeriodoFinanceiro = async (periodo) => {
    const btnMes = document.getElementById('btn-filtro-mes');
    const btnAno = document.getElementById('btn-filtro-ano');
    
    // Ajuste Visual dos Botões
    if(periodo === 'mes') {
        btnMes.className = "bg-blue-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg transition";
        btnAno.className = "bg-slate-800 text-gray-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-slate-700 transition";
    } else {
        btnAno.className = "bg-blue-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg transition";
        btnMes.className = "bg-slate-800 text-gray-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-slate-700 transition";
    }

    console.log(`📡 Filtrando Banco Central para: ${periodo.toUpperCase()}`);
    // Gil, a lógica de soma por data será injetada no PASSO 5 para não sobrecarregar agora.
};

/**
 * 🏧 MESA DE TRABALHO PIX (BANCO CENTRAL)
 * Carrega a fila de pagamentos pendentes integrada ao Dashboard.
 */
window.abrirMesaTrabalhoPix = async () => {
    const mesa = document.getElementById('mesa-pix-pendente');
    const grade = document.getElementById('grade-kpis-dashboard');
    const feed = document.getElementById('feedback-mesa-pix');
    
    if(!mesa || !grade) return;
    
    grade.classList.add('hidden');
    mesa.classList.remove('hidden');
    feed.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto border-emerald-500"></div></div>`;

    try {
        const { collection, query, where, orderBy, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(window.db, "mission_submissions"), where("status", "==", "approved_pending_pix"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        if(snap.empty) {
            feed.innerHTML = `<p class="text-center py-20 text-gray-500 text-[10px] italic uppercase">Céu limpo! Nenhum PIX na fila. ☀️</p>`;
            return;
        }

        feed.innerHTML = "";
        for (const d of snap.docs) {
            const m = d.data();
            // Busca a chave PIX no perfil do usuário por segurança
            const uSnap = await getDocs(query(collection(window.db, "usuarios"), where("uid", "==", m.user_id)));
            const userPix = !uSnap.empty ? (uSnap.docs[0].data().pix_key || uSnap.docs[0].data().chave_pix) : 'Não cadastrada';

            feed.innerHTML += `
                <div class="bg-slate-800/50 border border-emerald-500/20 p-4 rounded-2xl flex justify-between items-center gap-4 animate-fadeIn mb-3">
                    <div class="text-left">
                        <p class="text-[8px] font-black text-emerald-400 uppercase mb-1">${m.is_saque ? '🏧 RESGATE DE SALDO' : '🎯 MISSÃO B2B'}</p>
                        <h5 class="text-xs font-bold text-white">${m.user_name || 'Usuário'} ──▶ R$ ${m.reward.toFixed(2)}</h5>
                        <p class="text-[9px] text-gray-500 font-mono mt-1">PIX: ${userPix}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="navigator.clipboard.writeText('${userPix}'); alert('Copiado!')" class="bg-slate-700 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase">📋 Copiar</button>
                        <button onclick="window.finalizarPagamentoComprovanteDashboard('${d.id}')" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95">✅ Pagar</button>
                    </div>
                </div>
            `;
        }
    } catch(e) { console.error("Erro Banco Central:", e); }
};

/**
 * 📤 FINALIZAÇÃO DE SAQUE COM COMPROVANTE (MESA DASHBOARD)
 * Abre a galeria, comprime a imagem e executa a baixa contábil.
 */
window.finalizarPagamentoComprovanteDashboard = async (docId) => {
    if(!confirm("⚠️ Banco Central: Confirma que o PIX já foi feito?\nClique em OK para selecionar o comprovante.")) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        console.log("📑 Banco Central: Processando comprovante...");

        try {
            // MOTOR DE COMPRESSÃO ATLIVIO (Reduz peso para o banco)
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const scale = 800 / Math.max(bitmap.width, bitmap.height);
            canvas.width = bitmap.width * scale;
            canvas.height = bitmap.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            
            const base64Img = canvas.toDataURL('image/jpeg', 0.6);

            const { doc, runTransaction, serverTimestamp, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            await runTransaction(window.db, async (transaction) => {
                const subRef = doc(window.db, "mission_submissions", docId);
                const subSnap = await transaction.get(subRef);
                if (!subSnap.exists()) throw "Registro sumiu do banco!";
                
                const data = subSnap.data();
                const valor = parseFloat(data.reward);

                // 1. Baixa no Status e Anexo de Comprovante
                transaction.update(subRef, {
                    status: 'paid_real',
                    receipt_url: base64Img,
                    finalized_at: serverTimestamp()
                });

                // 2. Débito no Caixa Geral (receita_total)
                const cofreRef = doc(window.db, "sys_finance", "receita_total");
                transaction.update(cofreRef, {
                    total_acumulado: increment(-valor),
                    ultima_atualizacao: serverTimestamp()
                });
            });

            alert("💸 BANCO CENTRAL: Pagamento liquidado com sucesso!");
            window.abrirMesaTrabalhoPix(); // Atualiza a fila
            
        } catch(err) { 
            console.error(err);
            alert("❌ Erro no Banco Central: " + err.message); 
        }
    };
    input.click();
};

// 🔐 SOLDAGEM FINAL DAS PONTES DO BANCO CENTRAL
window.confirmarPagamentoRealizado = window.finalizarPagamentoComprovanteDashboard;
window.abrirMesaTrabalhoPix = window.abrirMesaTrabalhoPix;

console.log("🚀 [Dashboard] Motor Financeiro e Gráficos de Fluxo Soldados!");
