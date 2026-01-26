import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentViewType = 'jobs';

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init(viewType) {
    currentViewType = viewType;
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
    // CONFIGURAÇÃO DINÂMICA DA TABELA
    if (viewType === 'jobs') {
        headers.innerHTML = `
            <th class="p-3 text-left">TÍTULO DA VAGA</th>
            <th class="p-3 text-left">EMPRESA & SALÁRIO</th>
            <th class="p-3 text-left">CANDIDATOS</th>
            <th class="p-3 text-left">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA VAGA"; btnAdd.onclick = () => window.openJobEditor('jobs', null); }
    } 
    else if (viewType === 'missions') {
        headers.innerHTML = `
            <th class="p-3 text-left">TAREFA / MISSÃO</th>
            <th class="p-3 text-left">DESCRIÇÃO</th>
            <th class="p-3 text-left">RECOMPENSA</th>
            <th class="p-3 text-left">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
        if(btnAdd) { btnAdd.style.display = 'block'; btnAdd.innerHTML = "+ NOVA TAREFA"; btnAdd.onclick = () => window.openJobEditor('missions', null); }
    } 
    else if (viewType === 'candidatos') {
        headers.innerHTML = `
            <th class="p-3 text-left">NOME DO CANDIDATO</th>
            <th class="p-3 text-left">PARA A VAGA</th>
            <th class="p-3 text-left">CONTATO</th>
            <th class="p-3 text-left">CURRÍCULO (PDF)</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
        // Não faz sentido criar candidato manualmente por aqui, eles vêm do App
        if(btnAdd) btnAdd.style.display = 'none'; 
    }

    console.log(`✅ Módulo Jobs/Tasks carregado: ${viewType}`);
    await loadList();
}

// ============================================================================
// 2. LISTAGEM (LOAD LIST)
// ============================================================================
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        let collectionName = '';
        if(currentViewType === 'jobs') collectionName = 'jobs';
        if(currentViewType === 'missions') collectionName = 'missoes';
        if(currentViewType === 'candidatos') collectionName = 'candidatos';

        const isDemoMode = window.currentDataMode === 'demo';
        let q;

        // FILTRO REAL vs DEMO
        if (isDemoMode) {
            q = query(collection(db, collectionName), where('is_demo', '==', true), limit(50));
        } else {
            // Em produção, ordena por data recente
            q = query(collection(db, collectionName), orderBy('created_at', 'desc'), limit(50));
        }

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500 opacity-50">Nenhum item encontrado.</td></tr>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            if (currentViewType === 'jobs') renderJobRow(tbody, id, data);
            else if (currentViewType === 'missions') renderMissionRow(tbody, id, data);
            else if (currentViewType === 'candidatos') renderCandidateRow(tbody, id, data);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro: ${e.message}</td></tr>`;
    }
}

// ============================================================================
// 3. RENDERIZADORES DE LINHA
// ============================================================================

function renderJobRow(tbody, id, data) {
    let statusBadge = data.status === 'ativo' 
        ? `<span class="bg-green-900/30 text-green-400 border border-green-500/50 px-2 py-1 rounded text-[10px] font-bold">ATIVO</span>`
        : `<span class="bg-gray-700 text-gray-400 border border-gray-600 px-2 py-1 rounded text-[10px] font-bold">PAUSADO</span>`;
    
    const demoBadge = data.is_demo ? `<span class="ml-2 text-[8px] bg-purple-600 px-1 rounded text-white">DEMO</span>` : "";

    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3">
                <div class="font-bold text-white flex items-center">${data.titulo} ${demoBadge}</div>
                <div class="text-[10px] text-gray-500 font-mono">${id.substring(0,6)}...</div>
            </td>
            <td class="p-3">
                <div class="text-xs text-blue-300 font-bold uppercase">${data.empresa || "Confidencial"}</div>
                <div class="text-[10px] text-gray-400">R$ ${data.salario || "A combinar"}</div>
            </td>
            <td class="p-3 text-xs text-gray-400">
                ${data.candidatos_count || 0} inscritos
            </td>
            <td class="p-3">${statusBadge}</td>
            <td class="p-3 text-right">
                <button onclick="window.openJobEditor('jobs', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold transition">✏️ GERENCIAR</button>
            </td>
        </tr>
    `;
}

function renderMissionRow(tbody, id, data) {
    const demoBadge = data.is_demo ? `<span class="ml-2 text-[8px] bg-purple-600 px-1 rounded text-white">DEMO</span>` : "";
    
    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3">
                <div class="font-bold text-white flex items-center">📷 ${data.titulo} ${demoBadge}</div>
            </td>
            <td class="p-3">
                <div class="text-[10px] text-gray-400 truncate max-w-[200px]">${data.descricao || "-"}</div>
            </td>
            <td class="p-3 font-bold text-amber-400">
                R$ ${(data.valor || 0).toFixed(2)}
            </td>
            <td class="p-3">
                <span class="bg-blue-900/30 text-blue-400 border border-blue-500/50 px-2 py-1 rounded text-[10px] font-bold">DISPONÍVEL</span>
            </td>
            <td class="p-3 text-right">
                <button onclick="window.openJobEditor('missoes', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold transition">✏️ EDITAR</button>
            </td>
        </tr>
    `;
}

function renderCandidateRow(tbody, id, data) {
    let cvButton = `<span class="text-gray-600 text-[10px]">Sem PDF</span>`;
    
    if (data.cv_url) {
        cvButton = `
            <a href="${data.cv_url}" target="_blank" class="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 px-3 py-1.5 rounded text-[10px] font-bold transition">
                <i data-lucide="file-text" size="12"></i> BAIXAR PDF
            </a>
        `;
    }

    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3">
                <div class="font-bold text-white">${data.nome_candidato || "Desconhecido"}</div>
            </td>
            <td class="p-3">
                <div class="text-xs text-gray-300">${data.vaga_titulo || "Vaga Removida"}</div>
            </td>
            <td class="p-3 text-[10px] text-gray-400">
                ${data.email_candidato || "-"}
            </td>
            <td class="p-3">
                ${cvButton}
            </td>
            <td class="p-3 text-right">
                <button onclick="window.deleteItem('candidatos', '${id}')" class="text-red-500 hover:text-white px-2">🗑️</button>
            </td>
        </tr>
    `;
    lucide.createIcons(); // Atualiza ícones
}

// ============================================================================
// 4. EDITOR ESPECÍFICO DESTA ÁREA
// ============================================================================
window.openJobEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    // Mapeia nome correto
    let realColl = collectionName === 'missions' ? 'missoes' : collectionName;

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = id ? "EDITAR ITEM" : "CRIAR NOVO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    
    content.innerHTML = `<p class="text-center text-gray-500 py-10">Carregando...</p>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realColl, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4">`;
        
        // CAMPOS PERSONALIZADOS POR TIPO
        if (realColl === 'jobs') {
            html += `
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2"><label class="inp-label">Título da Vaga</label><input type="text" id="edt-titulo" value="${data.titulo||''}" class="inp-editor font-bold text-white"></div>
                    <div><label class="inp-label">Empresa</label><input type="text" id="edt-empresa" value="${data.empresa||''}" class="inp-editor"></div>
                    <div><label class="inp-label">Salário (Texto)</label><input type="text" id="edt-salario" value="${data.salario||''}" class="inp-editor"></div>
                    <div class="col-span-2"><label class="inp-label">Descrição Completa</label><textarea id="edt-descricao" class="inp-editor h-24">${data.descricao||''}</textarea></div>
                    <div><label class="inp-label">Status</label>
                        <select id="edt-status" class="inp-editor">
                            <option value="ativo" ${data.status==='ativo'?'selected':''}>ATIVO</option>
                            <option value="pausado" ${data.status==='pausado'?'selected':''}>PAUSADO</option>
                        </select>
                    </div>
                </div>
            `;
        } 
        else if (realColl === 'missoes') {
            html += `
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2"><label class="inp-label">Título da Missão</label><input type="text" id="edt-titulo" value="${data.titulo||''}" class="inp-editor font-bold text-white"></div>
                    <div class="col-span-2"><label class="inp-label">Descrição (O que fazer?)</label><textarea id="edt-descricao" class="inp-editor h-20">${data.descricao||''}</textarea></div>
                    <div><label class="inp-label">Recompensa (R$)</label><input type="number" id="edt-valor" value="${data.valor||''}" class="inp-editor text-amber-400 font-bold"></div>
                </div>
            `;
        }

        // Botão Salvar
        html += `
            <div class="mt-6 pt-4 border-t border-slate-700">
                <button onclick="window.saveJobData('${realColl}', '${id}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg">
                    💾 SALVAR DADOS
                </button>
            </div>
        </div>`;

        content.innerHTML = html;

    } catch (e) { content.innerHTML = `Erro: ${e.message}`; }
};

window.saveJobData = async (col, id) => {
    try {
        const db = window.db;
        let data = { updated_at: serverTimestamp() };
        
        // Coleta genérica dos campos
        if(document.getElementById('edt-titulo')) data.titulo = document.getElementById('edt-titulo').value;
        if(document.getElementById('edt-empresa')) data.empresa = document.getElementById('edt-empresa').value;
        if(document.getElementById('edt-salario')) data.salario = document.getElementById('edt-salario').value;
        if(document.getElementById('edt-descricao')) data.descricao = document.getElementById('edt-descricao').value;
        if(document.getElementById('edt-status')) data.status = document.getElementById('edt-status').value;
        if(document.getElementById('edt-valor')) data.valor = parseFloat(document.getElementById('edt-valor').value);

        // Se for novo, adiciona created_at e is_demo baseado no modo atual
        if (!id) {
            data.created_at = serverTimestamp();
            data.is_demo = (window.currentDataMode === 'demo');
            if(col === 'jobs') data.candidatos_count = 0;
            
            await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
                .then(m => m.addDoc(m.collection(db, col), data));
        } else {
            await updateDoc(doc(db, col, id), data);
        }

        alert("✅ Salvo com sucesso!");
        document.getElementById('modal-editor').classList.add('hidden');
        // Recarrega a lista se o módulo tiver a função exposta ou recarrega a view
        if(window.switchView) window.switchView(window.activeView);

    } catch(e) { alert("Erro ao salvar: " + e.message); }
};

window.deleteItem = async (col, id) => {
    if(!confirm("Excluir permanentemente?")) return;
    try {
        await deleteDoc(doc(window.db, col, id));
        if(window.switchView) window.switchView(window.activeView);
    } catch(e) { alert(e.message); }
};
