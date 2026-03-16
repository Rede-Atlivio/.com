import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp, runTransaction, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentTab = 'submissions'; 
let allLoadedMissions = []; // Armazena as missões para edição

export async function init() {
    const container = document.getElementById('view-list');
    
    // 1. Cria a Navegação Interna (Sub-abas)
    const subNav = document.createElement('div');
    subNav.className = "flex gap-4 mb-6 border-b border-slate-800 pb-2";
    subNav.innerHTML = `
        <button onclick="window.switchMissionTab('missions')" id="btn-tab-missions" class="text-gray-400 font-bold uppercase text-xs hover:text-white pb-2 border-b-2 border-transparent transition">📋 Gerenciar Missões</button>
        <button onclick="window.switchMissionTab('submissions')" id="btn-tab-submissions" class="text-blue-500 font-bold uppercase text-xs hover:text-white pb-2 border-b-2 border-blue-500 transition">💰 Analisar Envios</button>
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
    const btnMissions = document.getElementById('btn-tab-missions');
    const btnSubs = document.getElementById('btn-tab-submissions');
    const btnAdd = document.getElementById('btn-list-add');
    const header = document.getElementById('list-header');

    if(tab === 'missions') {
        btnMissions.className = "text-blue-500 font-bold uppercase text-xs pb-2 border-b-2 border-blue-500 transition";
        btnSubs.className = "text-gray-400 font-bold uppercase text-xs pb-2 border-b-2 border-transparent transition";
        
        if(btnAdd) { 
            btnAdd.style.display = 'block'; 
            btnAdd.innerHTML = "+ NOVA MISSÃO"; 
            btnAdd.onclick = () => abrirNovaMissao(); // Limpa para criar nova
        }
        header.innerHTML = `<th class="p-3">TÍTULO</th><th class="p-3">TIPO</th><th class="p-3">VALOR</th><th class="p-3 text-right">AÇÕES</th>`;
        await loadMissionsManagement();
    } else {
        btnMissions.className = "text-gray-400 font-bold uppercase text-xs pb-2 border-b-2 border-transparent transition";
        btnSubs.className = "text-blue-500 font-bold uppercase text-xs pb-2 border-b-2 border-blue-500 transition";
        
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

// ✅ FUNÇÃO DE PREPARAÇÃO PARA EDIÇÃO
function editarMissao(id) {
    const mission = allLoadedMissions.find(m => m.id === id);
    if(mission) {
        abrirNovaMissao(mission);
    }
}

function abrirNovaMissao(dados = null) {
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
            
            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Título</label>
                <input id="mis-title" value="${dados?.title || ''}" class="w-full p-3 rounded bg-white text-black font-bold" placeholder="Ex: Seguir no Instagram">
            </div>
            
            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Descrição / Instruções</label>
                <textarea id="mis-desc" class="w-full p-3 rounded bg-white text-black" rows="3" placeholder="Explique o que fazer...">${dados?.description || ''}</textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Recompensa (R$)</label>
                    <input type="number" id="mis-reward" value="${dados?.reward || ''}" class="w-full p-3 rounded bg-white text-black font-bold text-green-700" placeholder="0.50">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Tipo de Prova</label>
                    <select id="mis-type" class="w-full p-3 rounded bg-white text-black">
                        <option value="screenshot" ${dados?.type === 'screenshot' ? 'selected' : ''}>📸 Print / Foto</option>
                        <option value="video" ${dados?.type === 'video' ? 'selected' : ''}>🎥 Vídeo</option>
                        <option value="text" ${dados?.type === 'text' ? 'selected' : ''}>📝 Texto / Link</option>
                    </select>
                </div>
            </div>
            
            <button onclick="window.salvarMissao()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase shadow-lg transition transform active:scale-95">
                ${dados ? '💾 SALVAR ALTERAÇÕES' : '🚀 CRIAR MISSÃO'}
            </button>
        </div>
    `;
}

async function salvarMissao() {
    const id = document.getElementById('mis-id').value;
    const title = document.getElementById('mis-title').value;
    const desc = document.getElementById('mis-desc').value;
    const reward = document.getElementById('mis-reward').value;
    const type = document.getElementById('mis-type').value;

    if(!title || !reward) return alert("Preencha título e valor.");

    const payload = {
        title, description: desc, reward: parseFloat(reward), type,
        updated_at: serverTimestamp(), active: true
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

            let provaLink = '<span class="text-gray-600 text-xs">Sem anexo</span>';
            if(data.proof_url || data.photo_url) {
                provaLink = `<a href="${data.proof_url || data.photo_url}" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline flex items-center gap-1">👁️ Ver Prova</a>`;
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

// 💰 V2026: Motor de Aprovação e Pagamento Híbrido (Real -> ATLIX)
async function aprovarMissao(docId, userId, valor) {
    if(!confirm(`Aprovar missão e pagar R$ ${valor} em ATLIX?`)) return;
    
    try {
        // 1. Marca a submissão como aprovada no banco de auditoria
        await updateDoc(doc(window.db, "mission_submissions", docId), { 
            status: 'approved',
            paid_at: serverTimestamp() 
        });

        // 2. Aciona o Cofre de Bônus (ATLIX) via Wallet Module
        // Gil, aqui usamos a função que você já "commitou" no wallet.js
        if (window.receberRecompensaMissao) {
            await window.receberRecompensaMissao(valor, "Missão Aprovada pelo Admin");
        } else {
            throw new Error("Motor Financeiro (Wallet) não carregado no Admin.");
        }

        // 3. Dispara Notificação Oficial para o Usuário
        await addDoc(collection(window.db, "notifications"), {
            uid: userId, 
            message: `💰 Missão Aprovada! R$ ${valor.toFixed(2).replace('.',',')} em bônus ATLIX foram adicionados à sua carteira.`, 
            read: false, 
            type: 'success', 
            created_at: serverTimestamp()
        });

        alert("✅ Pagamento ATLIX processado com sucesso!");
        loadSubmissions(); // Recarrega a lista para mostrar o novo status

    } catch(e) { 
        console.error("Erro no Payout:", e);
        alert("❌ Erro ao processar pagamento: " + e.message); 
    }
}

async function rejeitarMissao(docId) {
    if(!confirm("Rejeitar esta missão?")) return;
    await updateDoc(doc(window.db, "mission_submissions", docId), { status: 'rejected' });
    loadSubmissions();
}
