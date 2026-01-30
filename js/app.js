// 👇 AQUI ESTAVA O ERRO: AGORA USA DOIS PONTOS (..) PARA ACHAR O APP.JS COM AS CHAVES
import { db, auth } from '../app.js'; 
import { doc, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÕES FINANCEIRAS
const TAXA_PLATAFORMA = 0.20; 
const LIMITE_DIVIDA = -60.00; 

// ============================================================================
// 1. CARREGAR CARTEIRA (CONSTRUTOR VISUAL)
// ============================================================================
export async function carregarCarteira() {
    console.log("💰 Iniciando módulo Carteira (V2.0)...");
    const uid = auth.currentUser?.uid;
    if(!uid) return;

    // Tenta encontrar a section da carteira (suporta nomes antigos e novos)
    let container = document.getElementById('sec-carteira');
    if(!container) container = document.getElementById('sec-ganhar'); 

    if (!container) return console.warn("⚠️ Container da carteira não encontrado no HTML.");

    // 🏗️ INJEÇÃO DE HTML (O NOVO VISUAL)
    // Substitui o visual antigo pelo Painel Financeiro Moderno
    container.innerHTML = `
        <div class="p-4 animate-fadeIn">
            <div class="bg-slate-900 rounded-2xl p-6 text-center text-white mb-6 relative overflow-hidden shadow-lg border border-slate-800">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                
                <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Saldo Disponível</p>
                <h1 id="wallet-display-available" class="text-4xl font-black mb-4 tracking-tight">R$ --,--</h1>

                <div class="flex justify-center gap-3 mb-6">
                    <button onclick="alert('Recarga via PIX em breve!')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-full transition shadow-lg flex items-center gap-1">
                        <span>⊕</span> Recarregar
                    </button>
                    <button onclick="alert('Saque em breve!')" class="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-4 rounded-full transition border border-slate-600">
                        <span>↧</span> Sacar
                    </button>
                </div>

                <div class="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 flex items-center justify-between backdrop-blur-sm">
                    <div class="flex items-center gap-3">
                        <div class="bg-orange-500/20 p-2 rounded-lg text-orange-400">🔒</div>
                        <div class="text-left">
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Em Reserva</p>
                            <p class="text-[9px] text-gray-500 leading-tight">Garantia de serviços</p>
                        </div>
                    </div>
                    <span id="wallet-display-reserved" class="text-sm font-bold text-orange-400">R$ 0,00</span>
                </div>
            </div>

            <div id="wallet-history-container">
                <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3 pl-1">Extrato Recente</p>
                <div class="text-center py-8 opacity-40 border-2 border-dashed border-gray-200 rounded-xl">
                    <p class="text-xs text-gray-400">Nenhuma movimentação recente.</p>
                </div>
            </div>
        </div>
    `;

    // Atualiza os valores imediatamente
    atualizarCarteira(); 
}

// ============================================================================
// 2. ATUALIZADOR DE VALORES (LÓGICA)
// ============================================================================
export function atualizarCarteira() {
    const elAvailable = document.getElementById('wallet-display-available');
    const elReserved = document.getElementById('wallet-display-reserved');
    
    // Pega dados do perfil global carregado pelo auth.js
    const userProfile = window.userProfile; 
    
    if(userProfile) {
        const saldoLivre = parseFloat(userProfile.wallet_balance || 0);
        const saldoPreso = parseFloat(userProfile.wallet_reserved || 0);

        // Atualiza Disponível
        if(elAvailable) {
            elAvailable.innerText = `R$ ${saldoLivre.toFixed(2).replace('.', ',')}`;
            elAvailable.className = saldoLivre < 0 
                ? "text-4xl font-black mb-4 tracking-tight text-red-400" 
                : "text-4xl font-black mb-4 tracking-tight text-white";
        }

        // Atualiza Reservado
        if(elReserved) {
            elReserved.innerText = `R$ ${saldoPreso.toFixed(2).replace('.', ',')}`;
        }

        // Atualiza Header do Topo (Miniatura) se existir
        const headerSaldo = document.querySelector('#header-user-wallet span'); 
        if(headerSaldo) headerSaldo.innerText = `R$ ${saldoLivre.toFixed(0)}`;
        
        // Atualiza Header do Prestador
        const providerHeader = document.querySelector('#provider-header-name span span');
        if(providerHeader) providerHeader.innerText = `R$ ${saldoLivre.toFixed(2)}`;
    }
}

// Atualiza a cada 3 segundos para manter sincronia
setInterval(atualizarCarteira, 3000);

// ============================================================================
// 3. FUNÇÕES DE CUSTÓDIA (NOVO FLUXO)
// ============================================================================

// A: Reservar Saldo
export async function reservarSaldo(uid, valor) {
    const userRef = doc(db, "usuarios", uid);
    await runTransaction(db, async (t) => {
        const docSnap = await t.get(userRef);
        if (!docSnap.exists()) throw "Usuário não encontrado";
        
        const atualLivre = parseFloat(docSnap.data().wallet_balance || 0);
        const atualPreso = parseFloat(docSnap.data().wallet_reserved || 0);

        if (atualLivre < valor) {
            throw new Error("Saldo insuficiente para reserva.");
        }

        t.update(userRef, {
            wallet_balance: atualLivre - valor,
            wallet_reserved: atualPreso + valor
        });
    });
    // Feedback Local
    if(window.userProfile) {
        window.userProfile.wallet_balance -= valor;
        window.userProfile.wallet_reserved = (window.userProfile.wallet_reserved || 0) + valor;
        atualizarCarteira();
    }
}

// B: Consumir Reserva (Zerar a reserva do cliente ao pagar o prestador)
export async function consumirReservaCliente(uid, valor) {
    const userRef = doc(db, "usuarios", uid);
    await runTransaction(db, async (t) => {
        const docSnap = await t.get(userRef);
        const atualPreso = parseFloat(docSnap.data().wallet_reserved || 0);
        const novoPreso = atualPreso - valor < 0 ? 0 : atualPreso - valor;

        t.update(userRef, { wallet_reserved: novoPreso });
    });
    // Feedback Local
    if(window.userProfile) {
        window.userProfile.wallet_reserved -= valor;
        atualizarCarteira();
    }
}

// C: Estornar Saldo (Devolver para o Disponível)
export async function estornarSaldo(uid, valor) {
    const userRef = doc(db, "usuarios", uid);
    await runTransaction(db, async (t) => {
        const docSnap = await t.get(userRef);
        const atualLivre = parseFloat(docSnap.data().wallet_balance || 0);
        const atualPreso = parseFloat(docSnap.data().wallet_reserved || 0);
        const novoPreso = atualPreso - valor < 0 ? 0 : atualPreso - valor;

        t.update(userRef, {
            wallet_balance: atualLivre + valor,
            wallet_reserved: novoPreso
        });
    });
    // Feedback Local
    if(window.userProfile) {
        window.userProfile.wallet_balance += valor;
        window.userProfile.wallet_reserved -= valor;
        atualizarCarteira();
    }
}

// ============================================================================
// 4. SISTEMA LEGADO E EXPORTAÇÕES
// ============================================================================
export function podeTrabalhar() {
    const userProfile = window.userProfile;
    if (!userProfile) return false;
    const saldo = parseFloat(userProfile.wallet_balance || 0);
    if (saldo <= LIMITE_DIVIDA) {
        alert(`⛔ LIMITE DE CRÉDITO ATINGIDO!\nRecarregue para continuar.`);
        return false;
    }
    return true;
}

export async function processarCobrancaTaxa(orderId, valorServico) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const valorTaxa = valorServico * TAXA_PLATAFORMA;
    
    const userRef = doc(db, "usuarios", uid);
    await runTransaction(db, async (t) => {
        const docSnap = await t.get(userRef);
        const novo = (docSnap.data().wallet_balance || 0) - valorTaxa;
        t.update(userRef, { wallet_balance: novo });
    });
}

// EXPORTAÇÃO GLOBAL
window.carregarCarteira = carregarCarteira;
window.atualizarCarteira = atualizarCarteira;
window.podeTrabalhar = podeTrabalhar;
window.processarCobrancaTaxa = processarCobrancaTaxa;
window.reservarSaldo = reservarSaldo;
window.estornarSaldo = estornarSaldo;
window.consumirReservaCliente = consumirReservaCliente;

console.log("✅ Wallet V2.0 Carregado e Conectado.");
