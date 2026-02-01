import { collection, getDocs, doc, updateDoc, query, orderBy, limit, where, serverTimestamp, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init() {
    const container = document.getElementById('view-finance');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade">
            <div class="glass-panel p-6 border-l-4 border-amber-500 relative overflow-hidden">
                <div class="absolute right-0 top-0 p-4 opacity-10"><i data-lucide="wallet" size="64"></i></div>
                <p class="text-[10px] uppercase font-bold text-amber-400 mb-1">EM CUSTÓDIA (PASSIVO)</p>
                <h3 class="text-3xl font-black text-white" id="fin-custodia">R$ 0,00</h3>
                <p class="text-[10px] text-gray-500 mt-2">Dinheiro dos usuários parado na plataforma.</p>
            </div>

            <div class="glass-panel p-6 border-l-4 border-red-500 relative overflow-hidden">
                <div class="absolute right-0 top-0 p-4 opacity-10"><i data-lucide="alert-circle" size="64"></i></div>
                <p class="text-[10px] uppercase font-bold text-red-400 mb-1">A RECEBER (DÍVIDAS)</p>
                <h3 class="text-3xl font-black text-white" id="fin-receber">R$ 0,00</h3>
                <p class="text-[10px] text-gray-500 mt-2">Soma de saldos negativos (Prestadores).</p>
            </div>

            <div class="glass-panel p-6 border-l-4 border-emerald-500 relative overflow-hidden">
                <div class="absolute right-0 top-0 p-4 opacity-10"><i data-lucide="pie-chart" size="64"></i></div>
                <p class="text-[10px] uppercase font-bold text-emerald-400 mb-1">USUÁRIOS COM SALDO</p>
                <h3 class="text-3xl font-black text-white" id="fin-total-users">0</h3>
                <p class="text-[10px] text-gray-500 mt-2">Contas movimentadas (Positivas ou Negativas).</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel overflow-hidden border border-red-900/30">
                <div class="bg-red-900/20 p-4 border-b border-red-900/30 flex justify-between items-center">
                    <h3 class="font-bold text-red-400 text-xs uppercase">⚠️ Top Devedores (Negativados)</h3>
                </div>
                <div class="max-h-80 overflow-y-auto">
                    <table class="w-full text-left">
                        <tbody id="list-debtors" class="text-xs">
                            <tr><td class="p-4 text-center text-gray-500">Carregando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="glass-panel overflow-hidden border border-emerald-900/30">
                <div class="bg-emerald-900/20 p-4 border-b border-emerald-900/30 flex justify-between items-center">
                    <h3 class="font-bold text-emerald-400 text-xs uppercase">💎 Maiores Saldos (Credores)</h3>
                </div>
                <div class="max-h-80 overflow-y-auto">
                    <table class="w-full text-left">
                        <tbody id="list-creditors" class="text-xs">
                            <tr><td class="p-4 text-center text-gray-500">Carregando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;

    lucide.createIcons();
    console.log("✅ Módulo Financeiro Carregado.");
    await loadFinanceData();
}

// ============================================================================
// 2. CÁLCULO E LISTAGEM
// ============================================================================
async function loadFinanceData() {
    try {
        const db = window.db;
        const isDemo = window.currentDataMode === 'demo';
        
        // Busca usuários (Filtra por demo se necessário)
        let q;
        if (isDemo) {
            q = query(collection(db, "usuarios"), where("is_demo", "==", true));
        } else {
            // Em produção real, pegamos todos (pode ser pesado se tiver milhares, mas ok por agora)
            q = query(collection(db, "usuarios"));
        }

        const snap = await getDocs(q);
        
        let custodia = 0;
        let receber = 0;
        let usersWithBalance = 0;
        
        let debtors = [];
        let creditors = [];

        snap.forEach(doc => {
            const d = doc.data();
            const saldo = parseFloat(d.saldo || 0);
            
            if (saldo !== 0) usersWithBalance++;
            
            if (saldo > 0) {
                custodia += saldo;
                creditors.push({ id: doc.id, ...d, saldo });
            } else if (saldo < 0) {
                receber += Math.abs(saldo);
                debtors.push({ id: doc.id, ...d, saldo });
            }
        });

        // Atualiza KPIs
        document.getElementById('fin-custodia').innerText = `R$ ${custodia.toFixed(2)}`;
        document.getElementById('fin-receber').innerText = `R$ ${receber.toFixed(2)}`;
        document.getElementById('fin-total-users').innerText = usersWithBalance;

        // Renderiza Tabelas
        renderTable('list-debtors', debtors.sort((a,b) => a.saldo - b.saldo), 'red'); // Menor saldo primeiro (mais negativo)
        renderTable('list-creditors', creditors.sort((a,b) => b.saldo - a.saldo), 'emerald'); // Maior saldo primeiro

    } catch (e) {
        console.error("Erro financeiro:", e);
    }
}

function renderTable(elementId, list, color) {
    const el = document.getElementById(elementId);
    el.innerHTML = "";
    
    if (list.length === 0) {
        el.innerHTML = `<tr><td class="p-4 text-center text-gray-500 text-[10px]">Nenhum registro.</td></tr>`;
        return;
    }

    list.slice(0, 20).forEach(u => { // Top 20
        const isNeg = u.saldo < 0;
        const moneyClass = isNeg ? "text-red-400" : "text-emerald-400";
        
        el.innerHTML += `
            <tr class="border-b border-white/5 hover:bg-white/5 transition">
                <td class="p-3">
                    <div class="font-bold text-white text-[11px]">${u.nome || "Usuário"}</div>
                    <div class="text-[9px] text-gray-500">${u.email}</div>
                </td>
                <td class="p-3 text-right">
                    <div class="font-mono font-bold ${moneyClass}">R$ ${u.saldo.toFixed(2)}</div>
                </td>
                <td class="p-3 text-right w-10">
                    <button onclick="window.openBalanceEditor('${u.id}', ${u.saldo})" class="text-gray-400 hover:text-white transition">⚙️</button>
                </td>
            </tr>
        `;
    });
}

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
            // 1. Referências
            const userRef = doc(db, "usuarios", uid);
            const providerRef = doc(db, "active_providers", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            const newHistRef = doc(collection(db, "transactions")); // Cria ID novo para o extrato

            // 2. Leituras (Obrigatório fazer todas as leituras antes das escritas)
            const userDoc = await transaction.get(userRef);
            const provDoc = await transaction.get(providerRef);
            
            if (!userDoc.exists()) throw "Usuário não encontrado!";

            // 3. Cálculos
            // Pega o saldo atual (prioriza wallet_balance, se não tiver usa saldo)
            const currentBalance = userDoc.data().wallet_balance !== undefined ? userDoc.data().wallet_balance : (userDoc.data().saldo || 0);
            const newBalance = currentBalance + finalAmount;

            // 4. Atualizações (Escritas)
            
            // A) Atualiza o Usuário (Carteira Nova + Legado para garantir)
            transaction.update(userRef, { 
                wallet_balance: newBalance,
                saldo: newBalance // Mantém sincronizado por segurança
            });

            // B) Se for Prestador, atualiza a tabela de prestadores também
            if (provDoc.exists()) {
                transaction.update(providerRef, { balance: newBalance });
            }

            // C) Cria o Extrato (Essencial para o usuário ver o histórico)
            transaction.set(newHistRef, {
                provider_id: uid, // Pode ser user comum, mas usamos esse campo
                type: mode === 'credit' ? 'manual_credit' : 'manual_debit',
                amount: finalAmount,
                description: `Admin: ${desc}`,
                order_id: 'admin_adjust',
                created_at: serverTimestamp()
            });

            // D) (Opcional) Atualiza estatísticas gerais do sistema se quiser
            // transaction.set(ledgerRef, { total_adjustments: increment(finalAmount) }, { merge: true });
        });

        alert("✅ Saldo atualizado e sincronizado com a Carteira V3!");
        document.getElementById('modal-editor').classList.add('hidden');
        loadFinanceData(); // Recarrega a tela do Admin

    } catch (e) {
        console.error(e);
        alert("Erro na transação: " + e.message);
    }
};
