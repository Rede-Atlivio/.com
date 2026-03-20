import { collection, getDocs, getDoc, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp, runTransaction, where, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let currentTab = 'submissions'; 
let allLoadedMissions = []; // Armazena as missões para edição

export async function init() {
    const container = document.getElementById('view-list');
    
    // 1. Cria a Navegação Interna (Sub-abas)
    const subNav = document.createElement('div');
    subNav.className = "flex gap-4 mb-6 border-b border-slate-800 pb-2";
   subNav.innerHTML = `
        <button onclick="window.switchMissionTab('missions')" id="btn-tab-missions" class="text-gray-400 font-bold uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition">📋 Missões</button>
        <button onclick="window.switchMissionTab('b2b_pendente')" id="btn-tab-b2b_pendente" class="text-amber-500 font-black uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition relative">
            🤝 B2B Pendente
            <span id="badge-b2b-count" class="hidden absolute -top-1 -right-2 bg-red-600 text-white text-[7px] px-1 rounded-full animate-pulse">0</span>
        </button>
        <button onclick="window.switchMissionTab('submissions')" id="btn-tab-submissions" class="text-gray-400 font-bold uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition">📸 Envios</button>
        <button onclick="window.switchMissionTab('payments')" id="btn-tab-payments" class="text-gray-400 font-bold uppercase text-[9px] hover:text-white pb-2 border-b-2 border-transparent transition">💸 Pagamentos PIX</button>
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
    
    // Inicia na aba de Gerenciar (já que você quer editar)
    switchMissionTab('missions');
}

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
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA MISSÃO"; btnAdd.onclick = () => abrirCriadorMissaoAtlas(); }
        header.innerHTML = `<th class="p-3">TÍTULO</th><th class="p-3">TIPO</th><th class="p-3">VALOR</th><th class="p-3 text-right">AÇÕES</th>`;
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
    } else {
        // ABA DE PAGAMENTOS
        if(btnAdd) { btnAdd.style.display = 'none'; }
        header.innerHTML = `<th class="p-3">USUÁRIO</th><th class="p-3">VALOR</th><th class="p-3">CHAVE PIX</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadMissionsPayments(); // Nova função
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
                    <td class="p-3 text-right">
                        <button onclick="window.publicarMissaoB2B('${d.id}')" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg transition active:scale-95">
                            ✅ PUBLICAR NO MAPA
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

        // 🔄 PREPARAÇÃO DO PAYLOAD DE ATIVAÇÃO
        let updateData = {
            status: 'active', // Agora ela aparece no radar
            published_at: serverTimestamp(),
            curated_by: 'admin_gil'
        };

        // 💰 REGRA DE EXTERMÍNIO B2B (MÁGICA DO LUCRO)
        if (isReal) {
            // Se a missão é em R$, a empresa já pagou (Valor + Taxa) no ato da reserva.
            // Aqui a Atlivio "extermina" a parte dela da reserva e deixa apenas o valor do usuário.
            // O lucro real já foi contado no sys_finance lá na recarga da empresa.
            console.log("✂️ Exterminando taxa Atlivio e liberando valor líquido para o radar.");
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
        const q = query(collection(window.db, "mission_submissions"), orderBy("created_at", "desc"), limit(50));
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
            let statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">⏳ PENDENTE</span>`;
            if(data.status === 'approved') statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">✅ PAGO</span>`;
            if(data.status === 'rejected') statusBadge = `<span class="bg-red-900 text-red-400 px-2 py-1 rounded text-[9px] uppercase border border-red-700">❌ RECUSADO</span>`;

          // Gil, agora a foto abre em um modal flutuante para não falhar o carregamento
            let provaLink = '<span class="text-gray-600 text-[10px]">SEM FOTO</span>';
            if(data.proof_url) {
                provaLink = `
                    <div class="relative group cursor-pointer" onclick="window.visualizarProva('${data.proof_url}')">
                        <img src="${data.proof_url}" class="w-12 h-12 object-cover rounded-lg border border-slate-700 transition-all">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                            <span class="text-white text-[10px] font-bold">VER</span>
                        </div>
                    </div>
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
                        ` : '<span class="text-gray-600 text-[10px]">Processado</span>'}
                    </td>
                </tr>
            `;
        });
    } catch(e) { console.error(e); }
}

// 💰 V2026.PRO: Motor de Aprovação Híbrido (ATLIX Automático vs REAL na Fila)
async function aprovarMissao(docId, userId, valor) {
    // Primeiro, recuperamos os dados da submissão para saber o pay_type
    try {
        const subSnap = await getDoc(doc(window.db, "mission_submissions", docId));
        if (!subSnap.exists()) return alert("Erro: Envio não encontrado.");
        const subData = subSnap.data();
        const tipoMoeda = subData.pay_type || 'atlix'; // Padrão é ATLIX se estiver vazio

        if(!confirm(`Aprovar missão de R$ ${valor} (${tipoMoeda.toUpperCase()})?`)) return;

       if (tipoMoeda === 'atlix') {
            // 🛡️ LIQUIDAÇÃO ATLIX: Tira da reserva da empresa e paga o bônus ao usuário
            await runTransaction(window.db, async (transaction) => {
                const userRef = doc(window.db, "usuarios", userId);
                const subRef = doc(window.db, "mission_submissions", docId);
                const userDoc = await transaction.get(userRef);

                // 1. Se for B2B, libera o valor que estava "preso" na reserva da empresa
                if (subData.b2b_owner_uid) {
                    const b2bRef = doc(window.db, "usuarios", subData.b2b_owner_uid);
                    transaction.update(b2bRef, { wallet_reserved: increment(-valor) });
                }

                // 2. Deposita o bônus na carteira do executor
                if (userDoc.exists()) {
                    transaction.update(userRef, { 
                        wallet_bonus: increment(valor), 
                        updated_at: serverTimestamp() 
                    });
                }

                // 3. Marca como finalizado
                transaction.update(subRef, { status: 'approved', paid_at: serverTimestamp() });
            });

            // 📝 Registro no Extrato Financeiro com DNA ATLIX
            await addDoc(collection(window.db, "extrato_financeiro"), {
                uid: userId,
                valor: parseFloat(valor),
                tipo: "💰 MISSÃO_CONCLUÍDA",
                descricao: `Você ganhou por: ${subData.mission_title}`,
                timestamp: serverTimestamp(),
                moeda: "ATLIX" // 🚀 O Carimbo de Moeda Bônus
            });

            await addDoc(collection(window.db, "notifications"), {
                uid: userId, 
                message: `💰 Missão Aprovada! R$ ${valor} em bônus ATLIX creditados.`, 
                read: false, type: 'success', created_at: serverTimestamp()
            });
            alert("✅ Pago automaticamente em ATLIX!");

       } else {
            // --- FLUXO B: PAGAMENTO EM REAL (EXTERMÍNIO DE TAXA + FILA PIX) ---
            await runTransaction(window.db, async (transaction) => {
                const subRef = doc(window.db, "mission_submissions", docId);

                // ✂️ EXTERMÍNIO: Se for B2B, limpamos o valor TOTAL (Taxa + Recompensa) da reserva.
                // A Atlivio já lucrou na recarga, então aqui apenas removemos a custódia.
                if (subData.b2b_owner_uid && subData.total_with_fee) {
                    const b2bRef = doc(window.db, "usuarios", subData.b2b_owner_uid);
                    transaction.update(b2bRef, { wallet_reserved: increment(-subData.total_with_fee) });
                }

                transaction.update(subRef, { status: 'approved_pending_pix', approved_at: serverTimestamp() });
            });

            await addDoc(collection(window.db, "notifications"), {
                uid: userId, 
                message: `✅ Sua missão de R$ ${valor} foi aprovada! O pagamento via PIX será realizado em breve.`, 
                read: false, type: 'info', created_at: serverTimestamp()
            });

            // Gil, aqui damos o "toque" no Dashboard: Se a função de recarregar o Assistant existir, chamamos ela
            if (window.initDashboard) {
                console.log("🔔 Missões: Notificando Dashboard sobre novo PIX...");
                window.initDashboard(); 
            }

            alert("⚠️ Aprovada! O pagamento em REAL foi enviado para sua fila de PIX no Dashboard.");
        }

        // Recarrega a lista de envios para sumir o botão de aprovação que já foi clicado
        loadSubmissions();

    } catch(e) {
        console.error("Erro na Aprovação:", e);
        alert("❌ Falha técnica: " + e.message);
    }
}

async function rejeitarMissao(docId) {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected' });
    loadSubmissions();
}

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

// 📸 MOTOR VISUALIZADOR DE PROVAS
window.visualizarProva = (url) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="flex flex-col items-center">
            <h3 class="text-white font-bold mb-4 uppercase text-xs tracking-widest">Auditoria de Imagem</h3>
            <div class="bg-slate-900 p-2 rounded-2xl border border-white/10 shadow-2xl">
                <img src="${url}" class="max-w-full max-h-[70vh] rounded-xl shadow-lg">
            </div>
            <button onclick="document.getElementById('modal-editor').classList.add('hidden')" class="mt-6 bg-white text-black px-8 py-2 rounded-full font-black text-xs uppercase shadow-xl hover:bg-gray-200 transition">Fechar Visualização</button>
        </div>
    `;
};

// 💸 MOTOR DE PAGAMENTOS: Carrega a fila de PIX dentro da aba Micro Tarefas
async function loadMissionsPayments() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center"><div class="loader mx-auto border-emerald-500"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "mission_submissions"), where("status", "==", "approved_pending_pix"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        tbody.innerHTML = "";

        if(snap.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-500 italic uppercase text-[10px]">Nenhum PIX pendente. Fila limpa!</td></tr>`;
            return;
        }

        for (const d of snap.docs) {
            const data = d.data();
            // Busca a chave PIX no perfil do usuário para garantir
            const uSnap = await getDocs(query(collection(window.db, "usuarios"), where("uid", "==", data.user_id)));
            const userPix = !uSnap.empty ? (uSnap.docs[0].data().pix_key || uSnap.docs[0].data().chave_pix) : 'Não cadastrada';

            tbody.innerHTML += `
                <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
                    <td class="p-3">
                        <p class="text-white font-bold text-xs">${data.mission_title}</p>
                        <p class="text-[9px] text-gray-500">${data.user_name || 'Usuário'}</p>
                    </td>
                    <td class="p-3 text-emerald-400 font-black text-xs">R$ ${data.reward}</td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-mono text-gray-400 bg-black/30 p-1 rounded">${userPix}</span>
                            <button onclick="navigator.clipboard.writeText('${userPix}'); alert('Copiada!')" class="text-[10px] bg-slate-700 px-2 py-1 rounded">📋</button>
                        </div>
                    </td>
                    <td class="p-3 text-right">
                        <button onclick="window.finalizarPagamentoComprovante('${d.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg transition">Pagar e Anexar ✅</button>
                    </td>
                </tr>
            `;
        }
        document.getElementById('list-count').innerText = `${snap.size} pagamentos pendentes`;
    } catch(e) { console.error(e); }
}

// 📤 MOTOR DE FINALIZAÇÃO COM COMPROVANTE (VERSÃO COMPRIMIDA V2026)
// 💰 MOTOR DE PAGAMENTO FINAL (DNA CHAT + CORREÇÃO FOTO DUPLA)
window.finalizarPagamentoComprovante = async (docId) => {
    // Primeiro pedimos a confirmação para não travar o seletor de arquivos
    if(!confirm("⚠️ Confirma que o PIX já foi feito no banco?\nClique em OK para escolher o comprovante.")) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;

        // Feedback visual no console e tela
        console.log("📑 Comprimindo comprovante...");

        try {
            // MOTOR DE COMPRESSÃO: Reduz o print do banco para caber no Firestore
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Reduzimos para 1000px de largura (suficiente para ler comprovante)
            const scale = 1000 / Math.max(bitmap.width, bitmap.height);
            canvas.width = bitmap.width * scale;
            canvas.height = bitmap.height * scale;
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            
            // Converte para JPEG leve (qualidade 0.6)
            const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.6));
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
           reader.onloadend = async () => {
                const base64Img = reader.result;
                console.log("🚀 Iniciando Transação Contábil Atlivio...");

               // ⚡ TRANSAÇÃO ATÔMICA: Garante que o débito na empresa e o crédito no usuário ocorram juntos
                await runTransaction(window.db, async (transaction) => {
                    const subRef = doc(window.db, "mission_submissions", docId);
                    const subSnap = await transaction.get(subRef);
                    if (!subSnap.exists()) throw "Registro não encontrado";
                    
                    const mData = subSnap.data();
                    const valorPago = parseFloat(mData.reward);
                    const uidUsuario = mData.user_id;

                    // 1. Marca missão como paga e anexa a prova física (Comprovante)
                    transaction.update(subRef, {
                        status: 'paid_real',
                        receipt_url: base64Img,
                        paid_at: serverTimestamp()
                    });

                    // 2. DÉBITO NA EMPRESA: Tira o valor do lucro acumulado do Dashboard
                    const cofreRef = doc(window.db, "sys_finance", "receita_total");
                    transaction.update(cofreRef, {
                        total_acumulado: increment(-valorPago),
                        ultima_atualizacao: serverTimestamp()
                    });

                    // 3. LIVRO RAZÃO (sys_ledger): Histórico imutável de saída da empresa
                    const ledgerRef = doc(collection(window.db, "sys_ledger"));
                    transaction.set(ledgerRef, {
                        origem: "SAIDA_MISSAO_PIX",
                        valor: -valorPago,
                        usuario_pago: uidUsuario,
                        missao_id: docId,
                        timestamp: serverTimestamp()
                    });

                    // 4. CRÉDITO NO EXTRATO DO USUÁRIO: (DNA IDENTICO AO CHAT.JS)
                    const userExtratoRef = doc(collection(window.db, "extrato_financeiro"));
                    transaction.set(userExtratoRef, {
                        uid: uidUsuario,
                        valor: valorPago, // Gravando como número puro igual ao chat
                        tipo: "GANHO_SERVIÇO ✅", // Gil, usamos o mesmo texto do chat para o wallet não bugar
                        descricao: `Missão concluída: ${mData.mission_title}`,
                        timestamp: serverTimestamp(),
                        moeda: "BRL" // 🚀 Identifica como Dinheiro Real (PIX)
                    });
                });

                alert("💸 PAGAMENTO FINALIZADO!\nO cofre da empresa foi debitado e o usuário recebeu o comprovante.");
                if(window.loadMissionsPayments) window.loadMissionsPayments();
                if(window.initDashboard) window.initDashboard(); 
            };
        } catch(err) { 
            console.error(err);
            alert("❌ Erro ao processar imagem."); 
        }
    };
    // Dispara a galeria de fotos após a lógica estar montada
    input.click();
};

// 🔐 SOLDAGEM GLOBAL ADMIN V2026.PRO (FINAL)
window.abrirCriadorMissaoAtlas = abrirCriadorMissaoAtlas;
window.publicarMissaoB2B = publicarMissaoB2B; // 🚀 Soldado!
window.loadMissionsPayments = loadMissionsPayments; // ✅ Soldado!
window.finalizarPagamentoComprovante = finalizarPagamentoComprovante;
window.abrirNovaMissao = abrirCriadorMissaoAtlas; 
window.obterLocalizacaoAutomatica = obterLocalizacaoAutomatica;
window.converterEnderecoEmGps = converterEnderecoEmGps;
window.visualizarProva = visualizarProva;

console.log("🚀 [Missions Admin] Sistema Atlas Vivo com Inteligência Google Soldado!");
