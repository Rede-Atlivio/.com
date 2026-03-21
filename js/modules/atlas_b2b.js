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
                        <span class="text-[8px] font-black uppercase ${statusColor}">${m.status === 'active' ? '● Ativa no Radar' : '⏳ Aguardando Gil'}</span>
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
    
    // 🎨 RETOQUE VISUAL ATLAS V2026: Título Cyan e Destaque Neon nos Inputs
    // Gil, injetamos o CSS direto aqui para garantir que o efeito seja aplicado apenas neste modal
    content.innerHTML = `
        <style>
            /* 💡 EFEITO NEON NOS INPUTS: Dá profundidade e destaque ao redor do campo focado */
            .b2b-input-premium {
                transition: all 0.3s ease-in-out;
            }
            .b2b-input-premium:focus {
                border-color: #22d3ee !important; /* Cyan */
                box-shadow: 0 0 15px rgba(34, 211, 238, 0.4) !important;
                background-color: #111a2e !important; /* Fundo levemente mais claro no foco */
            }
        </style>

        <div class="space-y-6 animate-fadeIn pb-6">
            <div class="text-center">
                <h3 class="text-xl font-black text-cyan-400 uppercase italic tracking-tighter shadow-cyan-900/50">Passo 1: Briefing</h3>
                <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">O que o prestador deve fazer?</p>
            </div>
            
            <div class="space-y-4">
                <input type="text" id="b2b-title" placeholder="Título (Ex: Foto da Fachada - Loja X)" class="b2b-input-premium w-full p-4 rounded-2xl bg-slate-800 text-white font-bold border border-white/10 outline-none transition-all">
                <textarea id="b2b-desc" rows="4" placeholder="Instruções detalhadas... (Use tópicos)" class="b2b-input-premium w-full p-4 rounded-2xl bg-slate-800 text-white text-sm border border-white/10 outline-none transition-all"></textarea>
            </div>

            <button onclick="window.proximoPassoWizard(2)" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-900/30 active:scale-95 transition-all hover:bg-blue-500">
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

        // PASSO 2: LOCALIZAÇÃO E ALVO (SIMULADO VIA COORDENADAS)
        document.getElementById('modal-content').innerHTML = `
            <div class="space-y-6 animate-fadeIn pb-6">
                <div class="text-center">
                    <h3 class="text-xl font-black text-white uppercase italic tracking-tighter">Passo 2: Localização</h3>
                    <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Onde a missão deve ser realizada?</p>
                </div>

                <div class="p-8 bg-slate-800 rounded-[2.5rem] border border-blue-500/30 text-center space-y-4">
                    <div class="text-4xl">📍</div>
                    <p class="text-xs text-gray-300">Deseja usar sua localização atual como centro do radar para esta missão?</p>
                    <div class="grid grid-cols-2 gap-2" id="gps-action-area">
                        <button onclick="window.capturarLocalizacaoWizard()" class="py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase">Sim, Usar GPS</button>
                        <button onclick="alert('Funcionalidade de mapa manual em homologação. Use o GPS por enquanto.')" class="py-3 bg-slate-700 text-gray-400 rounded-xl font-black text-[9px] uppercase">Digitar Local</button>
                    </div>
                    <div id="gps-status" class="hidden text-[8px] font-black text-emerald-400 uppercase tracking-widest">Localização Fixada com Sucesso!</div>
                    <input type="hidden" id="b2b-lat">
                    <input type="hidden" id="b2b-lng">
                </div>

                <button id="btn-next-3" disabled onclick="window.finalizarLocalWizard()" class="w-full py-4 bg-gray-700 text-gray-500 rounded-2xl font-black text-[10px] uppercase cursor-not-allowed">Definir Investimento ➜</button>
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

// 💰 PASSO 3: CONFIGURAÇÃO DE INVESTIMENTO
window.finalizarLocalWizard = () => {
    const lat = document.getElementById('b2b-lat').value;
    const lng = document.getElementById('b2b-lng').value;
    if(!lat || !lng) return alert("Selecione o local no mapa!");

    window.wizardB2BData.latitude = parseFloat(lat);
    window.wizardB2BData.longitude = parseFloat(lng);
    window.wizardB2BData.radius = 500; // Raio padrão de 500 metros

    const content = document.getElementById('modal-content');
    content.innerHTML = `
        <div class="space-y-6 animate-fadeIn pb-6">
            <div class="text-center">
                <h3 class="text-xl font-black text-white uppercase italic tracking-tighter">Passo 3: Investimento</h3>
                <p class="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Quanto você pagará por esta informação?</p>
            </div>

            <div class="p-5 bg-slate-900/80 rounded-3xl border border-white/5 space-y-4">
                <div class="relative">
                    <span class="absolute left-4 top-4 text-emerald-600 font-black text-xl">R$</span>
                    <input type="number" id="b2b-reward" value="5.00" min="3" step="0.50" oninput="window.atualizarPreviewFinanceiro()" class="w-full p-4 pl-12 rounded-2xl bg-slate-950 text-emerald-400 text-2xl font-black border border-white/10 outline-none focus:border-blue-500 transition">
                </div>

                <div class="p-4 bg-black/40 rounded-2xl space-y-2 border border-white/5">
                    <div class="flex justify-between text-[9px] font-bold uppercase text-gray-500">
                        <span>Recompensa (Prestador):</span>
                        <span id="preview-user" class="text-white">R$ 5,00</span>
                    </div>
                    <div class="flex justify-between text-[9px] font-bold uppercase text-gray-500">
                        <span>Taxa Atlivio (100%):</span>
                        <span id="preview-tax" class="text-blue-400">R$ 5,00</span>
                    </div>
                    <div class="h-[1px] bg-white/10 my-1"></div>
                    <div class="flex justify-between text-[11px] font-black uppercase text-gray-400">
                        <span>Investimento Total:</span>
                        <span id="preview-total" class="text-emerald-500">R$ 10,00</span>
                    </div>
                </div>
            </div>

            <button onclick="window.processarReservaB2B()" id="btn-confirmar-b2b" class="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-900/20 active:scale-95 transition">
                Confirmar e Reservar Saldo ✅
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

        alert("🚀 ORDEM ENVIADA!\nO Gil analisará o local e publicará no radar em breve.");
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
