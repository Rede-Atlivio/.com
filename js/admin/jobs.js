// ✅ ADICIONADO 'limit' NA IMPORTAÇÃO (CORREÇÃO DO ERRO)
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp, writeBatch, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allLoadedJobs = [];
let selectedJobs = new Set();

export async function init() {
    selectedJobs.clear();
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
   // ⚙️ Configura UI e Painel de Economia
    if(headers) headers.innerHTML = `<th class="p-3 w-10"><input type="checkbox" id="check-all-jobs" class="chk-custom"></th><th class="p-3">VAGA</th><th class="p-3">EMPRESA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;

    // Injeta a Chave Mestra de Cobrança acima da tabela
    const containerLista = document.getElementById('list-body').parentElement.parentElement;
    if (!document.getElementById('painel-economia-jobs')) {
        const divEconomia = document.createElement('div');
        divEconomia.id = 'painel-economia-jobs';
        divEconomia.className = 'bg-slate-900 border border-slate-700 p-4 rounded-2xl mb-6 flex flex-wrap gap-4 items-center justify-between';
        divEconomia.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-blue-500/20 p-2 rounded-lg text-blue-400">💰</div>
                <div>
                    <h4 class="text-white text-xs font-black uppercase italic">Economia de Empregos</h4>
                    <p class="text-[9px] text-gray-500 font-bold uppercase">Controle de cobrança de ATLIX</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span class="text-[9px] font-black text-gray-400 uppercase">Cobrança:</span>
                    <select id="cfg-job-billing" onchange="window.salvarConfigGlobalJobs()" class="bg-transparent text-white text-[10px] font-black outline-none cursor-pointer">
                        <option value="true" class="bg-slate-900">LIGADA</option>
                        <option value="false" class="bg-slate-900">DESLIGADA (GRÁTIS)</option>
                    </select>
                </div>
                <button onclick="window.atualizarPrecosPadrao()" class="bg-blue-600 text-white text-[9px] font-black px-4 py-2 rounded-lg hover:bg-blue-500 transition shadow-lg">SALVAR TUDO</button>
            </div>
        `;
        containerLista.parentNode.insertBefore(divEconomia, containerLista);
        carregarConfigGlobalJobs();
    }

    // Exporta Globais de Configuração
    window.salvarConfigGlobalJobs = salvarConfigGlobalJobs;
    window.carregarConfigGlobalJobs = carregarConfigGlobalJobs;
    
    if(btnAdd) { 
        btnAdd.style.display = 'block';
        btnAdd.innerHTML = "+ NOVA VAGA"; 
        btnAdd.onclick = () => abrirModalVaga(); 
    }
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeBulkDelete;

    // Exporta Globais
    window.abrirModalVaga = abrirModalVaga;
    window.salvarVaga = salvarVaga;
    window.verCandidatos = verCandidatos;
    window.excluirVaga = excluirVaga;
    window.alterarStatusVaga = alterarStatusVaga;
    window.fecharModalJobs = fecharModalJobs;

    await loadList();
}

function fecharModalJobs() {
    const modal = document.getElementById('modal-editor');
    modal.classList.add('hidden');
    const content = document.getElementById('modal-content');
    if(content) {
        content.style.pointerEvents = 'auto';
        content.style.opacity = '1';
    }
}

async function loadList() {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-10"><div class="loader mx-auto border-blue-500"></div></td></tr>`;
    
    try {
        const q = query(collection(window.db, "jobs"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        allLoadedJobs = [];
        snap.forEach(d => allLoadedJobs.push({ id: d.id, ...d.data() }));
        renderTable(allLoadedJobs);
    } catch (e) { console.error(e); }
}

function renderTable(lista) {
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = "";
    const countEl = document.getElementById('list-count');
    if(countEl) countEl.innerText = `${lista.length} vagas`;

    if(lista.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 p-10">Nada encontrado.</td></tr>`; return; }

    lista.forEach(job => {
        const isChecked = selectedJobs.has(job.id) ? 'checked' : '';
        let stClass = job.status === 'ativo' ? 'text-green-400' : 'text-yellow-400';
        
        // TRATAMENTO HÍBRIDO (RESOLVE O "UNDEFINED")
        const titulo = job.title || job.titulo || "Sem Título";
        const empresa = job.company || job.empresa || "Confidencial";
        
        tbody.innerHTML += `
            <tr class="border-b border-slate-800 hover:bg-slate-800/50">
                <td class="p-3"><input type="checkbox" class="chk-job chk-custom" data-id="${job.id}" ${isChecked}></td>
                <td class="p-3 font-bold text-white">${titulo}</td>
                <td class="p-3 text-gray-400 text-xs">${empresa}</td>
                <td class="p-3 ${stClass} font-bold text-xs uppercase">${job.status || 'pendente'}</td>
                <td class="p-3 text-right flex justify-end gap-2">
                    <button onclick="window.verCandidatos('${job.id}', '${titulo.replace(/'/g,"")}')" class="bg-blue-900/30 text-blue-300 border border-blue-800 px-3 py-1 rounded text-xs hover:bg-blue-900 transition">📄 CANDIDATOS</button>
                    <button onclick="window.abrirModalVaga('${job.id}')" class="text-gray-400 hover:text-white px-2">✏️</button>
                    <button onclick="window.excluirVaga('${job.id}')" class="text-red-500 hover:text-red-400 px-2">🗑️</button>
                </td>
            </tr>
        `;
    });
}

// --- VISUALIZADOR DE CANDIDATOS ---
window.verCandidatos = async (jobId, title) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const btnClose = document.getElementById('btn-close-modal');
    if(btnClose) btnClose.onclick = window.fecharModalJobs;

    modal.classList.remove('hidden');
    content.innerHTML = `<div class="text-center py-10 text-white">Buscando currículos para ID: ${jobId}...</div>`;

    try {
        console.log(`🔎 Buscando candidatos para JobID: ${jobId}`);
        
        // Tenta buscar por job_id
        let q = query(collection(window.db, "job_applications"), where("job_id", "==", jobId));
        let snap = await getDocs(q);

        // Se não achar, tenta buscar TODOS e filtrar no JS (Backup)
        if(snap.empty) {
            console.warn("⚠️ Busca direta vazia. Tentando busca ampla...");
            const qAll = query(collection(window.db, "job_applications"), orderBy("created_at", "desc"), limit(50)); // AGORA O LIMIT VAI FUNCIONAR
            const snapAll = await getDocs(qAll);
            const filtrados = snapAll.docs.filter(d => d.data().job_id === jobId || d.data().vaga_id === jobId);
            
            if(filtrados.length > 0) {
                snap = { size: filtrados.length, empty: false, forEach: (cb) => filtrados.forEach(cb) };
            }
        }

        let html = `<div class="p-2"><h3 class="font-bold text-white mb-4 border-b border-slate-700 pb-2">Candidatos: ${title} (${snap.size || 0})</h3><div class="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">`;

        if (snap.empty) {
            html += `<p class="text-gray-500 text-center">Nenhum candidato encontrado no sistema para esta vaga.</p>`;
        } else {
            snap.forEach(d => {
                const app = d.data ? d.data() : d;
                const linkPdf = app.resume_url || app.cv_url || app.file_url;
                
                html += `
                    <div class="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-blue-500 transition">
                        <div class="flex justify-between">
                            <span class="font-bold text-white text-sm">${app.user_name || 'Anônimo'}</span>
                            <span class="text-xs text-gray-500">${app.created_at?.toDate ? app.created_at.toDate().toLocaleDateString() : 'Hoje'}</span>
                        </div>
                        <p class="text-xs text-gray-400 mt-1 italic">"${app.message || 'Sem mensagem'}"</p>
                        <div class="flex gap-2 mt-3">
                            ${linkPdf ? `<a href="${linkPdf}" target="_blank" class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-red-500">📄 VER PDF</a>` : '<span class="text-gray-600 text-xs border border-gray-600 px-2 rounded">Sem PDF</span>'}
                            <a href="https://wa.me/55${(app.user_phone||'').replace(/\D/g,'')}" target="_blank" class="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-500">💬 WHATSAPP</a>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div></div>`;
        content.innerHTML = html;

    } catch (e) {
        console.error(e);
        content.innerHTML = `<p class="text-red-500 p-4">Erro: ${e.message}</p>`;
    }
};

// ... Funções de Salvar (Mantidas) ...
function abrirModalVaga(id = null) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('btn-close-modal').onclick = window.fecharModalJobs;

    let dados = { title: '', company: '', salary: '', description: '' };
    if(id) {
        const job = allLoadedJobs.find(j => j.id === id);
        if(job) dados = { title: job.title || job.titulo, company: job.company || job.empresa, salary: job.salary || job.salario, description: job.description || '' };
    }

    content.innerHTML = `
        <div class="space-y-4">
            <h3 class="text-lg font-bold text-white">${id ? 'EDITAR VAGA' : 'NOVA VAGA'}</h3>
            <input id="job-title" value="${dados.title||''}" class="w-full p-3 rounded bg-white text-black font-bold" placeholder="Título da Vaga">
            <div class="grid grid-cols-2 gap-2">
                <input id="job-company" value="${dados.company||''}" class="w-full p-3 rounded bg-white text-black" placeholder="Empresa">
                <input id="job-salary" value="${dados.salary||''}" class="w-full p-3 rounded bg-white text-black" placeholder="Salário (Ex: 1.500,00)">
            </div>
            <div>
                <label class="block text-[10px] font-bold text-gray-400 mb-1 uppercase text-left">Custo para Candidato (ATLIX)</label>
                <input id="job-cost" type="number" value="${allLoadedJobs.find(j => j.id === id)?.cost_atlix || 0}" class="w-full p-3 rounded bg-yellow-50 text-black font-black" placeholder="Ex: 5">
            </div>
            <textarea id="job-description" class="w-full p-3 rounded bg-white text-black text-xs" rows="4" placeholder="Descrição da vaga...">${allLoadedJobs.find(j => j.id === id)?.description || ''}</textarea>
            <button onclick="window.salvarVaga('${id||''}')" class="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-500 shadow-lg">SALVAR VAGA 💼</button>
        </div>
    `;
}

window.salvarVaga = async (id) => {
    const data = { 
        title: document.getElementById('job-title').value, 
        titulo: document.getElementById('job-title').value, 
        company: document.getElementById('job-company').value, 
        salary: document.getElementById('job-salary').value,
        description: document.getElementById('job-description').value,
        cost_atlix: parseInt(document.getElementById('job-cost').value) || 0,
        updated_at: serverTimestamp() 
    };
    if(!data.title) return alert("Título obrigatório");
    try {
        if(id) { await updateDoc(doc(window.db, "jobs", id), data); } 
        else { data.status = 'ativo'; data.created_at = serverTimestamp(); await addDoc(collection(window.db, "jobs"), data); }
        window.fecharModalJobs(); loadList();
    } catch(e) { alert(e.message); }
};

async function executeBulkDelete() {
    if(!confirm("Excluir selecionados?")) return;
    const batch = writeBatch(window.db);
    selectedJobs.forEach(id => batch.delete(doc(window.db, "jobs", id)));
    await batch.commit();
    alert("Vagas excluídas.");
    selectedJobs.clear();
    loadList();
}
window.alterarStatusVaga = async (id, st) => { await updateDoc(doc(window.db, "jobs", id), {status: st}); loadList(); };
window.excluirVaga = async (id) => { if(confirm("Excluir?")) { await deleteDoc(doc(window.db, "jobs", id)); loadList(); } };

// --- GESTÃO DE ECONOMIA GLOBAL ---
async function carregarConfigGlobalJobs() {
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docSnap = await getDoc(doc(window.db, "configuracoes", "global"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('cfg-job-billing').value = data.billing_jobs_active !== undefined ? data.billing_jobs_active.toString() : "true";
        }
    } catch (e) { console.error("Erro ao carregar config global:", e); }
}

async function salvarConfigGlobalJobs() {
    const val = document.getElementById('cfg-job-billing').value === "true";
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await updateDoc(doc(window.db, "configuracoes", "global"), {
            billing_jobs_active: val,
            updated_at: serverTimestamp()
        });
        console.log("✅ Configuração de cobrança atualizada: " + val);
    } catch (e) { alert("Erro ao salvar config: " + e.message); }
}
window.atualizarPrecosPadrao = salvarConfigGlobalJobs;
