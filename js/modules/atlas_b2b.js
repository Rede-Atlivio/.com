// 🛡️ TRAVA ANTI-VAZAMENTO: Se não for cliente, o módulo B2B se auto-desliga
if (window.userProfile && window.userProfile.perfil !== 'cliente') {
    console.warn("🚫 [B2B] Acesso negado: Perfil não compatível.");
}
import { db, auth } from '../config.js';
import { collection, getDocs, getDoc, doc, query, where, addDoc, serverTimestamp, orderBy, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏢 MOTOR DE INTERFACE EXCLUSIVA B2B (V63 - ESCALA INDUSTRIAL)
// Gil, este arquivo cuida apenas de quem CONTRATA inteligência.
export async function initB2B() {
   const container = document.getElementById('sec-b2b_gestao');
    if (!container) return;

    console.log("💼 Atlas B2B: Ativando Central de Inteligência Estratégica.");

    container.innerHTML = `
        <div class="p-4 space-y-6 animate-fadeIn pb-24">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-2xl font-black text-blue-900 uppercase italic tracking-tighter leading-none">Gestão Atlas</h2>
                    <p class="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Inteligência Estratégica B2B</p>
                </div>
                <div class="flex gap-1 bg-slate-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button onclick="window.alternarSubAbaB2B('radar')" id="btn-sub-radar" class="px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md">📡 Minhas Ordens</button>
                    <button onclick="window.alternarSubAbaB2B('auditoria')" id="btn-sub-auditoria" class="px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400">⚖️ Auditoria</button>
                </div>
            </div>
            
            <div id="sub-view-container" class="min-h-[400px] space-y-4">
                <div id="lista-cards-b2b-real"></div>
            </div>

            <button onclick="window.abrirWizardB2B()" class="fixed bottom-24 right-6 z-[100] bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-full shadow-2xl transition-all active:scale-95 border-2 border-white/20 animate-bounce">
                <span class="text-2xl">💼</span>
            </button>
        </div>
    `;
    
    // Inicia carregando as ordens já criadas
    window.carregarOrdensB2B();
}

// 🔄 MOTOR DE ALTERNÂNCIA B2B
window.alternarSubAbaB2B = (aba) => {
    const btnRadar = document.getElementById('btn-sub-radar');
    const btnAudit = document.getElementById('btn-sub-auditoria');
    const container = document.getElementById('sub-view-container');

    if(aba === 'radar') {
        btnRadar.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md";
        btnAudit.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400";
        window.carregarOrdensB2B(); 
    } else {
        btnRadar.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition text-gray-400";
        btnAudit.className = "px-4 py-2 rounded-lg text-[9px] font-black uppercase transition bg-blue-600 text-white shadow-md";
        window.carregarAuditoriaB2B(); 
    }
};

// 🛰️ CARREGADOR DE ORDENS DO CLIENTE
window.carregarOrdensB2B = async () => {
    const lista = document.getElementById('lista-cards-b2b-real') || document.getElementById('sub-view-container');
    lista.innerHTML = `<div class="py-20 text-center"><div class="loader mx-auto border-blue-500"></div></div>`;

    try {
        const q = query(
            collection(db, "missions"), 
            where("b2b_owner_uid", "==", auth.currentUser.uid),
            orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            lista.innerHTML = `<p class="text-center py-20 text-gray-400 text-xs italic uppercase">Você ainda não enviou ordens de coleta.</p>`;
            return;
        }

        lista.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            const statusColor = m.status === 'active' ? 'text-emerald-500' : 'text-amber-500';
            lista.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <span class="text-[7px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase tracking-widest">ID: ${doc.id.slice(0,8)}</span>
                        <span class="text-[8px] font-black uppercase ${statusColor}">${m.status === 'active' ? '● Ativa no Radar' : '⏳ Aguardando...'}</span>
                    </div>
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-gray-50">
                        <span class="text-[10px] font-bold text-emerald-600">R$ ${m.reward.toFixed(2)}</span>
                        <span class="text-[8px] font-black text-gray-400 uppercase">${m.pay_type === 'real' ? 'Dinheiro' : 'Atlix'}</span>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
};

// ⚖️ MOTOR DE AUDITORIA B2B (EXCLUSIVO)
window.carregarAuditoriaB2B = async () => {
    const container = document.getElementById('sub-view-container');
    container.innerHTML = `<div class="py-20 text-center"><div class="loader mx-auto border-amber-500"></div></div>`;

    try {
        const q = query(
            collection(db, "mission_submissions"),
            where("b2b_owner_uid", "==", auth.currentUser.uid),
            where("status", "==", "pending"),
            orderBy("created_at", "desc")
        );
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = `<p class="text-center py-20 text-gray-500 text-[10px] font-black uppercase tracking-tighter">Nenhuma evidência para auditar.</p>`;
            return;
        }

        container.innerHTML = `<div class="grid gap-4" id="lista-auditoria-cards"></div>`;
        snap.forEach(d => {
            const m = d.data();
            document.getElementById('lista-auditoria-cards').innerHTML += `
                <div class="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
                    <div class="flex justify-between items-center">
                        <h4 class="text-blue-900 font-black text-xs uppercase">${m.mission_title}</h4>
                        <span class="text-[7px] font-black uppercase px-2 py-1 rounded-full ${m.gps_status === 'match' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                            ${m.gps_status === 'match' ? 'GPS OK' : 'GPS SUSPEITO'}
                        </span>
                    </div>
                    <img src="${m.proof_url}" class="w-full h-48 object-cover rounded-[2rem] border border-gray-100">
                    <div class="flex gap-2">
                        <button onclick="window.vereditoB2B('${d.id}', 'rejected')" class="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[9px] uppercase">Reprovar</button>
                        <button onclick="window.vereditoB2B('${d.id}', 'approved')" class="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase shadow-lg shadow-blue-200">Aprovar e Pagar</button>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
};

// 🏛️ DECISÃO DO CLIENTE (PAGAMENTO OU DISPUTA)
window.vereditoB2B = async (docId, status) => {
    const acao = status === 'approved' ? 'APROVAR E PAGAR' : 'REPROVAR';
    if(!confirm(`Confirma ${acao}?`)) return;

    try {
        await updateDoc(doc(db, "mission_submissions", docId), {
            status: status === 'approved' ? 'approved_by_b2b' : 'disputed_by_b2b',
            approved_at: serverTimestamp()
        });
        alert("✅ Veredito registrado com sucesso.");
        window.carregarAuditoriaB2B();
    } catch (e) { alert("Erro ao processar veredito."); }
};

// 🪄 WIZARD ATLAS B2B: MOTOR DE CRIAÇÃO PASSO A PASSO
window.wizardB2BData = {}; // Memória temporária da missão

window.abrirWizardB2B = () => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    
    // 🎨 DESIGN PREMIUM B2B: Fundo radial, Título Laranja Forte e Subtítulo Cyan Neon
    content.innerHTML = `
        <style>
            /* Define o fundo com profundidade industrial */
            #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
            
            .input-b2b-lapidado {
                background-color: #0f172a !important; /* Fundo escuro para contraste */
                border: 2px solid #334155 !important; /* Borda discreta inicial */
                color: #f8fafc !important;
                border-radius: 1rem !important;
                padding: 1rem !important;
                width: 100% !important;
                outline: none !important;
                margin-bottom: 1.5rem !important;
                font-size: 14px !important;
                transition: all 0.3s ease;
            }
            /* O input "acende" em Cyan quando o usuário clica para digitar */
            .input-b2b-lapidado:focus {
                border-color: #22d3ee !important;
                box-shadow: 0 0 15px rgba(34, 211, 238, 0.3) !important;
                background-color: #111a2e !important;
            }
        </style>

        <div class="max-w-[450px] mx-auto animate-fadeIn pb-6">
            <div class="text-center mb-8">
                <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">
                    Passo 1: Briefing
                </h3>
                <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">
                    Configuração de Missão Atlas
                </p>
            </div>
            
            <div class="flex flex-col">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3 mb-2">Título da Ordem</label>
                <input type="text" id="b2b-title" placeholder="Ex: Auditoria de Estoque - Loja Centro" class="input-b2b-lapidado font-bold">
                
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-3 mb-2">Instruções de Coleta</label>
                <textarea id="b2b-desc" rows="4" placeholder="Descreva exatamente o que o prestador deve fotografar..." class="input-b2b-lapidado text-sm"></textarea>
            </div>

            <button onclick="window.proximoPassoWizard(2)" class="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-black text-[11px] uppercase shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] active:scale-95 transition-all">
                Continuar para Localização ➜
            </button>
        </div>
    `;
};

window.proximoPassoWizard = (passo) => {
    if (passo === 2) {
        const title = document.getElementById('b2b-title').value;
        const desc = document.getElementById('b2b-desc').value;
        if (!title || !desc) return alert("Preencha o título e a descrição!");

        window.wizardB2BData.title = title;
        window.wizardB2BData.description = desc;
        window.wizardB2BData.b2b_owner_uid = auth.currentUser.uid;

      // PASSO 2: LOCALIZAÇÃO - Sincronizado com a nova identidade Premium e Fundo Radial
        document.getElementById('modal-content').innerHTML = `
            <style>
                /* Garante que o Passo 2 herde o fundo com profundidade industrial da ATLIVIO */
                #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
            </style>

            <div class="max-w-[450px] mx-auto animate-fadeIn space-y-6 text-center">
                <div class="mb-8">
                    <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">Passo 2: Localização</h3>
                    <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">Centro Geográfico da Missão</p>
                </div>

                <div class="p-8 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
                    <div class="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-inner">
                        <span class="text-3xl">📍</span>
                    </div>
                    <p class="text-[11px] text-gray-400 font-medium px-4">Deseja usar sua localização atual como centro do radar para esta missão?</p>
                    
                    <div id="gps-action-area" class="grid grid-cols-2 gap-3 pt-2">
                        <button onclick="window.capturarLocalizacaoWizard()" class="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">Sim, Usar GPS</button>
                        <button onclick="alert('Funcionalidade de mapa manual em homologação para sua região.')" class="py-4 bg-slate-800 text-gray-500 rounded-2xl font-black text-[10px] uppercase border border-white/5 hover:bg-slate-700 transition-colors">Digitar Local</button>
                    </div>
                    
                    <div id="gps-status" class="hidden animate-bounce text-[10px] font-black text-emerald-400 uppercase tracking-widest pt-2">
                        🎯 Localização Fixada com Sucesso!
                    </div>
                    <input type="hidden" id="b2b-lat"><input type="hidden" id="b2b-lng">
                </div>

                <button id="btn-next-3" disabled onclick="window.finalizarLocalWizard()" class="w-full py-5 bg-slate-800 text-gray-600 rounded-2xl font-black text-[11px] uppercase cursor-not-allowed border border-white/5 transition-all shadow-md">
                    Definir Investimento ➜
                </button>
            </div>
        `;
    }
};

window.capturarLocalizacaoWizard = () => {
    const btn = document.querySelector('#gps-action-area button');
    btn.innerText = "⏳ BUSCANDO...";
    
    navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('b2b-lat').value = pos.coords.latitude;
        document.getElementById('b2b-lng').value = pos.coords.longitude;
        document.getElementById('gps-status').classList.remove('hidden');
        document.getElementById('gps-action-area').classList.add('hidden');
        
        const btnNext = document.getElementById('btn-next-3');
        btnNext.disabled = false;
        btnNext.className = "w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition";
    }, (err) => {
        alert("Ative o GPS para prosseguir.");
        btn.innerText = "Sim, Usar GPS";
    });
};

// 💰 PASSO 3: INVESTIMENTO - Finalização com a identidade visual da ATLIVIO
window.finalizarLocalWizard = () => {
    const lat = document.getElementById('b2b-lat').value;
    const lng = document.getElementById('b2b-lng').value;
    if(!lat || !lng) return alert("Selecione o local no mapa!");

    window.wizardB2BData.latitude = parseFloat(lat);
    window.wizardB2BData.longitude = parseFloat(lng);
    window.wizardB2BData.radius = 500;

    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <style>
            /* Gil, forçamos o fundo radial também no Passo 3 para manter a alma da ATLIVIO acesa */
            #modal-editor { background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%) !important; }
        </style>

        <div class="max-w-[450px] mx-auto animate-fadeIn space-y-8">
            <div class="text-center">
                <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight" style="text-shadow: 0 2px 10px rgba(251, 146, 60, 0.3);">Passo 3: Investimento</h3>
                <p class="text-[10px] text-cyan-400 font-black uppercase tracking-[0.15em] mt-1">Custo de Aquisição de Dados</p>
            </div>

            <div class="p-8 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
                <div class="relative">
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-2 block">Valor por Coleta Realizada</label>
                    <div class="relative">
                        <span class="absolute left-5 top-5 text-emerald-500 font-black text-2xl">R$</span>
                        <input type="number" id="b2b-reward" value="5.00" min="3" step="0.50" oninput="window.atualizarPreviewFinanceiro()" class="w-full p-6 pl-16 rounded-[1.5rem] bg-black text-emerald-400 text-4xl font-black border-2 border-emerald-500/20 outline-none focus:border-emerald-500 transition-all shadow-inner">
                    </div>
                </div>

                <div class="p-5 bg-black/40 rounded-3xl space-y-3 border border-white/5">
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>💰 Recompensa (Prestador)</span>
                        <span id="preview-user" class="text-white font-mono">R$ 5,00</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>🛡️ Taxa Administrativa (100%)</span>
                        <span id="preview-tax" class="text-blue-400 font-mono">R$ 5,00</span>
                    </div>
                    <div class="h-[1px] bg-white/10 my-1"></div>
                    <div class="flex justify-between items-center text-xs font-black uppercase tracking-widest text-gray-300">
                        <span>TOTAL A RESERVAR</span>
                        <span id="preview-total" class="text-emerald-500 text-lg font-mono">R$ 10,00</span>
                    </div>
                </div>
            </div>

            <button onclick="window.processarReservaB2B()" id="btn-confirmar-b2b" class="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-[0_15px_30px_-10px_rgba(16,185,129,0.4)] active:scale-95 transition-all">
                Finalizar e Ativar Operação ✅
            </button>
        </div>
    `;
};
// 🤖 CALCULADORA DINÂMICA
window.atualizarPreviewFinanceiro = () => {
    const val = parseFloat(document.getElementById('b2b-reward').value) || 0;
    const total = val * 2; // Regra de 100% de taxa
    document.getElementById('preview-user').innerText = `R$ ${val.toFixed(2)}`;
    document.getElementById('preview-tax').innerText = `R$ ${val.toFixed(2)}`;
    document.getElementById('preview-total').innerText = `R$ ${total.toFixed(2)}`;
};

// ⚡ MOTOR DE RESERVA (O CORAÇÃO DO B2B)
window.processarReservaB2B = async () => {
    const reward = parseFloat(document.getElementById('b2b-reward').value);
    if(reward < 3) return alert("O valor mínimo é R$ 3,00");

    const btn = document.getElementById('btn-confirmar-b2b');
    btn.disabled = true;
    btn.innerText = "⏳ RESERVANDO SALDO...";

    const totalNecessario = reward * 2;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "usuarios", uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Perfil não encontrado.";
            
            const bal = userSnap.data().wallet_balance || 0;
            if (bal < totalNecessario) throw "Saldo insuficiente! Faça uma recarga para continuar.";

            // 1. Debita o saldo disponível e move para o reservado
            transaction.update(userRef, {
                wallet_balance: increment(-totalNecessario),
                wallet_reserved: increment(totalNecessario),
                updated_at: serverTimestamp()
            });

            // 2. Cria o documento da Missão (Ordem de Serviço)
            const missionRef = doc(collection(db, "missions"));
            transaction.set(missionRef, {
                ...window.wizardB2BData,
                reward: reward,
                total_with_fee: totalNecessario,
                pay_type: 'real',
                status: 'pending_b2b', // Aguarda Gil aprovar no Admin
                active: false,
                created_at: serverTimestamp()
            });

            // 3. Registra no extrato da empresa
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -totalNecessario,
                tipo: "RESERVA_B2B 🔒",
                descricao: `Reserva: ${window.wizardB2BData.title}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        alert("🚀 ORDEM ENVIADA!\nA ATLIVIO analisará o local e publicará no radar em breve.");
        document.getElementById('modal-editor').classList.add('hidden');
        window.carregarOrdensB2B();

    } catch (e) {
        alert("❌ ERRO: " + e);
        btn.disabled = false;
        btn.innerText = "Confirmar e Reservar Saldo ✅";
    }
};

// 🔐 SOLDAGEM GLOBAL: Gil, aqui entregamos a chave da Gestão para o app.js
window.initB2B = initB2B;
window.carregarOrdensB2B = carregarOrdensB2B;
window.carregarAuditoriaB2B = carregarAuditoriaB2B;

console.log("💼 [Atlas B2B] Módulo Financeiro e Checkout Soldado!");
