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
        const limite = 30 * 60 * 1000; 

        for (const mDoc of snap.docs) {
            // Varre tentativas que ficaram presas no status 'started'
            const qTentativas = query(collection(window.db, "missions", mDoc.id, "attempts"), where("status", "==", "started"));
            const tentSnap = await getDocs(qTentativas);

            for (const tDoc of tentSnap.docs) {
                const t = tDoc.data();
                const inicio = t.started_at?.toDate().getTime() || agora;
                
                if (agora - inicio > limite) {
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
    
    // Configura botão X (com a vacina do core.js isso já deve funcionar, mas reforçamos)
    const btnClose = document.getElementById('btn-close-modal');
    if(btnClose) btnClose.onclick = () => modal.classList.add('hidden');

    content.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-xl font-bold text-white mb-4">${dados ? 'Editar Missão' : 'Nova Micro Tarefa'}</h3>
            <input type="hidden" id="mis-id" value="${dados?.id || ''}">
            
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Título da Missão</label>
                    <input id="mis-title" value="${dados?.title || ''}" class="w-full p-2 rounded bg-white text-black font-bold border border-slate-700" placeholder="Ex: Verificar Fachada">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">ID Vídeo Tutorial (Veo 3)</label>
                    <input id="mis-video-id" value="${dados?.video_id || ''}" class="w-full p-2 rounded bg-white text-black font-mono text-xs border border-slate-700" placeholder="ID do YouTube">
                </div>
            </div>
            
            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Instruções para o Usuário</label>
                <textarea id="mis-desc" class="w-full p-2 rounded bg-white text-black text-sm" rows="2" placeholder="Explique o passo a passo...">${dados?.description || ''}</textarea>
            </div>
            
           <div class="p-4 bg-slate-800 rounded-2xl border border-blue-500/20 space-y-3">
                <div class="flex justify-between items-center">
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">📍 Localização Atlas Vivo</p>
                    <button onclick="window.obterLocalizacaoAutomatica()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase transition flex items-center gap-1 shadow-lg">
                        <span class="text-xs">🎯</span> Pegar GPS Atual
                    </button>
                </div>

                <div class="relative group">
                    <input type="text" id="mis-address-search" placeholder="Ou digite o endereço (Rua, Número, Cidade)..." class="w-full p-2.5 pl-9 rounded-xl bg-slate-900 text-white text-xs border border-slate-700 focus:border-blue-500 outline-none transition">
                    <span class="absolute left-3 top-2.5 text-gray-500">🔍</span>
                    <button onclick="window.converterEnderecoEmGps()" class="absolute right-2 top-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-[8px] font-bold uppercase transition">Converter</button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                    <div class="space-y-1">
                        <label class="text-[8px] text-gray-500 font-bold uppercase ml-1">Latitude</label>
                        <input id="mis-lat" value="${dados?.latitude || ''}" class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-slate-800" placeholder="0.0000">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] text-gray-500 font-bold uppercase ml-1">Longitude</label>
                        <input id="mis-lng" value="${dados?.longitude || ''}" class="w-full p-2 rounded-lg bg-slate-950 text-emerald-400 text-[10px] font-mono border border-slate-800" placeholder="0.0000">
                    </div>
                   <div class="space-y-1">
                        <label class="text-[8px] text-blue-400 font-bold uppercase ml-1">Distância Máxima (Ex: 5000 para 5km)</label>
                        <input id="mis-radius" value="${dados?.radius || 500}" type="number" class="w-full p-2 rounded-lg bg-slate-950 text-white text-[10px] font-mono border border-slate-800" placeholder="Ex: 1000">
                    </div>
                </div>
                <p class="text-[8px] text-gray-500 italic">* Se for missão online (sem local fixo), deixe Latitude e Longitude vazios.</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Valor da Recompensa</label>
                    <input type="number" id="mis-reward" value="${dados?.reward || ''}" class="w-full p-2 rounded bg-white text-black font-black text-green-700" placeholder="0.00">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Tipo de Pagamento</label>
                    <select id="mis-pay-type" class="w-full p-2 rounded bg-white text-black font-bold">
                        <option value="atlix" ${dados?.pay_type === 'atlix' ? 'selected' : ''}>🪙 ATLIX (Bônus)</option>
                        <option value="real" ${dados?.pay_type === 'real' ? 'selected' : ''}>💰 REAL (Dinheiro)</option>
                    </select>
                </div>
            </div>
            
            <button onclick="window.salvarMissao()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase shadow-lg transition transform active:scale-95">
                ${dados ? '💾 SALVAR ALTERAÇÕES' : '🚀 CRIAR MISSÃO'}
            </button>
       </div>
    `;

    // 🛰️ DESPERTADOR GOOGLE V2026: Liga o sensor 200ms após o modal abrir para garantir que o HTML exista
    setTimeout(() => {
        if (window.iniciarAutocompleteMissions) window.iniciarAutocompleteMissions();
    }, 200);
}

async function salvarMissao() {
    // Captura de IDs e Valores do Novo Formulário
    const id = document.getElementById('mis-id').value;
    const title = document.getElementById('mis-title').value;
    const desc = document.getElementById('mis-desc').value;
    const reward = document.getElementById('mis-reward').value;
    const videoId = document.getElementById('mis-video-id').value;
    
    // Captura Atlas Vivo
    const lat = document.getElementById('mis-lat').value;
    const lng = document.getElementById('mis-lng').value;
    const radius = document.getElementById('mis-radius').value;
    
    // Captura Moeda
    const payType = document.getElementById('mis-pay-type').value;

    if(!title || !reward) return alert("Erro: Título e Valor são obrigatórios.");

    // 🏗️ PAYLOAD V2026: Estrutura preparada para escala de milhões de usuários
    const payload = {
        title, 
        description: desc, 
        reward: parseFloat(reward), 
        video_id: videoId || null,
       latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        // Gil, garantimos que o raio seja lido como número inteiro puro (Metros)
        radius: radius ? Number(radius) : 50,
        pay_type: payType, // Define se paga em ATLIX ou REAL
        updated_at: serverTimestamp(), 
        active: true
    };

    try {
        if (id) {
            // EDITAR
            await updateDoc(doc(window.db, "missions", id), payload);
            alert("✅ Missão atualizada!");
        } else {
            // CRIAR
            payload.created_at = serverTimestamp();
            await addDoc(collection(window.db, "missions"), payload);
            alert("✅ Missão criada!");
        }
        
        document.getElementById('modal-editor').classList.add('hidden');
        loadMissionsManagement();
    } catch(e) { alert(e.message); }
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
           // 🚥 MOTOR DE STATUS ATLIVIO: Identifica disputas iniciadas pelo B2B
            let statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">⏳ PENDENTE</span>`;
            
            if(data.status === 'approved' || data.status === 'paid_real' || data.status === 'paid_atlix') {
                statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">✅ PAGO</span>`;
            } else if(data.status === 'rejected') {
                statusBadge = `<span class="bg-red-900 text-red-400 px-2 py-1 rounded text-[9px] uppercase border border-red-700">❌ RECUSADO</span>`;
            } else if(data.status === 'b2b_rejected') {
                // Alerta visual de disputa para o Admin intervir
                statusBadge = `<span class="bg-orange-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase animate-pulse shadow-lg">⚖️ DISPUTA B2B</span>`;
            }

          // 🚀 ULTRA-PERFORMANCE ATLIVIO: Abre a prova em nova aba para não travar o Admin
            let provaLink = '<span class="text-gray-600 text-[9px] font-bold uppercase">Sem Foto</span>';
            
            if(data.proof_url) {
                provaLink = `
                    <button onclick="window.abrirProvaNovaAba('${data.proof_url}')" class="bg-slate-800 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-2 rounded-xl border border-white/5 transition-all flex items-center gap-2 group shadow-lg">
                        <span class="text-[10px] font-black uppercase tracking-widest">Ver Evidência ↗</span>
                    </button>
                `;
            }
            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                    <td class="p-3 text-white font-bold text-sm">${data.mission_title || 'Missão'}</td>
                    <td class="p-3 text-gray-400 text-xs">${data.user_name || data.user_email || 'Usuário'}</td>
                    <td class="p-3">${provaLink}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-right">
                        ${data.status === 'pending' ? `
                            <button onclick="window.aprovarMissao('${d.id}', '${data.user_id}', ${data.reward || 0})" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold mr-2 shadow">PAGAR R$ ${data.reward}</button>
                            <button onclick="window.rejeitarMissao('${d.id}')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-[10px] font-bold shadow">RECUSAR</button>
                        ` : data.status === 'b2b_rejected' ? `
                            <div class="flex flex-col gap-1">
                                <button onclick="window.anularRecusaB2B('${d.id}', '${data.user_id}', ${data.reward || 0})" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[8px] font-black uppercase">🔓 FORÇAR PAGAMENTO</button>
                                <button onclick="window.confirmarRecusaB2B('${d.id}')" class="bg-slate-700 hover:bg-red-600 text-gray-300 px-2 py-1 rounded text-[8px] font-black uppercase">🔨 VALIDAR RECUSA</button>
                            </div>
                        ` : '<span class="text-gray-600 text-[10px]">Processado</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

// 💰 MOTOR DE LIQUIDAÇÃO UNIFICADO ATLIVIO V2026
// Esta função faz exatamente o que o B2B faz: Liquida o digital e computa o lucro.
async function aprovarMissao(docId, userId, valor) {
    try {
        const subRef = doc(window.db, "mission_submissions", docId);
        const subSnap = await getDoc(subRef);
        if (!subSnap.exists()) return alert("Erro: Envio não encontrado.");
        const data = subSnap.data();

        if(!confirm(`Confirmar PAGAMENTO ATLIX de R$ ${valor}?`)) return;

        await runTransaction(window.db, async (transaction) => {
            const userRef = doc(window.db, "usuarios", userId);
            const b2bRef = doc(window.db, "usuarios", data.b2b_owner_uid || data.owner_id);
            const statsRef = doc(window.db, "sys_finance", "stats");

            // 1. Identifica o valor TOTAL que foi preso (Recompensa + Taxa)
            const valorTotalReservado = data.unit_total_with_fee || valor; 
            const lucroAtlivio = valorTotalReservado - valor;

            // 2. Tira da CUSTÓDIA do B2B
            transaction.update(b2bRef, { 
                wallet_reserved: increment(-valorTotalReservado) 
            });

            // 3. Paga o PRESTADOR (Direto no Balance - Saldo Real)
            transaction.update(userRef, { 
                wallet_balance: increment(valor), 
                updated_at: serverTimestamp() 
            });

            // 4. Envia a TAXA para a ATLIVIO (Total Revenue)
            if (lucroAtlivio > 0) {
                transaction.update(statsRef, { 
                    total_revenue: increment(lucroAtlivio),
                    ultima_atualizacao: serverTimestamp() 
                });
            }

            // 5. Finaliza o Documento
            transaction.update(subRef, { 
                status: 'paid_real', 
                paid_at: serverTimestamp(),
                liquidacao_tipo: 'digital_direta_admin'
            });
        });

        alert("✅ PAGAMENTO REALIZADO: Crédito enviado ao prestador e taxa computada.");
        loadSubmissions();
    } catch(e) { alert("Erro na aprovação: " + e.message); }
}

async function rejeitarMissao(docId) {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected', rejected_at: serverTimestamp() });
    loadSubmissions();
}

// 🔨 MARTELO DO ADMIN: O B2B recusou, mas você achou que a prova é válida
window.anularRecusaB2B = async (docId, userId, valor) => {
    if(!confirm(`⚠️ JUSTIÇA ATLIVIO: Deseja anular a recusa do B2B e forçar o pagamento de R$ ${valor} ao usuário?`)) return;
    // Gil, ao anular, chamamos o motor de aprovação padrão que já lida com as carteiras
    await window.aprovarMissao(docId, userId, valor);
};

// 🔨 MARTELO DO ADMIN: Você analisou e concorda que a prova é RUIM (O B2B tem razão)
window.confirmarRecusaB2B = async (docId) => {
    if(!confirm("🔨 Confirmar reprovação final? O valor reservado voltará para o saldo da empresa.")) return;

    try {
        await runTransaction(window.db, async (transaction) => {
            const subRef = doc(window.db, "mission_submissions", docId);
            const subSnap = await transaction.get(subRef);
            if (!subSnap.exists()) throw "Registro não encontrado";
            const data = subSnap.data();

            // 1. Devolve o dinheiro da reserva para o saldo disponível da empresa
            if (data.b2b_owner_uid && data.reward) {
                const b2bRef = doc(window.db, "usuarios", data.b2b_owner_uid);
                transaction.update(b2bRef, { 
                    wallet_reserved: increment(-data.reward),
                    wallet_balance: increment(data.reward)
                });
            }

            // 2. Marca como reprovado permanentemente
            transaction.update(subRef, { status: 'rejected', admin_decision: 'confirmed_b2b_rejection', updated_at: serverTimestamp() });
        });
        
        alert("✅ Conflito resolvido: Dinheiro devolvido à empresa.");
        loadSubmissions();
    } catch(e) { alert("Erro ao processar resolução."); }
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
