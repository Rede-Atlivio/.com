import { db, auth } from '../app.js';
import { doc, runTransaction, collection, serverTimestamp, getDoc, increment, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 💰 CONFIGURAÇÕES
const TAXA_PLATAFORMA = 0.20; 
const LIMITE_DIVIDA = -60.00; 

let unsubscribeWallet = null;

// ============================================================================
// 1. MONITORAMENTO REAL-TIME (SINCRONIZADO COM ADMIN/AUTH)
// ============================================================================
export function iniciarMonitoramentoCarteira() {
    if (!auth || !auth.currentUser) return; 
    
    const uid = auth.currentUser.uid;
    if (unsubscribeWallet) unsubscribeWallet();

    // Monitora o documento do prestador para atualizações imediatas de saldo
    const ref = doc(db, "active_providers", uid);

    console.log("📡 Carteira: Iniciando conexão Real-Time...");

    unsubscribeWallet = onSnapshot(ref, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 🔥 Lógica de fallback: Aceita qualquer um dos 3 nomes de campo usados no sistema
            const saldo = parseFloat(data.balance || data.saldo || data.wallet_balance || 0);

            if (!window.userProfile) window.userProfile = {};
            window.userProfile.balance = saldo;

            atualizarInterfaceCarteira(saldo);
            atualizarInterfaceHeader(saldo);
        }
    });
}

function atualizarInterfaceCarteira(saldo) {
    const el = document.getElementById('user-balance');
    if (el) {
        el.innerText = saldo.toFixed(2).replace('.', ',');
        el.classList.remove('text-white', 'text-green-400', 'text-red-400');
        
        if (saldo < 0) {
            el.classList.add('text-red-400');
        } else {
            el.classList.add('text-green-400');
        }
    }
}

function atualizarInterfaceHeader(saldo) {
    const headerName = document.getElementById('provider-header-name');
    if (headerName) {
        let badge = document.getElementById('header-balance-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'header-balance-badge';
            headerName.appendChild(badge);
        }
        badge.innerText = ` R$ ${saldo.toFixed(2)}`;
        badge.className = saldo < 0 
            ? "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 font-bold"
            : "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-600 font-bold";
    }
}

export async function carregarCarteira() {
    iniciarMonitoramentoCarteira();
}

// ============================================================================
// 2. LÓGICA DE TRAVA (ANTI-CALOTE)
// ============================================================================
export function podeTrabalhar() {
    const user = window.userProfile;
    if (!user) return false;

    const saldo = parseFloat(user.balance || 0);
    
    if (saldo <= LIMITE_DIVIDA) {
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\n\nSeu saldo atual é R$ ${saldo.toFixed(2)}.\nO limite é R$ ${LIMITE_DIVIDA.toFixed(2)}.\n\nPor favor, vá na aba Carteira e pague a taxa.`);
        if(window.switchTab) window.switchTab('ganhar');
        return false;
    }
    return true;
}

// ============================================================================
// 3. O COBRADOR (TRANSAÇÃO FINANCEIRA)
// ============================================================================
export async function processarCobrancaTaxa(orderId, valorServico) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const valorTaxa = valorServico * TAXA_PLATAFORMA;

    try {
        await runTransaction(db, async (transaction) => {
            const providerRef = doc(db, "active_providers", uid);
            const userRef = doc(db, "usuarios", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            
            const provDoc = await transaction.get(providerRef);
            if (!provDoc.exists()) throw "Prestador offline!";
            
            const saldoAtual = provDoc.data().balance || provDoc.data().saldo || provDoc.data().wallet_balance || 0;
            const novoSaldo = saldoAtual - valorTaxa;

            // Atualiza em ambos os documentos para manter sincronia total
            transaction.update(providerRef, { balance: novoSaldo });
            transaction.update(userRef, { wallet_balance: novoSaldo, saldo: novoSaldo }); 

            const newHistRef = doc(collection(db, "transactions")); 
            transaction.set(newHistRef, {
                provider_id: uid,
                type: 'fee_charge',
                amount: -valorTaxa,
                description: `Taxa 20% - Pedido #${orderId.slice(0,5)}`,
                order_id: orderId,
                created_at: serverTimestamp()
            });

            transaction.set(ledgerRef, { total_receivables: increment(valorTaxa) }, { merge: true });
        });
        console.log("✅ Taxa cobrada e sincronizada!");
    } catch (e) {
        console.error("❌ Erro financeiro:", e);
    }
}

// ============================================================================
// EXPORTAÇÕES GLOBAIS
// ============================================================================
window.carregarCarteira = carregarCarteira;
window.iniciarMonitoramentoCarteira = iniciarMonitoramentoCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;
window.atualizarCarteira = carregarCarteira;
