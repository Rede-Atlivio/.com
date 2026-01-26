import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users';
let selectedUsers = new Set();

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    updateUserBulkUI();

    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-users-all" class="chk-custom"></th>`;
    
    if (viewType === 'users') {
        headers.innerHTML = `${checkHeader}<th class="p-3">NOME / ID</th><th class="p-3">TIPO</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO USUÁRIO";
    } else {
        headers.innerHTML = `${checkHeader}<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO PRESTADOR";
    }

    if(btnAdd) btnAdd.onclick = () => window.openEditor(viewType, null);

    // Listener Mestre (Checkbox do Cabeçalho)
    const chkAll = document.getElementById('check-users-all');
    if(chkAll) {
        // Remove listener antigo para evitar duplicação (cloneNode)
        const newChk = chkAll.cloneNode(true);
        chkAll.parentNode.replaceChild(newChk, chkAll);
        newChk.addEventListener('change', (e) => toggleUserSelectAll(e.target.checked));
    }
    
    // Listener Botão Excluir Global
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeUserBulkDelete;

    console.log(`✅ Módulo Users carregado: ${viewType}`);
    await loadList();
}

// ============================================================================
// 2. LISTAGEM
// ============================================================================
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        const col = currentType === 'users' ? 'usuarios' : 'active_providers';
        const isDemo = window.currentDataMode === 'demo';
        
        let q = isDemo 
            ? query(collection(db, col), where('is_demo', '==', true)) 
            : query(collection(db, col), limit(50));

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center opacity-50">Nada encontrado.</td></tr>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const isChecked = selectedUsers.has(d.id) ? 'checked' : '';
            const checkbox = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" data-id="${d.id}" ${isChecked}></td>`;
            
            if(currentType === 'users') {
                let statusClass = "text-green-400 border-green-500/50";
                if(data.status === 'banido') statusClass = "text-red-400 border-red-500/50";
                
                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition">
                        ${checkbox}
                        <td class="p-3"><div class="font-bold text-white">${data.nome||'User'}</div><div class="text-[10px] text-gray-500">${d.id.substring(0,6)}...</div></td>
                        <td class="p-3 text-gray-400 text-xs uppercase">${data.tipo}</td>
                        <td class="p-3"><span class="border ${statusClass} px-2 py-1 rounded text-[10px]">${data.status||'Ativo'}</span></td>
                        <td class="p-3 text-right"><button onclick="window.openEditor('users','${d.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">EDITAR</button></td>
                    </tr>`;
            } else {
                let statusIcon = data.is_online ? "🟢" : "⚫";
                if(data.status === 'em_analise') statusIcon = "🟡";
                
                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition">
                        ${checkbox}
                        <td class="p-3"><div class="font-bold text-white">${data.nome_profissional||'Pro'}</div><div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,20)+'...' : '-'}</div></td>
                        <td class="p-3 text-gray-400 text-xs">${data.services?.[0]?.category||'-'}</td>
                        <td class="p-3 text-xs">${statusIcon} ${data.status}</td>
                        <td class="p-3 text-right"><button onclick="window.openEditor('active_providers','${d.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold shadow">CURADORIA</button></td>
                    </tr>`;
            }
        });

        // Reatribui listeners
        document.querySelectorAll('.chk-user').forEach(c => c.addEventListener('change', (e) => toggleUserItem(e.target.dataset.id, e.target.checked)));

    } catch (e) { console.error(e); }
}

// ============================================================================
// 3. LÓGICA DE SELEÇÃO EM MASSA
// ============================================================================
function toggleUserSelectAll(checked) {
    document.querySelectorAll('.chk-user').forEach(c => {
        c.checked = checked;
        toggleUserItem(c.dataset.id, checked);
    });
}

function toggleUserItem(id, selected) {
    if(selected) selectedUsers.add(id); else selectedUsers.delete(id);
    updateUserBulkUI();
}

function updateUserBulkUI() {
    const bar = document.getElementById('bulk-actions');
    const count = document.getElementById('bulk-count');
    if(selectedUsers.size > 0) {
        bar.classList.add('visible');
        bar.style.transform = 'translateY(0)';
        count.innerText = selectedUsers.size;
    } else {
        bar.classList.remove('visible');
        bar.style.transform = 'translateY(100%)';
    }
}

async function executeUserBulkDelete() {
    if(!confirm(`EXCLUIR ${selectedUsers.size} usuários selecionados PERMANENTEMENTE?`)) return;
    
    const btn = document.getElementById('btn-bulk-delete');
    btn.innerText = "AGUARDE...";
    
    try {
        const db = window.db;
        const batch = writeBatch(db);
        const col = currentType === 'users' ? 'usuarios' : 'active_providers';
        
        selectedUsers.forEach(id => {
            const ref = doc(db, col, id);
            batch.delete(ref);
        });
        
        await batch.commit();
        selectedUsers.clear();
        updateUserBulkUI();
        await loadList();
        alert("✅ Exclusão em massa concluída!");
        
    } catch(e) { alert("Erro: " + e.message); } 
    finally {
        btn.innerHTML = `<i data-lucide="trash-2"></i> EXCLUIR`;
        lucide.createIcons();
    }
}

// ============================================================================
// 4. EDITOR COMPLETO & FUNÇÕES DE CURADORIA
// ============================================================================
window.openEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    // Mapeamento correto
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    title.innerText = id ? "EDITAR / CURADORIA" : "NOVO REGISTRO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = `<div class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></div>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4">`;

        // ÁREA DE MÍDIA (CURADORIA)
        if (data.banner_url || data.foto_perfil) {
            html += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 flex gap-4">`;
            if(data.banner_url) html += `<div><p class="text-[9px]">Banner</p><img src="${data.banner_url}" class="h-20 w-32 object-cover rounded border border-gray-600"></div>`;
            if(data.foto_perfil) html += `<div><p class="text-[9px]">Avatar</p><img src="${data.foto_perfil}" class="w-16 h-16 object-cover rounded-full border border-gray-600"></div>`;
            html += `</div>`;
        }

        // CAMPOS DE TEXTO
        const keys = id ? Object.keys(data).sort() : ['nome', 'email', 'tipo', 'status']; 
        const ignored = ['created_at', 'updated_at', 'services', 'geo_location', 'is_demo', 'visibility_score'];
        
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => {
            if(ignored.includes(key)) return;
            const val = data[key] || "";
            html += `<div><label class="inp-label">${key.toUpperCase()}</label><input type="text" id="edit-${key}" value="${val}" class="inp-editor"></div>`;
        });
        html += `</div>`;

        // BOTÕES DE PODER (AÇÃO)
        html += `<div class="border-t border-slate-700 pt-6 mt-6">`;
        
        if (realCollection === 'active_providers') {
            html += `
                <p class="text-center text-gray-400 text-[10px] uppercase font-bold mb-3">👮 Painel de Moderação</p>
                <div class="grid grid-cols-3 gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'rejeitar')" class="bg-red-900/50 hover:bg-red-600 border border-red-800 text-white py-3 rounded-lg font-bold text-xs">🚫 REJEITAR</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'suspender')" class="bg-yellow-900/50 hover:bg-yellow-600 border border-yellow-800 text-white py-3 rounded-lg font-bold text-xs">⚠️ SUSPENDER</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'aprovar')" class="bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-black text-xs shadow-lg shadow-green-900/20">✅ APROVAR (SCORE 100)</button>
                </div>
            `;
        } else {
            html += `
                <div class="flex gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold text-xs">⛔ BANIR USUÁRIO</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-xs">💾 SALVAR DADOS</button>
                </div>
            `;
        }
        html += `</div></div>`;

        content.innerHTML = html;

    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
};

// ============================================================================
// 5. FUNÇÃO DE SALVAMENTO (RESTAURADA!)
// ============================================================================
window.saveAction = async (collectionName, id, action) => {
    if(!id) return alert("Criação manual ainda não implementada.");
    if(!confirm(`Confirmar ação: ${action.toUpperCase()}?`)) return;

    try {
        const ref = doc(window.db, collectionName, id);
        let updates = { updated_at: serverTimestamp() };

        // Coleta dados dos inputs
        const inputs = document.querySelectorAll('[id^="edit-"]');
        inputs.forEach(inp => {
            const key = inp.id.replace('edit-', '');
            updates[key] = inp.value;
        });

        // Lógica de Negócio
        if (action === 'aprovar') {
            updates.status = 'aprovado';
            updates.visibility_score = 100; // Regra de Ouro
            updates.is_online = false; // Começa offline
            alert("✅ Prestador Aprovado! Score 100.");
        } 
        else if (action === 'rejeitar') { updates.status = 'rejeitado'; updates.visibility_score = 0; }
        else if (action === 'suspender') { updates.status = 'suspenso'; updates.visibility_score = 0; }
        else if (action === 'banir') { updates.status = 'banido'; }

        await updateDoc(ref, updates);
        document.getElementById('modal-editor').classList.add('hidden');
        await loadList();

    } catch (e) { alert("Erro ao salvar: " + e.message); }
};
