import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, orderBy, serverTimestamp, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE ESTADO ---
let allLoadedJobs = [];
let selectedJobs = new Set();

export async function init() {
    selectedJobs.clear();
    
    // 1. Configura Header da Tabela
    const headers = document.getElementById('list-header');
    if(headers) {
        headers.innerHTML = `
            <th class="p-3 w-10"><input type="checkbox" id="check-all-jobs" class="chk-custom"></th>
            <th class="p-3">VAGA / EMPRESA</th>
            <th class="p-3">DETALHES</th>
            <th class="p-3">CANDIDATOS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
    }

    // 2. Configura Botão "Nova Vaga"
    const btnAdd = document.getElementById('btn-list-add');
    if(btnAdd) {
        btnAdd.innerHTML = "+ NOVA VAGA";
        btnAdd.onclick = () => abrirEditorVaga(); // Limpa e abre
    }

    // 3. Configura Bulk Delete
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeBulkDelete;

    // 4. Configura Busca
    const searchInput = document.getElementById('list-search');
    if(searchInput) {
        // Remove listeners antigos
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.placeholder = "Buscar vaga, empresa ou salário...";
        newSearch.addEventListener('input', (e) => filtrarVagas(e.target.value));
    }

    // Listener do Checkbox Geral
    setTimeout(() => {
        const chk = document.getElementById('check-all-jobs');
        if(chk) chk.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    }, 500);

    // Exporta globais para o HTML acessar
    window.abrirEditorVaga = abrirEditorVaga;
    window.salvarVaga = salvarVaga;
    window.alterarStatusVaga = alterarStatusVaga;
    window.verCandidatos = verCandidatos;
    window.excluirVaga = excluirVaga;

    console.log("✅ Módulo Jobs V3 Carregado.");
    await loadList();
}

// --- CARREGAMENTO DE DADOS ---
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const q = query(collection(window.db, "jobs"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        
        allLoadedJobs = [];
        snap.forEach(d => {
            const data = d.data();
            // TRATAMENTO HÍBRIDO (Corrige o "undefined")
            const vaga = {
                id: d.id,
                titulo: data.title || data.titulo || "Sem Título",
                empresa: data.company || data.empresa || "Confidencial",
                salario: data.salary || data.salario || "A combinar",
                status: data.status || "pendente",
                candidatos_count: data.applicants_count || 0
            };
            allLoadedJobs.push(vaga);
        });

        countEl.innerText = `${allLoadedJobs.length} vagas`;
        renderTable(allLoadedJobs);
        updateBulkUI();

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 p-4">Erro: ${e.message}</td></tr>`;
    }
}

function renderTable(lista) {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = "";

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhuma vaga encontrada.</td></tr>`;
        return;
    }

    lista.forEach(job => {
        const isChecked = selectedJobs.has(job.id) ? 'checked' : '';
        
        // Cores do Status
        let statusBadge = `<span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-[9px] uppercase border border-gray-600">PENDENTE</span>`;
        if (job.status === 'ativo') statusBadge = `<span class="bg-green-900 text-green-400 px-2 py-1 rounded text-[9px] uppercase border border-green-700">ATIVO</span>`;
        if (job.status === 'pausado') statusBadge = `<span class="bg-yellow-900 text-yellow-400 px-2 py-1 rounded text-[9px] uppercase border border-yellow-700">PAUSADO</span>`;

        tbody.innerHTML += `
            <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
                <td class="p-3"><input type="checkbox" class="chk-job chk-custom" data-id="${job.id}" ${isChecked}></td>
                <td class="p-3">
                    <div class="font-bold text-white text-sm">${job.titulo}</div>
                    <div class="text-[10px] text-gray-400 uppercase">${job.empresa}</div>
                </td>
                <td class="p-3">
                    <div class="text-xs text-emerald-400 font-mono">${job.salario}</div>
                    <div class="mt-1">${statusBadge}</div>
                </td>
                <td class="p-3">
                    <button onclick="window.verCandidatos('${job.id}', '${job.titulo.replace(/'/g, "")}')" class="bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1 rounded text-xs flex items-center gap-2 transition">
                        📄 Ver Currículos
                    </button>
                </td>
                <td class="p-3 text-right flex justify-end gap-1">
                    <button onclick="window.alterarStatusVaga('${job.id}', 'ativo')" class="text-green-500 hover:bg-green-900/20 p-2 rounded" title="Aprovar">✅</button>
                    <button onclick="window.alterarStatusVaga('${job.id}', 'pausado')" class="text-yellow-500 hover:bg-yellow-900/20 p-2 rounded" title="Pausar">⏸️</button>
                    <button onclick="window.abrirEditorVaga('${job.id}')" class="text-blue-500 hover:bg-blue-900/20 p-2 rounded" title="Editar">✏️</button>
                    <button onclick="window.excluirVaga('${job.id}')" class="text-red-500 hover:bg-red-900/20 p-2 rounded" title="Excluir">🗑️</button>
                </td>
            </tr>
        `;
    });

    // Re-bind checkboxes
    document.querySelectorAll('.chk-job').forEach(c => c.addEventListener('change', (e) => toggleItemSelection(e.target.dataset.id, e.target.checked)));
}

// --- AÇÕES EM MASSA ---
function toggleSelectAll(checked) {
    document.querySelectorAll('.chk-job').forEach(c => { c.checked = checked; toggleItemSelection(c.dataset.id, checked); });
}
function toggleItemSelection(id, checked) {
    if(checked) selectedJobs.add(id); else selectedJobs.delete(id);
    updateBulkUI();
}
function updateBulkUI() {
    const bar = document.getElementById('bulk-actions');
    const count = document.getElementById('bulk-count');
    if(selectedJobs.size > 0) {
        bar.classList.remove('invisible', 'translate-y-[200%]');
        if(count) count.innerText = selectedJobs.size;
    } else {
        bar.classList.add('invisible', 'translate-y-[200%]');
    }
}
async function executeBulkDelete() {
    if(!confirm(`Excluir ${selectedJobs.size} vagas permanentemente?`)) return;
    const batch = writeBatch(window.db);
    selectedJobs.forEach(id => batch.delete(doc(window.db, "jobs", id)));
    await batch.commit();
    alert("✅ Vagas excluídas.");
    selectedJobs.clear();
    loadList();
}

// --- EDITOR DE VAGAS (Criação/Edição) ---
function abrirEditorVaga(id = null) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    
    // Se tem ID, busca dados. Se não, limpa.
    let dados = { titulo: '', empresa: '', salario: '', descricao: '' };
    
    if (id) {
        const job = allLoadedJobs.find(j => j.id === id);
        if(job) {
            dados = { ...job, descricao: job.description || job.descricao || '' };
        }
    }

    content.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-lg font-bold text-white mb-4">${id ? 'EDITAR VAGA' : 'NOVA VAGA'}</h3>
            <input type="hidden" id="edit-job-id" value="${id || ''}">
            
            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Título da Vaga *</label>
                <input id="edit-job-title" value="${dados.titulo}" class="w-full p-3 rounded bg-white text-black font-bold" placeholder="Ex: Vendedor">
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Empresa</label>
                    <input id="edit-job-company" value="${dados.empresa}" class="w-full p-3 rounded bg-white text-black" placeholder="Nome da Empresa">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400 font-bold uppercase">Salário</label>
                    <input id="edit-job-salary" value="${dados.salario}" class="w-full p-3 rounded bg-white text-black" placeholder="Ex: R$ 1.500,00">
                </div>
            </div>

            <div>
                <label class="text-[10px] text-gray-400 font-bold uppercase">Descrição / Requisitos</label>
                <textarea id="edit-job-desc" rows="4" class="w-full p-3 rounded bg-white text-black" placeholder="Detalhes da vaga...">${dados.descricao || ''}</textarea>
            </div>

            <button onclick="window.salvarVaga()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold uppercase shadow-lg transition transform active:scale-95">
                ${id ? '💾 SALVAR ALTERAÇÕES' : '🚀 PUBLICAR VAGA'}
            </button>
        </div>
    `;
}

window.salvarVaga = async () => {
    const id = document.getElementById('edit-job-id').value; // Pega o ID do hidden input (pode ser vazio)
    
    const payload = {
        title: document.getElementById('edit-job-title').value, // Salva como 'title' padrão
        titulo: document.getElementById('edit-job-title').value, // Salva também 'titulo' por segurança
        company: document.getElementById('edit-job-company').value,
        salary: document.getElementById('edit-job-salary').value,
        description: document.getElementById('edit-job-desc').value,
        updated_at: serverTimestamp()
    };

    if(!payload.title) return alert("O Título da vaga é obrigatório.");

    try {
        if (id) {
            // EDIÇÃO
            await updateDoc(doc(window.db, "jobs", id), payload);
            alert("✅ Vaga atualizada!");
        } else {
            // CRIAÇÃO (ADD DOC - Resolve o erro de Null)
            payload.status = 'ativo';
            payload.created_at = serverTimestamp();
            payload.applicants_count = 0;
            await addDoc(collection(window.db, "jobs"), payload);
            alert("✅ Vaga criada com sucesso!");
        }
        
        document.getElementById('modal-editor').classList.add('hidden');
        loadList();

    } catch(e) {
        alert("Erro ao salvar: " + e.message);
    }
};

// --- VISUALIZAR CANDIDATOS (NOVO!) ---
window.verCandidatos = async (jobId, jobTitle) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    
    content.innerHTML = `<div class="text-center py-10"><div class="loader mx-auto border-white"></div><p class="text-white mt-2">Buscando candidatos...</p></div>`;

    try {
        // Busca na coleção 'job_applications' onde job_id == jobId
        const q = query(collection(window.db, "job_applications"), where("job_id", "==", jobId), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        let html = `
            <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 class="font-bold text-white text-lg">Candidatos: ${jobTitle}</h3>
                <span class="bg-blue-600 text-white px-2 py-1 rounded text-xs">${snap.size} encontrados</span>
            </div>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        `;

        if (snap.empty) {
            html += `<div class="p-6 text-center text-gray-500 bg-slate-800 rounded-xl">Nenhum candidato aplicou para esta vaga ainda.</div>`;
        } else {
            snap.forEach(d => {
                const app = d.data();
                html += `
                    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-bold text-white text-sm">${app.user_name || 'Usuário'}</p>
                                <p class="text-xs text-gray-400 font-mono">${app.user_phone || 'Sem telefone'}</p>
                            </div>
                            <span class="text-[9px] text-gray-500">${app.created_at?.toDate().toLocaleDateString() || '-'}</span>
                        </div>
                        <div class="mt-2 text-xs text-gray-300 italic">"${app.message || 'Sem mensagem'}"</div>
                        <div class="mt-3 flex gap-2">
                            ${app.resume_url ? `<a href="${app.resume_url}" target="_blank" class="bg-red-600 text-white px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-red-500">📄 VER PDF</a>` : ''}
                            <a href="https://wa.me/55${app.user_phone?.replace(/\D/g,'')}" target="_blank" class="bg-green-600 text-white px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-green-500">💬 WHATSAPP</a>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        content.innerHTML = html;

    } catch (e) {
        console.error(e);
        content.innerHTML = `<p class="text-red-500 p-4">Erro ao carregar candidatos: ${e.message}</p>`;
    }
};

window.alterarStatusVaga = async (id, status) => {
    await updateDoc(doc(window.db, "jobs", id), { status: status });
    loadList();
};

window.excluirVaga = async (id) => {
    if(confirm("Tem certeza? Isso apagará a vaga e os registros.")) {
        await deleteDoc(doc(window.db, "jobs", id));
        loadList();
    }
};

function filtrarVagas(termo) {
    const t = termo.toLowerCase();
    const filtrados = allLoadedJobs.filter(j => 
        j.titulo.toLowerCase().includes(t) || 
        j.empresa.toLowerCase().includes(t)
    );
    renderTable(filtrados);
}
