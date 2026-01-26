import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentType = 'users'; // 'users' ou 'services'

// ============================================================================
// 1. INICIALIZAÇÃO E HEADERS
// ============================================================================
export async function init(viewType) {
    currentType = viewType;
    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    
    // Configura Títulos e Botão
    if (viewType === 'users') {
        headers.innerHTML = `
            <th class="p-3 text-left">NOME / ID</th>
            <th class="p-3 text-left">TIPO & EMAIL</th>
            <th class="p-3 text-left">SALDO</th>
            <th class="p-3 text-left">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO USUÁRIO";
    } else {
        headers.innerHTML = `
            <th class="p-3 text-left">PRESTADOR</th>
            <th class="p-3 text-left">CATEGORIA & PREÇO</th>
            <th class="p-3 text-left">SCORE</th>
            <th class="p-3 text-left">STATUS</th>
            <th class="p-3 text-right">AÇÕES</th>
        `;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO PRESTADOR";
    }

    // Configura o botão de adicionar para abrir o modal correto
    if(btnAdd) btnAdd.onclick = () => window.openEditor(viewType, null);

    console.log(`✅ Módulo Users carregado: ${viewType}`);
    await loadList();
}

// ============================================================================
// 2. LISTAGEM DE DADOS (LOAD LIST)
// ============================================================================
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        const collectionName = currentType === 'users' ? 'usuarios' : 'active_providers';
        
        // Query básica (Limitada a 50 para performance)
        const q = query(collection(db, collectionName), limit(50));
        const snap = await getDocs(q);

        tbody.innerHTML = "";
        countEl.innerText = `${snap.size} registros visíveis`;

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500 opacity-50">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Renderização Condicional (Usuário vs Prestador)
            if (currentType === 'users') {
                renderUserRow(tbody, id, data);
            } else {
                renderServiceRow(tbody, id, data);
            }
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar: ${e.message}</td></tr>`;
    }
}

function renderUserRow(tbody, id, data) {
    const nome = data.nome || data.email || "Sem Nome";
    const email = data.email || "-";
    const tipo = data.tipo || "cliente";
    const saldo = parseFloat(data.saldo || 0).toFixed(2);
    
    // Status Logic
    let statusClass = "bg-green-900/30 text-green-400 border-green-500/50";
    let statusIcon = "🟢";
    if (data.status === 'suspenso') { statusClass = "bg-red-900/30 text-red-400 border-red-500/50"; statusIcon = "🔴"; }
    if (data.status === 'alerta') { statusClass = "bg-yellow-900/30 text-yellow-400 border-yellow-500/50"; statusIcon = "⚠️"; }

    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition group">
            <td class="p-3">
                <div class="font-bold text-white">${nome}</div>
                <div class="text-[10px] text-gray-500 font-mono">${id.substring(0,8)}...</div>
            </td>
            <td class="p-3">
                <div class="text-xs text-blue-300 font-bold uppercase">${tipo}</div>
                <div class="text-[10px] text-gray-400">${email}</div>
            </td>
            <td class="p-3 font-mono text-white">R$ ${saldo}</td>
            <td class="p-3">
                <span class="px-2 py-1 rounded text-[10px] font-bold border ${statusClass}">${statusIcon} ${data.status || 'ATIVO'}</span>
            </td>
            <td class="p-3 text-right">
                <button onclick="window.openEditor('users', '${id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow">✏️ EDITAR</button>
            </td>
        </tr>
    `;
}

function renderServiceRow(tbody, id, data) {
    const nome = data.nome_profissional || "Prestador";
    const servicos = data.services ? data.services.length : 0;
    const catPrincipal = data.services?.[0]?.category || "Geral";
    const preco = data.services?.[0]?.price || 0;
    const score = data.visibility_score || 0;
    const isOnline = data.is_online === true;

    // Status Visual (Aprovação e Online)
    let statusHtml = "";
    if (data.status === 'em_analise') {
        statusHtml = `<span class="px-2 py-1 rounded text-[10px] font-black border bg-yellow-600/20 text-yellow-400 border-yellow-500 animate-pulse">🟡 EM ANÁLISE</span>`;
    } else if (data.status === 'rejeitado') {
        statusHtml = `<span class="px-2 py-1 rounded text-[10px] font-bold border bg-red-900/20 text-red-400 border-red-500">🔴 REJEITADO</span>`;
    } else {
        // Aprovado
        statusHtml = isOnline 
            ? `<span class="px-2 py-1 rounded text-[10px] font-bold border bg-green-900/20 text-green-400 border-green-500">🟢 ONLINE</span>`
            : `<span class="px-2 py-1 rounded text-[10px] font-bold border bg-gray-700/50 text-gray-400 border-gray-600">⚫ OFFLINE</span>`;
    }

    // Destaque se for DEMO
    const demoBadge = data.is_demo ? `<span class="ml-2 text-[9px] bg-purple-600 text-white px-1 rounded">DEMO</span>` : "";

    tbody.innerHTML += `
        <tr class="border-b border-white/5 hover:bg-white/5 transition">
            <td class="p-3">
                <div class="flex items-center gap-2">
                    <div class="font-bold text-white">${nome}</div>
                    ${demoBadge}
                </div>
            </td>
            <td class="p-3">
                <div class="text-xs text-white">${catPrincipal}</div>
                <div class="text-[10px] text-gray-400">+ ${servicos} serviços • R$ ${preco}+</div>
            </td>
            <td class="p-3">
                <div class="text-xs font-bold ${score >= 100 ? 'text-green-400' : 'text-gray-500'}">${score} pts</div>
            </td>
            <td class="p-3">${statusHtml}</td>
            <td class="p-3 text-right">
                <button onclick="window.openEditor('active_providers', '${id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow">🕵️ CURADORIA</button>
            </td>
        </tr>
    `;
}

// ============================================================================
// 3. EDITOR UNIVERSAL & CURADORIA (POP-UP)
// ============================================================================
window.openEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    const btnClose = document.getElementById('btn-close-modal');

    // Mapeamento de nome real da coleção
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    title.innerText = id ? "EDITAR / CURADORIA" : "NOVO REGISTRO";
    content.innerHTML = `<div class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div><p class="mt-4 text-gray-400 text-xs">Carregando dados...</p></div>`;

    // Fecha modal
    btnClose.onclick = () => modal.classList.add('hidden');

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        // Renderiza Formulário Dinâmico
        let html = `<div class="space-y-4">`;

        // 1. ÁREA DE MÍDIA (CURADORIA)
        // Detecta banners e fotos para mostrar preview
        if (data.banner_url || data.foto_perfil) {
            html += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4">
                <p class="text-[10px] uppercase font-bold text-gray-400 mb-2">📸 Mídia do Perfil</p>
                <div class="grid grid-cols-2 gap-4">`;
            
            if(data.banner_url) html += `<div><p class="text-[9px]">Banner</p><img src="${data.banner_url}" class="w-full h-24 object-cover rounded border border-gray-600"></div>`;
            if(data.foto_perfil) html += `<div><p class="text-[9px]">Avatar</p><img src="${data.foto_perfil}" class="w-16 h-16 object-cover rounded-full border border-gray-600"></div>`;
            
            html += `</div></div>`;
        }

        // 2. CAMPOS DE TEXTO
        const keys = id ? Object.keys(data).sort() : ['nome', 'email', 'tipo', 'status']; // Campos padrão para novo
        
        // Remove campos técnicos
        const ignored = ['created_at', 'updated_at', 'services', 'geo_location'];
        
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => {
            if(ignored.includes(key)) return;
            const val = data[key] || "";
            html += `
                <div>
                    <label class="inp-label">${key.toUpperCase()}</label>
                    <input type="text" id="edit-${key}" value="${val}" class="inp-editor">
                </div>
            `;
        });
        html += `</div>`;

        // 3. AÇÕES DE PODER (BOTÕES)
        html += `<div class="border-t border-slate-700 pt-6 mt-6">`;
        
        if (realCollection === 'active_providers') {
            // AÇÕES DE PRESTADOR
            html += `
                <p class="text-center text-gray-400 text-[10px] uppercase font-bold mb-3">👮 Painel de Moderação</p>
                <div class="grid grid-cols-3 gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'rejeitar')" class="bg-red-900/50 hover:bg-red-600 border border-red-800 text-white py-3 rounded-lg font-bold text-xs">🚫 REJEITAR</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'suspender')" class="bg-yellow-900/50 hover:bg-yellow-600 border border-yellow-800 text-white py-3 rounded-lg font-bold text-xs">⚠️ SUSPENDER</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'aprovar')" class="bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-black text-xs shadow-lg shadow-green-900/20">✅ APROVAR (SCORE 100)</button>
                </div>
            `;
        } else {
            // AÇÕES DE USUÁRIO COMUM
            html += `
                <div class="flex gap-3">
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold text-xs">⛔ BANIR USUÁRIO</button>
                    <button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-xs">💾 SALVAR DADOS</button>
                </div>
            `;
        }
        html += `</div></div>`; // Fecha containers

        content.innerHTML = html;

    } catch (e) {
        content.innerHTML = `<p class="text-red-500 text-center">Erro: ${e.message}</p>`;
    }
};

// ============================================================================
// 4. LÓGICA DE SALVAMENTO (SAVE ACTION)
// ============================================================================
window.saveAction = async (collectionName, id, action) => {
    if(!id) return alert("Criação de novos usuários ainda não implementada neste editor.");
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

        // Aplica Lógica de Negócio da Ação
        if (action === 'aprovar') {
            updates.status = 'aprovado';
            updates.visibility_score = 100; // Regra de Ouro
            updates.is_online = false; // Começa offline mas liberado
            alert("✅ Prestador Aprovado! Score definido para 100.");
        } 
        else if (action === 'rejeitar') {
            updates.status = 'rejeitado';
            updates.visibility_score = 0;
            updates.is_online = false;
        }
        else if (action === 'suspender') {
            updates.status = 'suspenso';
            updates.visibility_score = 0;
            updates.is_online = false;
        }
        else if (action === 'banir') {
            updates.status = 'banido';
            // Aqui futuramente pode chamar uma Cloud Function para deletar o Auth
        }

        await updateDoc(ref, updates);
        
        // Fecha modal e recarrega
        document.getElementById('modal-editor').classList.add('hidden');
        await loadList(); // Recarrega a tabela

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
};
