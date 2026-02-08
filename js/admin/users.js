import { collection, getDocs, doc, updateDoc, query, limit, serverTimestamp, getDoc, writeBatch, runTransaction, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users';
let selectedUsers = new Set();
let allLoadedUsers = []; 

export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    const searchInput = document.getElementById('list-search'); 
    
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-users-all" class="chk-custom"></th>`;
    if (viewType === 'users') {
        headers.innerHTML = `${checkHeader}<th class="p-3">IDENTIFICAÇÃO</th><th class="p-3">TIPO</th><th class="p-3">STATUS / SALDO</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.innerHTML = "+ NOVO USUÁRIO"; btnAdd.onclick = () => window.openEditor('usuarios', null); }
    } else {
        headers.innerHTML = `${checkHeader}<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.innerHTML = "+ NOVO PRESTADOR"; btnAdd.onclick = () => window.openEditor('active_providers', null); }
    }

    // ✅ RESTAURADO: Exportações Globais essenciais
    window.openEditor = openEditor;
    window.saveAction = saveAction;
    window.saveServiceAction = saveServiceAction;
    window.abrirModalMassa = abrirModalMassa;
    window.enviarMassaConfirmado = enviarMassaConfirmado;

    if(searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', (e) => filtrarListaLocal(e.target.value.toLowerCase()));
    }
    
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) {
        btnBulk.innerHTML = `<i data-lucide="zap"></i> AÇÕES EM MASSA`;
        btnBulk.onclick = abrirModalMassa;
    }

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
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500 font-mono">${data.email || '...'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs uppercase font-bold tracking-wider">${data.tipo || 'comum'}</td>
                   <td class="p-3"><div class="flex items-center gap-2">${statusBadge}<span class="text-emerald-400 font-mono text-xs">R$ ${Number(data.wallet_balance ?? data.saldo ?? 0).toFixed(2)}</span></div></td>
                    <td class="p-3 text-right">
                        <button onclick="window.openEditor('usuarios','${data.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold mr-1">EDITAR</button>
                        </td>
                </tr>`;
        } else {
            let statusIcon = data.status === 'aprovado' ? "🟢" : (data.status === 'em_analise' ? "🟡" : "🔴");
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,25)+'...' : 'Sem bio'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${data.services?.[0]?.category || 'Geral'}</span></td>
                    <td class="p-3 text-xs font-bold text-white">${statusIcon} ${data.status?.toUpperCase()}</td>
                    <td class="p-3 text-right"><button onclick="window.openEditor('active_providers','${data.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold shadow">CURADORIA</button></td>
                </tr>`;
        }
    });
    document.querySelectorAll('.chk-user').forEach(c => c.addEventListener('change', (e) => {
        if(e.target.checked) selectedUsers.add(e.target.dataset.id); else selectedUsers.delete(e.target.dataset.id);
        updateUserBulkUI();
    }));
}

// ✅ RESTAURADO: Curadoria e Editor
async function openEditor(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    try {
        let data = {};
        if (id) {
            const snap = await getDoc(doc(window.db, collectionName, id));
            if (snap.exists()) data = snap.data();
        }
        let html = `<div class="space-y-4 animate-fade">`;
        if (collectionName === 'active_providers' && id) {
             const servicos = data.services || [];
             html += `<div class="mb-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <h4 class="text-xs font-black text-blue-300 uppercase mb-3">🛡️ SERVIÇOS (${servicos.length})</h4>
                        <div class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">`;
             servicos.forEach((svc, idx) => {
                 let badge = svc.status === 'aprovado' ? "✅" : "⏳";
                 html += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                            <div>
                                <p class="text-xs font-bold text-white flex items-center gap-2">${badge} ${svc.category}</p>
                                <p class="text-[10px] text-gray-400 mt-1">R$ ${svc.price}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'aprovado')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-[10px] font-bold">APROVAR</button>
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'suspenso')" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-[10px] font-bold">SUSPENDER</button>
                            </div>
                        </div>`;
             });
             html += `</div></div>`;
        }
        const keys = ['nome', 'email', 'status']; 
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => { 
            const val = data[key] || data.displayName || ""; 
            html += `<div><label class="block text-[10px] text-gray-400 uppercase font-bold mb-1">${key}</label><input type="text" id="edit-${key}" value="${val}" class="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 text-sm font-bold"></div>`; 
        });
        html += `</div><div class="border-t border-slate-700 pt-6 mt-6 flex gap-3">
                    <button onclick="window.saveAction('${collectionName}', '${id}', 'banir')" class="flex-1 bg-red-600 text-white py-3 rounded text-xs font-bold">⛔ BANIR</button>
                    <button onclick="window.saveAction('${collectionName}', '${id}', 'suspenso')" class="flex-1 bg-yellow-600 text-white py-3 rounded text-xs font-bold">⚠️ SUSPENDER</button>
                    <button onclick="window.saveAction('${collectionName}', '${id}', 'aprovar')" class="flex-1 bg-green-600 text-white py-3 rounded text-xs font-bold">✅ APROVAR</button>
                 </div></div>`;
        content.innerHTML = html;
    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
}

async function saveServiceAction(id, index, status) {
    if(!confirm(`Mudar status para ${status.toUpperCase()}?`)) return;
    try {
        const ref = doc(window.db, "active_providers", id);
        const snap = await getDoc(ref);
        let services = snap.data().services;
        if(services && services[index]) {
            services[index].status = status;
            await updateDoc(ref, { services: services, updated_at: serverTimestamp() });
            let type = status === 'aprovado' ? 'success' : 'alert';
            await addDoc(collection(window.db, "notifications"), {
                uid: id, message: `Seu serviço de ${services[index].category} foi atualizado para: ${status.toUpperCase()}.`,
                read: false, created_at: serverTimestamp(), type: type
            });
            alert("✅ Serviço atualizado!");
            window.openEditor('active_providers', id);
        }
    } catch(e) { alert(e.message); }
}

async function saveAction(col, id, action) {
    let updates = { updated_at: serverTimestamp() };
    let msg = "";
    if(!id) {
        const nome = document.getElementById('edit-nome').value;
        const email = document.getElementById('edit-email').value;
        if(!nome || !email) return alert("Preencha os campos.");
        await addDoc(collection(window.db, col), { nome, email, status: 'ativo', created_at: serverTimestamp() });
        document.getElementById('modal-editor').classList.add('hidden');
        return loadList();
    }
    if(action === 'banir') { updates.status = 'banido'; updates.is_online = false; msg = "Sua conta foi banida."; }
    if(action === 'suspenso') { updates.status = 'suspenso'; updates.is_online = false; msg = "Sua conta foi suspensa."; }
    if(action === 'aprovar') { updates.status = 'aprovado'; updates.is_online = true; msg = "Perfil aprovado!"; }
    await updateDoc(doc(window.db, col, id), updates);
    if(msg) await addDoc(collection(window.db, "notifications"), { uid: id, message: msg, type: action==='aprovar'?'success':'alert', read: false, created_at: serverTimestamp() });
    alert("✅ Salvo!");
    document.getElementById('modal-editor').classList.add('hidden');
    loadList();
}

// ✅ RESTAURADO: Ações em Massa
function abrirModalMassa() {
    if(selectedUsers.size === 0) return alert("Selecione usuários primeiro.");
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-xl font-black text-white">📢 Ação em Massa (${selectedUsers.size})</h3>
            <div><label class="text-[10px] text-gray-400 font-bold uppercase">Mensagem</label><textarea id="massa-msg" class="w-full p-3 rounded bg-white text-black" rows="3"></textarea></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[10px] text-gray-400 font-bold uppercase">Cor</label><select id="massa-tipo" class="w-full p-3 rounded bg-white text-black"><option value="success">Verde</option><option value="alert">Amarelo</option></select></div>
                <div><label class="text-[10px] text-gray-400 font-bold uppercase">Dar Crédito</label><input type="number" id="massa-credito" class="w-full p-3 rounded bg-white text-black"></div>
            </div>
            <button onclick="window.enviarMassaConfirmado()" class="w-full bg-purple-600 text-white py-4 rounded-xl font-bold uppercase">🚀 DISPARAR</button>
        </div>`;
}

async function enviarMassaConfirmado() {
    const msg = document.getElementById('massa-msg').value;
    const tipo = document.getElementById('massa-tipo').value;
    const credito = parseFloat(document.getElementById('massa-credito').value) || 0;
    
    if(!msg && credito === 0) return alert("Preencha a mensagem ou o valor do crédito.");
    if(!confirm(`Deseja aplicar esta ação para ${selectedUsers.size} usuários?`)) return;
    
    try {
        const batch = writeBatch(window.db);
        selectedUsers.forEach(uid => {
            if(msg) {
                const refNotif = doc(collection(window.db, "notifications"));
                batch.set(refNotif, { 
                    uid: uid, 
                    message: msg, 
                    type: tipo, 
                    read: false, 
                    created_at: serverTimestamp() 
                });
            }
        });
        
        await batch.commit();

        if(credito !== 0) {
            for (let uid of selectedUsers) {
                const ref = doc(window.db, "usuarios", uid);
                const snap = await getDoc(ref);
                if(snap.exists()) {
                    const data = snap.data();
                    const saldoAtual = parseFloat(data.wallet_balance || data.saldo || 0);
                    const novoSaldo = saldoAtual + credito;
                    
                    await updateDoc(ref, { 
                        wallet_balance: Number(novoSaldo),
                        saldo: Number(novoSaldo),
                        updated_at: serverTimestamp()
                    });
                }
            }
        }

        alert("✅ Processo concluído com sucesso!");
        document.getElementById('modal-editor').classList.add('hidden');
        selectedUsers.clear();
        loadList();
    } catch (e) {
        console.error("Erro na ação em massa:", e);
        alert("Falha ao processar ação em massa.");
    }
}

function toggleUserSelectAll(checked) { document.querySelectorAll('.chk-user').forEach(c => { c.checked = checked; if(checked) selectedUsers.add(c.dataset.id); else selectedUsers.delete(c.dataset.id); }); updateUserBulkUI(); }
function updateUserBulkUI() { const bar = document.getElementById('bulk-actions'); if(selectedUsers.size > 0) bar.classList.remove('invisible', 'translate-y-[200%]'); else bar.classList.add('invisible', 'translate-y-[200%]'); document.getElementById('bulk-count').innerText = selectedUsers.size; }
function filtrarListaLocal(termo) { const filtrados = allLoadedUsers.filter(u => JSON.stringify(u).toLowerCase().includes(termo)); renderTable(filtrados); }
