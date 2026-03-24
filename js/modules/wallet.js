import { db, auth } from '../config.js';
import { doc, runTransaction, collection, serverTimestamp, getDoc, increment, addDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🎨 SKIN PREMIUM V64: Injeta o brilho dourado nas moedas ATLIX
const styleGold = document.createElement('style');
styleGold.innerHTML = `
    .moeda-ouro { 
        color: #fbbf24; /* Amarelo Ouro */
        font-weight: 900;
        text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }
    .icon-coin { filter: drop-shadow(0 0 2px #d97706); }
`;
document.head.appendChild(styleGold);

// Helper para renderizar a moeda com ícone
const GOLD_COIN = '<span class="moeda-ouro"><span class="icon-coin">🪙</span></span>';

/**
 * 💰 CONFIGURAÇÕES MESTRE
 * O valor inicial é apenas um "placeholder". 
 * O sistema irá sobrescrever esses valores em milissegundos assim que o 'iniciarRegrasFinanceiras' 
 * ler o seu Painel Administrativo no Firestore.
 */
// 💰 CONFIGURAÇÕES MESTRE DINÂMICAS
// Estes valores são atualizados automaticamente pelo Painel Admin via 'iniciarRegrasFinanceiras'
// 💰 CONFIGURAÇÕES MESTRE DINÂMICAS (V2026.VALIDADE)
export let CONFIG_FINANCEIRA = {
    taxa: 0.20,             // Taxa padrão de intermediação (20%)
    limite: 0.00,           // Limite de dívida negativa permitido para prestadores
    limite_recarga_v1: 500, // Teto de recarga rápida controlado pelo Admin
    validade_pix_meses: 12, // Dinheiro real: 1 ano para congelamento
    validade_bonus_meses: 6 // Bônus/Missões: 6 meses para destruição total
};

// Monitora alterações nas regras financeiras em Tempo Real
// Variáveis de controle de memória
let unsubscribeWallet = null; 
let unsubscribeLedger = null; // 🛰️ NOVO: Vigia específico para os lotes de validade
let processandoSaneamento = false; // 🔒 SEMÁFORO: Bloqueia execuções duplicadas para evitar saldo negativo

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

            // 🧠 SINCRONIZAÇÃO MAESTRO: Captura os novos campos de segurança do Admin
           // Captura regras de validade vindas do Admin ou assume o padrão seguro
           // 🧠 SINCRONIA MESTRE: Mapeia os nomes exatamente como estão no Firestore Admin
            const novasRegras = {
                taxa: taxaBruta,
                limite: parseFloat(data.limite_divida || 0),
                limite_recarga_v1: parseFloat(data.limite_recarga_v1 || 500),
                validade_pix_meses: parseInt(data.validade_pix_meses || 12), // Nome corrigido
                validade_bonus_meses: parseInt(data.validade_bonus_meses || 6) // Nome corrigido
            };
            
            // 🛰️ Sincronia V2026: Garante que o objeto global receba todas as novas chaves de validade
            window.CONFIG_FINANCEIRA = { ...window.CONFIG_FINANCEIRA, ...novasRegras };
            // 🔄 ATUALIZAÇÃO SÍNCRONA: Garante que todo o App saiba do novo limite sem precisar de F5
            // 🔄 ATUALIZAÇÃO SÍNCRONA: Sobrescreve os placeholders iniciais com a vontade do Admin
            CONFIG_FINANCEIRA.taxa = novasRegras.taxa;
            CONFIG_FINANCEIRA.limite = novasRegras.limite;
            CONFIG_FINANCEIRA.limite_recarga_v1 = novasRegras.limite_recarga_v1;
            CONFIG_FINANCEIRA.validade_pix_meses = novasRegras.validade_pix_meses;
            CONFIG_FINANCEIRA.validade_bonus_meses = novasRegras.validade_bonus_meses;
            
            console.log(`%c 🎯 SINCRONIA ATIVA: Taxa lida como ${(novasRegras.taxa * 100).toFixed(0)}%`, "color: #059669; font-weight: bold;");
        }
    });
}

/**
 * 🏦 MONITOR DE ECONOMIA B2B E SAQUE (V2026)
 * Este motor é isolado e não interfere nas regras de validade de saldo.
 */
function iniciarSincroniaB2B() {
    const refEco = doc(db, "settings", "global_economy");
    onSnapshot(refEco, (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            // Injeta as regras de conversão e saque no objeto global sem apagar o que já existe
            window.CONFIG_FINANCEIRA.spread = parseFloat(data.spread_conversao || 0.8);
            window.CONFIG_FINANCEIRA.saque_minimo = parseInt(data.saque_minimo_atlix || 50);
            window.CONFIG_FINANCEIRA.pix_ativo = data.pagamentos_pix_ativos ?? true;
            
            console.log("🏦 Economia B2B Sincronizada: Saque Mínimo " + window.CONFIG_FINANCEIRA.saque_minimo + " ATLIX");
            
           // 🎯 AJUSTE DE MIRA: Calcula saque apenas sobre RECARGAS (wallet_balance)
            if (window.userProfile?.wallet_balance !== undefined) {
                window.calcularEquivalenciaAtlix(window.userProfile.wallet_balance);
            }
        }
    });
}

/**
 * 🛡️ TRAVA DE TRABALHO V12
 * Decide se o Radar fica AZUL ou VERMELHO
 */
export function podeTrabalhar(custoEstimado = 0) {
    // 🛡️ SEGURANÇA V2026: Pega o saldo JÁ SANEADO da memória global
    const sReal = parseFloat(window.userProfile?.wallet_balance || 0);
    const sBonus = parseFloat(window.userProfile?.wallet_bonus || 0);
    const saldoDisponivel = sReal + sBonus;
    
    const custo = parseFloat(custoEstimado || 0);
    const limite = parseFloat(window.CONFIG_FINANCEIRA?.limite || 0);

    console.log(`🛡️ [Trava] Validando: Disponível ${saldoDisponivel} | Custo: ${custo}`);

    if (saldoDisponivel < (custo + limite)) {
        if(custo > 0) {
            const saldoFmt = saldoDisponivel.toFixed(2).replace('.', ',');
            alert(`⛔ SALDO INSUFICIENTE (VALIDADE)\n\nSeu saldo válido é de ${saldoFmt} ATLIX.\n\nNote que saldos expirados ou congelados não podem ser usados para novas solicitações.`);
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
    //MONITOR EM TEMPO REAL PARA CONFERIR VALIDADE DE SALDOS
    if (unsubscribeWallet) unsubscribeWallet();
    if (unsubscribeLedger) unsubscribeLedger(); // Limpa escuta anterior para evitar vazamento de memória

    const fv = window.firebaseModules;
    // 🛰️ VIGIA DE TEMPO: Monitora apenas lotes ATIVOS. Se um deles mudar (vencer), o gatilho dispara.
    const qLedger = fv.query(fv.collection(db, "usuarios", uid, "ledger"), fv.where("status", "==", "ativo"));

    unsubscribeLedger = fv.onSnapshot(qLedger, async (ledgerSnap) => {
        // 🔒 BLOQUEIO IMEDIATO: Se já houver um faxineiro na sala, ignora totalmente este disparo
        if (processandoSaneamento) return; 
        
        const agora = fv.Timestamp.now();
        let saldoExpiradoPix = 0;
        let saldoExpiradoBonus = 0;
        let tarefas = [];

        let idsParaLimpar = [];

        ledgerSnap.forEach(loteDoc => {
            const lote = loteDoc.data();
            // Identifica o que está podre
            if (lote.expires_at && lote.expires_at.seconds < agora.seconds) {
                idsParaLimpar.push({ id: loteDoc.id, valor: Number(lote.valor || 0), tipo: lote.tipo });
            }
        });

        // 🔥 SEGUNDA TRAVA: Só prossegue se tiver algo E se ninguém pegou a chave no meio do caminho
        if (idsParaLimpar.length > 0 && !processandoSaneamento) {
            processandoSaneamento = true; // 🔒 FECHA A PORTA AGORA (Antes de montar as ordens)
            console.error(`🚨 VIGIA DE TEMPO: Iniciando limpeza de ${idsParaLimpar.length} lote(s)...`);

            // 🛡️ SEGURANÇA V2026: Pega o saldo atual do usuário antes de calcular a poda
            const saldoRealAtual = parseFloat(window.userProfile?.wallet_balance || 0);
            const saldoBonusAtual = parseFloat(window.userProfile?.wallet_bonus || 0);

            idsParaLimpar.forEach(item => {
                if (item.tipo === 'PIX') {
                    // Só soma para expirar se o usuário ainda tiver saldo real
                    // Se o saldo já for 0, ele limpa o lote mas não subtrai mais
                    const valorADeduzir = Math.min(item.valor, Math.max(0, saldoRealAtual - saldoExpiradoPix));
                    saldoExpiradoPix += valorADeduzir;
                } else {
                    // Mesma lógica para o bônus
                    const valorADeduzirBonus = Math.min(item.valor, Math.max(0, saldoBonusAtual - saldoExpiradoBonus));
                    saldoExpiradoBonus += valorADeduzirBonus;
                }

                // 💀 INDEPENDENTE DO SALDO: O lote deve ser marcado como morto para não processar de novo
                tarefas.push(fv.updateDoc(fv.doc(db, "usuarios", uid, "ledger", item.id), { 
                    status: item.tipo === 'PIX' ? 'congelado' : 'exterminado',
                    saneado_at: fv.serverTimestamp() 
                }));
            });

           // 1. Ajusta os cofres principais
            tarefas.push(fv.updateDoc(ref, {
                wallet_balance: fv.increment(-saldoExpiradoPix),
                wallet_bonus: fv.increment(-saldoExpiradoBonus),
                wallet_frozen: fv.increment(saldoExpiradoPix),
                updated_at: fv.serverTimestamp()
            }));

            // 2. 📝 REGISTRO NO EXTRATO: Cria a linha visual para o usuário não achar que sumiu
            const extratoRef = fv.doc(fv.collection(db, "extrato_financeiro"));
            
            // Se expirou PIX, avisa que foi CONGELADO
            if (saldoExpiradoPix > 0) {
                tarefas.push(fv.setDoc(extratoRef, {
                    uid: uid,
                    valor: -saldoExpiradoPix,
                    tipo: "❄️ SALDO CONGELADO",
                    descricao: "Prazo de validade expirado (Pode ser recuperado)",
                    timestamp: fv.serverTimestamp()
                }));
            }

            // Se expirou BÔNUS, avisa que foi EXTERMINADO
            if (saldoExpiradoBonus > 0) {
                const extratoBonusRef = fv.doc(fv.collection(db, "extrato_financeiro"));
                tarefas.push(fv.setDoc(extratoBonusRef, {
                    uid: uid,
                    valor: -saldoExpiradoBonus,
                    tipo: "💀 BÔNUS EXPIRADO",
                    descricao: "Prazo de utilização encerrado",
                    timestamp: fv.serverTimestamp()
                }));
            }

            try {
                await Promise.all(tarefas);
                console.log("✅ VIGIA DE TEMPO: Banco saneado com sucesso.");
            } catch (err) {
                console.error("❌ Erro no saneamento passivo:", err);
            } finally {
                processandoSaneamento = false; // Destranca a porta
            }
        }
    });

    // 🛡️ FONTE DE VERDADE: Documento do USUÁRIO
    const ref = doc(db, "usuarios", uid);

    console.log("📡 Carteira V10: Conectando ao Banco...");

   unsubscribeWallet = onSnapshot(ref, async (docSnap) => {
        // 🛡️ FILTRO DE ORIGEM: Ignora atualizações de cache (locais) e foca apenas no Servidor
        // Isso impede que o 'onSnapshot' dispare duas vezes (uma no clique e outra na confirmação).
        if (docSnap.metadata.hasPendingWrites) return;

        if (docSnap.exists()) {
            let data = docSnap.data();
            
            // 🛡️ INTERFACE V2026: O saneamento agora é gerido pelo 'unsubscribeLedger' de forma independente
            
            //PONTO CRÍTICO SOLUÇÃO BÔNUS - LINHAS ANTES 101 A 115 DEPOIS 102 A 118
            // 💰 ESTRUTURA HÍBRIDA: Separação de Real e Bônus
            // 🛡️ SINCRONIA V12: Poder de Compra (Real + Bônus)
            // 💰 ESTRUTURA HÍBRIDA V25 (COM GATILHO DE MARKETING EM MASSA)
            // 💰 VALORES SANEADOS V2026: Subtrai o lixo tecnológico antes de mostrar na tela
            const sReal = parseFloat(data.wallet_balance || 0);
            const sBonus = parseFloat(data.wallet_bonus || 0);
            const sEarnings = parseFloat(data.wallet_earnings || 0);
            const powerCalculado = sReal + sBonus;

         // 🚀 MAESTRO SENSORIAL V2026.5: Sensor Híbrido (Detecta PIX e BÔNUS)
            // 1. SENSOR DE PIX REAL (Mantendo sua regra original intocada)
            if (window.ultimoSaldoConhecido !== undefined && sReal > window.ultimoSaldoConhecido) {
                const diferenca = sReal - window.ultimoSaldoConhecido;
                const frozenAtual = parseFloat(data.wallet_frozen || 0);

                // 🛡️ Filtro para não duplicar saldo que veio do Frozen
                if (diferenca >= 1.00 && Math.abs(diferenca - frozenAtual) > 0.01) {
                    const fv = window.firebaseModules;
                    // 💰 REGRA DE OURO: O lucro da Atlivio sobe no Dashboard agora na entrada do Pix
                    await fv.updateDoc(fv.doc(db, "sys_finance", "receita_total"), { total_acumulado: fv.increment(parseFloat(diferenca.toFixed(2))), ultima_atualizacao: fv.serverTimestamp() });

                    if (frozenAtual > 0) {
                        const fv = window.firebaseModules;
                        await fv.updateDoc(fv.doc(db, "usuarios", uid), {
                            wallet_balance: fv.increment(frozenAtual),
                            wallet_frozen: 0,
                            updated_at: fv.serverTimestamp()
                        });
                        window.registrarMovimentacao(frozenAtual, "🔥 SALDO RESGATADO", "Seu saldo anterior foi recuperado!");
                    }
                    window.oficializarLoteExterno(diferenca, "PIX", "Recarga Integrada");
                }
            }

            // 2. SENSOR DE BÔNUS (Novo: Detecta se o Admin ou Boas-vindas deu dinheiro)
            if (window.ultimoSaldoBonusConhecido !== undefined && sBonus > window.ultimoSaldoBonusConhecido) {
                const difBonus = sBonus - window.ultimoSaldoBonusConhecido;
                if (difBonus >= 0.01) {
                    console.log(`🎁 [Maestro] Bônus detectado (R$ ${difBonus}). Carimbando Ledger...`);
                    // Chama a mesma função oficializadora, mas avisando que o tipo é BONUS
                    window.oficializarLoteExterno(difBonus, "BONUS", "Bônus ou Premiação");
                }
            }

            // Atualiza as memórias de comparação para a próxima mudança de saldo
            window.ultimoSaldoConhecido = sReal;
            window.ultimoSaldoBonusConhecido = sBonus;

            // Alinha o perfil global (Essencial para milhões de usuários)
            window.userProfile = window.userProfile || {};
            window.userProfile.uid = uid;
            window.userProfile.wallet_balance = sReal;
            window.userProfile.wallet_bonus = sBonus;
            window.userProfile.wallet_total_power = powerCalculado;
            // ❄️ Sincroniza o saldo congelado na memória global do App
            window.userProfile.wallet_reserved = parseFloat(data.wallet_reserved || 0);
            window.userProfile.wallet_frozen = parseFloat(data.wallet_frozen || 0); 
            window.userProfile.wallet_earnings = sEarnings;
            
            const saldoExibicao = powerCalculado;
            // ✅ Interfaces usam agora o campo oficial de Poder de Compra
            verificarFaixaBonus(sBonus); 
            atualizarInterfaceCarteira(saldoExibicao);
            atualizarInterfaceHeader(saldoExibicao);
            atualizarInterfaceGanhar(saldoExibicao);
           // 💰 Sincronia Híbrida V64: Ganhos em R$ (Trabalho) e Saldo em Moeda (Acesso)
            const elEarningsHome = document.getElementById('user-earnings-home'); // Este recebe R$
            const elBalanceHome = document.getElementById('user-balance-home');   // Este recebe Moeda
            const barMeta = document.getElementById('meta-progress-bar');
            const txtMeta = document.getElementById('meta-text-home');
            const metaDefinida = parseFloat(data.wallet_daily_goal || 0);

            // 🏷️ V112: Força a Home a mostrar apenas os Ganhos de Hoje (Zera às 00:00h)
            if (elEarningsHome && elEarningsHome.getAttribute('data-hidden') !== 'true') {
                // Em vez de ler o saldo fixo, ele reconstrói a soma do dia atual
                window.filtrarGanhos('hoje');
            }
            if (elBalanceHome && elBalanceHome.getAttribute('data-hidden') !== 'true') {
                // Injeta o valor total somado (Principal + Reserva) com o ícone de moeda
                elBalanceHome.innerHTML = `${powerCalculado.toFixed(2).replace('.', ',')} ${GOLD_COIN}`;
            }

            // Cálculo da Barra de Meta (Unidade de medida ajustada)
            if (barMeta && txtMeta) {
                // 🏷️ V117: Alinha a meta visual com os ganhos reais (R$)
                txtMeta.innerText = `Meta: R$ ${metaDefinida.toFixed(2).replace('.', ',')}`;
                // 📈 V116: Garante que se o ganho for igual ou maior que a meta, a barra encha 100%
                const ganhoParaMeta = sEarnings; 
                const porcentagem = metaDefinida > 0 ? Math.min((ganhoParaMeta / metaDefinida) * 100, 100) : 0;
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
    const elFrozen = document.getElementById('user-balance-frozen'); // Novo campo visual
    const elReserved = document.getElementById('user-reserved'); 
    const elEarnings = document.getElementById('user-earnings'); 
    
    const sReal = parseFloat(window.userProfile?.wallet_balance || 0);
    const sBonus = parseFloat(window.userProfile?.wallet_bonus || 0);
    const sFrozen = parseFloat(window.userProfile?.wallet_frozen || 0);
    const reserved = parseFloat(window.userProfile?.wallet_reserved || 0);
    const earnings = parseFloat(window.userProfile?.wallet_earnings || 0);
    if (elTotal) {
        elTotal.innerText = saldoTotal.toFixed(2).replace('.', ',');
    }
    //PONTO CRÍTICO: COBRANÇA UNIVERSAL ATIVADA "TODAS AS ABAS" LINHAS: 144 A 205
    // 🪙 V124: Atualiza os 4 cofres: Real, Bônus, Congelado e Reserva
    if (elReal) elReal.innerText = sReal.toFixed(2).replace('.', ',');
    if (elBonus) elBonus.innerText = sBonus.toFixed(2).replace('.', ',');
    if (elFrozen) elFrozen.innerText = sFrozen.toFixed(2).replace('.', ',');
    if (elReserved) elReserved.innerText = reserved.toFixed(2).replace('.', ',');
    
    // Inicia com "Hoje" se for a primeira carga
    if (elEarnings && !window.filtroGanhosAtivo) {
        window.filtrarGanhos('hoje');
    }
}

/** 💳 O COFRE UNIVERSAL ATLIX (V200)
 * Unifica a cobrança de todas as abas. 
 * NOVA REGRA: Consome SALDO REAL (PIX) primeiro. Bônus é apenas reserva técnica.
 */
window.pagarComAtlix = async (valor, etiqueta, descricao) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { success: false, error: "Usuário deslogado" };
    const valorDebito = parseFloat(valor);

    try {
        return await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            const cofreRef = doc(db, "sys_finance", "receita_total");
            const [userSnap, cofreSnap] = await Promise.all([transaction.get(userRef), transaction.get(cofreRef)]);
            
            if (!userSnap.exists()) throw "Perfil não localizado";

            const data = userSnap.data();
            let rPrincipal = parseFloat(data.wallet_balance || 0); // Saldo Real (PIX)
            let rBonus = parseFloat(data.wallet_bonus || 0);       // Saldo Presente (Marketing)
            const poderTotal = rPrincipal + rBonus;

            if (poderTotal < valorDebito) {
                throw `Saldo insuficiente. Você tem ${poderTotal.toFixed(2)} ATLIX.`;
            }

            let lucroRealParaEmpresa = 0;

            // 🌀 NOVO LIQUIDIFICADOR V200: Prioridade ao Dinheiro Real (Lucro Atlivio)
            if (rPrincipal >= valorDebito) {
                // Cenário A: O dinheiro real cobre tudo
                rPrincipal -= valorDebito;
                lucroRealParaEmpresa = valorDebito; // Tudo é lucro real
            } else {
                // Cenário B: Dinheiro real acaba, usa o bônus para completar
                lucroRealParaEmpresa = rPrincipal; // Apenas o que era real vira lucro
                const restante = valorDebito - rPrincipal;
                rPrincipal = 0;
                rBonus -= restante;
            }

            // 1. Atualiza os Cofres do Usuário (Sincronizado)
            transaction.update(userRef, {
                wallet_balance: rPrincipal,
                wallet_bonus: rBonus,
                updated_at: serverTimestamp()
            });

            // 2. 🛡️ TRAVA CONTÁBIL: Só incrementa o faturamento se houver valor REAL envolvido
            if (lucroRealParaEmpresa > 0) {
                transaction.update(cofreRef, {
                    total_acumulado: increment(parseFloat(lucroRealParaEmpresa.toFixed(2))),
                    ultima_atualizacao: serverTimestamp()
                });
            }

            // 3. Registra no Ledger (Extrato Imutável)
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -valorDebito,
                tipo: etiqueta,
                descricao: descricao,
                timestamp: serverTimestamp(),
                origem_real: lucroRealParaEmpresa // Para auditoria do Robô 47
            });

            // 🕒 LOGICA DE VALIDADE: Registra a movimentação no Ledger com data de expiração
            // Se for positivo (entrada), calculamos o vencimento. Se for negativo (débito), o FIFO consome.
            console.log(`✅ [Cofre] Débito de ${valorDebito} concluído. Lucro Real: ${lucroRealParaEmpresa}`);
            return { success: true };
        });
    } catch (e) {
        console.warn("❌ Falha no Pagamento Universal:", e);
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
        // 🛰️ Badge do Header V64 (Compacto e Premium)
        badge.innerHTML = `${saldo.toFixed(2).replace('.', ',')} ${GOLD_COIN}`;
        badge.className = saldo < 0 
            ? "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 font-bold"
            : "ml-2 text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-600 font-bold";
    }
}

function atualizarInterfaceGanhar(saldo) {
    const el = document.getElementById('user-balance-earn'); 
    if (el) {
        //PONTO CRÍTICO, LINHA 169: TRINDADE FINANCEIRA
       // 💰 Aba Ganhar V65: Identidade visual de Créditos de Acesso Total
        el.innerHTML = `${saldo.toFixed(2).replace('.', ',')} ${GOLD_COIN}`;
        el.className = saldo < 0 ? "text-4xl font-black italic text-red-400" : "text-4xl font-black italic text-green-400";
    }
}
export async function carregarCarteira() {
    iniciarRegrasFinanceiras(); // Mantém regras de validade e taxas originais
    iniciarSincroniaB2B();      // Ativa novas regras de conversão B2B isoladamente
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

            // ✅ Restauração V74: Atualiza o saldo real deduzindo a taxa de intermediação
            transaction.update(userRef, { 
                wallet_balance: novoSaldo,
                updated_at: serverTimestamp()
            });

            // 🎯 SINCRONIA TOTAL: O Radar usa 'balance'. Garantimos que o Cobrador fale a mesma língua do Robô de PIX.
            const provDoc = await transaction.get(providerRef);
            if(provDoc.exists()) transaction.update(providerRef, { balance: novoSaldo });

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
    if (!user) return alert("Por favor, faça login!");

   // 🌍 ENDEREÇO DO ROBÔ (O cérebro que você ressuscitou no Google Cloud)
    const webhook = "https://receber-pix-infinitepay-887430049204.us-central1.run.app";
    let linkBase = "";

    // 🎯 DICIONÁRIO DE LINKS: Mapeia o valor escolhido para o link oficial da InfinitePay
    // 🎯 DICIONÁRIO DE LINKS V13: Links otimizados (sem endereço + redirecionamento)
    const mapaLinks = {
        20: "5k0YyunYF",     // Recarga Mínima
        50: "7PMm7JxIbd",    // Recarga Padrão
        100: "1EYoDIDmGB",   // Recarga Pró 01
        200: "7PMsNbklbP",   // Recarga Pró 02
        300: "7PMt8KBMMh",   // Recarga Pró 03
        500: "1TsBExCwNB",   // Recarga Pró 04
        1000: "7PMvPQH4B1",  // Recarga Black 01
        2000: "2T7e5Vu0ON",  // Recarga Black 02
        3000: "7PMwygZ5Rr",  // Recarga Black 03
        4000: "cHPerkNv7",   // Recarga Black 04
        5000: "7PMykvuDCZ"   // Recarga Black 05
    };

    const codigoProduto = mapaLinks[valor];

    if (!codigoProduto) {
        return alert("⚠️ Valor não mapeado. Por favor, escolha um valor sugerido na tela.");
    }

    linkBase = `https://checkout.infinitepay.io/atlivio-servicos/${codigoProduto}`;

    // 🚀 SINCRONIA DE IDENTIDADE: 
    // Anexamos o UID do usuário (order_nsu) e o Webhook do Robô (webhook_url).
    // Sem isso, o dinheiro entra mas o saldo não sobe automaticamente.
    const linkFinal = `${linkBase}?order_nsu=${user.uid}&webhook_url=${webhook}`;

    console.log(`💰 Gerando recarga de ${valor} ATLIX para o usuário ${user.uid}`);
    window.open(linkFinal, '_blank');
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
                                ${t.data_expiracao ? `
                                    <p class="text-[8px] font-bold mt-1 ${t.valor > 0 ? 'text-amber-600' : 'hidden'} flex items-center gap-1">
                                        ⏱️ Vence em: ${t.data_expiracao.toDate ? t.data_expiracao.toDate().toLocaleDateString() : new Date(t.data_expiracao).toLocaleDateString()}
                                    </p>
                                ` : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-black text-xs ${isPositivo ? 'text-green-600' : 'text-red-600'}">
                                ${isPositivo ? '+' : '-'} ${Math.abs(valor).toFixed(2).replace('.', ',')} 
                                ${(t.moeda === 'BRL' || (t.tipo && t.tipo.toUpperCase().includes('GANHO'))) ? 'R$' : 'ATLIX'}
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

// 🛰️ V151: Sincronização de bônus visual. O valor agora vem do banco de dados (valorBonus).
function verificarFaixaBonus(valorBonus) {
    // Verifica se o usuário já clicou no "X" para fechar esta faixa anteriormente
    const jaFechou = localStorage.getItem('atlivio_bonus_visto'); 
    
    // Se o bônus for maior que zero e o usuário ainda não fechou a faixa...
    if (valorBonus > 0 && !jaFechou) {
        let banner = document.getElementById('bonus-banner');
        
        // Se a faixa ainda não existe na tela, nós a criamos
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'bonus-banner';
            banner.className = "fixed top-0 left-0 w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 px-4 z-[9999] shadow-lg flex justify-between items-center animate-bounce-subtle";
            
            // 💰 O valor abaixo (.toFixed(2)) formata o número real do seu Admin (Ex: 10,00 ou 5,00)
            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-xl">🎁</span>
                    <div>
                        <p class="text-[9px] opacity-80 uppercase font-black">Presente de Boas-Vindas</p>
                        <p class="text-xs font-bold uppercase tracking-wider">VOCÊ GANHOU R$ ${valorBonus.toFixed(2).replace('.', ',')} PARA USAR AGORA!</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.switchTab('ganhar')" class="bg-white text-green-600 text-[10px] font-black px-4 py-2 rounded-xl uppercase shadow-md active:scale-95 transition">Usar Agora</button>
                    <button id="close-bonus" class="text-white opacity-70 hover:opacity-100 text-xl px-2">✕</button>
                </div>
            `;
            // Insere a faixa no topo do site
            document.body.prepend(banner);

            // Configura o botão de fechar (X)
            document.getElementById('close-bonus').onclick = () => {
                banner.remove();
                // ✅ Salva no navegador que este usuário já viu o bônus para não incomodar mais
                localStorage.setItem('atlivio_bonus_visto', 'true'); 
            };
        }
    } else {
        // Se o bônus for zero ou o Admin desligar, removemos a faixa da tela
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

    /* 🛡️ V119: Inicializa o contador global para que a Barra de Meta (V116) consiga ler os valores */
    if (periodo === 'hoje') window.ultimoSaldoGanhosCalculado = 0;

    window.filtroGanhosAtivo = periodo;
    elEarnings.innerText = "...";

    // 🏆 V2026.PREMIUM: Filtro instantâneo para Ganhos Totais
    if (periodo === 'total') {
        const totalR = (window.userProfile?.wallet_earnings || 0).toFixed(2).replace('.', ',');
        const totalA = (window.userProfile?.wallet_bonus_ganho_total || 0).toFixed(2).replace('.', ',');
        
        // Aplica o título correto
        if (elLabel) elLabel.innerText = "Ganhos Totais";
        
        // Injeta a estrutura de Dupla de Ataque (Real | ATLIX) no modo Total
        elEarnings.innerHTML = `
            <div class="flex items-center gap-1.5 justify-center font-black">
                <span class="text-emerald-600">R$ ${totalR}</span>
                <span class="text-slate-300 font-light mx-0.5">|</span>
                <span class="text-amber-500">${totalA} 🪙</span>
            </div>
        `;
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

        let somaReal = 0;
        let somaAX = 0;

        snap.forEach(doc => {
            const t = doc.data();
            const tipo = t.tipo || "";
            const valor = parseFloat(t.valor || 0);

           if (valor > 0) {
                // 🧬 REGRA MASTER: Prioridade para o DNA da moeda gravado no documento
                const moedaDoBanco = t.moeda || ""; 

                if (moedaDoBanco === 'ATLIX' || tipo.includes('🪙') || tipo.includes('MISSÃO')) {
                    somaAX += valor; // 🪙 Cai no balde de Bônus (Dourado)
                } else {
                    somaReal += valor; // 💰 Cai no balde de Real (Verde)
                }
            }
        });

     // 💰 V2026.ULTRA: Sincronização de Ganhos com Interface Unificada
        if (periodo === 'hoje') window.ultimoSaldoGanhosCalculado = somaReal;

        // Formatação dos valores para o padrão brasileiro
        const txtR = somaReal.toFixed(2).replace('.', ','); 
        const txtA = somaAX.toFixed(2).replace('.', ',');

        // 🏗️ Molde Visual Premium (Dupla de Ataque)
        const htmlMaster = `
            <div class="flex items-center gap-1.5 justify-center font-black">
                <span class="text-emerald-600">R$ ${txtR}</span>
                <span class="text-slate-300 font-light mx-0.5">|</span>
                <span class="text-amber-500">${txtA} 🪙</span>
            </div>
        `;

        // 🎯 Injeta no container da Carteira (ID unificado no index.html)
        if (elEarnings) elEarnings.innerHTML = htmlMaster;

        // Atualiza os Labels (Títulos) da Carteira
        if (elLabel) {
            elLabel.innerText = periodo === 'hoje' ? "Ganhos de Hoje" : 
                                periodo === 'total' ? "Ganhos Totais" : `Ganhos ${periodo} dias`;
        }

        // 🏠 Sincroniza o Card da Home (Se estiver visível)
        const elHome = document.getElementById('user-earnings-home');
        if (elHome && elHome.getAttribute('data-hidden') !== 'true') {
            elHome.innerHTML = `R$ ${txtR} <span class="text-amber-400 text-[10px] font-black">| ${txtA} 🪙</span>`;
       }
    } catch (e) {
        console.error("Erro ao filtrar ganhos:", e);
        elEarnings.innerText = "0,00";
    }
};

/**
 * 🔍 EXTRATO INTELIGENTE V2026
 * Abre um modal com a auditoria detalhada de ganhos e saques.
 */
window.abrirRelatorioDetalhado = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Feedback visual de carregamento
    const btnOriginal = event.currentTarget.innerHTML;
    event.currentTarget.innerText = "🔍 ANALISANDO...";

    try {
        const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const snap = await getDocs(query(collection(db, "extrato_financeiro"), where("uid", "==", uid)));

        let totais = { servicos: 0, missoes: 0, saques: 0 };

        snap.forEach(doc => {
            const t = doc.data();
            const valor = parseFloat(t.valor || 0);
            const tipo = t.tipo || "";

            if (valor > 0) {
                // Separação por DNA da transação
                if (tipo.includes('GANHO_SERVIÇO') || tipo.includes('FEE')) totais.servicos += valor;
                else if (tipo.includes('MISSÃO') || t.moeda === 'ATLIX') totais.missoes += valor;
            } else if (tipo.includes('SAQUE') || tipo.includes('CONVERSÃO')) {
                totais.saques += Math.abs(valor);
            }
        });

        // 🏗️ Injeção Visual no Modal (Usando a estrutura de modal que você já tem no App)
        const modalContent = `
            <div class="p-6 space-y-6 text-slate-800">
                <div class="text-center">
                    <h3 class="text-xl font-black uppercase italic tracking-tighter">Auditoria de Ganhos</h3>
                    <p class="text-[10px] text-gray-400 uppercase font-bold">Desempenho Geral na Atlivio</p>
                </div>

                <div class="grid grid-cols-1 gap-3">
                    <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                        <div>
                            <p class="text-[9px] font-black text-emerald-600 uppercase">Ganhos em Serviços</p>
                            <p class="text-[8px] text-emerald-400 uppercase leading-none">Intermediação via Chat</p>
                        </div>
                        <span class="font-black text-emerald-700">R$ ${totais.servicos.toFixed(2).replace('.', ',')}</span>
                    </div>

                    <div class="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center">
                        <div>
                            <p class="text-[9px] font-black text-amber-600 uppercase">Ganhos em Missões</p>
                            <p class="text-[8px] text-amber-400 uppercase leading-none">B2B & Atlas Vivo</p>
                        </div>
                        <span class="font-black text-amber-700">${totais.missoes.toFixed(2).replace('.', ',')} 🪙</span>
                    </div>

                    <div class="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex justify-between items-center">
                        <div>
                            <p class="text-[9px] font-black text-blue-600 uppercase">Total Resgatado</p>
                            <p class="text-[8px] text-blue-400 uppercase leading-none">Saques PIX Concluídos</p>
                        </div>
                        <span class="font-black text-blue-700">R$ ${totais.saques.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>

                <button onclick="window.fecharModalUniversal()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Fechar Auditoria</button>
            </div>
        `;

        // Aqui você usa a função de abrir modal do seu App
        if (window.abrirModalApp) {
            window.abrirModalApp(modalContent);
        } else {
            alert(`--- RELATÓRIO ATLIVIO ---\n\nServiços: R$ ${totais.servicos.toFixed(2)}\nMissões: ${totais.missoes.toFixed(2)} ATLIX\nResgatado: R$ ${totais.saques.toFixed(2)}`);
        }

    } catch (e) {
        console.error("Erro no Relatório:", e);
        alert("Falha ao gerar relatório.");
    } finally {
        // Volta o botão ao normal
        document.querySelectorAll('.btn-detalhes-extrato').forEach(b => b.innerHTML = 'Ver Detalhes 📊');
    }
};
async function definirMetaDiaria() {
    const novaMeta = prompt("Qual sua meta de ganhos para hoje (R$)?", "100.00");
    if (novaMeta && !isNaN(novaMeta.replace(',', '.'))) {
        const valor = parseFloat(novaMeta.replace(',', '.'));
        try {
            const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
                wallet_daily_goal: valor
            });
        } catch (e) {
            console.error("Erro ao salvar meta:", e);
        }
    }
}
/**
 * 🛰️ OFICIALIZADOR DE CARGA (V2026.PRO - HÍBRIDO)
 * Agora suporta PIX e BONUS, respeitando os meses de validade de cada um.
 */
window.oficializarLoteExterno = async (valor, tipoCarga = "PIX", descCustom = "") => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const config = window.CONFIG_FINANCEIRA;
    // Seleciona o prazo: se for BONUS usa a regra de 6 meses, se for PIX usa 12 meses (conforme seu Admin)
    const meses = tipoCarga === "BONUS" 
        ? parseInt(config.validade_bonus_meses || 6) 
        : parseInt(config.validade_pix_meses || 12);
    
    const dataBase = new Date();
    const dataExp = new Date(dataBase.getFullYear(), dataBase.getMonth() + meses, dataBase.getDate());

    try {
        const fv = window.firebaseModules;
        const batch = fv.writeBatch(db);
        
        // 1. Cria o Lote no Ledger (O papel que o Vigia de Tempo lê)
        const ledgerRef = fv.doc(fv.collection(db, "usuarios", uid, "ledger"));
        batch.set(ledgerRef, {
            valor: parseFloat(valor),
            tipo: tipoCarga, // 'PIX' ou 'BONUS'
            status: 'ativo',
            descricao: descCustom || (tipoCarga === "PIX" ? "Recarga Sincronizada" : "Bônus Sincronizado"), 
            created_at: fv.serverTimestamp(),
            expires_at: fv.Timestamp.fromDate(dataExp), // Carimbo de morte do saldo
            meses_concedidos: meses
        });

        // 2. Tenta injetar a validade no extrato visual para o usuário ver na tela
        const extratoRef = fv.collection(db, "extrato_financeiro");
        const q = fv.query(extratoRef, fv.where("uid", "==", uid), fv.orderBy("timestamp", "desc"), fv.limit(1));
        const snapExtrato = await fv.getDocs(q);

        if (!snapExtrato.empty) {
            const docRef = fv.doc(db, "extrato_financeiro", snapExtrato.docs[0].id);
            batch.update(docRef, { data_expiracao: fv.Timestamp.fromDate(dataExp) });
        }

        await batch.commit();
        console.log(`✅ [Ledger] Lote de ${tipoCarga} criado: R$ ${valor} com ${meses} meses de validade.`);
    } catch (e) { console.error("❌ Erro ao oficializar validade:", e); }
};

/**
 * 🎯 MOTOR DE RECOMPENSA ATLAS VIVO (V2026)
 * Esta função garante que todo ganho de missão entre como WALLET_BONUS (ATLIX).
 * Isso protege o lucro real da empresa (SYS_FINANCE).
 */
window.receberRecompensaMissao = async (valor, tituloMissao) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return { success: false, error: "Usuário não identificado" };

    try {
        const userRef = doc(db, "usuarios", uid);
        const fv = window.firebaseModules;

        // 1. Injeta o valor no Cofre de Bônus (Destino Único Aprovado)
        // Usamos increment para evitar erro de concorrência se houver 2 missões ao mesmo tempo
        await fv.updateDoc(userRef, {
            wallet_bonus: fv.increment(parseFloat(valor)),
            updated_at: fv.serverTimestamp()
        });

        // 2. Carimba a "Certidão de Nascimento" no Ledger (Dando 6 meses de validade)
        // Isso garante que o bônus da missão também expire se o usuário sumir
        if (typeof window.oficializarLoteExterno === 'function') {
            await window.oficializarLoteExterno(valor, "BONUS", `Recompensa: ${tituloMissao}`);
        }

        // 3. Registra no Extrato Financeiro para o usuário ver de onde veio o dinheiro
        await fv.addDoc(fv.collection(db, "extrato_financeiro"), {
            uid: uid,
            valor: parseFloat(valor),
            tipo: "💰 MISSÃO_CONCLUÍDA",
            descricao: `Você ganhou por: ${tituloMissao}`,
            timestamp: fv.serverTimestamp(),
            moeda: "ATLIX"
        });

        console.log(`✅ [Atlas] Recompensa de ${valor} ATLIX creditada com sucesso.`);
        return { success: true };

    } catch (e) {
        console.error("❌ Falha ao creditar recompensa:", e);
        return { success: false, error: e };
    }
};
/**
 * 🔄 MOTOR DE CONVERSÃO VISUAL ATLIVIO
 * Transforma saldo de missões em percepção de valor real (Spread).
 */

    // 🛡️ TRAVA DO ADMIN: Verifica se você desligou o PIX no Banco Central
    if (window.CONFIG_FINANCEIRA?.pix_ativo === false) {
        return alert("⚠️ CONVERSÃO TEMPORARIAMENTE INDISPONÍVEL\nO Banco Central Atlivio está em manutenção programada.");
    }

    const uid = auth.currentUser?.uid;
    // 🛡️ FILTRO DE MOEDA REAL: O saque agora ignora o wallet_bonus (Marketing)
    const saldoConversivel = parseFloat(window.userProfile?.wallet_balance || 0);
    const minSaque = window.CONFIG_FINANCEIRA?.saque_minimo || 50;
    const spread = window.CONFIG_FINANCEIRA?.spread || 0.8;

    // 🚫 Verificação de Elegibilidade de Saque
    if (saldoConversivel < minSaque) {
        return alert(`🛑 LIMITE MÍNIMO NÃO ATINGIDO\n\nVocê possui ${saldoConversivel.toFixed(2)} ATLIX conversíveis.\nO valor mínimo para resgate é de ${minSaque} ATLIX.\n\nLembre-se: Bônus de marketing não podem ser sacados.`);
    }

    const valorRealBruto = (saldoRealTrabalho * spread).toFixed(2);
    if (!confirm(`🚀 SOLICITAR RESGATE\n\nConverter: ${saldoRealTrabalho.toFixed(2)} ATLIX\nReceber: R$ ${valorRealBruto}\n\nConfirma a operação?`)) return;

    try {
        const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // Debita o saldo REAL de trabalho
        await updateDoc(doc(db, "usuarios", uid), {
            wallet_balance: increment(-saldoRealTrabalho),
            updated_at: serverTimestamp()
        });

        // 📝 Registro de Débito para Auditoria: Identifica como ATLIX CRÉDITOS
        await addDoc(collection(db, "extrato_financeiro"), {
            uid: uid,
            valor: -saldoConversivel,
            tipo: "🏧 SOLICITAÇÃO_SAQUE",
            descricao: `Resgate de ${saldoConversivel.toFixed(2)} ATLIX (Créditos de Trabalho)`,
            timestamp: serverTimestamp(),
            moeda: "ATLIX",
            status: "processando"
        });

        // Envia para o Gil pagar (Assistant vai ler isso)
        await addDoc(collection(db, "mission_submissions"), {
            user_id: uid,
            user_name: window.userProfile?.nome || "Usuário",
            mission_title: "🏧 RESGATE DE SALDO ATLIX",
            reward: parseFloat(valorRealBruto),
            pay_type: 'real',
            status: 'approved_pending_pix', // Já cai na fila de pagamento
            is_saque: true,
            created_at: serverTimestamp()
        });

        alert("✅ SOLICITAÇÃO ENVIADA!\nO Banco Central processará seu PIX em breve.");
        
    } catch (e) { alert("Erro ao processar saque."); }
};
// 🎯 V2026.FIX: Expõe a função para que o botão "Meta" no HTML volte a funcionar
window.definirMetaDiaria = definirMetaDiaria;
window.carregarHistoricoCarteira = carregarHistoricoCarteira;
// 🛰️ BRIDGE DE MÓDULOS: Garante que o motor de saneamento tenha acesso às ferramentas do Firebase
import * as firestoreFull from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
window.firebaseModules = { ...window.firebaseModules, ...firestoreFull };

/**
 * ♻️ PROTOCOLO DE ESTORNO B2B ATLIVIO
 * Liquida vagas ociosas de uma missão e devolve o saldo reservado para a empresa.
 */
window.encerrarMissaoB2BComEstorno = async (missionId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
        const { doc, getDoc, runTransaction, serverTimestamp, increment, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🛰️ CONSULTA DE INTEGRIDADE ANTES DA AÇÃO
        const missionRef = doc(db, "missions", missionId);
        const missionSnap = await getDoc(missionRef);

        if (!missionSnap.exists()) return alert("Erro: Ordem não localizada no sistema.");
        const mData = missionSnap.data(); // 🟢 Declaração Única

        // 🛡️ TRAVA ATÔMICA ATLIVIO: Bloqueia se já foi processada, encerrada ou rejeitada pelo Admin
        if (mData.status === 'rejected' || mData.status === 'closed') {
            console.warn("🚫 Tentativa de estorno duplicado bloqueada.");
            alert("✔️ Esta ordem já foi finalizada e o saldo devidamente processado pelo sistema.");
            if(window.carregarOrdensB2B) window.carregarOrdensB2B();
            return;
        }

        // 🔐 Verificação de Propriedade
        if (mData.owner_id !== uid) return alert("Acesso negado: Você não possui autorização para esta ordem.");
        
        if (mData.status === 'closed' || mData.status === 'rejected') {
            alert("✔️ Esta ordem já foi finalizada e o saldo devidamente processado pelo sistema.");
            return;
        }

        const vagasTotais = parseInt(mData.slots_totais || 0);
        const vagasPreenchidas = parseInt(mData.slots_ocupados || 0);
        const vagasRestantes = vagasTotais - vagasPreenchidas;

        if (vagasRestantes <= 0) {
            // Se não há vagas sobrando, apenas fecha a missão
            await updateDoc(missionRef, { status: 'closed', updated_at: serverTimestamp() });
            return alert("Missão encerrada! Todas as vagas foram utilizadas.");
        }

        // 💸 Cálculo do Reembolso: Valor Unitário (Com Taxa) x Vagas Restantes
        const valorUnitarioComTaxa = parseFloat(mData.unit_total_with_fee || 0);
        const valorTotalEstorno = parseFloat((valorUnitarioComTaxa * vagasRestantes).toFixed(2));

        if (!confirm(`⚠️ ENCERRAR OPERAÇÃO?\n\nExistem ${vagasRestantes} vagas não utilizadas.\nO valor de ${valorTotalEstorno.toFixed(2)} ATLIX voltará para seu saldo disponível.\n\nConfirmar encerramento?`)) return;

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            
            // 1. Devolve o dinheiro: Tira da Reserva e volta para o Saldo Real de Trabalho (Balance)
            transaction.update(userRef, {
                wallet_reserved: increment(-valorTotalEstorno),
                wallet_balance: increment(valorTotalEstorno),
                updated_at: serverTimestamp()
            });

            // 2. Mata a missão no Radar
            transaction.update(missionRef, { 
                status: 'closed', 
                slots_disponiveis: 0,
                updated_at: serverTimestamp() 
            });

            // 3. Registra no Extrato Imutável
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: valorTotalEstorno,
                tipo: "♻️ ESTORNO_VAGAS_B2B",
                descricao: `Reembolso de ${vagasRestantes} vaga(s) da missão: ${mData.title}`,
                timestamp: serverTimestamp(),
                moeda: "ATLIX"
            });
        });

       // 🔄 Sincronia Imediata: Atualiza a memória local para refletir o estorno sem recarregar
        if(window.userProfile) {
            window.userProfile.wallet_reserved -= valorTotalEstorno;
            window.userProfile.wallet_balance += valorTotalEstorno;
        }

        alert(`✅ OPERAÇÃO FINALIZADA: ${valorTotalEstorno.toFixed(2)} ATLIX retornaram ao seu saldo disponível.`);
        if (window.switchTab) window.switchTab('ganhar');

    } catch (e) {
        console.error("Erro no Estorno B2B:", e);
        alert("❌ Falha ao processar estorno. Tente novamente.");
    }
};

console.log("%c✅ WALLET V63.4: Protocolo de Estorno B2B e Conexões Globais Ativadas.", "color: #10b981; font-weight: bold;");
/**
 * 📖 GUIA DA CARTEIRA ATLIVIO V2026
 * Explica de forma leiga e direta cada compartimento financeiro.
 */
window.abrirGuiaCarteira = () => {
    // 🎨 AJUSTE DE CONTRASTE: Usamos fundo sólido e texto mais escuro para leitura perfeita
    const modalContent = `
        <div class="p-6 space-y-6 text-slate-950 animate-fadeIn bg-white rounded-3xl border border-gray-100 shadow-inner">
            <div class="text-center">
                <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-sm">
                    <span class="text-3xl">🏦</span>
                </div>
                <h3 class="text-2xl font-black text-slate-950 uppercase italic tracking-tighter shadow-sm">Guia Financeiro</h3>
                <p class="text-[11px] text-gray-500 uppercase font-bold tracking-widest leading-none mt-1">Entenda seus créditos Atlivio</p>
            </div>

           <div class="space-y-5">
                <div class="flex gap-4 items-start bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                    <span class="text-2xl">💰</span>
                    <div>
                        <p class="text-xs font-black uppercase text-slate-950">Atlix Recargas</p>
                        <p class="text-[10px] text-slate-600 leading-tight">Dinheiro que você adicionou VIA RECARGA PIX. É o **único** que pode ser sacado para sua conta via SAQUE PIX.</p>
                    </div>
                </div>

                <div class="flex gap-4 items-start p-2">
                    <span class="text-2xl">🎁</span>
                    <div>
                        <p class="text-xs font-black uppercase text-amber-600">Atlix Bônus</p>
                        <p class="text-[10px] text-gray-500 leading-tight">São presentes da Atlivio ou prêmios de missões. Você usa para contratar serviços dentro do app, mas **eles não podem ser convertidos em PIX.**</p>
                    </div>
                </div>

                <div class="flex gap-4 items-start p-2">
                    <span class="text-2xl">❄️</span>
                    <div>
                        <p class="text-xs font-black uppercase text-blue-500">Atlix Congelado</p>
                        <p class="text-[10px] text-gray-500 leading-tight">Saldos de recargas que passaram da validade. Eles ficam guardados aqui. Para descongelar e usar, basta fazer qualquer nova recarga.</p>
                    </div>
                </div>

                <div class="flex gap-4 items-start p-2 border-t border-gray-50 pt-4">
                    <span class="text-2xl">🔒</span>
                    <div>
                        <p class="text-xs font-black uppercase text-slate-700">Em Custódia</p>
                        <p class="text-[10px] text-gray-500 leading-tight">Dinheiro "preso" em um serviço que você contratou. Garante o pagamento do prestador após voce liberar o pagamento de missões ou serviços.</p>
                    </div>
                </div>

                <div class="flex gap-4 items-start p-2">
                    <span class="text-2xl">📈</span>
                    <div>
                        <p class="text-xs font-black uppercase text-emerald-600">Seus Ganhos</p>
                        <p class="text-[10px] text-gray-500 leading-tight">Soma de tudo o que você faturou trabalhando ou cumprindo missões.</p>
                    </div>
                </div>
            </div>

            <button id="btn-fechar-guia" class="w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg transform active:scale-95 transition-all mt-4">
                Entendi, Voltar
            </button>
        </div>
    `;

    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    if (modal && content) {
        content.innerHTML = modalContent;
        modal.classList.remove('hidden');
        modal.style.setProperty('display', 'flex', 'important');

        // 🔗 Soldagem do Clique: Força o fechamento do modal ao clicar no botão
        document.getElementById('btn-fechar-guia').onclick = () => {
            modal.classList.add('hidden');
            modal.style.setProperty('display', 'none', 'important');
        };
    }
};
