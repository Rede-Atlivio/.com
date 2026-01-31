import { db, auth } from './app.js';
import { doc, runTransaction, collection, serverTimestamp, getDoc, increment, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 💰 CONFIGURAÇÕES DO BANCO CENTRAL ATLIVIO
const TAXA_PLATAFORMA = 0.20; // 20%
const LIMITE_DIVIDA = -60.00; // Bloqueia se dever mais que isso

// ============================================================================
// 1. VISUALIZAÇÃO (INTERFACE)
// ============================================================================
export async function carregarCarteira() {
    const uid = auth.currentUser?.uid;
    if(!uid) return;

    // Busca saldo em tempo real na coleção CERTA (active_providers)
    const ref = doc(db, "active_providers", uid);
    
    try {
        const snap = await getDoc(ref);
        if(snap.exists()) {
            const data = snap.data();
            const saldo = data.balance || 0; // Padronizado como 'balance'

            // Atualiza Perfil Global (Memória)
            if(window.userProfile) window.userProfile.balance = saldo;

            // Atualiza Interface (Se a carteira estiver aberta)
            const el = document.getElementById('user-balance');
            if(el) {
                el.innerText = saldo.toFixed(2).replace('.', ',');
                
                // Cores: Verde (Positivo) / Vermelho (Negativo)
                if (saldo < 0) {
                    el.classList.remove('text-white', 'text-green-400');
                    el.classList.add('text-red-400');
                } else {
                    el.classList.remove('text-red-400');
                    el.classList.add('text-green-400');
                }
            }
            
            // Atualiza também o Header (Miniatura se existir)
            const headerSaldo = document.querySelector('#provider-header-name span span');
            if(headerSaldo) {
                headerSaldo.innerText = `R$ ${saldo.toFixed(2)}`;
                headerSaldo.className = saldo < 0 ? 'text-red-400 font-bold' : 'text-emerald-300 font-bold';
            }
        }
    } catch(e) { console.error("Erro ao ler carteira:", e); }
}

// Atualiza a cada 5 segundos para garantir sincronia
setInterval(carregarCarteira, 5000);

// ============================================================================
// 2. LÓGICA DE TRAVA (ENFORCEMENT)
// ============================================================================
export function podeTrabalhar() {
    const user = window.userProfile;
    
    // Se não carregou ainda, bloqueia por segurança
    if (!user) { console.warn("Perfil offline."); return false; }

    const saldo = parseFloat(user.balance || 0);
    
    // Se o saldo for MENOR que o limite (ex: -65 < -60), TRAVA.
    if (saldo <= LIMITE_DIVIDA) {
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\n\nSeu saldo atual é R$ ${saldo.toFixed(2)}.\nO limite é R$ ${LIMITE_DIVIDA.toFixed(2)}.\n\nPor favor, faça um pagamento via PIX na aba Carteira para liberar seu acesso.`);
        
        // Redireciona para a carteira
        if(window.switchTab) window.switchTab('ganhar');
        
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

    console.log(`💰 Processando taxa de R$ ${valorTaxa.toFixed(2)}...`);

    try {
        // 🔥 TRANSAÇÃO ATÔMICA (Segurança Bancária)
        await runTransaction(db, async (transaction) => {
            // 1. Referências (Apontando para active_providers)
            const providerRef = doc(db, "active_providers", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            
            // 2. Leituras (Obrigatório ler antes de escrever)
            const provDoc = await transaction.get(providerRef);
            if (!provDoc.exists()) throw "Prestador não encontrado na base ativa!";
            
            // 3. Cálculos
            const saldoAtual = provDoc.data().balance || 0;
            const novoSaldo = saldoAtual - valorTaxa;

            // 4. Gravações (Writes)
            
            // A: Deduz do Prestador (active_providers)
            transaction.update(providerRef, { 
                balance: novoSaldo 
            });

            // B: Registra Histórico (Sub-coleção transactions)
            const newHistRef = doc(collection(db, "transactions")); 
            transaction.set(newHistRef, {
                provider_id: uid,
                type: 'fee_charge',
                amount: -valorTaxa,
                description: `Taxa de Serviço (20%) - Pedido #${orderId.slice(0,5)}`,
                order_id: orderId,
                created_at: serverTimestamp()
            });

            // C: Contabilidade da Plataforma (Opcional)
            transaction.set(ledgerRef, { 
                total_receivables: increment(valorTaxa) 
            }, { merge: true });
        });

        console.log("✅ Cobrança realizada com sucesso!");
        
        // Atualiza a memória local imediatamente
        if(window.userProfile) window.userProfile.balance -= valorTaxa;
        carregarCarteira();

    } catch (e) {
        console.error("❌ Erro financeiro:", e);
    }
}

// ============================================================================
// 🚨 EXPORTAÇÕES GLOBAIS (ISSO QUE FALTAVA!)
// ============================================================================
window.carregarCarteira = carregarCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;

// COMPATIBILIDADE: Se chamarem pelo nome antigo, redireciona para o novo
window.atualizarCarteira = carregarCarteira;
