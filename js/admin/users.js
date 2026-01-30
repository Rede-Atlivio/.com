import { collection, getDocs, doc, updateDoc, query, limit, serverTimestamp, getDoc, writeBatch, runTransaction, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users';
let selectedUsers = new Set();
let allLoadedUsers = []; 

export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    
    // Configura HTML Básico
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    const searchInput = document.getElementById('list-search'); 
    
    // Cabeçalhos
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-users-all" class="chk-custom"></th>`;
    if (viewType === 'users') {
        headers.innerHTML = `${checkHeader}<th class="p-3">IDENTIFICAÇÃO</th><th class="p-3">TIPO</th><th class="p-3">STATUS / SALDO</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.innerHTML = "+ NOVO USUÁRIO"; btnAdd.onclick = () => window.openEditor('usuarios', null); }
    } else {
        headers.innerHTML = `${checkHeader}<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.innerHTML = "+ NOVO PRESTADOR"; btnAdd.onclick = () => window.openEditor('active_providers', null); }
    }

    // --- GARANTIA DE FUNÇÕES GLOBAIS (CRUCIAL) ---
    window.openEditor = openEditor;
    window.saveAction = saveAction;
    window.saveServiceAction = saveServiceAction;
    window.openBalanceEditor = openBalanceEditor;
    window.executeAdjustment = executeAdjustment;
    window.fecharModal = fecharModal; // Nova função segura

    // Configura Busca e Bulk
    if(searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', (e) => filtrarListaLocal(e.target.value.toLowerCase()));
    }
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeUserBulkDelete;

    await loadList();
}

// FUNÇÃO SEGURA PARA FECHAR MODAL
function fecharModal() {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    modal.classList.add('hidden');
    // Destrava a tela caso tenha travado
    content.style.opacity = '1';
    content.style.pointerEvents = 'auto';
}

async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const col = currentType === 'services' ? 'active_providers' : 'usuarios';
        const q = query(collection(window.db, col), limit(100)); 
        const snap = await getDocs(q);
        allLoadedUsers = []; 

        snap.forEach(d => {
            const data = d.data();
            data.id = d.id; 
            let nomeReal = data.nome_profissional || data.displayName || data.nome || 'Desconhecido';
            data._displayName = nomeReal;
            allLoadedUsers.push(data);
        });

        countEl.innerText = `${allLoadedUsers.length} registros`;
        renderTable(allLoadedUsers);
        updateUserBulkUI();
    } catch (e) { console.error(e); }
}

function renderTable(lista) {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = "";

    lista.forEach(data => {
        const isChecked = selectedUsers.has(data.id) ? 'checked' : '';
        const checkbox = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" data-id="${data.id}" ${isChecked}></td>`;
        const avatar = data.foto_perfil || data.photoURL || `https://ui-avatars.com/api/?name=${data._displayName}&background=random`;

        if(currentType === 'users') {
            let statusBadge = `<span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-green-900 text-green-400 border border-green-800">ATIVO</span>`;
            if(data.status === 'suspenso') statusBadge = `<span class="bg-yellow-900 text-yellow-400 border border-yellow-800 px-2 py-0.5 rounded text-[9px] uppercase">⚠️ SUSPENSO</span>`;
            if(data.status === 'banido') statusBadge = `<span class="bg-red-900 text-red-400 border border-red-800 px-2 py-0.5 rounded text-[9px] uppercase">🚫 BANIDO</span>`;

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500">${data.email}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs">${data.tipo || 'Comum'}</td>
                    <td class="p-3"><div class="flex items-center gap-2">${statusBadge}<span class="text-emerald-400 font-mono text-xs">R$ ${(data.saldo||0).toFixed(2)}</span></div></td>
                    <td class="p-3 text-right">
                        <button onclick="window.openEditor('usuarios','${data.id}')" class="bg-slate-700 text-white px-3 py-1 rounded text-xs mr-1 hover:bg-slate-600">EDITAR</button>
                        <button onclick="window.openBalanceEditor('${data.id}', ${data.saldo||0}, '${data._displayName}')" class="bg-slate-700 text-emerald-400 px-2 py-1 rounded text-xs hover:bg-slate-600">💰</button>
                    </td>
                </tr>`;
        } else {
            let statusIcon = data.status === 'aprovado' ? "🟢" : (data.status === 'em_analise' ? "🟡" : "🔴");
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,20)+'...' : 'Sem bio'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${data.services?.[0]?.category || 'Geral'}</span></td>
                    <td class="p-3 text-xs font-bold text-white">${statusIcon} ${data.status?.toUpperCase()}</td>
                    <td class="p-3 text-right"><button onclick="window.openEditor('active_providers','${data.id}')" class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold shadow hover:bg-blue-500">CURADORIA</button></td>
                </tr>`;
        }
    });

    document.querySelectorAll('.chk-user').forEach(c => c.addEventListener('change', (e) => {
        if(e.target.checked) selectedUsers.add(e.target.dataset.id); else selectedUsers.delete(e.target.dataset.id);
        updateUserBulkUI();
    }));
}

async function openEditor(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    // CORREÇÃO DO "X": Força o evento de fechar
    const btnClose = document.getElementById('btn-close-modal');
    if(btnClose) btnClose.onclick = window.fecharModal;

    content.innerHTML = `<div class="p-10 text-center text-white">Carregando dados...</div>`;

    try {
        let data = {};
        if(id) {
            const snap = await getDoc(doc(window.db, realCollection, id));
            if(snap.exists()) data = snap.data();
        }
        
        let html = `<div class="space-y-4 animate-fade">`;

        // 🛡️ CURADORIA DE SERVIÇOS (CORRIGIDO)
        if (realCollection === 'active_providers' && id) {
             const servicos = data.services || [];
             html += `<div class="mb-6 border border-blue-900/50 bg-blue-900/10 p-4 rounded-xl">
                        <h4 class="text-xs font-black text-blue-300 uppercase mb-3 flex items-center gap-2">🛡️ SERVIÇOS (${servicos.length})</h4>
                        <div class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">`;
             
             if(servicos.length === 0) html += `<p class="text-gray-500 text-xs">Nenhum serviço.</p>`;

             servicos.forEach((svc, idx) => {
                 let badge = svc.status === 'aprovado' ? "✅" : "⏳";
                 html += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                            <div>
                                <p class="text-xs font-bold text-white flex items-center gap-2">${badge} ${svc.category}</p>
                                <p class="text-[10px] text-gray-400 mt-1">R$ ${svc.price}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'aprovado')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-[10px] font-bold transition">APROVAR</button>
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'suspenso')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-[10px] font-bold transition">SUSPENDER</button>
                            </div>
                        </div>`;
             });
             html += `</div></div>`;
        }

        // CAMPOS GERAIS
        const keys = ['nome', 'email', 'tipo', 'status', 'saldo']; 
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => { 
            const val = data[key] || ""; 
            html += `<div><label class="block text-[10px] text-gray-400 uppercase font-bold mb-1">${key}</label><input type="text" id="edit-${key}" value="${val}" class="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 text-sm font-bold"></div>`; 
        });
        html += `</div>`;

        // BOTÕES GLOBAIS
        html += `<div class="border-t border-slate-700 pt-6 mt-6 flex gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-xs">⛔ BANIR</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'suspenso')" class="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg font-bold text-xs">⚠️ SUSPENDER</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'aprovar')" class="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold text-xs">✅ APROVAR TUDO</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs">💾 SALVAR</button>
                 </div>`;

        html += `</div>`;
        content.innerHTML = html;

    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
}

async function saveServiceAction(id, index, status) {
    if(!confirm(`Mudar status para: ${status.toUpperCase()}?`)) return;
    
    // Bloqueia UI
    const content = document.getElementById('modal-content');
    content.style.opacity = '0.5'; content.style.pointerEvents = 'none';

    try {
        const ref = doc(window.db, "active_providers", id);
        const snap = await getDoc(ref);
        let services = snap.data().services || [];
        
        if(services[index]) {
            services[index].status = status;
            await updateDoc(ref, { services: services, updated_at: serverTimestamp() });
            
            // Envia notificação
            await addDoc(collection(window.db, "notifications"), {
                uid: id,
                message: `Seu serviço de ${services[index].category} foi atualizado para: ${status.toUpperCase()}.`,
                read: false, created_at: serverTimestamp(), type: 'system'
            });

            alert("✅ Serviço atualizado!");
            window.openEditor('active_providers', id); // Recarrega modal
        }
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        // Destrava UI
        content.style.opacity = '1'; content.style.pointerEvents = 'auto';
    }
}

async function saveAction(col, id, action) {
    try {
        let updates = { updated_at: serverTimestamp() };
        let msg = "";

        if(!id) {
            // CRIAÇÃO DE NOVO USUÁRIO
            const nome = document.getElementById('edit-nome').value;
            const email = document.getElementById('edit-email').value;
            if(!nome || !email) return alert("Preencha nome e email.");
            
            await addDoc(collection(window.db, col), { 
                nome: nome, email: email, status: 'ativo', created_at: serverTimestamp(), 
                is_demo: window.currentDataMode === 'demo', wallet_balance: 0 
            });
            alert("✅ Criado com sucesso!");
            window.fecharModal();
            return loadList();
        }

        if(action === 'banir') { updates.status = 'banido'; updates.is_online = false; msg = "Sua conta foi banida."; }
        if(action === 'suspenso') { updates.status = 'suspenso'; updates.is_online = false; msg = "Sua conta foi suspensa."; }
        if(action === 'aprovar') { updates.status = 'aprovado'; updates.is_online = true; msg = "Perfil aprovado!"; }
        
        if(action === 'salvar') {
            updates.nome = document.getElementById('edit-nome').value;
            updates.email = document.getElementById('edit-email').value;
        }

        await updateDoc(doc(window.db, col, id), updates);

        if(msg) {
            await addDoc(collection(window.db, "notifications"), {
                uid: id, message: msg, type: 'alert', read: false, created_at: serverTimestamp()
            });
        }

        alert("✅ Ação realizada!");
        window.fecharModal();
        loadList();

    } catch(e) { alert("Erro: " + e.message); }
}

// BULK & FINANCEIRO
function updateUserBulkUI() {
    const bar = document.getElementById('bulk-actions');
    if(selectedUsers.size > 0) {
        bar.classList.remove('invisible', 'translate-y-[200%]');
        document.getElementById('bulk-count').innerText = selectedUsers.size;
    } else {
        bar.classList.add('invisible', 'translate-y-[200%]');
    }
}
async function executeUserBulkDelete() {
    if(!confirm(`EXCLUIR ${selectedUsers.size} REGISTROS?`)) return;
    const batch = writeBatch(window.db);
    selectedUsers.forEach(id => batch.delete(doc(window.db, currentType === 'services' ? 'active_providers' : 'usuarios', id)));
    await batch.commit();
    alert("✅ Excluídos.");
    selectedUsers.clear();
    loadList();
}
function openBalanceEditor(uid, saldo, nome) {
    const val = prompt(`Ajustar saldo de ${nome} (Atual: ${saldo}):\nUse negativo para retirar (ex: -10)`);
    if(val) executeAdjustment(uid, parseFloat(val));
}
async function executeAdjustment(uid, val) {
    if(isNaN(val)) return;
    try {
        const ref = doc(window.db, "usuarios", uid);
        await runTransaction(window.db, async (t) => {
            const doc = await t.get(ref);
            const novo = (doc.data().saldo || 0) + val;
            t.update(ref, { saldo: novo, wallet_balance: novo });
        });
        alert("✅ Saldo atualizado.");
        loadList();
    } catch(e) { alert(e.message); }
}
function filtrarListaLocal(termo) {
    const filtrados = allLoadedUsers.filter(u => JSON.stringify(u).toLowerCase().includes(termo));
    renderTable(filtrados);
}
