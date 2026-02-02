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

    const ref = doc(db, "active_providers", uid);

    console.log("📡 Carteira: Iniciando conexão Real-Time...");

    unsubscribeWallet = onSnapshot(ref, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const saldo = parseFloat(data.balance || data.saldo || data.wallet_balance || 0);

            if (!window.userProfile) window.userProfile = {};
            window.userProfile.balance = saldo;

            // ✅ Atualização unificada das interfaces
            verificarFaixaBonus(saldo);
            atualizarInterfaceCarteira(saldo);
            atualizarInterfaceHeader(saldo);
            atualizarInterfaceGanhar(saldo);
            carregarHistoricoCarteira(uid); 
        }
    });
}

function atualizarInterfaceCarteira(saldo) {
    const el = document.getElementById('user-balance');
    if (el) {
        el.innerText = saldo.toFixed(2).replace('.', ',');
        el.classList.remove('text-green-400', 'text-red-400');
        el.classList.add(saldo < 0 ? 'text-red-400' : 'text-green-400');
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

function atualizarInterfaceGanhar(saldo) {
    const el = document.getElementById('user-balance'); 
    if (el) {
        el.innerText = saldo.toFixed(2).replace('.', ',');
        el.className = saldo < 0 ? "text-4xl font-black italic text-red-400" : "text-4xl font-black italic text-green-400";
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
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\n\nSeu saldo atual é R$ ${saldo.toFixed(2)}.\nO limite é R$ ${LIMITE_DIVIDA.toFixed(2)}.\n\nPor favor, faça uma recarga.`);
        if(window.switchTab) window.switchTab('ganhar');
        return false;
    }
    return true;
}

// ============================================================================
// 3. O COBRADOR (RESTAURADO ✅)
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
// 4. INFINITEPAY & HISTÓRICO
// ============================================================================
window.abrirCheckoutPix = async (valor) => {
    const user = auth.currentUser;
    if (!user) return alert("Por favor, faça login para recarregar.");

    console.log(`🚀 Iniciando automação de recarga: R$ ${valor}`);

    // Configuração baseada na documentação que você localizou
    const payload = {
        "handle": "atlivio-servicos", 
        "order_nsu": user.uid, // O segredo da automação: rastreia o usuário
        "itens": [
            {
                "quantity": 1,
                "price": valor * 100, // InfinitePay usa centavos (Ex: 2000 = R$ 20)
                "description": `Recarga de Saldo - Atlivio`
            }
        ]
    };

    // No Estágio 02 real, faremos um fetch para o seu Firebase Function aqui.
    // Para resolver seu erro 404 AGORA e manter a automação:
    const linkDinamico = `https://pay.infinitepay.io/atlivio-servicos/${valor}?order_nsu=${user.uid}`;
    
    console.log("🔗 Link Automático Gerado:", linkDinamico);
    window.open(linkDinamico, '_blank');
};

async function carregarHistoricoCarteira(uid) {
    const container = document.getElementById('lista-transacoes-carteira');
    if (!container) return;

    try {
        const { collection, query, where, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(db, "transactions"), where("provider_id", "==", uid), orderBy("created_at", "desc"), limit(10));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-[10px] text-gray-400 py-4 italic">Nenhuma movimentação ainda.</p>`;
            return;
        }

        container.innerHTML = "";
        snap.forEach(doc => {
            const t = doc.data();
            const isPositivo = t.amount > 0;
            container.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-2">
                    <div>
                        <p class="text-[10px] font-black uppercase text-gray-800">${t.description || 'Transação'}</p>
                        <p class="text-[8px] text-gray-400">${t.created_at?.toDate().toLocaleDateString() || 'Recentemente'}</p>
                    </div>
                    <span class="font-black text-xs ${isPositivo ? 'text-green-600' : 'text-red-500'}">
                        ${isPositivo ? '+' : ''} R$ ${Math.abs(t.amount).toFixed(2)}
                    </span>
                </div>`;
        });
    } catch (e) { console.warn("Erro histórico:", e); }
}

// ============================================================================
// EXPORTAÇÕES GLOBAIS
// ============================================================================
window.carregarCarteira = carregarCarteira;
window.iniciarMonitoramentoCarteira = iniciarMonitoramentoCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;
window.atualizarCarteira = carregarCarteira;
// 🎀 FUNÇÃO PARA EXIBIR FAIXA DE BOAS-VINDAS
function verificarFaixaBonus(saldo) {
    // Só mostra se o saldo for exatamente o bônus (20) e se ele ainda não fechou hoje
    const jaFechou = sessionStorage.getItem('atlivio_bonus_visto');
    
    if (saldo === 20 && !jaFechou) {
        let banner = document.getElementById('bonus-banner');
        
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'bonus-banner';
            banner.className = "fixed top-0 left-0 w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-4 z-[9999] shadow-lg flex justify-between items-center animate-bounce-subtle";
            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-xl">🎁</span>
                    <p class="text-xs font-bold uppercase tracking-wider">Você ganhou R$ 20,00 de bônus de boas-vindas!</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.switchTab('ganhar')" class="bg-white text-green-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">Usar Agora</button>
                    <button id="close-bonus" class="text-white opacity-70 hover:opacity-100 text-lg">✕</button>
                </div>
            `;
            document.body.prepend(banner);

            document.getElementById('close-bonus').onclick = () => {
                banner.remove();
                sessionStorage.setItem('atlivio_bonus_visto', 'true');
            };
        }
    } else {
        const banner = document.getElementById('bonus-banner');
        if (banner) banner.remove();
    }
}
