import { collection, getDocs, doc, updateDoc, query, orderBy, limit, where, serverTimestamp, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
// ============================================================================
// 1. INICIALIZAÇÃO COM BUSCA E FILTROS
// ============================================================================
export async function init() {
    const container = document.getElementById('view-finance');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-fade">
            <div class="glass-panel p-6 border-l-4 border-emerald-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-emerald-400 mb-1">💰 SALDO REAL (PIX)</p>
                <h3 class="text-2xl font-black text-white" id="fin-saldo-real">R$ 0,00</h3>
                <p class="text-[8px] text-gray-500 mt-1">Patrimônio Real dos Usuários</p>
            </div>
            <div class="glass-panel p-6 border-l-4 border-purple-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-purple-400 mb-1">🎁 FUNDO BÔNUS</p>
                <h3 class="text-2xl font-black text-white" id="fin-saldo-bonus">0,00 AX</h3>
                <p class="text-[8px] text-gray-500 mt-1">Investimento de Marketing Ativo</p>
            </div>
            <div class="glass-panel p-6 border-l-4 border-blue-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-blue-400 mb-1">🔒 EM CUSTÓDIA</p>
                <h3 class="text-2xl font-black text-white" id="fin-custodia">R$ 0,00</h3>
                <p class="text-[8px] text-gray-500 mt-1">Garantias de Serviços em Aberto</p>
            </div>
            <div class="glass-panel p-6 border-l-4 border-red-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-red-400 mb-1">DÍVIDAS TÉCNICAS</p>
                <h3 class="text-3xl font-black text-white" id="fin-receber">0,00 AX</h3>
            </div>
            <div class="glass-panel p-6 border-l-4 border-emerald-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-emerald-400 mb-1">CONTAS ATIVAS</p>
                <h3 class="text-3xl font-black text-white" id="fin-total-users">0</h3>
            </div>
        <div class="bg-blue-600/10 p-5 rounded-3xl border border-blue-500/30 flex items-center justify-between mb-6 shadow-2xl animate-fade">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                    <i data-lucide="unlock" class="text-white w-6 h-6"></i>
                </div>
                <div>
                    <h4 class="text-xs font-black text-white uppercase tracking-widest italic">Liberação Geral Black</h4>
                    <p class="text-[9px] text-blue-300 uppercase font-bold">Ignorar trava de R$ 500 para recargas PIX</p>
                </div>
            </div>

            <div class="flex flex-col items-center gap-2">
                <label class="relative inline-flex items-center cursor-pointer scale-110">
                    <input type="checkbox" id="conf-liberar-black-geral" class="sr-only peer" onchange="window.confirmarLiberacaoGeral(this)">
                    <div class="w-12 h-6 bg-slate-800 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
                <span id="txt-status-black" class="text-[8px] font-black text-gray-500 uppercase italic">🔒 Sistema Travado</span>
            </div>
            <input type="hidden" id="conf-limite-recarga" value="500">
        </div>
            <div class="relative flex-1 w-full">
                <i data-lucide="search" class="absolute left-3 top-2.5 w-4 h-4 text-gray-500"></i>
                <input type="text" id="fin-search-input" placeholder="Pesquisar por nome ou email..." 
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none transition">
            </div>
            
            <select id="fin-filter-mode" class="bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-xl px-4 py-2 outline-none focus:border-blue-500 cursor-pointer">
                <option value="all">👥 TODOS OS USUÁRIOS</option>
                <option value="creditors">💎 MAIORES CREDORES</option>
                <option value="debtors">⚠️ TOP DEVEDORES</option>
            </select>

        </div>

        <div id="fin-master-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade">
            <div class="col-span-full p-10 text-center text-gray-500 italic">Carregando carteiras...</div>
        </div>
    `;

    lucide.createIcons();
    
    // Listeners para busca em tempo real (local)
    document.getElementById('fin-search-input').addEventListener('input', window.filterFinanceList);
    document.getElementById('fin-filter-mode').addEventListener('change', window.filterFinanceList);

    await loadFinanceData();
}

// Global para armazenar os dados baixados e filtrar localmente sem sobrecarregar o Firebase
window.allFinData = [];

async function loadFinanceData() {
    try {
        const db = window.db;
        // Buscamos os usuários (limitado a 500 para performance, ajustável)
        const q = query(collection(db, "usuarios"), limit(500));
        const snap = await getDocs(q);
        
       window.allFinData = [];
        let totalRealPIX = 0;
        let totalFundoBonus = 0;
        let totalEmDivida = 0;
        let totalEmCustodia = 0;

        snap.forEach(doc => {
            const d = doc.data();
            // Separação cirúrgica dos 3 cofres do usuário
            const sReal = parseFloat(d.wallet_balance || 0);
            const sBonus = parseFloat(d.wallet_bonus || 0);
            const sReserved = parseFloat(d.wallet_reserved || 0);

            // Contabilidade do Topo
            if (sReal > 0) totalRealPIX += sReal;
            else if (sReal < 0) totalEmDivida += Math.abs(sReal);
            
            totalFundoBonus += sBonus;
            totalEmCustodia += sReserved;

            // Armazena para a lista com o saldo principal (Real) para ordenação
            window.allFinData.push({ id: doc.id, ...d, saldoCalculado: sReal });
        });

        // Injeta os valores nos novos cards separados
        // ✅ SANEAMENTO V504: Injeta valores reais e limpa chamadas fantasmas
        document.getElementById('fin-saldo-real').innerText = `R$ ${totalRealPIX.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('fin-saldo-bonus').innerText = `${totalFundoBonus.toLocaleString('pt-BR', {minimumFractionDigits: 2})} AX`;
        document.getElementById('fin-custodia').innerText = `R$ ${totalEmCustodia.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('fin-receber').innerText = `R$ ${totalEmDivida.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('fin-total-users').innerText = window.allFinData.length;

        console.log("📊 [Finance] Reforma Econômica aplicada com sucesso nos KPIs.");

        window.filterFinanceList(); // Renderiza a lista inicial
    } catch (e) { console.error(e); }
}

window.filterFinanceList = () => {
    const searchTerm = document.getElementById('fin-search-input').value.toLowerCase();
    const filterMode = document.getElementById('fin-filter-mode').value;
    const tbody = document.getElementById('fin-master-list');

    let filtered = window.allFinData.filter(u => {
        const nome = (u.nome || u.displayName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const matchesSearch = nome.includes(searchTerm) || email.includes(searchTerm);
        
        if (filterMode === 'creditors') return matchesSearch && u.saldoCalculado > 0;
        if (filterMode === 'debtors') return matchesSearch && u.saldoCalculado < 0;
        return matchesSearch;
    });

    // Ordenação dinâmica
    if (filterMode === 'creditors') filtered.sort((a, b) => b.saldoCalculado - a.saldoCalculado);
    else if (filterMode === 'debtors') filtered.sort((a, b) => a.saldoCalculado - b.saldoCalculado);
    else filtered.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    tbody.innerHTML = filtered.length ? "" : `<div class="col-span-full p-10 text-center text-gray-500">Nenhum usuário encontrado.</div>`;

    filtered.forEach(u => {
        const balReal = (u.wallet_balance || 0);
        const balBonus = (u.wallet_bonus || 0);
        const balReserved = (u.wallet_reserved || 0);
        const color = balReal < 0 ? 'text-red-400' : 'text-emerald-400';

        tbody.innerHTML += `
            <div class="glass-panel p-4 border border-slate-800 hover:border-blue-500/50 transition-all group">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-white font-bold text-sm uppercase tracking-tighter truncate w-40">${u.nome || u.displayName || 'Usuário'}</h4>
                        <p class="text-[9px] text-gray-500 font-mono">${u.id.slice(0,12)}...</p>
                    </div>
                    <button onclick="window.openBalanceEditor('${u.id}', ${balReal}, ${balBonus}, ${balReserved})" 
                        class="p-2 bg-slate-900 rounded-lg text-blue-400 hover:bg-blue-600 hover:text-white transition shadow-sm border border-slate-700">⚙️</button>
                </div>
                
               <div class="grid grid-cols-3 gap-2">
                    <div class="bg-black/20 p-2 rounded border border-white/5 text-center">
                        <p class="text-[7px] text-gray-500 font-bold uppercase">Principal</p>
                        <p class="text-xs font-black ${color}">${balReal.toFixed(2)}</p>
                    </div>
                    <div class="bg-black/20 p-2 rounded border border-white/5 text-center">
                        <p class="text-[7px] text-gray-500 font-bold uppercase">Fundo Bônus</p>
                        <p class="text-xs font-black text-purple-400">${balBonus.toFixed(2)}</p>
                    </div>
                    <div class="bg-black/20 p-2 rounded border border-white/5 text-center">
                        <p class="text-[7px] text-gray-500 font-bold uppercase">Lock (Cust)</p>
                        <p class="text-xs font-black text-amber-400">${balReserved.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        `;
    });
};
// Certifique-se de manter a window.executeAdjustment que enviamos anteriormente no final do arquivo.
// ============================================================================
// 3. EDITOR DE SALDO (AJUSTE MANUAL)
// ============================================================================
window.openBalanceEditor = (uid, balReal, balBonus, balReserved) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = "GERENCIADOR DE CARTEIRA V12";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');

    content.innerHTML = `
        <div class="grid grid-cols-3 gap-2 mb-6">
            <div class="bg-slate-900 p-2 rounded-lg border border-blue-500/30 text-center">
                <p class="text-[8px] text-gray-500 uppercase font-bold">Saldo Real</p>
                <p class="text-xs font-bold text-white">R$ ${balReal.toFixed(2)}</p>
            </div>
            <div class="bg-slate-900 p-2 rounded-lg border border-purple-500/30 text-center">
                <p class="text-[8px] text-gray-500 uppercase font-bold">Bônus</p>
                <p class="text-xs font-bold text-white">R$ ${balBonus.toFixed(2)}</p>
            </div>
            <div class="bg-slate-900 p-2 rounded-lg border border-amber-500/30 text-center">
                <p class="text-[8px] text-gray-500 uppercase font-bold">Reserva</p>
                <p class="text-xs font-bold text-white">R$ ${balReserved.toFixed(2)}</p>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
            <label class="inp-label">SELECIONE O CAMPO PARA AJUSTAR:</label>
            <select id="trans-target-field" class="inp-editor mb-4 text-white">
                <option value="wallet_balance">💰 SALDO REAL (Disponível)</option>
                <option value="wallet_bonus">💜 SALDO BÔNUS (Promo)</option>
                <option value="wallet_reserved">🔒 SALDO RESERVADO (Em Serviço)</option>
            </select>

            <div class="grid grid-cols-2 gap-4">
                <button onclick="window.setTransactionMode('credit')" id="btn-mode-credit" class="bg-emerald-900/30 border border-emerald-500/30 text-white p-3 rounded-xl hover:bg-emerald-600 transition text-[10px] font-black uppercase">➕ Adicionar</button>
                <button onclick="window.setTransactionMode('debit')" id="btn-mode-debit" class="bg-red-900/30 border border-red-500/30 text-white p-3 rounded-xl hover:bg-red-600 transition text-[10px] font-black uppercase">➖ Remover</button>
            </div>
        </div>

        <div id="trans-form" class="mt-6 hidden animate-fade">
            <label class="inp-label">VALOR (R$)</label>
            <input type="number" id="trans-amount" class="inp-editor text-lg font-bold text-white mb-4" placeholder="0.00">
            
            <label class="inp-label">MOTIVO / DESCRIÇÃO</label>
            <input type="text" id="trans-desc" class="inp-editor mb-4" placeholder="Ex: Bônus de boas vindas">

            <button onclick="window.executeAdjustment('${uid}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg">
                CONFIRMAR TRANSAÇÃO
            </button>
        </div>
    `;
    
    // Variável temporária para guardar o modo (crédito ou débito)
    window.tempTransMode = null;
};

window.setTransactionMode = (mode) => {
    window.tempTransMode = mode;
    document.getElementById('trans-form').classList.remove('hidden');
    
    // Visual feedback
    const btnCredit = document.getElementById('btn-mode-credit');
    const btnDebit = document.getElementById('btn-mode-debit');
    
    if (mode === 'credit') {
        btnCredit.classList.add('ring-2', 'ring-emerald-400');
        btnDebit.classList.remove('ring-2', 'ring-red-400');
    } else {
        btnDebit.classList.add('ring-2', 'ring-red-400');
        btnCredit.classList.remove('ring-2', 'ring-emerald-400');
    }
};

// ============================================================================
// 🚨 FUNÇÃO DE AJUSTE FINANCEIRO (VERSÃO V3.0 - COMPATÍVEL COM CARTEIRA)
// ============================================================================
window.executeAdjustment = async (uid) => {
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const desc = document.getElementById('trans-desc').value;
    const mode = window.tempTransMode;

    if (!amount || amount <= 0) return alert("Digite um valor válido.");
    if (!desc) return alert("Digite um motivo.");

    const finalAmount = mode === 'credit' ? amount : -amount;

    if(!confirm(`Confirmar ${mode === 'credit' ? 'CRÉDITO' : 'DÉBITO'} de R$ ${amount}?\nMotivo: ${desc}`)) return;

    try {
        const db = window.db;
        
        await runTransaction(db, async (transaction) => {
            // 📡 1. ÁREA DE LEITURA (READS FIRST)
            const userRef = doc(db, "usuarios", uid);
            const providerRef = doc(db, "active_providers", uid);
            const configRef = doc(db, "settings", "financeiro");

            const [userDoc, provDoc, configSnap] = await Promise.all([
                transaction.get(userRef),
                transaction.get(providerRef),
                transaction.get(configRef)
            ]);
            
            if (!userDoc.exists()) throw "Usuário não encontrado!";

            const configData = configSnap.exists() ? configSnap.data() : {};
            const userData = userDoc.data();
            const field = document.getElementById('trans-target-field').value;
            
            // 🧪 2. ÁREA DE LÓGICA (CÁLCULOS)
            const currentVal = Number(userData[field] || 0);
            const newVal = currentVal + finalAmount;
            const novoReal = field === 'wallet_balance' ? newVal : Number(userData.wallet_balance || 0);
            const novoBonus = field === 'wallet_bonus' ? newVal : Number(userData.wallet_bonus || 0);
            const novoTotalPower = novoReal + novoBonus;

            let dataExpiracao = null;
            if (mode === 'credit') {
                const meses = field === 'wallet_balance' 
                    ? parseInt(configData.validade_pix_meses || 1) 
                    : parseInt(configData.validade_bonus_meses || 3);

                const dataBase = new Date();
                dataExpiracao = new Date(dataBase.getFullYear(), dataBase.getMonth() + meses, dataBase.getDate());
            }

            // ✍️ 3. ÁREA DE ESCRITA (WRITES LAST)
            transaction.update(userRef, { 
                [field]: Number(newVal),
                wallet_total_power: Number(novoTotalPower),
                updated_at: serverTimestamp()
            });

            if (provDoc.exists()) {
                transaction.update(providerRef, { 
                    balance: Number(novoReal),
                    updated_at: serverTimestamp()
                });
            }
                
                // 🚀 GERAÇÃO DE LOTE (LEDGER): Cria o rastro para o Robô de Expiração
                const ledgerRef = doc(collection(db, "usuarios", uid, "ledger"));
                transaction.set(ledgerRef, {
                    valor: Number(amount),
                    tipo: field === 'wallet_balance' ? 'PIX' : 'BONUS',
                    status: 'ativo',
                    descricao: `Ajuste Admin: ${desc}`,
                    created_at: serverTimestamp(),
                    expires_at: dataExpiracao
                });
            }

            const extratoRef = doc(collection(db, "extrato_financeiro"));
           // ⚖️ Correção V63.6: Garante que débitos gravem o sinal de negativo (-) no banco
            transaction.set(extratoRef, {
                uid: uid,
                valor: Number(finalAmount), // FINALAMOUNT já carrega o sinal correto (+ ou -)
                tipo: mode === 'credit' ? 'CRÉDITO 📈' : 'DÉBITO 📉',
                descricao: desc,
                timestamp: serverTimestamp(),
                data_expiracao: dataExpiracao // Registra a data para o usuário ver no App
            });
        });

        alert("✅ Saldo sincronizado em todas as bases!");
        document.getElementById('modal-editor').classList.add('hidden');
        if(window.loadFinanceData) window.loadFinanceData();

    } catch (e) {
        alert("Erro na sincronia: " + e.message);
    }
};
// ============================================================================
// 🔓 LÓGICA DE LIBERAÇÃO BLACK (MÓDULO FINANCEIRO)
// ============================================================================

window.confirmarLiberacaoGeral = async (el) => {
    if (el.checked) {
        // Se tentou ligar, abre o modal de confirmação
        document.getElementById('modal-confirmacao-black').classList.remove('hidden');
    } else {
        // 🔒 BLOQUEIO GLOBAL: Grava 'false' no Firebase e atualiza o visual
        try {
            const configRef = doc(window.db, "configuracoes", "global");
            await updateDoc(configRef, { 
                liberar_black_geral_v1: false,
                updated_at: serverTimestamp() 
            });
            
            document.getElementById('txt-status-black').innerText = "🔒 SISTEMA TRAVADO (500)";
            document.getElementById('txt-status-black').classList.replace('text-blue-400', 'text-gray-500');
            console.log("✅ [FINANCE] Trava global reativada com sucesso.");
        } catch (e) {
            el.checked = true; // Reverte o botão se der erro no banco
            alert("Erro ao travar sistema: " + e.message);
        }
    }
};

window.cancelarLiberacaoGeral = () => {
    const sw = document.getElementById('conf-liberar-black-geral');
    if (sw) sw.checked = false;
    document.getElementById('modal-confirmacao-black').classList.add('hidden');
};

window.executarLiberacaoGeral = async () => {
    try {
        const db = window.db;
        // 🛰️ GRAVAÇÃO NA CHAVE MESTRA: Altera apenas 1 documento para todo o sistema
        const configRef = doc(db, "configuracoes", "global");
        await updateDoc(configRef, {
            liberar_black_geral_v1: true,
            updated_at: serverTimestamp()
        });

        document.getElementById('txt-status-black').innerText = "🔓 LIBERADO PARA TODOS";
        document.getElementById('txt-status-black').classList.replace('text-gray-500', 'text-blue-400');
        document.getElementById('modal-confirmacao-black').classList.add('hidden');
        
        alert("🚨 COMANDO GLOBAL ATIVADO: Trava de R$ 500 removida de todos os usuários.");
    } catch (e) {
        alert("Erro ao gravar no Firebase: " + e.message);
    }
};
// ============================================================================
// 🛰️ EXPOSIÇÃO GLOBAL NECESSÁRIA (V503)
// ============================================================================
window.openBalanceEditor = openBalanceEditor;
window.loadFinanceData = loadFinanceData; // Expõe para os Robôs e Refresh
window.filterFinanceList = filterFinanceList; // Expõe para a busca em tempo real

// Mantém a renderização de ícones Lucide segura
setTimeout(() => { 
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
}, 1000);
