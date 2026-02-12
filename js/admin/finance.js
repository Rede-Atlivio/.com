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
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade">
            <div class="glass-panel p-6 border-l-4 border-amber-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-amber-400 mb-1">EM CUSTÓDIA (PASSIVO)</p>
                <h3 class="text-3xl font-black text-white" id="fin-custodia">R$ 0,00</h3>
            </div>
            <div class="glass-panel p-6 border-l-4 border-red-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-red-400 mb-1">A RECEBER (DÍVIDAS)</p>
                <h3 class="text-3xl font-black text-white" id="fin-receber">R$ 0,00</h3>
            </div>
            <div class="glass-panel p-6 border-l-4 border-emerald-500 relative overflow-hidden">
                <p class="text-[10px] uppercase font-bold text-emerald-400 mb-1">CONTAS ATIVAS</p>
                <h3 class="text-3xl font-black text-white" id="fin-total-users">0</h3>
            </div>
        </div>

        <div class="glass-panel p-4 mb-6 flex flex-col md:flex-row gap-4 items-center bg-slate-900/50 border border-slate-800">
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

            <button onclick="window.loadFinanceData()" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase transition">
                Atualizar
            </button>
        </div>

        <div class="glass-panel overflow-hidden border border-slate-800">
            <div class="bg-slate-800/50 p-4 border-b border-slate-800">
                <h3 class="font-bold text-white text-xs uppercase tracking-widest">Gestão de Saldos Real-Time</h3>
            </div>
            <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left">
                    <thead class="bg-slate-950 text-[10px] uppercase text-gray-500 font-bold sticky top-0 z-10">
                        <tr>
                            <th class="p-4">USUÁRIO</th>
                            <th class="p-4 text-right">SALDO ATUAL</th>
                            <th class="p-4 text-right">AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody id="fin-master-list" class="text-xs divide-y divide-white/5">
                        <tr><td colspan="3" class="p-10 text-center text-gray-500 italic">Carregando dados...</td></tr>
                    </tbody>
                </table>
            </div>
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
        let custodia = 0;
        let receber = 0;

        snap.forEach(doc => {
            const d = doc.data();
            //PONTO CRÍTICO LIMPEZA CAMPO SALDO
            // ✅ SANEAMENTO V12: Foco exclusivo na Trindade Financeira
            const saldoFinal = parseFloat(d.wallet_balance || 0);
            
            if (saldoFinal > 0) custodia += saldoFinal;
            if (saldoFinal < 0) receber += Math.abs(saldoFinal);

            window.allFinData.push({ id: doc.id, ...d, saldoCalculado: saldoFinal });
        });

        document.getElementById('fin-custodia').innerText = `R$ ${custodia.toFixed(2)}`;
        document.getElementById('fin-receber').innerText = `R$ ${receber.toFixed(2)}`;
        document.getElementById('fin-total-users').innerText = window.allFinData.length;

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

    tbody.innerHTML = filtered.length ? "" : `<tr><td colspan="3" class="p-10 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>`;

    filtered.forEach(u => {
        const color = u.saldoCalculado < 0 ? 'text-red-400' : (u.saldoCalculado > 0 ? 'text-emerald-400' : 'text-gray-500');
        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition">
                <td class="p-4">
                    <div class="font-bold text-white">${u.nome || u.displayName || 'Usuário'}</div>
                    <div class="text-[9px] text-gray-500 font-mono">${u.id}</div>
                </td>
                <td class="p-4 text-right font-mono font-bold ${color}">
                    R$ ${u.saldoCalculado.toFixed(2)}
                </td>
                <td class="p-4 text-right">
                    <button onclick="window.openBalanceEditor('${u.id}', ${u.saldoCalculado})" 
                        class="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg transition border border-slate-700">
                        ⚙️ Ajustar
                    </button>
                </td>
            </tr>
        `;
    });
};
// Certifique-se de manter a window.executeAdjustment que enviamos anteriormente no final do arquivo.
// ============================================================================
// 3. EDITOR DE SALDO (AJUSTE MANUAL)
// ============================================================================
window.openBalanceEditor = (uid, currentBalance) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = "AJUSTE FINANCEIRO MANUAL";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');

    content.innerHTML = `
        <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6 text-center">
            <p class="text-xs text-gray-400 uppercase font-bold">Saldo Atual</p>
            <h2 class="text-3xl font-black ${currentBalance < 0 ? 'text-red-500' : 'text-emerald-500'}">R$ ${currentBalance.toFixed(2)}</h2>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <button onclick="window.setTransactionMode('credit')" id="btn-mode-credit" class="bg-emerald-900/50 border border-emerald-500/30 text-white p-4 rounded-xl hover:bg-emerald-900/80 transition">
                <p class="font-bold text-emerald-400">🟢 ADICIONAR CRÉDITO</p>
                <p class="text-[10px] text-gray-400">Bônus, Estorno, Depósito Manual</p>
            </button>
            <button onclick="window.setTransactionMode('debit')" id="btn-mode-debit" class="bg-red-900/50 border border-red-500/30 text-white p-4 rounded-xl hover:bg-red-900/80 transition">
                <p class="font-bold text-red-400">🔴 COBRAR / REMOVER</p>
                <p class="text-[10px] text-gray-400">Taxas, Multas, Saque Manual</p>
            </button>
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
            const userRef = doc(db, "usuarios", uid);
            const providerRef = doc(db, "active_providers", uid);
            const newHistRef = doc(collection(db, "transactions"));

            const userDoc = await transaction.get(userRef);
            const provDoc = await transaction.get(providerRef);
            
            if (!userDoc.exists()) throw "Usuário não encontrado!";

            // 1. Pega o saldo atual (prioriza wallet_balance)
            const currentBalance = userDoc.data().wallet_balance !== undefined ? 
                                   userDoc.data().wallet_balance : (userDoc.data().saldo || 0);
            const newBalance = currentBalance + finalAmount;

            // 2. Sincronia Tripla: Atualiza os 3 nomes de saldo conhecidos no sistema
            const syncUpdate = { 
                wallet_balance: Number(newBalance), 
                saldo: Number(newBalance),
                updated_at: serverTimestamp()
            };
            
            transaction.update(userRef, syncUpdate);

            // Se for um prestador, atualiza também o campo 'balance' (usado no Radar/Mapa)
            if (provDoc.exists()) {
                transaction.update(providerRef, { 
                    balance: Number(newBalance),
                    updated_at: serverTimestamp()
                });
            }

            transaction.set(newHistRef, {
                provider_id: uid,
                type: mode === 'credit' ? 'manual_credit' : 'manual_debit',
                amount: Number(finalAmount),
                description: `Admin: ${desc}`,
                created_at: serverTimestamp()
            });
        });

        alert("✅ Saldo sincronizado em todas as bases!");
        document.getElementById('modal-editor').classList.add('hidden');
        if(window.loadFinanceData) window.loadFinanceData();

    } catch (e) {
        alert("Erro na sincronia: " + e.message);
    }
};
