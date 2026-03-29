import { db, auth } from '../config.js';
import { collection, getDocs, getDoc, doc, query, where, addDoc, serverTimestamp, orderBy, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏢 MOTOR DE INTERFACE EXCLUSIVA B2B - ATLIVIO V2026
// Este motor gerencia a criação e auditoria de ordens estratégicas.
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
        // 🛰️ Busca otimizada: Procura missões onde o usuário é o dono (owner_id)
        const q = query(
            collection(db, "missions"), 
            where("owner_id", "==", auth.currentUser.uid),
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
            // 🚥 LOGICA DE CORES ATLIVIO V2026
            let statusColor = 'text-amber-500';
            let statusTexto = '⏳ Aguardando...';
            let alertMsg = '';

            // Substituiremos a lógica de decisão por esta:
if (m.status === 'active') {
    statusColor = 'text-emerald-500';
    statusTexto = '● Ativa no Radar';
} else if (m.status === 'rejected') {
    statusColor = 'text-red-500';
    statusTexto = '❌ Ordem Rejeitada'; // <--- Isso resolve o seu print!
} else if (m.status === 'pending_b2b') {
    statusColor = 'text-amber-500';
    statusTexto = '⏳ Em Análise';
} else {
    statusColor = 'text-gray-400';
    statusTexto = 'Finalizada';
}

            lista.innerHTML += `
                <div class="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <span class="text-[7px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase tracking-widest">ID: ${doc.id.slice(0,8)}</span>
                        <span class="text-[8px] font-black uppercase ${statusColor}">${statusTexto}</span>
                    </div>
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    ${alertMsg}
                    <h4 class="text-blue-900 font-black uppercase text-xs">${m.title}</h4>
                    <p class="text-[9px] text-gray-400 leading-tight">${m.description}</p>
                    <div class="flex justify-between items-center pt-2 border-t border-gray-50 gap-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-emerald-600">R$ ${m.reward.toFixed(2)}</span>
                            <span class="text-[7px] font-black text-gray-400 uppercase">${m.pay_type === 'real' ? 'Dinheiro' : 'Atlix'}</span>
                        </div>
                       ${(m.status === 'active' || m.status === 'pending_b2b') ? `
                            <button onclick="window.encerrarMissaoB2BComEstorno('${doc.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all border border-red-100">
                                ⛔ Encerrar e Reembolsar
                            </button>
                        ` : `
                            <span class="text-[8px] font-black text-gray-300 uppercase italic">Fluxo Finalizado</span>
                        `}
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
     // ⚖️ Busca unificada: Filtramos pelo UID do dono B2B para garantir que ele só veja as provas das próprias missões
        const q = query(
            collection(db, "mission_submissions"),
            where("b2b_owner_uid", "==", auth.currentUser.uid), // ──▶ Usando b2b_owner_uid para match com a liquidação
            where("status", "==", "pending"), // ──▶ Somente o que ainda não foi auditado
            orderBy("created_at", "desc") // ──▶ Exibe as submissões mais recentes primeiro
        );
        const snap = await getDocs(q);

        // 🛡️ Trava de Segurança Atlivio: Evita erro se a coleção sumir ou estiver vazia
        if (!snap || snap.empty) {
            container.innerHTML = `
                <div class="py-20 text-center space-y-3">
                    <div class="text-4xl opacity-20">📡</div>
                    <p class="text-gray-400 text-[10px] font-black uppercase tracking-widest">Radar de Auditoria Limpo</p>
                    <p class="text-gray-500 text-[8px] italic">Nenhuma prova pendente para suas missões no momento.</p>
                </div>`;
            return;
        }

        container.innerHTML = `<div class="grid gap-4" id="lista-auditoria-cards"></div>`;
       snap.forEach(d => {
            const m = d.data();
            if (m.b2b_owner_uid !== auth.currentUser.uid) return;

            // 📝 Constrói o HTML das respostas do Checklist (se existirem)
            let checklistHtml = '';
            if (m.responses && Object.keys(m.responses).length > 0) {
                checklistHtml = `<div class="bg-slate-50 p-3 rounded-2xl space-y-1.5 border border-gray-100">
                    <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">📋 Respostas do Checklist</p>`;
                for (const [pergunta, resposta] of Object.entries(m.responses)) {
                    const isSim = resposta === 'Sim';
                    checklistHtml += `
                        <div class="flex justify-between items-center text-[10px]">
                            <span class="text-gray-600 font-medium">${pergunta}</span>
                            <span class="font-black ${isSim ? 'text-emerald-600' : 'text-red-500'}">${resposta}</span>
                        </div>`;
                }
                checklistHtml += `</div>`;
            }

            // 📍 Lógica de precisão de distância (se disponível)
            const precisaoGps = m.distance_meters !== undefined ? 
                `<span class="text-[7px] font-bold text-blue-500">📍 ${Math.round(m.distance_meters)}m do local</span>` : '';

            document.getElementById('lista-auditoria-cards').innerHTML += `
                <div class="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4 animate-fadeIn">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="text-blue-900 font-black text-xs uppercase leading-none">${m.mission_title}</h4>
                            ${precisaoGps}
                        </div>
                        <span class="text-[7px] font-black uppercase px-2 py-1 rounded-full ${m.gps_status === 'match' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                            ${m.gps_status === 'match' ? '● GPS OK' : '● LOCAL SUSPEITO'}
                        </span>
                    </div>

                    <div class="relative group cursor-pointer" onclick="window.abrirProvaNovaAba('${m.proof_url}')">
                        <img src="${m.proof_url}" class="w-full h-48 object-cover rounded-[2rem] border border-gray-100 shadow-inner">
                        <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex items-center justify-center">
                            <span class="bg-white/90 text-black text-[9px] font-black px-3 py-1 rounded-full uppercase">🔍 Ampliar Foto</span>
                        </div>
                    </div>

                    ${checklistHtml}

                    <div class="flex gap-2">
                        <button onclick="window.vereditoB2B('${d.id}', 'rejected')" class="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-[9px] uppercase transition-colors hover:bg-red-100">Reprovar</button>
                        <button onclick="window.vereditoB2B('${d.id}', 'approved')" class="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-black text-[9px] uppercase shadow-lg shadow-blue-200 transition-transform active:scale-95">Aprovar e Pagar</button>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
};

// 🏛️ DECISÃO DO CLIENTE (PAGAMENTO OU DISPUTA)
/**
 * ⚖️ VEREDITO DO CLIENTE B2B (COM CHAVE DE AUTONOMIA)
 * Decide se o pagamento sai na hora ou se cai na fila do Admin.
 */
window.vereditoB2B = async (docId, status) => {
    const acao = status === 'approved' ? 'APROVAR' : 'REPROVAR';
    if(!confirm(`Confirma ${acao}?`)) return;

    try {
        const { getDoc, doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        // 🧠 Consulta a Regra Soberana do Admin (Banco Central)
        const ecoSnap = await getDoc(doc(db, "settings", "global_economy"));
        const podePagarDireto = ecoSnap.exists() ? ecoSnap.data().aprovacao_automatica_b2b : false;

        if (status === 'approved') {
            if (podePagarDireto) {
                // 🚀 MODO AUTÔNOMO: Paga o usuário agora e encerra o processo
                await window.liquidarPagamentoB2B(docId);
                alert("✅ APROVADO: O saldo foi transferido ao usuário e sua taxa foi liquidada.");
           } else {
                // ⏳ MODO MANUAL: Verificação de segurança adicional ativada no Banco Central
                await updateDoc(doc(db, "mission_submissions", docId), {
                    status: 'approved_by_b2b',
                    status_history: 'Aguardando validação do sistema central',
                    reviewed_at: serverTimestamp()
                });
                alert("✔️ APROVAÇÃO REGISTRADA: O pagamento passará pela validação final do sistema Atlivio para ser liberado.");
            }
        } else {
            // ⚖️ DISPUTA: Se o B2B reprovar, sempre cai na sua mão para evitar golpe da empresa
            await updateDoc(doc(db, "mission_submissions", docId), {
                status: 'b2b_rejected',
                status_history: 'Aguardando auditoria de disputa',
                reviewed_at: serverTimestamp()
            });
            alert("⚖️ DISPUTA ABERTA: O Admin analisará a evidência para dar o veredito final.");
        }
        
        window.carregarAuditoriaB2B();
   } catch (e) { alert("Erro ao processar veredito."); }
};

// 💎 MOTOR DE LIQUIDAÇÃO ATLIVIO: Transfere o valor reservado para o executor
window.liquidarPagamentoB2B = async (submissionId) => {
    try {
       const subRef = doc(db, "mission_submissions", submissionId);
        const subSnap = await getDoc(subRef);
        const data = subSnap.data();

        // 🛰️ BUSCA DE VALOR BRUTO: Vamos na missão original buscar os R$ 8,50 (Evita lixo)
        const missionRef = doc(db, "missions", data.mission_id);
        const missionSnap = await getDoc(missionRef);
        const valorRealB2B = missionSnap.exists() ? Number(missionSnap.data().unit_total_with_fee) : Number(data.reward);

        if (!data.b2b_owner_uid || !data.reward) throw "Dados financeiros incompletos.";

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", data.user_id); // Executor da missão
            const b2bRef = doc(db, "usuarios", data.b2b_owner_uid); // Cliente que paga

          // 1. REGRA DO ABATE REAL: Remove definitivamente o valor da reserva do B2B
            // Gil, usamos o valorRealB2B (8.50) para limpar a reserva do cliente
            const valorParaAbater = Number(valorRealB2B);
            transaction.update(b2bRef, { 
                wallet_reserved: increment(-valorParaAbater),
                updated_at: serverTimestamp()
            });

            // 2. REGRA DO CRÉDITO COM ETIQUETA: O prestador recebe os 5.00
            // Gil, aqui batemos o martelo: atualizamos o saldo do usuário direto na transação
            // para evitar que o motor do wallet.js se confunda e jogue no acumulado de PIX.
            transaction.update(userRef, { 
                wallet_balance: increment(Number(data.reward)),
                updated_at: serverTimestamp()
            });
            
            // Registramos no log interno para o Robô Sentinela saber que é uma MISSÃO
            console.log("💳 Financeiro: R$ " + valorParaAbater + " abatidos da reserva B2B.");
            console.log("💰 Financeiro: R$ " + data.reward + " entregues ao prestador.");

          // 3. REGRA DA TAXA (MAESTRO V2026): Agora usando o valor real de R$ 8,50
            const valorBrutoB2B = Number(valorRealB2B); 
            const premioUsuario = Number(data.reward);
            const lucroRealValidado = Number((valorBrutoB2B - premioUsuario).toFixed(2));
            
            // 🛡️ TRAVA ANTI-LIXO: Só envia para STATS se o lucro for real e consistente
            if (lucroRealValidado > 0 && lucroRealValidado < valorBrutoB2B) {
                const statsRef = doc(db, "sys_finance", "stats");
                transaction.update(statsRef, { 
                    total_revenue: increment(lucroRealValidado),
                    ultima_atualizacao: serverTimestamp()
                });
                console.log(`✅ [COFRE] Taxa de R$ ${lucroRealValidado} capturada em STATS.`);
            } else {
                console.warn("⚠️ [COFRE] Lucro inconsistente (possível injeção de lixo). Gravação em STATS bloqueada.");
            }

            // 4. FINALIZAÇÃO: Encerra a submissão e carimba o lucro real liquidado
            transaction.update(subRef, { 
                status: 'paid_atlix', 
                paid_at: serverTimestamp(),
                taxa_atlivio_liquidada: (lucroRealValidado > 0 && lucroRealValidado < valorBrutoB2B) ? lucroRealValidado : 0 
            });
        });

        alert("✅ PAGAMENTO PROCESSADO: O saldo foi transferido com sucesso.");
    } catch (err) {
        console.error("Erro na liquidação:", err);
        alert("Erro ao processar transferência de valores.");
    }
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
            <div class="text-center mb-6">
                <h3 class="text-[28px] font-black text-orange-400 uppercase italic tracking-tighter leading-tight">Passo 1: Briefing</h3>
                <p class="text-[9px] text-cyan-400 font-black uppercase tracking-widest">Inteligência Estratégica</p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Título da Missão</label>
                    <input type="text" id="b2b-title" placeholder="Ex: Auditoria de Fachada" class="input-b2b-lapidado font-bold !mb-0">
                </div>

               <div class="grid grid-cols-3 gap-2">
                <div class="col-span-1">
                    <label class="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Categoria</label>
                    <select id="b2b-category" class="input-b2b-lapidado !mb-0">
                        <option value="physical">📍 No Local</option>
                        <option value="fast">⚡ Rápida</option>
                    </select>
                </div>
                <div class="col-span-1">
                    <label class="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Nível</label>
                    <select id="b2b-level" class="input-b2b-lapidado !mb-0">
                        <option value="1">Lvl 1</option>
                        <option value="2">Lvl 2</option>
                        <option value="3">Lvl 3</option>
                    </select>
                </div>
                <div class="col-span-1">
                    <label class="text-[9px] font-black text-cyan-400 uppercase ml-2 mb-1 block">Qtd Vagas</label>
                    <input type="number" id="b2b-slots-input" value="1" min="1" class="input-b2b-lapidado !mb-0 font-black text-center" placeholder="Ex: 10">
                </div>
            </div>

                <div>
                    <label class="text-[9px] font-black text-emerald-500 uppercase ml-2 mb-1 block">📋 Checklist (Perguntas separadas por vírgula)</label>
                    <input type="text" id="b2b-questions" placeholder="Ex: Loja aberta?, Tem fila?, Fachada limpa?" class="input-b2b-lapidado !mb-0 text-emerald-400">
                </div>

                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">URL Foto de Exemplo (Opcional)</label>
                    <input type="text" id="b2b-example-image" placeholder="Link da imagem de instrução" class="input-b2b-lapidado !mb-0 text-blue-400">
                </div>

                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Instruções de Coleta</label>
                    <textarea id="b2b-desc" rows="3" placeholder="Descreva o que deve ser fotografado..." class="input-b2b-lapidado !mb-0 text-xs"></textarea>
                </div>
            </div>

            <button onclick="window.proximoPassoWizard(2)" class="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all">
                Continuar para Localização ➜
            </button>
        </div>
    `;
};

window.proximoPassoWizard = (passo) => {
    if (passo === 2) {
        const title = document.getElementById('b2b-title').value;
        const desc = document.getElementById('b2b-desc').value;
        const category = document.getElementById('b2b-category').value;
        const level = parseInt(document.getElementById('b2b-level').value);
        const questionsRaw = document.getElementById('b2b-questions').value;
        const exampleImg = document.getElementById('b2b-example-image').value;
        const slotsTotais = parseInt(document.getElementById('b2b-slots-input').value) || 1;

        if (!title || !desc) return alert("Preencha o título e as instruções!");

        // Processa Checklist
        const questionsArray = questionsRaw ? questionsRaw.split(',').map(q => q.trim()).filter(q => q !== "") : [];

        window.wizardB2BData = {
            ...window.wizardB2BData,
            title: title,
            description: desc,
            category: category,
            level: level,
            questions: questionsArray,
            example_image: exampleImg || null,
            owner_id: auth.currentUser.uid
        };

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

               <div class="p-5 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
                    <div class="flex justify-between items-center px-2">
                        <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">📍 Ponto de Captura</p>
                        <button onclick="window.obterLocalizacaoAutomatica()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition flex items-center gap-1 shadow-lg">
                            🎯 GPS ATUAL
                        </button>
                    </div>

                    <div class="relative group">
                        <input type="text" id="mis-address-search" placeholder="Busque por endereço, rua ou cidade..." class="w-full p-3 pl-10 rounded-xl bg-black text-white text-xs border border-white/10 focus:border-cyan-500 outline-none transition-all">
                        <span class="absolute left-3 top-3 text-gray-500">🔍</span>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-1">Latitude</label>
                            <input id="b2b-lat" readonly class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5" placeholder="0.0000">
                        </div>
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-gray-500 font-black uppercase ml-1">Longitude</label>
                            <input id="b2b-lng" readonly class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-white/5" placeholder="0.0000">
                        </div>
                        <div class="space-y-1 text-left">
                            <label class="text-[8px] text-cyan-400 font-black uppercase ml-1">Raio (Metros)</label>
                            <input id="b2b-radius" type="number" value="500" oninput="window.validarRaioB2B(this)" class="w-full p-2 rounded-lg bg-slate-950 text-white text-[10px] font-mono border border-white/5 focus:border-cyan-500 outline-none" placeholder="Ex: 500">
                        </div>
                    </div>
                    <p class="text-[8px] text-gray-500 italic px-2">* Missão Online? Deixe Latitude/Longitude vazios e Raio em 0.</p>
                </div>

                <button id="btn-next-3" disabled onclick="window.finalizarLocalWizard()" class="w-full py-5 bg-slate-800 text-gray-600 rounded-2xl font-black text-[11px] uppercase cursor-not-allowed border border-white/5 transition-all shadow-md">
                    Definir Investimento ➜
                </button>
            </div>
        `;
        // 🛰️ DESPERTADOR GOOGLE: Ativa a busca de endereços 200ms após o HTML carregar
       // 🛰️ DESPERTADOR GOOGLE: Ativa a busca de endereços 200ms após o HTML carregar
        setTimeout(() => { if(window.iniciarAutocompleteB2B) window.iniciarAutocompleteB2B(); }, 200);
    }
};

// 📡 MOTOR DE CAPTURA SATELITAL: Pega a posição real do dispositivo do Cliente
window.obterLocalizacaoAutomatica = () => {
    if (!navigator.geolocation) return alert("Seu navegador não possui sensores de GPS.");
    
    // Feedback visual imediato no botão
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ SINCRONIZANDO...";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition((pos) => {
        // Grava as coordenadas com precisão de 6 casas decimais (Padrão Militar)
        document.getElementById('b2b-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('b2b-lng').value = pos.coords.longitude.toFixed(6);
        
        btn.innerHTML = "✅ LOCALIZADO";
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        
        // Libera o avanço para o Passo 3
        window.liberarBotaoInvestimento();
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-emerald-600', 'bg-blue-600');
            btn.disabled = false;
        }, 3000);
    }, (err) => {
        alert("🚩 Falha no Satélite: Certifique-se de que o GPS está ativado e o navegador tem permissão.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, { enableHighAccuracy: true });
};

// 🚀 MOTOR AUTOCOMPLETE GOOGLE V2026: Inteligência de Geocodificação ATLIVIO
window.iniciarAutocompleteB2B = () => {
    const input = document.getElementById('mis-address-search');
    
    // 🛡️ Segurança: Verifica se o Google SDK e o campo existem na tela
    if (!input || !window.google) {
        return console.warn("🛰️ Atlas B2B: Google Maps SDK não detectado.");
    }

    // Configura o Autocomplete focado 100% em endereços reais no Brasil
    const options = {
        componentRestrictions: { country: "br" },
        fields: ["geometry", "formatted_address"],
        types: ["address"]
    };

    const auto = new google.maps.places.Autocomplete(input, options);

    // 🎯 O GOLPE DE MESTRE: Transforma a seleção do endereço em coordenadas precisas
    auto.addListener("place_changed", () => {
        const place = auto.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
            return alert("📍 Local não identificado. Selecione uma opção da lista sugerida!");
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Alimenta os sensores invisíveis do formulário
        document.getElementById('b2b-lat').value = lat.toFixed(6);
        document.getElementById('b2b-lng').value = lng.toFixed(6);
        
        console.log("✅ Geocodificação Concluída:", place.formatted_address);
        
        // Destrava o fluxo para o próximo passo (Investimento)
        window.liberarBotaoInvestimento();
    });
};

window.validarRaioB2B = (input) => { if(input.value < 0) input.value = 0; window.liberarBotaoInvestimento(); };

window.liberarBotaoInvestimento = () => {
    const btn = document.getElementById('btn-next-3');
    if(btn) { btn.disabled = false; btn.className = "w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg active:scale-95 transition-all"; }
};

// 💰 PASSO 3: INVESTIMENTO - Finalização com a identidade visual da ATLIVIO
window.finalizarLocalWizard = () => {
    // 💣 OPERAÇÃO GHOST: Destrói o container do Google para limpar a linha lixo no Passo 3
    document.querySelectorAll('.pac-container').forEach(el => el.remove());

    const latStr = document.getElementById('b2b-lat').value;
    const lngStr = document.getElementById('b2b-lng').value;
    const radStr = document.getElementById('b2b-radius').value;

    window.wizardB2BData.latitude = latStr ? parseFloat(latStr) : null;
    window.wizardB2BData.longitude = lngStr ? parseFloat(lngStr) : null;
    window.wizardB2BData.radius = radStr ? Number(radStr) : 0;

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

           <div class="p-6 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-4">
              <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Valor por Foto (AX)</label>
                        <div class="relative flex items-center">
                            <span class="absolute left-4 text-amber-500 text-lg">🪙</span>
                            <input type="number" id="b2b-reward" value="5.00" min="3" oninput="window.atualizarPreviewFinanceiro()" 
                                class="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-950 text-amber-400 font-black border-2 border-slate-800 focus:border-amber-500 outline-none transition-all shadow-inner text-lg"
                                style="line-height: 1;">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-2 block">Qtd. de Pessoas</label>
                        <input type="number" id="b2b-slots" value="1" min="1" oninput="window.atualizarPreviewFinanceiro()" class="w-full p-3 rounded-xl bg-black text-white font-black border border-white/10 outline-none focus:border-blue-500 transition-all">
                    </div>
                </div>
                <p class="text-[8px] text-gray-500 italic px-2">O sistema reserva o valor total (Qtd × Valor + Taxa).</p>

               <div class="p-5 bg-black/40 rounded-3xl space-y-3 border border-white/5">
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>💰 Valor Líquido</span>
                        <span id="preview-user" class="text-white font-mono">R$ 0,00</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-gray-500">
                        <span>🛡️ Taxa de Intermediação</span>
                        <span id="preview-tax" class="text-blue-400 font-mono">R$ 0,00</span>
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

    // 🚀 SINCRONIA IMEDIATA: Dispara o cálculo assim que o Passo 3 abre para evitar valores zerados
    window.atualizarPreviewFinanceiro();
};
// 🤖 CALCULADORA DINÂMICA V2026 (CONECTADA AO BANCO CENTRAL)
window.atualizarPreviewFinanceiro = async () => {
    const val = parseFloat(document.getElementById('b2b-reward').value) || 0;
    const slots = parseInt(document.getElementById('b2b-slots').value) || 1;
    
   // 🏦 SINCRONIA TOTAL: O código não assume valores. Ele lê o que você definiu no Admin.
    const configSnap = await getDoc(doc(db, "settings", "global_economy"));
    // Se o campo não existir, a taxa é 0. O Admin é o único soberano.
    const taxaConfig = (configSnap.exists() && configSnap.data().taxa_lucro_b2b !== undefined) 
        ? Number(configSnap.data().taxa_lucro_b2b) 
        : 0;
    const recompensaTotalUsuarios = val * slots;
    // Gil, agora o cálculo usa os seus 70% (ou o que você definir)
    const taxaTotalAtlivio = recompensaTotalUsuarios * (taxaConfig / 100);
    const totalGeral = recompensaTotalUsuarios + taxaTotalAtlivio;

    document.getElementById('preview-user').innerText = `R$ ${recompensaTotalUsuarios.toFixed(2)}`;
    document.getElementById('preview-tax').innerText = `R$ ${taxaTotalAtlivio.toFixed(2)} (${taxaConfig}%)`;
    document.getElementById('preview-total').innerText = `R$ ${totalGeral.toFixed(2)}`;
    
    window.wizardB2BData.slots_totais = slots;
    window.wizardB2BData.taxa_aplicada = taxaConfig;
    window.wizardB2BData.total_with_fee = totalGeral;
};

// ⚡ MOTOR DE RESERVA V2026: Sincronia Total com Banco Central
window.processarReservaB2B = async () => {
    // 📥 CAPTURA ÚNICA E SEGURA DOS VALORES
    const rewardVal = parseFloat(document.getElementById('b2b-reward')?.value || 0);
    const slotsVal = parseInt(document.getElementById('b2b-slots')?.value || 1);
    const enderecoFormatado = document.getElementById('mis-address-search')?.value || "";

    if(rewardVal < 3) return alert("O valor mínimo de recompensa é R$ 3,00");

    const btn = document.getElementById('btn-confirmar-b2b');
    if(btn) {
        btn.disabled = true;
        btn.innerText = "⏳ RESERVANDO SALDO...";
    }

    // 🛡️ BUSCA DE TAXA SOBERANA (Gaveta Global Economy)
    const configSnap = await getDoc(doc(db, "settings", "global_economy"));
    const taxaOficial = (configSnap.exists() && configSnap.data().taxa_lucro_b2b !== undefined) 
        ? Number(configSnap.data().taxa_lucro_b2b) 
        : 0;

    // 💰 CÁLCULO DINÂMICO DE DÉBITO
    const recompensaTotal = rewardVal * slotsVal;
    const taxaAtlivioReal = recompensaTotal * (taxaOficial / 100); 
    const totalNecessario = recompensaTotal + taxaAtlivioReal;
    const uid = auth.currentUser?.uid;
    if(!uid) return alert("Erro: Usuário não autenticado.");
    const userRef = doc(db, "usuarios", uid);

    // 🧠 CONSULTA DE AUTONOMIA: Verifica se a missão entra direto ou vai para curadoria
    const ecoSnap = await getDoc(doc(db, "settings", "global_economy"));
    const radarAutomatico = ecoSnap.exists() ? (ecoSnap.data().auto_publish_b2b || false) : false;

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Perfil não encontrado.";
            
            const bal = userSnap.data().wallet_balance || 0;
            if (bal < totalNecessario) throw "Saldo insuficiente! Faça uma recarga para continuar.";

            // 1. Debita o valor total (Vagas x [Valor+Taxa]) e move para reserva
            transaction.update(userRef, {
                wallet_balance: increment(-totalNecessario),
                wallet_reserved: increment(totalNecessario),
                updated_at: serverTimestamp()
            });

          // 2. 🛡️ CRIAÇÃO BLINDADA B2B: Sincroniza com os novos nomes de variáveis (rewardVal / slotsVal)
            const unitWithFee = totalNecessario / slotsVal; 
            
            const missionRef = doc(collection(db, "missions"));
            // 🔐 Gravação Soberana: Unifica owner_id e status dinâmico para escala industrial
            transaction.set(missionRef, {
                ...window.wizardB2BData,
                owner_id: auth.currentUser.uid, 
                reward: rewardVal,
                unit_total_with_fee: unitWithFee, 
                total_with_fee: totalNecessario,
                slots_totais: slotsVal,
                slots_disponiveis: slotsVal,
                pessoas_realizando: 0,
               address: enderecoFormatado,
               pay_type: 'atlix', // 🛡️ RIGIDEZ ATLIVIO: Garante liquidação em crédito interno
                // 🚀 STATUS DINÂMICO: Se Radar Auto estiver ON, nasce 'active'. Se não, 'pending_b2b'
                status: radarAutomatico ? 'active' : 'pending_b2b',
                active: radarAutomatico ? true : false,
                published_at: radarAutomatico ? serverTimestamp() : null,
                b2b_name: window.userProfile?.nome_fantasia || window.userProfile?.nome || "Empresa B2B",
                created_at: serverTimestamp()
            });

           // 3. Livro Razão B2B: Sincronizado com slotsVal
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: -totalNecessario,
                tipo: "RESERVA_B2B 🔒",
                descricao: `Reserva: ${slotsVal}x ${window.wizardB2BData.title}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        const msgSucesso = radarAutomatico 
            ? "🚀 OPERAÇÃO ATIVA!\nSua missão já está visível no radar para todos os usuários."
            : "✅ OPERAÇÃO LANÇADA!\nSua missão foi enviada para análise e será publicada no radar em instantes.";
        
        alert(msgSucesso);
        document.getElementById('modal-editor').classList.add('hidden');
        window.carregarOrdensB2B();

    } catch (e) {
        console.error("Erro Reserva B2B:", e);
        
        // 🗣️ TRADUTOR DE ERROS ATLIVIO
        let msgAmigavel = "Não foi possível completar a reserva agora.";
        if (e.toString().includes("insuficiente")) msgAmigavel = "Saldo insuficiente! Recarregue sua carteira para lançar esta missão.";
        else if (e.toString().includes("undefined")) msgAmigavel = "Erro nos valores informados. Por favor, reinicie o assistente de criação.";

        alert(`⚠️ OPS! \n\n${msgAmigavel}`);
        
        btn.disabled = false;
        btn.innerText = "Finalizar e Ativar Operação ✅";
    }
};
// 🔄 MOTOR DE ESTORNO B2B: Encerra a missão e devolve o saldo proporcional ao cliente
window.encerrarMissaoB2BComEstorno = async (missionId) => {
    // 🛡️ CONFIRMAÇÃO DE SEGURANÇA: Evita cliques acidentais em operações financeiras
    if (!confirm("⚠️ ATENÇÃO: Deseja encerrar esta missão? As vagas não preenchidas serão reembolsadas com o abatimento da taxa de intermediação.")) return;

    try {
        const missionRef = doc(db, "missions", missionId);
        const missionSnap = await getDoc(missionRef);
        
        if (!missionSnap.exists()) throw "Missão não localizada no radar.";
        const m = missionSnap.data();

        // 🛑 TRAVA DE STATUS: Só estorna se a missão não estiver expirada ou já finalizada
        if (m.status !== 'active' && m.status !== 'pending_b2b') {
            return alert("Esta missão já se encontra em estado finalizado.");
        }

        const uid = auth.currentUser.uid;
        const userRef = doc(db, "usuarios", uid);
        const statsRef = doc(db, "sys_finance", "stats");

        // 🧮 CÁLCULO DE ENGENHARIA FINANCEIRA ATLIVIO
        const vagasRestantes = Number(m.slots_disponiveis || 0);
        
        if (vagasRestantes <= 0) {
            // Se não há vagas, apenas desativa a missão sem mexer no financeiro
            await updateDoc(missionRef, { status: 'completed', active: false, updated_at: serverTimestamp() });
            return alert("Missão encerrada! Todas as vagas já haviam sido preenchidas.");
        }

        // Recupera o valor que o cliente pagou por CADA vaga (Preço + Taxa)
        const valorUnitarioComTaxa = Number(m.unit_total_with_fee);
        // Recupera quanto o usuário ganharia (O valor líquido da recompensa)
        const recompensaLiquidaUnitaria = Number(m.reward);
        
        // 💎 A MINA DE OURO: A taxa que a Atlivio retém por cada vaga cancelada
        const taxaUnitariaAtlivio = valorUnitarioComTaxa - recompensaLiquidaUnitaria;
        
        // 💰 TOTAIS DA OPERAÇÃO
        const montanteTotalReserva = valorUnitarioComTaxa * vagasRestantes; // O que sai da reserva
        const lucroPlataformaTotal = taxaUnitariaAtlivio * vagasRestantes; // O que vai pro seu bolso (Revenue)
        const estornoClienteFinal = recompensaLiquidaUnitaria * vagasRestantes; // O que volta pro saldo do cliente

        // ⚡ INÍCIO DA TRANSAÇÃO ATÔMICA: Ou faz tudo, ou não faz nada
        await runTransaction(db, async (transaction) => {
            // 1. ATUALIZAÇÃO DA MISSÃO: Carimba como encerrada pelo dono
            transaction.update(missionRef, {
                status: 'closed_by_owner',
                active: false,
                slots_disponiveis: 0,
                encerrada_em: serverTimestamp()
            });

            // 2. MOVIMENTAÇÃO BANCÁRIA DO USUÁRIO: Tira da reserva e devolve o líquido
            transaction.update(userRef, {
                wallet_reserved: increment(-montanteTotalReserva), // Esvazia a reserva das vagas mortas
                wallet_balance: increment(estornoClienteFinal),    // Devolve apenas o valor da recompensa
                updated_at: serverTimestamp()
            });

            // 3. COFRE ATLIVIO: Captura as taxas das vagas que não foram usadas
            if (lucroPlataformaTotal > 0) {
                transaction.update(statsRef, {
                    total_revenue: increment(lucroPlataformaTotal),
                    ultima_atualizacao: serverTimestamp()
                });
            }

            // 4. LIVRO RAZÃO: Registro histórico do estorno
            const extratoRef = doc(collection(db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: uid,
                valor: estornoClienteFinal,
                tipo: "ESTORNO_B2B 🔓",
                descricao: `Reembolso de ${vagasRestantes} vagas: ${m.title}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        alert(`✅ OPERAÇÃO ENCERRADA!\n\nReembolso: R$ ${estornoClienteFinal.toFixed(2)}\nTaxas retidas: R$ ${lucroPlataformaTotal.toFixed(2)}`);
        window.carregarOrdensB2B(); // Atualiza a lista na tela

    } catch (e) {
        console.error("Erro no Estorno:", e);
        alert("Erro crítico ao processar estorno. Operação cancelada.");
    }
};
// 🔐 SOLDAGEM GLOBAL: Entrega as chaves para o app.js
window.initB2B = initB2B;
window.carregarOrdensB2B = carregarOrdensB2B;
window.carregarAuditoriaB2B = carregarAuditoriaB2B;
window.encerrarMissaoB2BComEstorno = encerrarMissaoB2BComEstorno; // ──▶ Nova chave de estorno adicionada
console.log("💼 [Atlas B2B] Módulo Financeiro e Checkout Soldado!");
