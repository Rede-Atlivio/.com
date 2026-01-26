import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, deleteDoc, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentViewType = 'jobs';
let selectedItems = new Set(); // Armazena IDs selecionados

// 1. INICIALIZAÇÃO
export async function init(viewType) {
    currentViewType = viewType;
    selectedItems.clear();
    updateBulkActionsUI();

    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
    // Checkbox Mestre no Header
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-all" class="chk-custom"></th>`;

    if (viewType === 'jobs') {
        headers.innerHTML = `${checkHeader}<th class="p-3 text-left">TÍTULO DA VAGA</th><th class="p-3 text-left">EMPRESA</th><th class="p-3 text-left">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA VAGA"; btnAdd.onclick = () => window.openJobEditor('jobs', null); }
    } 
    else if (viewType === 'missions') {
        headers.innerHTML = `${checkHeader}<th class="p-3 text-left">TAREFA</th><th class="p-3 text-left">DESCRIÇÃO</th><th class="p-3 text-left">VALOR</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA TAREFA"; btnAdd.onclick = () => window.openJobEditor('missoes', null); }
    }
    else if (viewType === 'opps') {
        headers.innerHTML = `${checkHeader}<th class="p-3 text-left">OPORTUNIDADE</th><th class="p-3 text-left">TIPO</th><th class="p-3 text-left">LINK</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA OPORTUNIDADE"; btnAdd.onclick = () => window.openJobEditor('oportunidades', null); }
    }
    else if (viewType === 'candidatos') {
        headers.innerHTML = `${checkHeader}<th class="p-3 text-left">CANDIDATO</th><th class="p-3 text-left">VAGA</th><th class="p-3 text-left">CV</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.style.display = 'none'; 
    }

    // Listener do Checkbox Mestre
    document.getElementById('check-all').addEventListener('change', (e) => toggleSelectAll(e.target.checked));

    // Configura botão de Excluir em Massa
    const btnBulkDelete = document.getElementById('btn-bulk-delete');
    if(btnBulkDelete) btnBulkDelete.onclick = executeBulkDelete;

    console.log(`✅ Jobs carregado: ${viewType}`);
    await loadList();
}

// 2. LOAD LIST
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center">Carregando...</td></tr>`;

    try {
        const db = window.db;
        let col = getCollectionName();
        const isDemo = window.currentDataMode === 'demo';
        
        let q = isDemo 
            ? query(collection(db, col), where('is_demo', '==', true), limit(50))
            : query(collection(db, col), orderBy('created_at', 'desc'), limit(50));

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros`;

        if (snap.empty) { tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center opacity-50">Nada encontrado.</td></tr>`; return; }

        snap.forEach(d => {
            const rowHTML = renderRow(d.id, d.data());
            tbody.innerHTML += rowHTML;
        });

        // Reatribui listeners dos checkboxes individuais
        document.querySelectorAll('.chk-item').forEach(chk => {
            chk.addEventListener('change', (e) => toggleItemSelection(e.target.dataset.id, e.target.checked));
        });

    } catch (e) { console.error(e); tbody.innerHTML = `<tr><td colspan="6" class="text-red-500 p-4">Erro: ${e.message}</td></tr>`; }
}

function getCollectionName() {
    if(currentViewType === 'jobs') return 'jobs';
    if(currentViewType === 'missions') return 'missoes';
    if(currentViewType === 'opps') return 'oportunidades';
    return 'candidatos';
}

// 3. RENDERIZADORES
function renderRow(id, data) {
    const isChecked = selectedItems.has(id) ? 'checked' : '';
    const checkbox = `<td class="p-3"><input type="checkbox" class="chk-item chk-custom" data-id="${id}" ${isChecked}></td>`;
    
    if (currentViewType === 'jobs') {
        const demo = data.is_demo ? `<span class="text-[9px] bg-purple-600 px-1 rounded ml-1">DEMO</span>` : "";
        return `<tr class="border-b border-white/5 hover:bg-white/5">
            ${checkbox}
            <td class="p-3 font-bold text-white">${data.titulo} ${demo}</td>
            <td class="p-3 text-gray-400 text-xs">${data.empresa}</td>
            <td class="p-3 text-xs">${data.status}</td>
            <td class="p-3 text-right"><button onclick="window.openJobEditor('jobs', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">EDITAR</button></td>
        </tr>`;
    }
    else if (currentViewType === 'missions') {
        const val = parseFloat(data.valor || 0).toFixed(2);
        return `<tr class="border-b border-white/5 hover:bg-white/5">
            ${checkbox}
            <td class="p-3 font-bold text-white">📷 ${data.titulo}</td>
            <td class="p-3 text-gray-400 text-xs truncate max-w-[150px]">${data.descricao}</td>
            <td class="p-3 text-amber-400 font-bold text-xs">R$ ${val}</td>
            <td class="p-3 text-right"><button onclick="window.openJobEditor('missoes', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">EDITAR</button></td>
        </tr>`;
    }
    else if (currentViewType === 'opps') {
        return `<tr class="border-b border-white/5 hover:bg-white/5">
            ${checkbox}
            <td class="p-3 font-bold text-white">⚡ ${data.titulo}</td>
            <td class="p-3 text-gray-400 text-xs uppercase">${data.tipo}</td>
            <td class="p-3 text-blue-400 text-xs underline truncate max-w-[150px]">${data.link}</td>
            <td class="p-3 text-right"><button onclick="window.openJobEditor('oportunidades', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">EDITAR</button></td>
        </tr>`;
    }
    else { // Candidatos
        const pdfBtn = data.cv_url ? `<a href="${data.cv_url}" target="_blank" class="text-red-400 text-xs font-bold border border-red-900 px-2 py-1 rounded">PDF</a>` : "-";
        return `<tr class="border-b border-white/5 hover:bg-white/5">
            ${checkbox}
            <td class="p-3 font-bold text-white">${data.nome_candidato}</td>
            <td class="p-3 text-gray-400 text-xs">${data.vaga_titulo}</td>
            <td class="p-3">${pdfBtn}</td>
            <td class="p-3 text-right"><button onclick="window.deleteSingleItem('${id}')" class="text-red-500 hover:text-red-400 px-2">🗑️</button></td>
        </tr>`;
    }
}

// 4. LÓGICA DE SELEÇÃO EM MASSA
function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.chk-item');
    checkboxes.forEach(chk => {
        chk.checked = checked;
        toggleItemSelection(chk.dataset.id, checked);
    });
}

function toggleItemSelection(id, isSelected) {
    if (isSelected) selectedItems.add(id);
    else selectedItems.delete(id);
    updateBulkActionsUI();
}

function updateBulkActionsUI() {
    const bar = document.getElementById('bulk-actions');
    const count = document.getElementById('bulk-count');
    
    if (selectedItems.size > 0) {
        bar.classList.add('visible'); // Classe CSS que faz subir a barra
        bar.style.transform = 'translateY(0)'; // Força visual
        count.innerText = selectedItems.size;
    } else {
        bar.classList.remove('visible');
        bar.style.transform = 'translateY(100%)'; // Esconde
    }
}

async function executeBulkDelete() {
    if(!confirm(`Tem certeza que deseja EXCLUIR ${selectedItems.size} itens selecionados?`)) return;
    
    const btn = document.getElementById('btn-bulk-delete');
    btn.innerText = "AGUARDE...";
    
    try {
        const db = window.db;
        const batch = writeBatch(db);
        const col = getCollectionName();

        selectedItems.forEach(id => {
            const ref = doc(db, col, id);
            batch.delete(ref);
        });

        await batch.commit();
        selectedItems.clear();
        updateBulkActionsUI();
        btn.innerHTML = `<i data-lucide="trash-2"></i> EXCLUIR`;
        lucide.createIcons();
        await loadList();
        alert("Itens excluídos com sucesso!");

    } catch(e) { alert("Erro: " + e.message); btn.innerHTML = `<i data-lucide="trash-2"></i> EXCLUIR`; }
}

// 5. EDITOR & FUNÇÕES ÚNICAS
window.openJobEditor = async (colName, id) => {
    // (Lógica do Editor igual a anterior - resumida aqui para caber)
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const realColl = colName === 'missions' ? 'missoes' : colName;
    
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = id ? "EDITAR" : "NOVO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = "Carregando...";

    let data = {};
    if(id) { const snap = await getDoc(doc(window.db, realColl, id)); if(snap.exists()) data = snap.data(); }

    // Gera campos (simplificado para brevidade, igual ao anterior)
    let fields = "";
    if(realColl === 'jobs') fields = `<label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2"><label class="inp-label">Empresa</label><input id="edt-empresa" value="${data.empresa||''}" class="inp-editor mb-2"><label class="inp-label">Salário</label><input id="edt-salario" value="${data.salario||''}" class="inp-editor mb-2"><label class="inp-label">Status</label><select id="edt-status" class="inp-editor"><option value="ativo">Ativo</option><option value="pausado">Pausado</option></select>`;
    else if(realColl === 'missoes') fields = `<label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2"><label class="inp-label">Valor</label><input id="edt-valor" value="${data.valor||''}" class="inp-editor mb-2">`;
    else fields = `<label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2"><label class="inp-label">Link</label><input id="edt-link" value="${data.link||''}" class="inp-editor mb-2">`;

    let delBtn = id ? `<button onclick="window.deleteSingleItem('${realColl}', '${id}')" class="bg-red-900 text-white px-4 rounded text-xs font-bold">EXCLUIR</button>` : "";

    content.innerHTML = `<div class="space-y-4">${fields}<div class="flex gap-4 pt-4 border-t border-slate-700">${delBtn}<button onclick="window.saveJobData('${realColl}', '${id}')" class="flex-1 bg-blue-600 text-white py-3 rounded font-bold text-xs">SALVAR</button></div></div>`;
};

window.saveJobData = async (col, id) => {
    // (Lógica de salvar igual ao anterior)
    try {
        let data = { updated_at: serverTimestamp() };
        if(document.getElementById('edt-titulo')) data.titulo = document.getElementById('edt-titulo').value;
        if(document.getElementById('edt-empresa')) data.empresa = document.getElementById('edt-empresa').value;
        if(document.getElementById('edt-salario')) data.salario = document.getElementById('edt-salario').value;
        if(document.getElementById('edt-status')) data.status = document.getElementById('edt-status').value;
        if(document.getElementById('edt-valor')) data.valor = parseFloat(document.getElementById('edt-valor').value);
        if(document.getElementById('edt-link')) data.link = document.getElementById('edt-link').value;

        if(!id) {
            data.created_at = serverTimestamp();
            data.is_demo = (window.currentDataMode === 'demo');
            if(col === 'jobs') data.candidatos_count = 0;
            await addDoc(collection(window.db, col), data);
        } else { await updateDoc(doc(window.db, col, id), data); }
        document.getElementById('modal-editor').classList.add('hidden');
        loadList();
    } catch(e) { alert(e.message); }
};

window.deleteSingleItem = async (colOrId, id) => {
    // Wrapper para suportar chamada direta ou via modal
    let realCol = getCollectionName(); 
    let realId = id;
    if (!id) { realId = colOrId; } // Se chamou só com ID (na tabela de candidatos)

    if(!confirm("Excluir item?")) return;
    await deleteDoc(doc(window.db, realCol, realId));
    document.getElementById('modal-editor').classList.add('hidden');
    loadList();
};
