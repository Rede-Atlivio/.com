import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentViewType = 'jobs';

// 1. INICIALIZAÇÃO
export async function init(viewType) {
    currentViewType = viewType;
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
    // Cabeçalhos (Iguais)
    if (viewType === 'jobs') {
        headers.innerHTML = `<th class="p-3 text-left">TÍTULO DA VAGA</th><th class="p-3 text-left">EMPRESA</th><th class="p-3 text-left">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA VAGA"; btnAdd.onclick = () => window.openJobEditor('jobs', null); }
    } 
    else if (viewType === 'missions') {
        headers.innerHTML = `<th class="p-3 text-left">TAREFA</th><th class="p-3 text-left">DESCRIÇÃO</th><th class="p-3 text-left">VALOR</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA TAREFA"; btnAdd.onclick = () => window.openJobEditor('missoes', null); }
    }
    else if (viewType === 'opps') {
        headers.innerHTML = `<th class="p-3 text-left">OPORTUNIDADE</th><th class="p-3 text-left">TIPO</th><th class="p-3 text-left">LINK</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA OPORTUNIDADE"; btnAdd.onclick = () => window.openJobEditor('oportunidades', null); }
    }
    else if (viewType === 'candidatos') {
        headers.innerHTML = `<th class="p-3 text-left">CANDIDATO</th><th class="p-3 text-left">VAGA</th><th class="p-3 text-left">CV</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.style.display = 'none'; 
    }

    console.log(`✅ Jobs carregado: ${viewType}`);
    await loadList();
}

// 2. LOAD LIST
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center">Carregando...</td></tr>`;

    try {
        const db = window.db;
        let col = currentViewType === 'jobs' ? 'jobs' : (currentViewType === 'missions' ? 'missoes' : (currentViewType === 'opps' ? 'oportunidades' : 'candidatos'));
        const isDemo = window.currentDataMode === 'demo';
        
        // Query
        let q = isDemo 
            ? query(collection(db, col), where('is_demo', '==', true), limit(50))
            : query(collection(db, col), orderBy('created_at', 'desc'), limit(50));

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros`;

        if (snap.empty) { tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center opacity-50">Nada encontrado.</td></tr>`; return; }

        snap.forEach(d => {
            if (currentViewType === 'jobs') renderJobRow(tbody, d.id, d.data());
            else if (currentViewType === 'missions') renderMissionRow(tbody, d.id, d.data());
            else if (currentViewType === 'opps') renderOppRow(tbody, d.id, d.data());
            else if (currentViewType === 'candidatos') renderCandidateRow(tbody, d.id, d.data());
        });
    } catch (e) { console.error(e); tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 p-4">Erro: ${e.message}</td></tr>`; }
}

// 3. RENDERIZADORES (Tabelas)
function renderJobRow(tbody, id, data) {
    const demo = data.is_demo ? `<span class="text-[9px] bg-purple-600 px-1 rounded ml-1">DEMO</span>` : "";
    tbody.innerHTML += `
    <tr class="border-b border-white/5 hover:bg-white/5">
        <td class="p-3 font-bold text-white">${data.titulo} ${demo}</td>
        <td class="p-3 text-gray-400 text-xs">${data.empresa}</td>
        <td class="p-3 text-xs">${data.status}</td>
        <td class="p-3 text-right"><button onclick="window.openJobEditor('jobs', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">GERENCIAR</button></td>
    </tr>`;
}

function renderMissionRow(tbody, id, data) {
    const val = parseFloat(data.valor || 0).toFixed(2);
    tbody.innerHTML += `
    <tr class="border-b border-white/5 hover:bg-white/5">
        <td class="p-3 font-bold text-white">📷 ${data.titulo}</td>
        <td class="p-3 text-gray-400 text-xs truncate max-w-[150px]">${data.descricao}</td>
        <td class="p-3 text-amber-400 font-bold text-xs">R$ ${val}</td>
        <td class="p-3 text-right"><button onclick="window.openJobEditor('missoes', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">EDITAR</button></td>
    </tr>`;
}

function renderOppRow(tbody, id, data) {
    tbody.innerHTML += `
    <tr class="border-b border-white/5 hover:bg-white/5">
        <td class="p-3 font-bold text-white">⚡ ${data.titulo}</td>
        <td class="p-3 text-gray-400 text-xs uppercase">${data.tipo}</td>
        <td class="p-3 text-blue-400 text-xs underline truncate max-w-[150px]">${data.link}</td>
        <td class="p-3 text-right"><button onclick="window.openJobEditor('oportunidades', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">EDITAR</button></td>
    </tr>`;
}

function renderCandidateRow(tbody, id, data) {
    const pdfBtn = data.cv_url ? `<a href="${data.cv_url}" target="_blank" class="text-red-400 text-xs font-bold border border-red-900 px-2 py-1 rounded">PDF</a>` : "-";
    tbody.innerHTML += `
    <tr class="border-b border-white/5 hover:bg-white/5">
        <td class="p-3 font-bold text-white">${data.nome_candidato}</td>
        <td class="p-3 text-gray-400 text-xs">${data.vaga_titulo}</td>
        <td class="p-3">${pdfBtn}</td>
        <td class="p-3 text-right"><button onclick="window.deleteItem('candidatos', '${id}')" class="text-red-500 hover:text-red-400 px-2">🗑️</button></td>
    </tr>`;
}

// 4. EDITOR (AGORA COM BOTÃO EXCLUIR)
window.openJobEditor = async (colName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const realColl = colName === 'missions' ? 'missoes' : colName;
    
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = id ? "EDITAR" : "NOVO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = "Carregando...";

    let data = {};
    if(id) {
        const snap = await getDoc(doc(window.db, realColl, id));
        if(snap.exists()) data = snap.data();
    }

    let fields = "";
    // Gera campos baseado no tipo...
    if(realColl === 'jobs') {
        fields = `
        <label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2">
        <label class="inp-label">Empresa</label><input id="edt-empresa" value="${data.empresa||''}" class="inp-editor mb-2">
        <label class="inp-label">Salário</label><input id="edt-salario" value="${data.salario||''}" class="inp-editor mb-2">
        <label class="inp-label">Descrição</label><textarea id="edt-descricao" class="inp-editor h-20 mb-2">${data.descricao||''}</textarea>
        <label class="inp-label">Status</label><select id="edt-status" class="inp-editor"><option value="ativo">Ativo</option><option value="pausado">Pausado</option></select>
        `;
    } else if (realColl === 'missoes') {
        fields = `
        <label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2">
        <label class="inp-label">Descrição</label><textarea id="edt-descricao" class="inp-editor h-20 mb-2">${data.descricao||''}</textarea>
        <label class="inp-label">Valor (R$)</label><input type="number" id="edt-valor" value="${data.valor||''}" class="inp-editor mb-2">
        `;
    } else if (realColl === 'oportunidades') {
        fields = `
        <label class="inp-label">Título</label><input id="edt-titulo" value="${data.titulo||''}" class="inp-editor mb-2">
        <label class="inp-label">Link</label><input id="edt-link" value="${data.link||''}" class="inp-editor mb-2 text-blue-400">
        <label class="inp-label">Tipo</label><select id="edt-tipo" class="inp-editor"><option value="alerta">Alerta</option><option value="cashback">Cashback</option></select>
        <label class="inp-label">Descrição</label><input id="edt-descricao" value="${data.descricao||''}" class="inp-editor mb-2">
        `;
    }

    // AQUI ESTÁ A MÁGICA: O BOTÃO DE EXCLUIR SÓ APARECE SE TIVER ID (EDIÇÃO)
    let deleteButton = id ? `<button onclick="window.deleteItem('${realColl}', '${id}')" class="bg-red-900/50 hover:bg-red-600 text-white border border-red-800 px-4 rounded font-bold text-xs">🗑️ EXCLUIR</button>` : "";

    content.innerHTML = `
        <div class="space-y-4">
            ${fields}
            <div class="flex gap-4 pt-4 border-t border-slate-700">
                ${deleteButton}
                <button onclick="window.saveJobData('${realColl}', '${id}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold text-xs">SALVAR</button>
            </div>
        </div>
    `;
};

// SALVAR
window.saveJobData = async (col, id) => {
    try {
        let data = { updated_at: serverTimestamp() };
        // Pega valores genéricos
        if(document.getElementById('edt-titulo')) data.titulo = document.getElementById('edt-titulo').value;
        if(document.getElementById('edt-empresa')) data.empresa = document.getElementById('edt-empresa').value;
        if(document.getElementById('edt-salario')) data.salario = document.getElementById('edt-salario').value;
        if(document.getElementById('edt-descricao')) data.descricao = document.getElementById('edt-descricao').value;
        if(document.getElementById('edt-status')) data.status = document.getElementById('edt-status').value;
        if(document.getElementById('edt-valor')) data.valor = parseFloat(document.getElementById('edt-valor').value);
        if(document.getElementById('edt-link')) data.link = document.getElementById('edt-link').value;
        if(document.getElementById('edt-tipo')) data.tipo = document.getElementById('edt-tipo').value;

        if(!id) {
            data.created_at = serverTimestamp();
            data.is_demo = (window.currentDataMode === 'demo');
            if(col === 'jobs') data.candidatos_count = 0;
            await addDoc(collection(window.db, col), data);
        } else {
            await updateDoc(doc(window.db, col, id), data);
        }
        document.getElementById('modal-editor').classList.add('hidden');
        loadList();
        alert("Salvo!");
    } catch(e) { alert(e.message); }
};

// EXCLUIR
window.deleteItem = async (col, id) => {
    if(!confirm("Tem certeza? Isso apagará o item permanentemente.")) return;
    try {
        await deleteDoc(doc(window.db, col, id));
        document.getElementById('modal-editor').classList.add('hidden'); // Fecha modal se estiver aberto
        loadList(); // Recarrega lista
    } catch(e) { alert("Erro ao excluir: " + e.message); }
};
