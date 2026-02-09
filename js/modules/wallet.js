import { db, auth } from '../config.js';
import { doc, runTransaction, collection, serverTimestamp, getDoc, increment, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * 💰 CONFIGURAÇÕES MESTRE
 * O valor inicial é apenas um "placeholder". 
 * O sistema irá sobrescrever esses valores em milissegundos assim que o 'iniciarRegrasFinanceiras' 
 * ler o seu Painel Administrativo no Firestore.
 */
export let CONFIG_FINANCEIRA = {
    taxa: 0.20,     
    limite: 0.00  
};

// Monitora alterações nas regras financeiras em Tempo Real
// Variáveis de controle de memória
let unsubscribeWallet = null; 

/**
 * 🧠 CÉREBRO FINANCEIRO V12
 * Escuta as regras do Admin e as expõe globalmente para o Radar e Chat
 */
/**
 * 🧠 CÉREBRO FINANCEIRO V12.1 - SINCRONIA TOTAL
 * Escuta as regras do Admin e garante que o Radar e o Robô de Cobrança falem a mesma língua.
 */
function iniciarRegrasFinanceiras() {
    const ref = doc(db, "settings", "financeiro");
    
    onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            
            // 🎯 AJUSTE DE MIRA: O valor '50' está em 'porcentagem_reserva'
            // Usamos || como plano B caso você mude o nome no Admin depois
            let taxaBruta = parseFloat(data.porcentagem_reserva || data.taxa_plataforma || 0);
            
            // Converte 50 para 0.50 (50%)
            if (taxaBruta > 1) taxaBruta = taxaBruta / 100;

            const novasRegras = {
                taxa: taxaBruta,
                limite: parseFloat(data.limite_divida || 0)
            };
            
            window.CONFIG_FINANCEIRA = novasRegras;
            CONFIG_FINANCEIRA.taxa = novasRegras.taxa;
            CONFIG_FINANCEIRA.limite = novasRegras.limite;
            
            console.log(`%c 🎯 SINCRONIA ATIVA: Taxa lida como ${(novasRegras.taxa * 100).toFixed(0)}%`, "color: #059669; font-weight: bold;");
        }
    });
}

/**
 * 🛡️ TRAVA DE TRABALHO V12
 * Decide se o Radar fica AZUL ou VERMELHO
 */
export function podeTrabalhar(custoEstimado = 0) {
    const user = window.userProfile;
    if (!user || user.wallet_balance === undefined) return false;
    
    const saldo = parseFloat(user.wallet_balance || 0);
    const custo = parseFloat(custoEstimado || 0);
    const limite = parseFloat(window.CONFIG_FINANCEIRA?.limite || 0);

    if (isNaN(saldo) || isNaN(custo)) return false; 
    
    // Lógica V12: (0 - 0) não é menor que 0. Então LIBERA saldo zero.
    const saldoFinal = saldo - custo;

    if (saldoFinal < limite) {
        if(custo > 0) {
             const saldoFmt = saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
             alert(`⛔ SALDO INSUFICIENTE\n\nSeu saldo (${saldoFmt}) não cobre a taxa do serviço.`);
             if(window.switchTab) window.switchTab('ganhar');
        }
        return false; 
    }
    return true; 
}
// ============================================================================
// 1. MONITORAMENTO REAL-TIME (V10.0 STACK COMPATIBLE)
// ============================================================================
export function iniciarMonitoramentoCarteira() {
    if (!auth || !auth.currentUser) return; 
    
    const uid = auth.currentUser.uid;
    if (unsubscribeWallet) unsubscribeWallet();

    // 🛡️ FONTE DE VERDADE: Documento do USUÁRIO
    const ref = doc(db, "usuarios", uid);

    console.log("📡 Carteira V10: Conectando ao Banco...");

    unsubscribeWallet = onSnapshot(ref, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // 🔥 UNIFICAÇÃO: Apenas 'wallet_balance' importa
            const saldoUnificado = parseFloat(data.wallet_balance || 0);

            // MEMÓRIA COMPARTILHADA (Para o request.js ler sem ir no banco)
            window.userProfile = window.userProfile || {};
            window.userProfile.uid = uid;
            window.userProfile.wallet_balance = saldoUnificado; // Padrão novo
            window.userProfile.balance = saldoUnificado; // Retrocompatibilidade

            // ✅ Atualização de Interfaces
            verificarFaixaBonus(saldoUnificado);
            atualizarInterfaceCarteira(saldoUnificado);
            atualizarInterfaceHeader(saldoUnificado);
            atualizarInterfaceGanhar(saldoUnificado);
            carregarHistoricoCarteira(uid); 
        }
    });
}

// Atualize a função atualizarInterfaceCarteira para mostrar os 3 cofres sincronizados com o banco
function atualizarInterfaceCarteira(data) {
    const elBalance = document.getElementById('user-balance'); // Disponível
    const elReserved = document.getElementById('user-reserved'); // Custódia
    const elEarnings = document.getElementById('user-earnings'); // Ganhos

    if (elBalance) elBalance.innerText = (data.wallet_balance || 0).toFixed(2).replace('.', ',');
    if (elReserved) elReserved.innerText = (data.wallet_reserved || 0).toFixed(2).replace('.', ',');
    if (elEarnings) elEarnings.innerText = (data.wallet_earnings || 0).toFixed(2).replace('.', ',');
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
    iniciarRegrasFinanceiras(); // 🚀 Inicia o robô de regras
    iniciarMonitoramentoCarteira();
}

// ============================================================================
// 2. LÓGICA DE TRAVA (ANTI-CALOTE) - V10.0
// ============================================================================
/**
 * Verifica se o prestador pode aceitar serviços.
 * Chamada pelo request.js antes de abrir o modal de aceite.
 */

// ============================================================================
// 3. O COBRADOR (RESTAURADO ✅)
// ============================================================================
export async function processarCobrancaTaxa(orderId, valorServico) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    // Pega a taxa dinâmica que veio do onSnapshot do Admin
    const valorTaxa = valorServico * CONFIG_FINANCEIRA.taxa;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            const providerRef = doc(db, "active_providers", uid);
            const ledgerRef = doc(db, "sys_finance", "stats");
            
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Usuário não encontrado!";
            
            // 🔥 Lê apenas do campo oficial
            const saldoAtual = parseFloat(userDoc.data().wallet_balance || 0);
            const novoSaldo = saldoAtual - valorTaxa;

            // 🔥 Atualiza apenas o campo oficial (Limpeza de Lixo)
            transaction.update(userRef, { 
                wallet_balance: novoSaldo 
            });

            // Espelha no active_providers se o documento existir lá
            const provDoc = await transaction.get(providerRef);
            if(provDoc.exists()){
                transaction.update(providerRef, { wallet_balance: novoSaldo });
            }

            const newHistRef = doc(collection(db, "transactions")); 
            transaction.set(newHistRef, {
                provider_id: uid,
                type: 'fee_charge',
                amount: -valorTaxa,
                description: `Taxa Intermediação - Pedido #${orderId.slice(0,5)}`,
                order_id: orderId,
                created_at: serverTimestamp()
            });

            transaction.set(ledgerRef, { total_receivables: increment(valorTaxa) }, { merge: true });
        });
        console.log("✅ Taxa processada com sucesso no campo wallet_balance!");
    } catch (e) {
        console.error("❌ Erro na transação financeira:", e);
    }
}

// ============================================================================
// 4. INFINITEPAY & HISTÓRICO
// ============================================================================
// 🩹 CORREÇÃO GHOSTBUSTER: Uso de 'async function' para evitar falso positivo
window.abrirCheckoutPix = async function(valor) {
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
    // ✅ CORREÇÃO: Usar localStorage para lembrar "para sempre" (ou até limpar cache)
    const jaFechou = localStorage.getItem('atlivio_bonus_visto'); 
    
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
                // ✅ GRAVA NA MEMÓRIA PERMANENTE DO NAVEGADOR
                localStorage.setItem('atlivio_bonus_visto', 'true'); 
            };
        }
    } else {
        const banner = document.getElementById('bonus-banner');
        if (banner) banner.remove();
    }
}
