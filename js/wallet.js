import { db, auth } from './app.js';
import { userProfile } from './auth.js';
import { doc, runTransaction, collection, addDoc, serverTimestamp, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 💰 CONFIGURAÇÕES DO BANCO CENTRAL ATLIVIO
const TAXA_PLATAFORMA = 0.20; // 20%
const LIMITE_DIVIDA = -60.00; // Bloqueia se dever mais que isso

// ============================================================================
// 1. VISUALIZAÇÃO (INTERFACE)
// ============================================================================
export function atualizarCarteira() {
    const el = document.getElementById('user-balance');
    
    // Proteção contra undefined
    if(el && userProfile) {
        // Garante que é número, mesmo se vier null do banco
        const saldo = parseFloat(userProfile.wallet_balance || 0);
        
        // Formata para R$
        el.innerText = saldo.toFixed(2).replace('.', ',');

        // Muda a cor: Verde (Positivo/Zero) ou Vermelho (Negativo)
        if (saldo < 0) {
            el.classList.remove('text-white', 'text-emerald-300'); // Remove cores antigas
            el.classList.add('text-red-400'); // Adiciona vermelho alerta
        } else {
            el.classList.remove('text-red-400');
            el.classList.add('text-white');
        }

        // Atualiza também no Header se existir o elemento lá
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
// 2. LÓGICA DE TRAVA (ENFORCEMENT)
// ============================================================================
export function podeTrabalhar() {
    if (!userProfile) return false;
    const saldo = parseFloat(userProfile.wallet_balance || 0);
    
    // Se o saldo for MENOR que o limite (ex: -65 < -60), TRAVA.
    if (saldo <= LIMITE_DIVIDA) {
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\n\nSeu saldo atual é R$ ${saldo.toFixed(2)}.\nO limite é R$ ${LIMITE_DIVIDA.toFixed(2)}.\n\nPor favor, faça uma recarga para continuar aceitando pedidos.`);
        return false;
    }
    return true;
}


// ============================================================================
// 3. O COBRADOR (TRANSAÇÃO FINANCEIRA SEGURA)
// ============================================================================
export async function processarCobrancaTaxa(orderId, valorServico) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const valorTaxa = valorServico * TAXA_PLATAFORMA;

    console.log(`💰 Processando taxa de R$ ${valorTaxa.toFixed(2)} para o pedido ${orderId}...`);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Referências
            const userRef = doc(db, "usuarios", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            const historyRef = collection(db, "usuarios", uid, "wallet_history");

            // 2. Leituras (Obrigatório ler antes de escrever numa transação)
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário não encontrado!";
            
            // Garante que o ledger existe
            const ledgerDoc = await transaction.get(ledgerRef);
            if (!ledgerDoc.exists()) {
                transaction.set(ledgerRef, { total_receivables: 0, total_revenue: 0 });
            }

            // 3. Cálculos
            const novoSaldo = (userDoc.data().wallet_balance || 0) - valorTaxa;

            // 4. Gravações (Writes)
            
            // A: Deduz do Prestador
            transaction.update(userRef, { 
                wallet_balance: novoSaldo 
            });

            // B: Adiciona no Livro Contábil da Atlivio (Contas a Receber)
            transaction.update(ledgerRef, {
                total_receivables: increment(valorTaxa)
            });

            // C: Gera o Extrato
            const novoExtrato = doc(historyRef); // Cria ref nova
            transaction.set(novoExtrato, {
                type: 'fee_charge',
                amount: -valorTaxa, // Negativo pois saiu
                description: `Taxa de Serviço (20%)`,
                order_id: orderId,
                created_at: serverTimestamp()
            });
        });

        console.log("✅ Cobrança realizada com sucesso!");
        
        // Atualiza a memória local imediatamente para o usuário ver
        if(userProfile) userProfile.wallet_balance -= valorTaxa;
        atualizarCarteira();

    } catch (e) {
        console.error("❌ Erro financeiro:", e);
        alert("Erro ao processar taxa. Contate o suporte.");
        throw e; // Repassa o erro para quem chamou saber que falhou
    }
}

// Expõe globalmente para testes
window.testeFinanceiro = processarCobrancaTaxa;
