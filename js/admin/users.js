import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users';

// 1. INICIALIZAÇÃO
export async function init(viewType) {
    currentType = viewType;
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
    if (viewType === 'users') {
        headers.innerHTML = `<th class="p-3">NOME / ID</th><th class="p-3">TIPO & EMAIL</th><th class="p-3">SALDO</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO USUÁRIO";
    } else {
        headers.innerHTML = `<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">SCORE</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO PRESTADOR";
    }

    if(btnAdd) btnAdd.onclick = () => window.openEditor(viewType, null);
    
    await loadList();
}

// 2. LISTAGEM COM FILTRO (REAL vs DEMO)
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        const collectionName = currentType === 'users' ? 'usuarios' : 'active_providers';
        const isDemoMode = window.currentDataMode === 'demo';

        // LÓGICA DE FILTRO DO BOTÃO
        let q;
        if (isDemoMode) {
            // Modo Demo: Busca onde is_demo == true
            q = query(collection(db, collectionName), where('is_demo', '==', true), limit(50));
        } else {
            // Modo Real: Busca o resto (ou explicitamente não demo, se preferir)
            // Aqui buscamos geral limitado a 50, mas idealmente seria where('is_demo', '!=', true)
            // Por enquanto, vamos assumir que o que não é demo é real.
            q = query(collection(db, collectionName), orderBy('created_at', 'desc'), limit(50));
        }

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros (${isDemoMode ? 'DEMO' : 'REAIS'})`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500 opacity-50">Nenhum registro ${isDemoMode ? 'demonstrativo' : 'real'} encontrado.</td></tr>`;
            return;
        }

        snap.forEach(docSnap => {
            if (currentType === 'users') renderUserRow(tbody, docSnap.id, docSnap.data());
            else renderServiceRow(tbody, docSnap.id, docSnap.data());
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro: ${e.message}</td></tr>`;
    }
}

// 3. RENDERIZADORES
function renderUserRow(tbody, id, data) {
    let statusClass = "bg-green-900/30 text-green-400 border-green-500/50";
    if (data.status === 'suspenso') statusClass = "bg-red-900/30 text-red-400 border-red-500/50";
    
    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3"><div class="font-bold text-white">${data.nome || "Sem Nome"}</div><div class="text-[10px] text-gray-500 font-mono">${id.substring(0,6)}...</div></td>
            <td class="p-3"><div class="text-xs text-blue-300 font-bold uppercase">${data.tipo || "CLIENTE"}</div><div class="text-[10px] text-gray-400">${data.email || "-"}</div></td>
            <td class="p-3 font-mono text-white">R$ ${(data.saldo || 0).toFixed(2)}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-bold border ${statusClass}">${data.status || 'ATIVO'}</span></td>
            <td class="p-3 text-right"><button onclick="window.openEditor('users', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold transition">✏️ EDITAR</button></td>
        </tr>`;
}

function renderServiceRow(tbody, id, data) {
    let statusHtml = data.is_online ? `<span class="text-green-400 font-bold text-[10px]">🟢 ONLINE</span>` : `<span class="text-gray-500 font-bold text-[10px]">⚫ OFFLINE</span>`;
    if(data.status === 'em_analise') statusHtml = `<span class="text-yellow-400 font-black text-[10px] animate-pulse">🟡 ANALISAR</span>`;
    const demoBadge = data.is_demo ? `<span class="ml-1 text-[8px] bg-purple-600 px-1 rounded text-white">DEMO</span>` : "";

    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3"><div class="flex items-center gap-1"><span class="font-bold text-white">${data.nome_profissional || "Prestador"}</span>${demoBadge}</div></td>
            <td class="p-3"><div class="text-xs text-white">${data.services?.[0]?.category || "-"}</div><div class="text-[10px] text-gray-400">R$ ${data.services?.[0]?.price || 0}</div></td>
            <td class="p-3"><div class="text-xs font-bold ${data.visibility_score >= 100 ? 'text-green-400' : 'text-gray-500'}">${data.visibility_score || 0} pts</div></td>
            <td class="p-3">${statusHtml}</td>
            <td class="p-3 text-right"><button onclick="window.openEditor('active_providers', '${id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow">🕵️ CURADORIA</button></td>
        </tr>`;
}

// 4. EDITOR GLOBAL
window.openEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = id ? "EDITAR / CURADORIA" : "NOVO REGISTRO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = `<p class="text-center text-gray-500 py-10">Carregando...</p>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4">`;
        if (data.banner_url || data.foto_perfil) {
            html += `<div class="bg-slate-800 p-4 rounded-xl mb-4 flex gap-4">
                ${data.banner_url ? `<img src="${data.banner_url}" class="h-20 w-32 object-cover rounded">` : ''}
                ${data.foto_perfil ? `<img src="${data.foto_perfil}" class="h-16 w-16 rounded-full object-cover">` : ''}
            </div>`;
        }

        const keys = id ? Object.keys(data).sort() : ['nome', 'email', 'tipo', 'status'];
        html += `<div class="grid grid-cols-2 gap-4">`;
        keys.forEach(key => {
            if(['created_at','updated_at','services'].includes(key)) return;
            html += `<div><label class="inp-label">${key}</label><input type="text" id="edit-${key}" value="${data[key]||''}" class="inp-editor"></div>`;
        });
        html += `</div>`;

        // Botões de Ação
        html += `<div class="mt-6 pt-4 border-t border-slate-700 flex gap-2">`;
        if(realCollection === 'active_providers') {
            html += `<button onclick="window.saveAction('${realCollection}', '${id}', 'aprovar')" class="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold text-xs">✅ APROVAR (SCORE 100)</button>`;
            html += `<button onclick="window.saveAction('${realCollection}', '${id}', 'rejeitar')" class="flex-1 bg-red-900 text-white py-3 rounded-lg font-bold text-xs">🚫 REJEITAR</button>`;
        }
        html += `<button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-xs">💾 SALVAR</button>`;
        html += `</div></div>`;

        content.innerHTML = html;
    } catch(e) { content.innerHTML = `Erro: ${e.message}`; }
};

window.saveAction = async (col, id, action) => {
    if(!id) return alert("Criação não implementada.");
    try {
        const ref = doc(window.db, col, id);
        let updates = { updated_at: serverTimestamp() };
        
        document.querySelectorAll('[id^="edit-"]').forEach(i => updates[i.id.replace('edit-', '')] = i.value);
        
        if (action === 'aprovar') { updates.status = 'aprovado'; updates.visibility_score = 100; updates.is_online = false; alert("✅ Aprovado!"); }
        if (action === 'rejeitar') { updates.status = 'rejeitado'; updates.visibility_score = 0; }
        
        await updateDoc(ref, updates);
        document.getElementById('modal-editor').classList.add('hidden');
        loadList();
    } catch(e) { alert(e.message); }
};
