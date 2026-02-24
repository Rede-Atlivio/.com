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
export function podeTrabalhar(custoEstimado = 0) { //- PONTO CRÍTICO SOLUÇÃO BÔNUS LINHAS ANTES 59 A 72 DEPOIS 59 A 73
    const user = window.userProfile;
    // Soma Real + Bônus para saber se ele tem "poder de fogo"
    const saldoReal = parseFloat(user?.wallet_balance || 0);
    const saldoBonus = parseFloat(user?.wallet_bonus || 0);
    const saldoTotal = saldoReal + saldoBonus;
    
    const custo = parseFloat(custoEstimado || 0);
    const limite = parseFloat(window.CONFIG_FINANCEIRA?.limite || 0);

    if (isNaN(saldoTotal) || isNaN(custo)) return false; 
    
    const saldoFinal = saldoTotal - custo;

    if (saldoFinal < limite) {
        if(custo > 0) {
             const saldoFmt = saldoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
            
            //PONTO CRÍTICO SOLUÇÃO BÔNUS - LINHAS ANTES 101 A 115 DEPOIS 102 A 118
            // 💰 ESTRUTURA HÍBRIDA: Separação de Real e Bônus
            // 🛡️ SINCRONIA V12: Poder de Compra (Real + Bônus)
            const sReal = parseFloat(data.wallet_balance || 0);
            const sBonus = parseFloat(data.wallet_bonus || 0);
            const sEarnings = parseFloat(data.wallet_earnings || 0); // ✅ Adicionado para a Home
            const powerCalculado = sReal + sBonus;

            // Alinha o perfil global com o campo reflexo do banco
            window.userProfile = window.userProfile || {};
            window.userProfile.uid = uid;
            window.userProfile.wallet_balance = sReal;
            window.userProfile.wallet_bonus = sBonus;
           window.userProfile.wallet_total_power = powerCalculado;
            window.userProfile.wallet_reserved = parseFloat(data.wallet_reserved || 0);
            window.userProfile.wallet_earnings = parseFloat(data.wallet_earnings || 0);
            
            const saldoExibicao = window.userProfile.wallet_total_power;
            // ✅ Interfaces usam agora o campo oficial de Poder de Compra
            verificarFaixaBonus(sBonus); 
            atualizarInterfaceCarteira(saldoExibicao);
            atualizarInterfaceHeader(saldoExibicao);
            atualizarInterfaceGanhar(saldoExibicao);
           // 💰 Sincroniza Ganhos, Saldo e Meta Home V25
            const elEarningsHome = document.getElementById('user-earnings-home');
            const elBalanceHome = document.getElementById('user-balance-home');
            const barMeta = document.getElementById('meta-progress-bar');
            const txtMeta = document.getElementById('meta-text-home');
            const metaDefinida = parseFloat(data.wallet_daily_goal || 0);

            if (elEarningsHome && elEarningsHome.getAttribute('data-hidden') !== 'true') {
                elEarningsHome.innerText = `R$ ${sEarnings.toFixed(2).replace('.', ',')}`;
            }
            if (elBalanceHome && elBalanceHome.getAttribute('data-hidden') !== 'true') {
                elBalanceHome.innerText = `R$ ${powerCalculado.toFixed(2).replace('.', ',')}`;
            }

            // Cálculo da Barra de Meta
            if (barMeta && txtMeta) {
                txtMeta.innerText = `Meta: R$ ${metaDefinida.toFixed(2).replace('.', ',')}`;
                const porcentagem = metaDefinida > 0 ? Math.min((sEarnings / metaDefinida) * 100, 100) : 0;
                barMeta.style.width = `${porcentagem}%`;
                barMeta.className = porcentagem >= 100 ? "bg-emerald-500 h-full transition-all duration-700" : "bg-blue-500 h-full transition-all duration-700";
            }
            carregarHistoricoCarteira(uid);
        }
    });
}
//PONTO CRÍTICO: NOVAS LINHAS 125 A 146 - ATUALIZAÇÃO COM NOVOS CAMPOS - TRINDADE FINANCEIRA
// Atualize a função atualizarInterfaceCarteira para mostrar os 3 cofres sincronizados com o banco
function atualizarInterfaceCarteira(saldoTotal) {
    const elTotal = document.getElementById('user-balance'); 
    const elReal = document.getElementById('user-balance-real');
    const elBonus = document.getElementById('user-balance-bonus');
    const elReserved = document.getElementById('user-reserved'); 
    const elEarnings = document.getElementById('user-earnings'); 
    
    const sReal = parseFloat(window.userProfile?.wallet_balance || 0);
    const sBonus = parseFloat(window.userProfile?.wallet_bonus || 0);
    const reserved = parseFloat(window.userProfile?.wallet_reserved || 0);
    const earnings = parseFloat(window.userProfile?.wallet_earnings || 0);

    if (elTotal) {
        elTotal.innerText = saldoTotal.toFixed(2).replace('.', ',');
    }
    
    if (elReal) elReal.innerText = sReal.toFixed(2).replace('.', ',');
    if (elBonus) elBonus.innerText = sBonus.toFixed(2).replace('.', ',');
    //PONTO CRÍTICO: COBRANÇA UNIVERSAL ATIVADA "TODAS AS ABAS" LINHAS: 144 A 205
   if (elReserved) elReserved.innerText = reserved.toFixed(2).replace('.', ',');
    
    // Inicia com "Hoje" se for a primeira carga
    if (elEarnings && !window.filtroGanhosAtivo) {
        window.filtrarGanhos('hoje');
    }
}

/**
 * ⚡ MOTOR DE COBRANÇA UNIVERSAL (V14)
 * Esta função é o 'pedágio' para as abas Empregos, Vídeos e Oportunidades.
 * Ela prioriza o wallet_bonus e depois o wallet_balance.
 */
window.processarPagamentoServico = async (valor, etiqueta, descricao) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { sucess: false, error: "Usuário deslogado" };

    try {
        let resultado = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Usuário não encontrado";

            const data = userSnap.data();
            let rBonus = parseFloat(data.wallet_bonus || 0);
            let rBal = parseFloat(data.wallet_balance || 0);
            const poderCompra = rBonus + rBal;

            if (poderCompra < valor) {
                throw `Saldo insuficiente. Necessário R$ ${valor.toFixed(2)}`;
            }

            // Lógica do Liquidificador: Consome bônus primeiro
            if (rBonus >= valor) {
                rBonus -= valor;
            } else {
                const resto = valor - rBonus;
                rBonus = 0;
                rBal -= resto;
            }

            // Atualiza o banco
            transaction.update(userRef, {
                wallet_balance: rBal,
                wallet_bonus: rBonus,
                updated_at: serverTimestamp()
            });

            // Grava no Ledger (Extrato)
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -valor,
                tipo: etiqueta,
                descricao: descricao,
                timestamp: serverTimestamp()
            });

            return { success: true };
        });
        return resultado;
    } catch (e) {
        console.error("❌ Erro no pagamento:", e);
        return { success: false, error: e };
    }
};

function atualizarInterfaceHeader(saldo) {
    const headerName = document.getElementById('provider-header-name');
    if (headerName) {
        let badge = document.getElementById('header-balance-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'header-balance-badge';
            headerName.appendChild(badge);
        }
        //PONTO CRÍTICO - LINHA 158 TRINDADE FINANCEIRA 
        badge.innerText = `R$ ${saldo.toFixed(2).replace('.', ',')}`;
        badge.className = saldo < 0 
            ? "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 font-bold"
            : "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-600 font-bold";
    }
}

function atualizarInterfaceGanhar(saldo) {
    const el = document.getElementById('user-balance-earn'); 
    if (el) {
        //PONTO CRÍTICO, LINHA 169: TRINDADE FINANCEIRA
        el.innerText = `R$ ${saldo.toFixed(2).replace('.', ',')}`;
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
            
            // 🔄 CORREÇÃO: Deduz a taxa e registra o ganho bruto para o Admin
            const saldoAtual = parseFloat(userDoc.data().wallet_balance || 0);
            const ganhosAtuais = parseFloat(userDoc.data().wallet_earnings || 0);
            const novoSaldo = saldoAtual - valorTaxa;

            transaction.update(userRef, { 
                wallet_balance: novoSaldo,
                // Mantemos o registro de ganhos para o nível do usuário
                updated_at: serverTimestamp()
            });

            // Sincroniza com o espelho do radar
            const provDoc = await transaction.get(providerRef);
            if(provDoc.exists()) transaction.update(providerRef, { wallet_balance: novoSaldo });

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

//PONTO CRÍTICO: LEDGER IMUTÁVEL APÓS NOVA INTERFACE: LINHAS 270 A 333
/**
 * 📖 CARREGAR HISTÓRICO (FASE 8.5 - LEDGER IMUTÁVEL)
 * Lê a coleção oficial 'extrato_financeiro' para desenhar o histórico premium.
 */
async function carregarHistoricoCarteira(uid) {
    const container = document.getElementById('lista-transacoes-carteira');
    if (!container) return;

    try {
        const { collection, query, where, orderBy, limit, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(db, "extrato_financeiro"), where("uid", "==", uid), orderBy("timestamp", "desc"), limit(15));
        
        onSnapshot(q, (snap) => {
            if (snap.empty) {
                container.innerHTML = `<p class="text-center text-[10px] text-gray-400 py-8 italic">Seu extrato aparecerá aqui assim que houver movimentações.</p>`;
                return;
            }

            container.innerHTML = "";
            snap.forEach(doc => {
                const t = doc.data();
                const valor = parseFloat(t.valor || 0);
                const isPositivo = valor > 0;
                
                container.innerHTML += `
                    <div class="flex justify-between items-center p-4 bg-white rounded-[16px] border border-gray-100 shadow-sm mb-3 animate-fadeIn">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full ${isPositivo ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center text-lg font-bold">
                                ${t.tipo.includes('🎁') ? '🎁' : t.tipo.includes('🔒') ? '🔒' : isPositivo ? '📈' : '🏁'}
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-800 leading-tight">${t.tipo}</p>
                                <p class="text-[9px] text-gray-400 font-medium">${t.descricao || 'Movimentação Automática'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-black text-xs ${isPositivo ? 'text-green-600' : 'text-slate-800'}">
                                ${isPositivo ? '+' : ''} R$ ${Math.abs(valor).toFixed(2).replace('.', ',')}
                            </p>
                            <p class="text-[8px] text-gray-400 font-bold uppercase">${t.timestamp?.toDate().toLocaleDateString() || 'Processando'}</p>
                        </div>
                    </div>`;
            });
        });
    } catch (e) { console.warn("❌ Falha ao ler Extrato:", e); }
}

/**
 * 🏗️ FUNÇÃO MESTRA: REGISTRAR MOVIMENTAÇÃO (PARA TODAS AS ABAS)
 * Use: window.registrarMovimentacao(5.00, "RECOMPENSA_MISSÃO 🎯", "Aba Microtarefas")
 */
window.registrarMovimentacao = async (valor, tipo, descricao) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addDoc(collection(db, "extrato_financeiro"), {
            uid: user.uid,
            valor: parseFloat(valor),
            tipo: tipo,
            descricao: descricao,
            timestamp: serverTimestamp()
        });
    } catch (e) { console.error("Erro ao gravar Ledger:", e); }
};
// ============================================================================
// EXPORTAÇÕES GLOBAIS
// ============================================================================
window.carregarCarteira = carregarCarteira;
window.iniciarMonitoramentoCarteira = iniciarMonitoramentoCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;
window.atualizarCarteira = carregarCarteira;
// 🎀 FUNÇÃO PARA EXIBIR FAIXA DE BOAS VINDAS - PONTO CRÍTICO SOLUÇÃO BÔNUS -  LINHAS ANTES 302 A 306 DEPOIS 302 A 305
function verificarFaixaBonus(valorBonus) {
    const jaFechou = localStorage.getItem('atlivio_bonus_visto'); 
    
    if (valorBonus > 0 && !jaFechou) {
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
/**
 * 📈 MOTOR DE GANHOS DINÂMICOS
 * Calcula ganhos baseados no extrato_financeiro
 */
window.filtrarGanhos = async (periodo) => {
    const uid = auth.currentUser?.uid;
    const elEarnings = document.getElementById('user-earnings');
    const elLabel = document.getElementById('label-ganhos');
    if (!uid || !elEarnings) return;

    window.filtroGanhosAtivo = periodo;
    elEarnings.innerText = "...";

    // Se o filtro for 'total', usamos o campo estático do perfil para ser instantâneo
    if (periodo === 'total') {
        elLabel.innerText = "Ganhos Totais";
        elEarnings.innerText = (window.userProfile?.wallet_earnings || 0).toFixed(2).replace('.', ',');
        return;
    }

    try {
        const { collection, query, where, getDocs, Timestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        let dataCorte = new Date();
        dataCorte.setHours(0, 0, 0, 0); // Início do dia de hoje

        if (periodo === '7') dataCorte.setDate(dataCorte.getDate() - 7);
        if (periodo === '30') dataCorte.setDate(dataCorte.getDate() - 30);

        const q = query(
            collection(db, "extrato_financeiro"),
            where("uid", "==", uid),
            where("timestamp", ">=", Timestamp.fromDate(dataCorte))
        );

        const snap = await getDocs(q);
        let soma = 0;

        snap.forEach(doc => {
            const t = doc.data();
            const tipo = t.tipo || "";
            // Captura qualquer ganho positivo de serviço ou missão (✅, ⚡ ou 🎯)
            if (t.valor > 0 && (tipo.includes('GANHO') || tipo.includes('✅') || tipo.includes('⚡') || tipo.includes('🎯'))) {
                soma += parseFloat(t.valor);
            }
        });

        const valorFormatado = soma.toFixed(2).replace('.', ',');
        elLabel.innerText = periodo === 'hoje' ? "Ganhos de Hoje" : `Ganhos nos últimos ${periodo} dias`;
        elEarnings.innerText = valorFormatado;

        // Atualiza o Card da Home em tempo real (Ganhos filtrados)
        const elEarningsHome = document.getElementById('user-earnings-home');
        const lbHome = document.getElementById('label-ganhos-home');
        
        if (elEarningsHome && elEarningsHome.getAttribute('data-hidden') !== 'true') {
            elEarningsHome.innerText = `R$ ${valorFormatado}`;
            if (lbHome) lbHome.innerText = periodo === 'hoje' ? "Ganhos" : `Ganhos ${periodo}D`;
        }
    } catch (e) {
        console.error("Erro ao filtrar ganhos:", e);
        elEarnings.innerText = "0,00";
    }
};
