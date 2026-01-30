import { collection, getDocs, doc, updateDoc, query, limit, serverTimestamp, getDoc, writeBatch, runTransaction, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users';
let selectedUsers = new Set();
let allLoadedUsers = []; 

export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    updateUserBulkUI();

    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    const searchInput = document.getElementById('list-search'); 
    
    // Configura Cabeçalho
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-users-all" class="chk-custom"></th>`;
    if (viewType === 'users') {
        headers.innerHTML = `${checkHeader}<th class="p-3">IDENTIFICAÇÃO</th><th class="p-3">TIPO</th><th class="p-3">STATUS / SALDO</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO USUÁRIO";
    } else {
        headers.innerHTML = `${checkHeader}<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO PRESTADOR";
    }

    // EXPORTA FUNÇÕES GLOBAIS
    window.openEditor = openEditor;
    window.saveAction = saveAction;
    window.saveServiceAction = saveServiceAction;
    window.openBalanceEditor = openBalanceEditor;
    window.setTransactionMode = setTransactionMode;
    window.executeAdjustment = executeAdjustment;

    if(btnAdd) btnAdd.onclick = () => window.openEditor(viewType, null);
    
    // Busca e Bulk
    if(searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', (e) => filtrarListaLocal(e.target.value.toLowerCase()));
    }
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeUserBulkDelete;
    
    setTimeout(() => {
        const chkAll = document.getElementById('check-users-all');
        if(chkAll) chkAll.addEventListener('change', (e) => toggleUserSelectAll(e.target.checked));
    }, 500);

    await loadList();
}

async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        const col = currentType === 'users' ? 'usuarios' : 'active_providers';
        const q = query(collection(db, col), limit(100)); 
        const snap = await getDocs(q);
        allLoadedUsers = []; 

        snap.forEach(d => {
            const data = d.data();
            data.id = d.id; 
            let nomeReal = data.nome_profissional || data.displayName || data.nome || (data.email ? data.email.split('@')[0] : 'Desconhecido');
            data._displayName = nomeReal.charAt(0).toUpperCase() + nomeReal.slice(1);
            allLoadedUsers.push(data);
        });

        countEl.innerText = `${allLoadedUsers.length} registros`;
        renderTable(allLoadedUsers);
    } catch (e) { console.error(e); }
}

function renderTable(lista) {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = "";

    lista.forEach(data => {
        const isChecked = selectedUsers.has(data.id) ? 'checked' : '';
        const checkbox = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" data-id="${data.id}" ${isChecked}></td>`;
        const avatarImg = data.foto_perfil || data.photoURL || `https://ui-avatars.com/api/?name=${data._displayName}&background=random`;

        if(currentType === 'users') {
            // TABELA USUÁRIOS: Re-adicionado Saldo e Botões
            let statusClass = "text-green-400 border-green-500/50 bg-green-500/10";
            if(data.status === 'banido') statusClass = "text-red-400 border-red-500/50 bg-red-500/10";
            
            const saldo = parseFloat(data.saldo || 0);
            const saldoClass = saldo < 0 ? 'text-red-400' : 'text-emerald-400';

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500 font-mono">${data.email || '...'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs uppercase font-bold tracking-wider">${data.tipo || 'comum'}</td>
                    <td class="p-3"><div class="flex items-center gap-2"><span class="border ${statusClass} px-2 py-0.5 rounded text-[9px] uppercase font-bold">${data.status||'Ativo'}</span><span class="font-mono text-xs font-bold ${saldoClass}">R$ ${saldo.toFixed(2)}</span></div></td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition">
                        <button onclick="window.openEditor('users','${data.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold mr-1 transition">EDITAR</button>
                        <button onclick="window.openBalanceEditor('${data.id}', ${saldo}, '${data._displayName}')" class="bg-slate-700 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold transition" title="Financeiro">💰</button>
                    </td>
                </tr>`;
        } else {
            // TABELA PRESTADORES
            let statusIcon = data.is_online ? "🟢" : "⚫";
            let statusLabel = data.status || "Novo";
            if(data.status === 'em_analise') { statusIcon = "🟡"; statusLabel = "EM ANÁLISE"; }
            
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,25)+'...' : 'Sem bio'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${data.services?.[0]?.category || 'Geral'}</span></td>
                    <td class="p-3 text-xs font-bold text-white flex items-center gap-2 mt-2"><span>${statusIcon}</span> ${statusLabel.toUpperCase()}</td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition"><button onclick="window.openEditor('active_providers','${data.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold shadow">CURADORIA</button></td>
                </tr>`;
        }
    });
    
    // Re-bind checkboxes
    document.querySelectorAll('.chk-user').forEach(c => c.addEventListener('change', (e) => toggleUserItem(e.target.dataset.id, e.target.checked)));
}

async function openEditor(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = `<div class="p-10 text-center text-white">Carregando...</div>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4 animate-fade">`;

        // BLOCO CURADORIA
        if (realCollection === 'active_providers' && id) {
             const servicos = data.services || [];
             html += `<div class="mb-6"><h4 class="text-xs font-black text-blue-300 uppercase mb-2 border-b border-blue-900 pb-1">🛡️ Curadoria (${servicos.length})</h4><div class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">`;
             servicos.forEach((svc, idx) => {
                 let badge = svc.status === 'aprovado' ? "✅" : "⏳";
                 html += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-start">
                            <div><p class="text-xs font-bold text-white">${badge} ${svc.category}</p><p class="text-[10px] text-emerald-400 font-mono mt-1">R$ ${svc.price}</p></div>
                            <div class="flex gap-1">
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'aprovado')" class="bg-green-900/40 border border-green-800 text-white p-1.5 rounded text-[9px] font-bold hover:bg-green-600">✅</button>
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'suspenso')" class="bg-red-900/40 border border-red-800 text-white p-1.5 rounded text-[9px] font-bold hover:bg-red-600">🚫</button>
                            </div>
                        </div>`;
             });
             html += `</div></div>`;
        }

        // BLOCO CAMPOS GERAIS
        const keys = ['nome', 'email', 'tipo', 'status', 'saldo']; 
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => { 
            const val = data[key] || ""; 
            html += `<div><label class="block text-[10px] text-gray-400 uppercase font-bold mb-1">${key}</label><input type="text" id="edit-${key}" value="${val}" class="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 text-sm font-bold"></div>`; 
        });
        html += `</div>`;

        // BOTÕES DE AÇÃO
        html += `<div class="border-t border-slate-700 pt-6 mt-6 flex gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-xs">⛔ BANIR</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'suspenso')" class="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-lg font-bold text-xs">⚠️ SUSPENDER</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs">💾 SALVAR</button>
                 </div>`;
        html += `</div>`;
        content.innerHTML = html;

    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
}

async function saveServiceAction(id, index, status) {
    if(!confirm(`Definir status como: ${status.toUpperCase()}?`)) return;
    const modalContent = document.getElementById('modal-content');
    modalContent.style.opacity = '0.5'; 
    modalContent.style.pointerEvents = 'none'; // Trava

    try {
        const ref = doc(window.db, "active_providers", id);
        const snap = await getDoc(ref);
        let services = snap.data().services || [];
        if (services[index]) services[index].status = status;
        
        await updateDoc(ref, { services: services, updated_at: serverTimestamp() });
        // Se aprovou serviço, aprova a conta também (opcional)
        if(status === 'aprovado') await updateDoc(ref, { status: 'aprovado' });

        alert("✅ Atualizado!");
        window.openEditor('active_providers', id);
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        // DESTRAVA A TELA SEMPRE
        modalContent.style.opacity = '1';
        modalContent.style.pointerEvents = 'auto';
    }
}

// RESTANTE DAS FUNÇÕES (Bulk, Financeiro)
function toggleUserSelectAll(checked) { document.querySelectorAll('.chk-user').forEach(c => { c.checked = checked; toggleUserItem(c.dataset.id, checked); }); }
function toggleUserItem(id, selected) { if(selected) selectedUsers.add(id); else selectedUsers.delete(id); updateUserBulkUI(); }
function updateUserBulkUI() { const bar = document.getElementById('bulk-actions'); const count = document.getElementById('bulk-count'); if(selectedUsers.size > 0) { bar.classList.remove('invisible', 'translate-y-[200%]'); if(count) count.innerText = selectedUsers.size; } else { bar.classList.add('invisible', 'translate-y-[200%]'); } }
async function executeUserBulkDelete() { if(!confirm(`EXCLUIR ${selectedUsers.size} REGISTROS?`)) return; try { const batch = writeBatch(window.db); const col = currentType === 'users' ? 'usuarios' : 'active_providers'; selectedUsers.forEach(id => batch.delete(doc(window.db, col, id))); await batch.commit(); selectedUsers.clear(); updateUserBulkUI(); await loadList(); alert("✅ Excluídos!"); } catch(e) { alert(e.message); } }

// FINANCEIRO (Re-adicionado)
function openBalanceEditor(uid, currentBalance, nomeUser) { const modal = document.getElementById('modal-editor'); const content = document.getElementById('modal-content'); modal.classList.remove('hidden'); content.innerHTML = `<div class="p-6 text-center text-white"><h2 class="text-2xl font-bold mb-4">R$ ${currentBalance.toFixed(2)}</h2><div class="flex gap-2"><input type="number" id="trans-amount" class="w-full p-2 text-black rounded" placeholder="Valor"><button onclick="window.executeAdjustment('${uid}')" class="bg-green-600 px-4 py-2 rounded font-bold">CONFIRMAR</button></div></div>`; window.tempTransMode = 'credit'; }
async function executeAdjustment(uid) { const val = parseFloat(document.getElementById('trans-amount').value); if(!val) return; try { await updateDoc(doc(window.db, 'usuarios', uid), { saldo: val }); alert("Saldo atualizado!"); document.getElementById('modal-editor').classList.add('hidden'); loadList(); } catch(e) { alert(e.message); } }
async function saveAction(col, id, act) { if(act==='banir') await updateDoc(doc(window.db, col, id), {status: 'banido'}); if(act==='salvar') { const val = document.getElementById('edit-nome').value; await updateDoc(doc(window.db, col, id), {nome: val}); } document.getElementById('modal-editor').classList.add('hidden'); loadList(); }
