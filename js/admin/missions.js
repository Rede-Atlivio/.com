import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp, runTransaction, where, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let currentTab = 'submissions'; 
let allLoadedMissions = []; // Armazena as missões para edição

export async function init() {
    const container = document.getElementById('view-list');
    
    // 1. Cria a Navegação Interna (Sub-abas)
    const subNav = document.createElement('div');
    subNav.className = "flex gap-4 mb-6 border-b border-slate-800 pb-2";
  subNav.innerHTML = `
        <div class="flex justify-between items-center w-full">
            <div class="flex gap-4">
                <button onclick="window.switchMissionTab('missions')" id="btn-tab-missions" class="text-gray-400 font-bold uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition">📋 Missões</button>
                <button onclick="window.switchMissionTab('b2b_pendente')" id="btn-tab-b2b_pendente" class="text-amber-500 font-black uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition relative">
                    🤝 B2B Pendente
                    <span id="badge-b2b-count" class="hidden absolute -top-1 -right-2 bg-red-600 text-white text-[7px] px-1 rounded-full animate-pulse">0</span>
                </button>
               <button onclick="window.switchMissionTab('submissions')" id="btn-tab-submissions" class="text-gray-400 font-bold uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition">📸 Envios</button>
            </div>
           <div class="flex items-center gap-4 bg-slate-900/80 px-4 py-1.5 rounded-2xl border border-white/5 shadow-inner">
                <div class="flex items-center gap-2 border-r border-white/10 pr-4">
                    <span class="text-[7px] font-black text-amber-500 uppercase">Radar Auto:</span>
                    <input type="checkbox" id="check-auto-publish" onchange="window.toggleGovernançaB2B('auto_publish_b2b')" class="w-3 h-3 accent-amber-500 cursor-pointer">
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[7px] font-black text-emerald-500 uppercase">Pagamento Auto:</span>
                    <input type="checkbox" id="check-auto-approve" onchange="window.toggleGovernançaB2B('aprovacao_automatica_b2b')" class="w-3 h-3 accent-emerald-500 cursor-pointer">
                </div>
            </div>
        </div>
    `;
    
    // Insere antes da tabela se não existir
    if(!document.getElementById('btn-tab-missions')) {
        container.insertBefore(subNav, container.firstChild);
    }

    // Exporta Globais
    window.switchMissionTab = switchMissionTab;
    window.abrirNovaMissao = abrirNovaMissao;
    window.editarMissao = editarMissao; // ✅ Nova Função
    window.salvarMissao = salvarMissao;
    window.excluirMissao = excluirMissao;
    window.aprovarMissao = aprovarMissao;
    window.rejeitarMissao = rejeitarMissao;
    
  // ⚙️ Sincronia de Governança B2B (Radar e Cofre)
    const sincronizarGovernança = async () => {
        const ecoSnap = await getDoc(doc(window.db, "settings", "global_economy"));
        if(ecoSnap.exists()) {
            const data = ecoSnap.data();
            if(document.getElementById('check-auto-publish')) document.getElementById('check-auto-publish').checked = data.auto_publish_b2b || false;
            if(document.getElementById('check-auto-approve')) document.getElementById('check-auto-approve').checked = data.aprovacao_automatica_b2b || false;
        }
    };
    sincronizarGovernança();

    // ⚡ Motor de Governança Independente
    window.toggleGovernançaB2B = async (campo) => {
        const el = campo === 'auto_publish_b2b' ? 'check-auto-publish' : 'check-auto-approve';
        const isChecked = document.getElementById(el).checked;
        
        await updateDoc(doc(window.db, "settings", "global_economy"), { 
            [campo]: isChecked,
            updated_at: serverTimestamp() 
        });

        const msg = campo === 'auto_publish_b2b' 
            ? (isChecked ? "📡 RADAR: Missões B2B agora entram direto!" : "🔒 RADAR: Você deve publicar manualmente.")
            : (isChecked ? "💰 COFRE: Empresas agora pagam usuários direto!" : "⚖️ COFRE: Você deve dar a palavra final no pagamento.");
        
        alert(msg);
    };
    // Inicia na aba de Gerenciar
    switchMissionTab('missions');

    // 🧹 FAXINA DE VAGAS: Verifica usuários inativos a cada entrada na aba
    setTimeout(() => { if(window.limparVagasZumbisB2B) window.limparVagasZumbisB2B(); }, 2000);
}

/**
 * 🕵️ MOTOR DE INTEGRIDADE ATLIVIO
 * Expulsa usuários que travam a vaga e não enviam a foto em 30 min.
 */
window.limparVagasZumbisB2B = async () => {
    try {
        // Busca missões que possuem ocupação ativa
        const q = query(collection(window.db, "missions"), where("pessoas_realizando", ">", 0));
        const snap = await getDocs(q);
        
        const agora = Date.now();

        for (const mDoc of snap.docs) {
            const mData = mDoc.data();
            
            // ⏱️ RECUPERA O LIMITE DO DNA DA MISSÃO (Ou usa o padrão de categoria se for antiga)
            let tempoLimiteMissao = mData.execution_time_limit || (mData.category === 'fast' ? 5 : 20);
            const limiteMilissegundos = tempoLimiteMissao * 60 * 1000;

            // 🚀 OTIMIZAÇÃO: Busca apenas tentativas 'started' criadas ANTES do tempo limite (Evita ler tudo)
            const qTentativas = query(
                collection(window.db, "missions", mDoc.id, "attempts"), 
                where("status", "==", "started")
            );
            
            const tentSnap = await getDocs(qTentativas);

            for (const tDoc of tentSnap.docs) {
                const t = tDoc.data();
                const inicio = t.started_at?.toDate().getTime() || agora;
                
                // 🧹 Só limpa se realmente estourou o tempo específico daquela missão
                if (agora - inicio > limiteMilissegundos) {
                    await runTransaction(window.db, async (transaction) => {
                        // Devolve a vaga ao estoque e remove o peso do contador
                        transaction.update(doc(window.db, "missions", mDoc.id), {
                            slots_disponiveis: increment(1),
                            pessoas_realizando: increment(-1),
                            updated_at: serverTimestamp()
                        });
                        // Invalida a tentativa do usuário
                        transaction.update(doc(window.db, "missions", mDoc.id, "attempts", tDoc.id), { 
                            status: 'expired',
                            expired_at: serverTimestamp() 
                        });
                    });
                }
            }
        }
    } catch(e) { console.error("Erro faxina:", e); }
};

async function switchMissionTab(tab) {
    currentTab = tab;
   // Reset de botões (Incluindo a nova aba B2B na faxina visual)
    ['missions', 'b2b_pendente', 'submissions', 'payments'].forEach(t => {
        const btn = document.getElementById(`btn-tab-${t}`);
        if(btn) btn.className = "text-gray-400 font-bold uppercase text-[9px] pb-2 border-b-2 border-transparent transition";
    });

    const activeBtn = document.getElementById(`btn-tab-${tab}`);
    if(activeBtn) activeBtn.className = "text-blue-500 font-bold uppercase text-[9px] pb-2 border-b-2 border-blue-500 transition";

    const btnAdd = document.getElementById('btn-list-add');
    const header = document.getElementById('list-header');

   if(tab === 'missions') {
        if(btnAdd) { 
            btnAdd.style.display = 'block'; 
            btnAdd.innerHTML = "+ NOVA MISSÃO"; 
            btnAdd.onclick = () => window.abrirCriadorMissaoAtlas(); 
        }
        header.innerHTML = `
            <th class="p-3 text-[9px] uppercase">Título</th>
            <th class="p-3 text-[9px] uppercase">Tipo</th>
            <th class="p-3 text-[9px] uppercase">Recompensa</th>
            <th class="p-3 text-right text-[9px] uppercase">Gestão</th>`;
        await loadMissionsManagement();
    } else if(tab === 'b2b_pendente') {
        // 🤝 ABA B2B: Oculta o botão de criar (pois aqui você só aprova o que os outros criaram)
        if(btnAdd) { btnAdd.style.display = 'none'; }
        header.innerHTML = `<th class="p-3">EMPRESA</th><th class="p-3">MISSÃO</th><th class="p-3">VALOR/MOEDA</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadB2BPendingMissions(); // Chamaremos esta função no próximo passo
   } else if(tab === 'submissions') {
        if(btnAdd) { btnAdd.style.display = 'none'; }
        header.innerHTML = `<th class="p-3">MISSÃO</th><th class="p-3">USUÁRIO</th><th class="p-3">PROVA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadSubmissions();
    }
}

// --- ABA 1: GERENCIAR MISSÕES ---
async function loadMissionsManagement() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-10"><div class="loader mx-auto border-blue-500"></div></td></tr>`;
    
    try {
        const q = query(collection(window.db, "missions"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        allLoadedMissions = []; // Limpa cache local
        tbody.innerHTML = "";
        
        if(snap.empty) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma missão ativa. Crie uma!</td></tr>`; return; }

        snap.forEach(d => {
            const m = d.data();
            m.id = d.id; // Guarda ID
            allLoadedMissions.push(m);

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                    <td class="p-3 font-bold text-white">${m.title}</td>
                    <td class="p-3 text-xs uppercase text-gray-400">${m.type || 'Geral'}</td>
                    <td class="p-3 text-emerald-400 font-mono">R$ ${m.reward}</td>
                    <td class="p-3 text-right flex justify-end gap-2">
                        <button onclick="window.editarMissao('${d.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold transition">✏️ EDITAR</button>
                        <button onclick="window.excluirMissao('${d.id}')" class="text-red-500 hover:text-red-400 font-bold text-xs border border-red-900/50 bg-red-900/20 px-3 py-1 rounded">🗑️</button>
                    </td>
                </tr>
            `;
        });
        document.getElementById('list-count').innerText = `${snap.size} missões ativas`;
    } catch(e) { console.error(e); }
}

// 🤝 ABA B2B: BUSCA MISSÕES CRIADAS POR EMPRESAS (AGUARDANDO CURADORIA)
async function loadB2BPendingMissions() {
    const tbody = document.getElementById('list-body');
    const badge = document.getElementById('badge-b2b-count');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-10"><div class="loader mx-auto border-amber-500"></div></td></tr>`;
    
    try {
        // 🔍 FILTRO RIGIDO: Busca apenas missões de empresas que ainda não foram publicadas
        const q = query(collection(window.db, "missions"), where("status", "==", "pending_b2b"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        tbody.innerHTML = "";
        
        if(snap.empty) { 
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Nenhuma solicitação B2B pendente.</td></tr>`; 
            if(badge) badge.classList.add('hidden');
            return; 
        }

        // Atualiza o contador vermelho (Badge)
        if(badge) {
            badge.innerText = snap.size;
            badge.classList.remove('hidden');
        }

        snap.forEach(d => {
            const m = d.data();
            const moedaIcon = m.pay_type === 'atlix' ? '🪙' : '💰';
            const corValor = m.pay_type === 'atlix' ? 'text-amber-400' : 'text-emerald-400';

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-amber-900/10 transition">
                    <td class="p-3">
                        <p class="text-white font-bold text-xs uppercase">${m.b2b_name || 'Empresa B2B'}</p>
                        <p class="text-[8px] text-gray-500">ID: ${d.id.slice(0,8)}</p>
                    </td>
                    <td class="p-3">
                        <p class="text-gray-300 text-xs font-medium">${m.title}</p>
                    </td>
                    <td class="p-3">
                        <span class="${corValor} font-mono font-bold text-xs">${moedaIcon} ${m.reward}</span>
                    </td>
                    <td class="p-3 text-right flex justify-end gap-2">
                        <button onclick="window.rejeitarOrdemB2B('${d.id}')" class="bg-slate-800 hover:bg-red-900 text-red-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition border border-red-900/30">
                            REJEITAR
                        </button>
                        <button onclick="window.publicarMissaoB2B('${d.id}')" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg transition active:scale-95">
                            PUBLICAR
                        </button>
                    </td>
                </tr>
            `;
        });
        document.getElementById('list-count').innerText = `${snap.size} solicitações aguardando`;
    } catch(e) { 
        console.error("Erro B2B Load:", e); 
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 text-xs">Erro ao carregar (Pode faltar Índice no Firebase).</td></tr>`;
    }
}

// 🔨 O MARTELO DO GIL: PUBLICA A MISSÃO B2B E EXECUTA A REGRA FINANCEIRA
async function publicarMissaoB2B(missionId) {
    if(!confirm("🚀 DESEJA PUBLICAR ESTA MISSÃO NO RADAR GLOBAL?\n\nIsso mudará o status para 'active' e ela aparecerá para todos os usuários.")) return;

    try {
        const missionRef = doc(window.db, "missions", missionId);
        const missionSnap = await getDoc(missionRef);
        
        if (!missionSnap.exists()) throw "Missão não encontrada no banco.";
        const m = missionSnap.data();

        // 🛡️ TRAVA DE SEGURANÇA: Só publica se for B2B Pendente
        if (m.status !== 'pending_b2b') throw "Esta missão já foi processada ou não é B2B.";

        const isReal = m.pay_type === 'real';
        const valorRecompensa = parseFloat(m.reward || 0);

       // 🧠 CONSULTA AO BANCO CENTRAL: Busca se a aprovação deve ser automática ou manual
        const ecoSnap = await getDoc(doc(window.db, "settings", "global_economy"));
        const autoApprove = ecoSnap.exists() ? ecoSnap.data().aprovacao_automatica_b2b : false;

        // 🔄 PREPARAÇÃO DO PAYLOAD DE ATIVAÇÃO
        let updateData = {
            status: 'active', // Agora ela aparece no radar para todos
            auto_approve: autoApprove, // Define se o B2B pode pagar o usuário sozinho
            published_at: serverTimestamp(),
            curated_by: 'atlivio_master_system'
        };

       // 💰 REGRA DE LUCRO B2B ATLIVIO
        if (isReal) {
            const valorTotalComTaxa = parseFloat(m.total_with_fee || 0);
            const lucroDaOperacao = valorTotalComTaxa - valorRecompensa;

            if (lucroDaOperacao > 0) {
                // Registra o lucro real da Atlivio no Balde de Taxas (stats)
                const statsRef = doc(window.db, "sys_finance", "stats");
                await updateDoc(statsRef, {
                    total_revenue: increment(lucroDaOperacao),
                    ultima_atualizacao: serverTimestamp()
                });
                console.log(`📈 Lucro de R$ ${lucroDaOperacao.toFixed(2)} enviado para o Balde de Taxas.`);
            }
        }

        await updateDoc(missionRef, updateData);

        // 📢 NOTIFICAÇÃO PARA A EMPRESA (O CLIENTE B2B)
        if (m.b2b_owner_uid) {
            await addDoc(collection(window.db, "notifications"), {
                uid: m.b2b_owner_uid,
                message: `✅ Sua missão "${m.title}" foi aprovada e já está ativa no radar!`,
                type: 'success',
                read: false,
                created_at: serverTimestamp()
            });
        }

        alert("✅ MISSÃO PUBLICADA COM SUCESSO!\nOs usuários já podem coletar os dados.");
        
        // Recarrega a lista para sumir o que você já aprovou
        loadB2BPendingMissions();

    } catch(e) {
        console.error("Erro na publicação B2B:", e);
        alert("❌ FALHA NA PUBLICAÇÃO:\n" + e);
    }
}

/**
 * ⛔ MOTOR DE ESTORNO B2B (REJEIÇÃO DE ORDEM)
 * Cancela a missão pendente e devolve o valor da wallet_reserved para wallet_balance da empresa.
 */
window.rejeitarOrdemB2B = async (missionId) => {
    const motivo = prompt("Informe o motivo da rejeição (será enviado para a empresa):");
    if (!motivo) return;

    if (!confirm("⚠️ CONFIRMAR REJEIÇÃO?\nO saldo reservado será devolvido integralmente para a empresa e a missão será excluída.")) return;

    try {
        const missionRef = doc(window.db, "missions", missionId);
        const missionSnap = await getDoc(missionRef);
        if (!missionSnap.exists()) throw "Ordem não encontrada.";
        
        const m = missionSnap.data();
        const totalEstorno = m.total_with_fee || 0;
        const b2bUid = m.owner_id || m.b2b_owner_uid;

       await runTransaction(window.db, async (transaction) => {
            // 1. Localiza a empresa
            const b2bRef = doc(window.db, "usuarios", b2bUid);
            
            // 2. Devolve o dinheiro (Tira da reserva e volta pro saldo)
            transaction.update(b2bRef, {
                wallet_reserved: increment(-totalEstorno),
                wallet_balance: increment(totalEstorno),
                updated_at: serverTimestamp()
            });

            // 3. 🛡️ PRESERVAÇÃO: Não deleta, apenas marca como rejeitada e grava o motivo
            transaction.update(missionRef, {
                status: 'rejected',
                rejection_reason: motivo,
                active: false,
                updated_at: serverTimestamp()
            });

            // 4. Registra no extrato da empresa a devolução
            const extratoRef = doc(collection(window.db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: b2bUid,
                valor: totalEstorno,
                tipo: "ESTORNO_B2B 🔄",
                descricao: `Ordem Rejeitada: ${m.title}. Motivo: ${motivo}`,
                moeda: "BRL",
                timestamp: serverTimestamp()
            });
        });

        // 📢 Notifica a empresa
        await addDoc(collection(window.db, "notifications"), {
            uid: b2bUid,
            message: `❌ Sua missão "${m.title}" foi rejeitada. Motivo: ${motivo}. O saldo foi estornado.`,
            type: 'alert',
            read: false,
            created_at: serverTimestamp()
        });

        alert("✅ Ordem cancelada e saldo estornado com sucesso!");
        loadB2BPendingMissions();

    } catch (e) {
        console.error("Erro ao rejeitar:", e);
        alert("Erro no processamento: " + e);
    }
};

// ✅ FUNÇÃO DE PREPARAÇÃO PARA EDIÇÃO
function editarMissao(id) {
    const mission = allLoadedMissions.find(m => m.id === id);
    if(mission) {
        abrirNovaMissao(mission);
    }
}

// 🚀 CRIADOR DE MISSÕES ATLAS V2026.PRO
// Gil, mudamos o nome para abrirCriadorMissaoAtlas para o Core.js te encontrar
async function abrirCriadorMissaoAtlas(dados = null) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    
    const btnClose = document.getElementById('btn-close-modal');
    if(btnClose) btnClose.onclick = () => modal.classList.add('hidden');

    // Gil, injetamos aqui a inteligência de Checklist e Nível de Usuário
    content.innerHTML = `
        <div class="space-y-4 pb-10">
            <h3 class="text-xl font-black text-white mb-4 italic uppercase tracking-tighter">${dados ? '🔧 Editar Estratégia' : '🚀 Nova Missão Atlas'}</h3>
            <input type="hidden" id="mis-id" value="${dados?.id || ''}">
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                    <label class="text-[9px] text-gray-500 font-black uppercase ml-1">Título da Ordem</label>
                    <input id="mis-title" value="${dados?.title || ''}" class="w-full p-3 rounded-xl bg-slate-900 text-white font-bold border border-slate-700 focus:border-blue-500 outline-none" placeholder="Ex: Fachada Comercial">
                </div>
               <div>
                    <label class="text-[9px] text-amber-500 font-black uppercase ml-1">Nível Mínimo</label>
                    <select id="mis-level" class="w-full p-3 rounded-xl bg-slate-900 text-amber-400 font-bold border border-slate-700 outline-none">
                        <option value="1" ${dados?.level == 1 ? 'selected' : ''}>Lvl 1 (Iniciante)</option>
                        <option value="2" ${dados?.level == 2 ? 'selected' : ''}>Lvl 2 (Intermediário)</option>
                        <option value="3" ${dados?.level == 3 ? 'selected' : ''}>Lvl 3 (Avançado/PRO)</option>
                    </select>
                </div>
                <div>
                    <label class="text-[9px] text-cyan-500 font-black uppercase ml-1">Quantidade de Vagas</label>
                    <input type="number" id="mis-slots" value="${dados?.slots_totais || 10}" class="w-full p-3 rounded-xl bg-slate-900 text-cyan-400 font-black border border-slate-700 outline-none" placeholder="Ex: 50">
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[9px] text-gray-500 font-black uppercase ml-1">Categoria</label>
                    <select id="mis-category" class="w-full p-3 rounded-xl bg-slate-900 text-white font-bold border border-slate-700 outline-none">
                        <option value="physical" ${dados?.category === 'physical' ? 'selected' : ''}>📍 No Local (Foto/GPS)</option>
                        <option value="fast" ${dados?.category === 'fast' ? 'selected' : ''}>⚡ Rápida (Online/Pesquisa)</option>
                        <option value="growth" ${dados?.category === 'growth' ? 'selected' : ''}>🚀 Crescimento (Indicação)</option>
                    </select>
                </div>
                <div>
                    <label class="text-[9px] text-gray-500 font-black uppercase ml-1">URL Foto Exemplo (Instrução)</label>
                    <input id="mis-example-image" value="${dados?.example_image || ''}" class="w-full p-3 rounded-xl bg-slate-900 text-blue-400 text-xs border border-slate-700 outline-none" placeholder="https://imagem.com/exemplo.jpg">
                </div>
            </div>

            <div>
                <label class="text-[9px] text-emerald-500 font-black uppercase ml-1">📋 Checklist Inteligente (Separe por vírgula)</label>
                <input id="mis-questions" value="${dados?.questions?.join(',') || ''}" class="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-medium border border-emerald-900/30 outline-none" placeholder="Ex: Loja Aberta?, Tem Estacionamento?, Preço Visível?">
                <p class="text-[7px] text-gray-500 mt-1">* Deixe vazio se não quiser perguntas extras.</p>
            </div>

            <div>
                <label class="text-[9px] text-gray-500 font-black uppercase ml-1">Instruções Técnicas</label>
                <textarea id="mis-desc" class="w-full p-3 rounded-xl bg-slate-900 text-gray-300 text-sm border border-slate-700 outline-none" rows="2" placeholder="O que o prestador deve fazer exatamente?">${dados?.description || ''}</textarea>
            </div>

            <div class="p-4 bg-slate-950 rounded-2xl border border-blue-500/10 space-y-3">
                <div class="flex justify-between items-center">
                    <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest italic">📍 Geolocalização Blindada</p>
                    <button onclick="window.obterLocalizacaoAutomatica()" class="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-[8px] font-black uppercase transition hover:bg-blue-600 hover:text-white">🎯 Sincronizar GPS</button>
                </div>
                <input type="text" id="mis-address-search" placeholder="Buscar endereço no Google Maps..." class="w-full p-2 rounded-lg bg-black text-white text-xs border border-slate-800 outline-none focus:border-cyan-500">
                <div class="grid grid-cols-3 gap-2">
                    <input id="mis-lat" value="${dados?.latitude || ''}" class="p-2 rounded bg-slate-900 text-emerald-500 text-[10px] font-mono border border-slate-800" placeholder="Lat">
                    <input id="mis-lng" value="${dados?.longitude || ''}" class="p-2 rounded bg-slate-900 text-emerald-500 text-[10px] font-mono border border-slate-800" placeholder="Lng">
                    <input id="mis-radius" value="${dados?.radius || 500}" type="number" class="p-2 rounded bg-slate-900 text-white text-[10px] font-mono border border-slate-800" placeholder="Raio(m)">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[9px] text-gray-500 font-black uppercase ml-1">Recompensa (AX)</label>
                    <input type="number" id="mis-reward" value="${dados?.reward || ''}" class="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-black text-lg border border-slate-700 outline-none" placeholder="0.00">
                </div>
               <div>
    <label class="text-[9px] text-gray-500 font-black uppercase ml-1">Tipo de Pagamento</label>
    <select id="mis-pay-type" class="w-full p-3 rounded-xl bg-slate-900 text-white font-bold border border-slate-700 outline-none">
        <option value="real">💰 DINHEIRO REAL (Balance)</option>
        <option value="atlix">🪙 CRÉDITO ATLIX (Bônus)</option>
    </select>
</div>
            </div>

            <button onclick="window.salvarMissao()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase shadow-xl transition-all active:scale-95 border-b-4 border-blue-800">
                ${dados ? '💾 ATUALIZAR ESTRATÉGIA' : '🚀 LANÇAR NO RADAR'}
            </button>
        </div>
    `;

    setTimeout(() => { if (window.iniciarAutocompleteMissions) window.iniciarAutocompleteMissions(); }, 200);
}
async function salvarMissao() {
    // Captura de IDs e Valores (Campos Clássicos e Novos)
    const id = document.getElementById('mis-id').value;
    const title = document.getElementById('mis-title').value;
    const level = parseInt(document.getElementById('mis-level').value);
    const category = document.getElementById('mis-category').value;
    const exampleImage = document.getElementById('mis-example-image').value;
    const questionsRaw = document.getElementById('mis-questions').value;
    const desc = document.getElementById('mis-desc').value;
    const reward = document.getElementById('mis-reward').value;
    const payType = document.getElementById('mis-pay-type').value;
    
    // Geolocalização
    const lat = document.getElementById('mis-lat').value;
    const lng = document.getElementById('mis-lng').value;
    const radius = document.getElementById('mis-radius').value;

    if(!title || !reward) return alert("⚠️ Título e Recompensa são obrigatórios.");

    // Tratamento do Checklist: Transforma string separada por vírgula em Array limpo
    const questionsArray = questionsRaw ? questionsRaw.split(',').map(q => q.trim()).filter(q => q !== "") : [];

// 🛡️ PROTEÇÃO DE RAIO: Garante que o Admin não crie raios absurdos (Máx 1000m)
    const raioDefinitivo = radius ? Math.min(Number(radius), 1000) : 500;
    
    // ⏱️ LÓGICA DE TEMPO DINÂMICO: Define quanto tempo a vaga fica presa no app do usuário
    let tempoLimiteMinutos = 30; // Padrão segurança
    if (category === 'fast') tempoLimiteMinutos = 5;      // ⚡ 5 min para online
    if (category === 'physical') tempoLimiteMinutos = 20;  // 📍 20 min para local
    if (category === 'growth') tempoLimiteMinutos = 60;    // 🚀 60 min para indicações

    const payload = {
        title: title,
        level: level || 1,
        category: category || 'physical',
        example_image: exampleImage || null,
        questions: questionsArray,
        description: desc,
        reward: parseFloat(reward),
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        radius: raioDefinitivo, // 📏 Raio agora é protegido
        execution_time_limit: tempoLimiteMinutos, // ⏱️ Novo DNA: Tempo de execução
        pay_type: payType,
        owner_id: window.auth.currentUser.uid,
        b2b_owner_uid: window.auth.currentUser.uid,
        updated_at: serverTimestamp(),
        active: true
    };

    try {
       // Captura o valor das vagas ANTES de decidir se é criação ou edição
        const slotsInput = parseInt(document.getElementById('mis-slots').value) || 10;

        if (id) {
            // MODO EDIÇÃO: Atualiza o TOTAL, mas preserva a lógica de disponíveis
            payload.slots_totais = slotsInput;
            // Dica: Se você aumentou o total, somamos a diferença nos disponíveis
            await updateDoc(doc(window.db, "missions", id), payload);
            alert("✨ Estratégia atualizada com sucesso!");
        } else {
            // MODO CRIAÇÃO: Tudo novo
            payload.created_at = serverTimestamp();
            payload.slots_totais = slotsInput;
            payload.slots_disponiveis = slotsInput;
            payload.pessoas_realizando = 0;
            await addDoc(collection(window.db, "missions"), payload);
            alert("🚀 Missão lançada no Radar!");
        }
        
        document.getElementById('modal-editor').classList.add('hidden');
        loadMissionsManagement(); // Recarrega a tabela do Admin
    } catch(e) { 
        console.error("Erro ao salvar DNA:", e);
        alert("🚨 Erro ao salvar: " + e.message); 
    }
}

async function excluirMissao(id) {
    if(confirm("Excluir esta missão?")) {
        await deleteDoc(doc(window.db, "missions", id));
        loadMissionsManagement();
    }
}

// --- ABA 2: ANALISAR ENVIOS (MANTIDO) ---
async function loadSubmissions() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader mx-auto border-blue-500"></div></td></tr>`;

    try {
        // 🚀 OTIMIZAÇÃO ATLIVIO: Limite reduzido para evitar travamento de memória com Base64
        const q = query(collection(window.db, "mission_submissions"), orderBy("created_at", "desc"), limit(15));
        const snap = await getDocs(q);
        tbody.innerHTML = "";

        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhum envio para analisar.</td></tr>`;
            document.getElementById('list-count').innerText = "0 envios";
            return;
        }

        document.getElementById('list-count').innerText = `${snap.size} envios`;

        snap.forEach(d => {
            const data = d.data();
            
            // 🚥 STATUS BADGES EVOLUÍDAS
            let statusBadge = `<span class="bg-yellow-900/50 text-yellow-500 px-2 py-1 rounded text-[8px] font-black uppercase border border-yellow-700/30">⏳ Pendente</span>`;
            if(data.status === 'paid_atlix') statusBadge = `<span class="bg-emerald-900/50 text-emerald-500 px-2 py-1 rounded text-[8px] font-black uppercase border border-emerald-700/30">✅ Pago AX</span>`;
            else if(data.status === 'rejected') statusBadge = `<span class="bg-red-900/50 text-red-500 px-2 py-1 rounded text-[8px] font-black uppercase border border-red-700/30">❌ Recusado</span>`;
            else if(data.status === 'b2b_rejected') statusBadge = `<span class="bg-orange-600 text-white px-2 py-1 rounded text-[8px] font-black uppercase animate-pulse shadow-lg">⚖️ Disputa B2B</span>`;

            // 📍 DISTÂNCIA REAL (Cálculo de Precisão)
            const distLabel = data.distance_meters !== undefined ? 
                `<p class="text-[8px] font-bold text-cyan-500 mt-1">📍 Local: ${Math.round(data.distance_meters)}m de precisão</p>` : '';

            // 📋 CHECKLIST (Mini visualização rápida)
            let miniCheck = '';
            if(data.responses) {
                miniCheck = `<div class="mt-1 flex flex-wrap gap-1">`;
                for(const [p, r] of Object.entries(data.responses)) {
                    miniCheck += `<span class="text-[7px] px-1 rounded ${r === 'Sim' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}">${r}</span>`;
                }
                miniCheck += `</div>`;
            }

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td class="p-3">
                        <p class="text-white font-black text-xs uppercase leading-tight">${data.mission_title || 'Missão'}</p>
                        ${distLabel}
                    </td>
                    <td class="p-3">
                        <p class="text-gray-300 font-bold text-[10px]">${data.user_name || 'Usuário'}</p>
                        <p class="text-[8px] text-gray-500 font-mono">${data.user_id.slice(0,8)}</p>
                    </td>
                    <td class="p-3">
                        <button onclick="window.abrirProvaNovaAba('${data.proof_url}')" class="bg-slate-700 hover:bg-blue-600 text-white p-2 rounded-lg transition shadow-md">📸 PROVA</button>
                        ${miniCheck}
                    </td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-right">
                        ${data.status === 'pending' ? `
                            <div class="flex justify-end gap-1">
                                <button onclick="window.aprovarMissao('${d.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase transition shadow-lg">LIBERAR</button>
                                <button onclick="window.rejeitarMissao('${d.id}')" class="bg-slate-800 hover:bg-red-600 text-red-400 px-2 py-1 rounded text-[8px] font-black uppercase transition border border-red-900/30">REJEITAR</button>
                            </div>
                        ` : data.status === 'b2b_rejected' ? `
                            <div class="flex flex-col gap-1 items-end">
                                <button onclick="window.anularRecusaB2B('${d.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase w-full">🔓 FORÇAR PGTO</button>
                                <button onclick="window.confirmarRecusaB2B('${d.id}')" class="bg-slate-800 hover:bg-red-900 text-gray-400 px-2 py-1 rounded text-[8px] font-black uppercase w-full">🔨 VALIDAR RECUSA</button>
                            </div>
                        ` : '<span class="text-gray-600 text-[9px] font-black uppercase italic">Finalizado</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

// 💎 MOTOR DE LIQUIDAÇÃO MESTRE V2026 (ADMIN & B2B)
window.aprovarMissao = async (submissionId) => {
    try {
        const subRef = doc(window.db, "mission_submissions", submissionId);
        const subSnap = await getDoc(subRef);
        if (!subSnap.exists()) throw "Submissão não encontrada.";
        const data = subSnap.data();

        const missionRef = doc(window.db, "missions", data.mission_id);
        const missionSnap = await getDoc(missionRef);
        if (!missionSnap.exists()) throw "Missão original não localizada.";
        const mData = missionSnap.data();

        // 🧬 DNA DA MISSÃO
        // Se o owner for o Admin Master ou o sistema, é uma Missão de Casa
        const isAdminMission = mData.owner_id === "atlivio_master" || mData.b2b_owner_uid === window.auth.currentUser.uid;
        const payType = data.pay_type; // 'real' ou 'atlix'
        const valorReward = Number(data.reward);

        if (!confirm(`⚖️ LIQUIDAÇÃO ATLIVIO: Confirmar pagamento de R$ ${valorReward} (${payType.toUpperCase()}) para ${data.user_name}?`)) return;

        await runTransaction(window.db, async (transaction) => {
            const userRef = doc(window.db, "usuarios", data.user_id);
            const caixaRef = doc(window.db, "sys_finance", "receita_total");
            const b2bRef = !isAdminMission ? doc(window.db, "usuarios", data.b2b_owner_uid) : null;

            // 1. LEITURAS OBRIGATÓRIAS
            await transaction.get(userRef);
            await transaction.get(caixaRef);
            if (b2bRef) await transaction.get(b2bRef);

            // ---------------------------------------------------------
            // 🚀 LÓGICA A: MISSÃO DO ADMIN (CUSTO DA PLATAFORMA)
            // ---------------------------------------------------------
            if (isAdminMission) {
                if (payType === 'real') {
                    // Tira do CAIXA GERAL (Dinheiro que entrou por PIX)
                    transaction.update(caixaRef, { total_acumulado: increment(-valorReward) });
                    // Adiciona no SALDO REAL do usuário
                    transaction.update(userRef, { wallet_balance: increment(valorReward) });
                } else {
                    // MODO ATLIX/BÔNUS: Não tira de lugar nenhum (Investimento/Inflação)
                    transaction.update(userRef, { wallet_bonus: increment(valorReward) });
                }
            } 
            // ---------------------------------------------------------
            // 🏢 LÓGICA B: MISSÃO B2B (MERCADO EXTERNO)
            // ---------------------------------------------------------
            else {
                const valorTotalComTaxa = Number(mData.unit_total_with_fee || valorReward);
                
                // Tira da RESERVA da empresa
                transaction.update(b2bRef, { wallet_reserved: increment(-valorTotalComTaxa) });
                
                // Paga o USUÁRIO (Sempre no Balance em B2B)
                transaction.update(userRef, { wallet_balance: increment(valorReward) });

                // Captura o LUCRO (Taxa) para o Revenue
                const lucroTaxa = Number((valorTotalComTaxa - valorReward).toFixed(2));
                if (lucroTaxa > 0) {
                    const statsRef = doc(window.db, "sys_finance", "stats");
                    transaction.update(statsRef, { total_revenue: increment(lucroTaxa) });
                }
            }

            // ---------------------------------------------------------
            // ✅ FINALIZAÇÃO COMUM (PARA AMBOS OS CASOS)
            // ---------------------------------------------------------
            transaction.update(subRef, { 
                status: 'paid_atlix', 
                paid_at: serverTimestamp(),
                liquidado_como: isAdminMission ? "ADMIN_COST" : "B2B_SETTLEMENT"
            });

            // Registro no Extrato
            const extratoRef = doc(collection(window.db, "extrato_financeiro"));
            transaction.set(extratoRef, {
                uid: data.user_id,
                valor: valorReward,
                tipo: payType === 'real' ? "🎯 MISSÃO_PAGAMENTO" : "🎁 MISSÃO_BONUS",
                descricao: `Missão: ${data.mission_title}`,
                moeda: payType === 'real' ? "BRL" : "ATLIX",
                timestamp: serverTimestamp()
            });
        });

        alert("✅ LIQUIDAÇÃO CONCLUÍDA!\nO motor processou as regras de " + (isAdminMission ? "Custo Admin." : "Fluxo B2B."));
        loadSubmissions();
    } catch (err) {
        console.error("Erro na liquidação master:", err);
        alert("❌ FALHA NO MOTOR: " + err);
    }
};

// ⛔ MOTOR DE REJEIÇÃO (DEVOLVE VAGA E MANTÉM CUSTÓDIA)
async function rejeitarMissao(docId) {
    if(!confirm("REJEITAR PROVA? \n\nA vaga voltará ao radar e o saldo continuará na custódia da empresa.")) return;

    try {
        const subRef = doc(window.db, "mission_submissions", docId);
        const subSnap = await getDoc(subRef);
        const data = subSnap.data();

        await runTransaction(window.db, async (transaction) => {
            const missionRef = doc(window.db, "missions", data.mission_id);
            
            transaction.update(subRef, { status: 'rejected', rejected_at: serverTimestamp() });

            // ♻️ DEVOLUÇÃO AUTOMÁTICA DE VAGA
            transaction.update(missionRef, {
                slots_disponiveis: increment(1),
                pessoas_realizando: increment(-1),
                updated_at: serverTimestamp()
            });
        });

        alert("❌ PROVA REJEITADA. Vaga liberada no radar.");
        loadSubmissions();
    } catch(e) { alert("Erro: " + e.message); }
}

// 🔨 MARTELO DO ADMIN: Anula a recusa do B2B e força o pagamento usando o motor oficial
window.anularRecusaB2B = async (docId) => {
    // Gil, aqui apenas chamamos a função aprovarMissao acima, que já tem toda a lógica blindada.
    await window.aprovarMissao(docId);
};
// 🔨 MARTELO DO ADMIN: Você analisou e concorda que a prova é RUIM (O B2B tem razão)
// 🔨 MARTELO DO ADMIN: Valida que a prova é RUIM. 
// O dinheiro NÃO VOLTA pro B2B, ele continua reservado para a missão e a VAGA é devolvida ao Radar.
window.confirmarRecusaB2B = async (docId) => {
    if(!confirm("🔨 VALIDAR RECUSA? \n\nA prova será descartada, o dinheiro continuará reservado e a vaga voltará ao radar para outro usuário.")) return;

    try {
        const subRef = doc(window.db, "mission_submissions", docId);
        const subSnap = await getDoc(subRef);
        const data = subSnap.data();

        await runTransaction(window.db, async (transaction) => {
            const missionRef = doc(window.db, "missions", data.mission_id);
            
            // 1. Marca a prova como rejeitada definitivamente pelo Admin
            transaction.update(subRef, { 
                status: 'rejected', 
                admin_decision: 'confirmed_b2b_rejection',
                updated_at: serverTimestamp() 
            });

            // 2. ♻️ DEVOLUÇÃO DA VAGA: O dinheiro continua em 'wallet_reserved' do B2B
            // porque a missão ainda está ativa aguardando alguém fazer certo.
            transaction.update(missionRef, {
                slots_disponiveis: increment(1),
                pessoas_realizando: increment(-1),
                updated_at: serverTimestamp()
            });
        });

        alert("✅ RECUSA VALIDADA: A vaga foi devolvida ao radar e o saldo permanece reservado para a missão.");
        loadSubmissions();
    } catch(e) { console.error(e); alert("Erro ao processar recusa."); }
};

// 🚀 MOTOR AUTOCOMPLETE GOOGLE V2026
// Gil, esta função liga as sugestões inteligentes do Google ao seu campo de busca
window.iniciarAutocompleteMissions = () => {
    const input = document.getElementById('mis-address-search');
    // Verifica se o input existe e se o script do Google no admin.html carregou
    if (!input || !window.google) return console.warn("🛰️ Google Maps SDK não detectado ou campo ausente.");

    // Configura o Autocomplete focado em endereços brasileiros
    const options = {
        componentRestrictions: { country: "br" },
        fields: ["geometry", "formatted_address"],
        types: ["address"]
    };

    const auto = new google.maps.places.Autocomplete(input, options);

    // 🎯 O GOLPE DE MESTRE: Quando você clica na sugestão, ele preenche os números sozinho!
    auto.addListener("place_changed", () => {
        const place = auto.getPlace();
        if (!place.geometry || !place.geometry.location) {
            return alert("Local não encontrado. Selecione uma opção da lista sugestiva.");
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Alimenta os campos de coordenadas automaticamente
        document.getElementById('mis-lat').value = lat.toFixed(6);
        document.getElementById('mis-lng').value = lng.toFixed(6);
        
        console.log("📍 Endereço Geocodificado:", place.formatted_address);
    });
};

// 📡 MOTOR DE GEOLOCALIZAÇÃO FÍSICA
// Pega a sua posição exata pelo GPS do seu notebook ou celular atual
window.obterLocalizacaoAutomatica = () => {
    if (!navigator.geolocation) return alert("Seu navegador não tem sensor de GPS.");
    
    const btn = event.currentTarget;
    btn.innerText = "🛰️ BUSCANDO...";

    navigator.geolocation.getCurrentPosition((pos) => {
        document.getElementById('mis-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('mis-lng').value = pos.coords.longitude.toFixed(6);
        btn.innerText = "✅ LOCALIZADO";
        setTimeout(() => { btn.innerText = "🎯 PEGAR GPS ATUAL"; }, 2000);
    }, (err) => {
        alert("Erro no GPS: " + err.message);
        btn.innerText = "🎯 PEGAR GPS ATUAL";
    }, { enableHighAccuracy: true });
};

// 💡 PONTE DE AUXÍLIO
window.converterEnderecoEmGps = () => {
    alert("💡 Dica do Maestro: Basta digitar o endereço no campo de busca acima e clicar na sugestão que aparecer!");
};

// 🚀 MOTOR DE ISOLAMENTO ATLIVIO: Abre a imagem Base64 em uma nova aba limpa
window.abrirProvaNovaAba = (base64) => {
    // Cria uma nova janela/aba
    const novaAba = window.open();
    
    // Injeta um HTML minimalista para a imagem não pesar na aba principal
    novaAba.document.write(`
        <html>
            <head>
                <title>Auditoria Atlivio - Evidência</title>
                <style>
                    body { background: #020617; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                    img { max-width: 95%; max-height: 95vh; border-radius: 20px; box-shadow: 0 0 50px rgba(0,0,0,0.8); border: 4px solid #1e293b; }
                </style>
            </head>
            <body>
                <img src="${base64}" />
            </body>
        </html>
    `);
    novaAba.document.close();
};


// 🔐 SOLDAGEM GLOBAL ADMIN V2026.PRO (CONEXÃO TOTAL B2B)
window.abrirCriadorMissaoAtlas = abrirCriadorMissaoAtlas;
window.publicarMissaoB2B = publicarMissaoB2B; 
// As funções de pagamento foram migradas para o Banco Central (Dashboard.js)
window.abrirNovaMissao = abrirCriadorMissaoAtlas; 
window.obterLocalizacaoAutomatica = obterLocalizacaoAutomatica;
window.converterEnderecoEmGps = converterEnderecoEmGps;
window.abrirProvaNovaAba = abrirProvaNovaAba;

// ⚖️ NOVOS MOTORES DE JUSTIÇA B2B
window.anularRecusaB2B = anularRecusaB2B;
window.confirmarRecusaB2B = confirmarRecusaB2B;

console.log("🚀 [Missions Admin] Sistema de Auditoria de Dois Níveis Soldado!");
