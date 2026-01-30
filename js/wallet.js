import { db, auth } from './app.js';
import { doc, runTransaction, collection, addDoc, serverTimestamp, getDoc, setDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÕES
const TAXA_PLATAFORMA = 0.20; 
const LIMITE_DIVIDA = -60.00; 

// ============================================================================
// 1. CARREGAR CARTEIRA (Aba "Carteira")
// ============================================================================
export async function carregarCarteira() {
    console.log("💰 Iniciando módulo Carteira...");
    const uid = auth.currentUser?.uid;
    if(!uid) return;

    // Atualiza saldo visualmente
    atualizarCarteira(); 

    const container = document.getElementById('sec-ganhar');
    
    // Injeta histórico se não existir
    let historyDiv = document.getElementById('wallet-history-container');
    if(!historyDiv) {
        historyDiv = document.createElement('div');
        historyDiv.id = 'wallet-history-container';
        historyDiv.className = "mt-4 space-y-2 px-1";
        container.appendChild(historyDiv);
    }

    historyDiv.innerHTML = `
        <p class="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-2">Extrato Recente</p>
        <div class="text-center py-4 opacity-50">
            <p class="text-xs">Nenhuma movimentação recente.</p>
        </div>
    `;
    
    // Futuro: Aqui entra o onSnapshot da coleção 'wallet_history'
}

// ============================================================================
// 2. ATUALIZADOR DE SALDO (VISUAL)
// ============================================================================
export function atualizarCarteira() {
    const el = document.getElementById('user-balance');
    const userProfile = window.userProfile; // Pega do global (auth.js)
    
    if(el && userProfile) {
        const saldo = parseFloat(userProfile.wallet_balance || 0);
        
        el.innerText = saldo.toFixed(2).replace('.', ',');

        // Cores
        if (saldo < 0) {
            el.classList.remove('text-white', 'text-emerald-300');
            el.classList.add('text-red-400');
        } else {
            el.classList.remove('text-red-400');
            el.classList.add('text-white');
        }

        // Atualiza Header do Prestador também
        const headerSaldo = document.querySelector('#provider-header-name span span');
        if(headerSaldo) {
            headerSaldo.innerText = `R$ ${saldo.toFixed(2)}`;
            headerSaldo.className = saldo < 0 ? 'text-red-400 font-bold' : 'text-emerald-300 font-bold';
        }
    }
}

// Atualiza a cada 5 segundos para garantir sincronia
setInterval(atualizarCarteira, 5000);

// ============================================================================
// 3. TRAVA DE SEGURANÇA (ENFORCEMENT)
// ============================================================================
export function podeTrabalhar() {
    const userProfile = window.userProfile;
    if (!userProfile) return false;
    
    const saldo = parseFloat(userProfile.wallet_balance || 0);
    
    if (saldo <= LIMITE_DIVIDA) {
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\n\nSeu saldo: R$ ${saldo.toFixed(2)}.\nLimite: R$ ${LIMITE_DIVIDA.toFixed(2)}.\n\nRecarregue para continuar.`);
        return false;
    }
    return true;
}

// ============================================================================
// 4. COBRANÇA DE TAXA (TRANSAÇÃO)
// ============================================================================
export async function processarCobrancaTaxa(orderId, valorServico) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const valorTaxa = valorServico * TAXA_PLATAFORMA;

    console.log(`💰 Processando taxa: R$ ${valorTaxa.toFixed(2)}...`);

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário 404";
            
            const ledgerDoc = await transaction.get(ledgerRef);
            if (!ledgerDoc.exists()) {
                transaction.set(ledgerRef, { total_receivables: 0, total_revenue: 0 });
            }

            const novoSaldo = (userDoc.data().wallet_balance || 0) - valorTaxa;

            // Débito no Usuário
            transaction.update(userRef, { wallet_balance: novoSaldo });

            // Crédito no Livro Caixa
            transaction.update(ledgerRef, { total_receivables: increment(valorTaxa) });
        });

        console.log("✅ Taxa cobrada.");
        // Atualiza memória local para feedback instantâneo
        if(window.userProfile) {
            window.userProfile.wallet_balance -= valorTaxa;
            atualizarCarteira();
        }

    } catch (e) {
        console.error("❌ Erro financeiro:", e);
        // alert("Erro ao processar taxa."); // Comentado para não bloquear fluxo em massa
    }
}

// 🔥 EXPORTAÇÃO GLOBAL (A Conexão com o HTML)
window.carregarCarteira = carregarCarteira;
window.atualizarCarteira = atualizarCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;

console.log("✅ Módulo Wallet Carregado.");
