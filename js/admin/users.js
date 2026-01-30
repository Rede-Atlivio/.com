/* ARQUIVO: js/admin/users.js (VERSÃO FINAL V2) */
import { collection, getDocs, doc, updateDoc, query, limit, serverTimestamp, getDoc, writeBatch, runTransaction, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- VARIÁVEIS DE ESTADO ---
let currentType = 'users';
let selectedUsers = new Set();
let allLoadedUsers = []; 

// --- 1. INICIALIZAÇÃO ---
export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    allLoadedUsers = []; 
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

    // --- EXPÕE FUNÇÕES GLOBAIS (CRUCIAL PARA O ROBÔ FUNCIONAR) ---
    window.openEditor = openEditor;
    window.saveAction = saveAction;
    window.saveServiceAction = saveServiceAction; // <--- A ESTRELA DO SHOW
    window.openBalanceEditor = openBalanceEditor;
    window.setTransactionMode = setTransactionMode;
    window.executeAdjustment = executeAdjustment;

    // Listeners
    if(btnAdd) btnAdd.onclick = () => window.openEditor(viewType, null);
    
    // Configura Busca
    if(searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', (e) => filtrarListaLocal(e.target.value.toLowerCase()));
    }
    
    // Configura Botão de Exclusão em Massa
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeUserBulkDelete;

    console.log(`✅ Módulo Users V2 carregado: ${viewType}`);
    await loadList();
}

// --- 2. FUNÇÕES DE LISTAGEM ---
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

        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center opacity-50">Nada encontrado.</td></tr>`;
            countEl.innerText = `0 registros`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            data.id = d.id; 
            // Normaliza nome
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

    if(lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500">Nenhum resultado.</td></tr>`;
        return;
    }

    lista.forEach(data => {
        const isChecked = selectedUsers.has(data.id) ? 'checked' : '';
        const checkbox = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" data-id="${data.id}" ${isChecked}></td>`;
        const avatarImg = data.foto_perfil || data.photoURL || `https://ui-avatars.com/api/?name=${data._displayName}&background=random`;

        if(currentType === 'users') {
            // ... (Lógica de tabela de usuários - inalterada) ...
             let statusClass = "text-green-400 border-green-500/50 bg-green-500/10";
            if(data.status === 'banido' || data.status === 'suspenso' || data.status === 'rejeitado') statusClass = "text-red-400 border-red-500/50 bg-red-500/10";
            if(data.status === 'ativo') statusClass = "text-blue-400 border-blue-500/50 bg-blue-500/10";
            const saldo = parseFloat(data.saldo || 0);
            const saldoClass = saldo < 0 ? 'text-red-400' : 'text-emerald-400';

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500 font-mono">${data.email || data.id.substring(0,8)+'...'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs uppercase font-bold tracking-wider">${data.tipo || 'comum'}</td>
                    <td class="p-3"><div class="flex items-center gap-2"><span class="border ${statusClass} px-2 py-0.5 rounded text-[9px] uppercase font-bold">${data.status||'Ativo'}</span><span class="font-mono text-xs font-bold ${saldoClass}">R$ ${saldo.toFixed(2)}</span></div></td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition"><button onclick="window.openEditor('users','${data.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold mr-1 transition">EDITAR</button><button onclick="window.openBalanceEditor('${data.id}', ${saldo}, '${data._displayName}')" class="bg-slate-700 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold transition" title="Financeiro">💰</button></td>
                </tr>`;
        } else {
            // Prestadores
            let statusIcon = data.is_online ? "🟢" : "⚫";
            let statusLabel = data.status || "Novo";
            let rowOpacity = "opacity-100";
            if(data.status === 'em_analise') { statusIcon = "🟡"; statusLabel = "EM ANÁLISE"; }
            if(data.status === 'rejeitado') { statusIcon = "🔴"; statusLabel = "REJEITADO"; rowOpacity = "opacity-60"; }
            if(data.status === 'banido') { statusIcon = "⛔"; statusLabel = "BANIDO"; rowOpacity = "opacity-50 grayscale"; }
            if(data.status === 'suspenso') { statusIcon = "⚠️"; statusLabel = "SUSPENSO"; }
            
            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group ${rowOpacity}">
                    ${checkbox}
                    <td class="p-3"><div class="flex items-center gap-3"><img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div><div class="font-bold text-white text-sm">${data._displayName}</div><div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,20)+'...' : 'Sem bio'}</div></div></div></td>
                    <td class="p-3 text-gray-400 text-xs"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${data.services?.[0]?.category || 'Sem serviço'}</span>${data.services?.length > 1 ? `<span class="text-[9px] ml-1">+${data.services.length-1}</span>` : ''}</td>
                    <td class="p-3 text-xs font-bold text-white flex items-center gap-2 mt-2"><span>${statusIcon}</span> ${statusLabel.toUpperCase()}</td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition"><button onclick="window.openEditor('active_providers','${data.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold shadow transition transform active:scale-95">CURADORIA</button></td>
                </tr>`;
        }
    });
    document.querySelectorAll('.chk-user').forEach(c => c.addEventListener('change', (e) => toggleUserItem(e.target.dataset.id, e.target.checked)));
}

// --- 3. EDITOR E AÇÕES ---
async function openEditor(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    title.innerText = id ? "EDITAR / MODERAÇÃO" : "NOVO REGISTRO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    content.innerHTML = `<div class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></div>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4 animate-fade">`;

        // MÍDIA
        if (data.banner_url || data.foto_perfil) {
            html += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 flex gap-4">`;
            if(data.banner_url) html += `<div><p class="text-[9px]">Banner</p><img src="${data.banner_url}" class="h-20 w-32 object-cover rounded border border-gray-600"></div>`;
            if(data.foto_perfil) html += `<div><p class="text-[9px]">Avatar</p><img src="${data.foto_perfil}" class="w-16 h-16 object-cover rounded-full border border-gray-600"></div>`;
            html += `</div>`;
        }

        // 🔥 CURADORIA INDIVIDUAL (AQUI ESTÁ A MÁGICA)
        if (realCollection === 'active_providers' && id) {
             const servicos = data.services || [];
             if (servicos.length > 0) {
                 html += `<div class="mb-6"><h4 class="text-xs font-black text-blue-300 uppercase mb-2 border-b border-blue-900 pb-1">🛡️ Curadoria de Serviços (${servicos.length})</h4><div class="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">`;
                 
                 servicos.forEach((svc, idx) => {
                     let badge = "";
                     let border = "border-slate-700";
                     const st = svc.status || 'em_analise';
                     
                     if(st === 'aprovado') { badge="✅"; border="border-green-500/50"; }
                     else if(st === 'rejeitado' || st === 'suspenso') { badge="⛔"; border="border-red-500/50"; }
                     else { badge="⏳"; border="border-yellow-500/50"; }

                     html += `
                        <div class="bg-slate-900 p-3 rounded-lg border ${border} flex justify-between items-start">
                            <div>
                                <p class="text-xs font-bold text-white flex items-center gap-2">${badge} ${svc.category}</p>
                                <p class="text-[10px] text-gray-400 mt-0.5 max-w-[200px] truncate">${svc.description || 'Sem descrição'}</p>
                                <p class="text-[10px] text-emerald-400 font-mono mt-1">R$ ${svc.price}</p>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'aprovado')" class="bg-green-900/40 hover:bg-green-600 border border-green-800 text-white p-1.5 rounded text-[9px] font-bold transition" title="Aprovar este serviço">✅</button>
                                <button onclick="window.saveServiceAction('${id}', ${idx}, 'suspenso')" class="bg-red-900/40 hover:bg-red-600 border border-red-800 text-white p-1.5 rounded text-[9px] font-bold transition" title="Suspender este serviço">🚫</button>
                            </div>
                        </div>
                     `;
                 });
                 html += `</div></div>`;
             } else {
                 html += `<div class="p-4 bg-yellow-900/20 border border-yellow-800 rounded mb-4 text-xs text-yellow-500">Este prestador ainda não cadastrou serviços.</div>`;
             }
        }

        // FINANCEIRO E CAMPOS GERAIS
        // ... (Mantém o código anterior para saldo e campos) ...
        if (realCollection === 'usuarios' && id) {
            const saldo = parseFloat(data.saldo || 0);
            const corSaldo = saldo < 0 ? 'text-red-400' : 'text-emerald-400';
            html += `<div class="bg-slate-900/50 p-4 rounded-xl border border-white/10 flex justify-between items-center mb-4"><div><p class="text-[10px] text-gray-400 uppercase font-bold">Saldo</p><h3 class="text-2xl font-mono font-black ${corSaldo}">R$ ${saldo.toFixed(2)}</h3></div><button onclick="window.openBalanceEditor('${id}', ${saldo}, '${data.nome || 'Usuário'}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow">Ajustar</button></div>`;
        }
        const keys = id ? Object.keys(data).sort() : ['nome', 'email', 'tipo', 'status']; 
        const ignored = ['created_at', 'updated_at', 'services', 'geo_location', 'is_demo', 'visibility_score', 'saldo', '_displayName', 'id'];
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => { if(ignored.includes(key)) return; const val = data[key] || ""; html += `<div><label class="inp-label">${key.toUpperCase()}</label><input type="text" id="edit-${key}" value="${val}" class="inp-editor"></div>`; });
        html += `</div>`;

        // BOTÕES GLOBAIS
        html += `<div class="border-t border-slate-700 pt-6 mt-6"><p class="text-center text-gray-500 text-[9px] uppercase font-bold mb-3">⚠️ Ações da Conta (Afeta Tudo)</p><div class="flex gap-3"><button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-xs shadow-lg">⛔ BANIR CONTA</button><button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs shadow-lg">💾 SALVAR DADOS GERAIS</button></div><div class="mt-2 text-center"><p class="text-[9px] text-gray-600">Para aprovar serviços, use os botões na lista de serviços acima.</p></div>`;
        html += `</div></div>`;
        content.innerHTML = html;

    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro: ${e.message}</p>`; }
}

// --- 4. FUNÇÃO NOVA: SAVE SERVICE ACTION ---
async function saveServiceAction(id, index, status) {
    if(!confirm(`Mudar status deste serviço para: ${status.toUpperCase()}?`)) return;
    const modalContent = document.getElementById('modal-content');
    modalContent.style.opacity = '0.5'; modalContent.style.pointerEvents = 'none';

    try {
        const db = window.db;
        const ref = doc(db, "active_providers", id);
        const snap = await getDoc(ref);
        if(!snap.exists()) throw new Error("Prestador não encontrado.");
        
        const data = snap.data();
        let services = data.services || [];
        
        if (services[index]) {
            services[index].status = status;
        } else {
            throw new Error("Índice de serviço inválido.");
        }

        await updateDoc(ref, { services: services, updated_at: serverTimestamp() });
        
        let msg = status === 'aprovado' ? `Seu serviço de ${services[index].category} foi APROVADO! 🟢` : `Seu serviço de ${services[index].category} foi colocado em análise/suspenso. 🔴`;
        await addDoc(collection(db, "notifications"), { uid: id, message: msg, read: false, created_at: serverTimestamp(), type: status === 'aprovado' ? 'success' : 'alert' });

        alert("✅ Status do serviço atualizado!");
        window.openEditor('active_providers', id); // Recarrega

    } catch(e) {
        alert("Erro ao atualizar serviço: " + e.message);
        modalContent.style.opacity = '1'; modalContent.style.pointerEvents = 'auto';
    }
}

// --- 5. FUNÇÕES AUXILIARES E GLOBAIS ---
async function saveAction(collectionName, id, action) {
    if(!id) return alert("Criação manual ainda não implementada.");
    if(!confirm(`Confirmar ação GLOBAL na CONTA: ${action.toUpperCase()}?`)) return;
    try {
        const ref = doc(window.db, collectionName, id);
        let updates = { updated_at: serverTimestamp() };
        let mensagemNotificacao = "";
        const inputs = document.querySelectorAll('[id^="edit-"]');
        if(inputs.length > 0) { inputs.forEach(inp => { const key = inp.id.replace('edit-', ''); updates[key] = inp.value; }); }
        if (action === 'banir') { updates.status = 'banido'; updates.visibility_score = 0; updates.is_online = false; updates.banned_at = serverTimestamp(); mensagemNotificacao = "⛔ Conta bloqueada permanentemente por violação dos termos."; }
        await updateDoc(ref, updates);
        if(mensagemNotificacao) { await addDoc(collection(window.db, "notifications"), { uid: id, message: mensagemNotificacao, read: false, created_at: serverTimestamp(), type: 'system' }); }
        document.getElementById('modal-editor').classList.add('hidden');
        await loadList();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
}

function filtrarListaLocal(termo) { if(!termo) { renderTable(allLoadedUsers); return; } const filtrados = allLoadedUsers.filter(u => { const nome = (u._displayName || "").toLowerCase(); const email = (u.email || "").toLowerCase(); const id = (u.id || "").toLowerCase(); return nome.includes(termo) || email.includes(termo) || id.includes(termo); }); renderTable(filtrados); }
function toggleUserSelectAll(checked) { document.querySelectorAll('.chk-user').forEach(c => { c.checked = checked; toggleUserItem(c.dataset.id, checked); }); }
function toggleUserItem(id, selected) { if(selected) selectedUsers.add(id); else selectedUsers.delete(id); updateUserBulkUI(); }
function updateUserBulkUI() { const bar = document.getElementById('bulk-actions'); const count = document.getElementById('bulk-count'); if(selectedUsers.size > 0) { bar.classList.add('visible'); bar.style.transform = 'translateY(0)'; count.innerText = selectedUsers.size; } else { bar.classList.remove('visible'); bar.style.transform = 'translateY(100%)'; } }
async function executeUserBulkDelete() { if(!confirm(`EXCLUIR ${selectedUsers.size} registros PERMANENTEMENTE?`)) return; const btn = document.getElementById('btn-bulk-delete'); btn.innerText = "AGUARDE..."; try { const db = window.db; const batch = writeBatch(db); const col = currentType === 'users' ? 'usuarios' : 'active_providers'; selectedUsers.forEach(id => { const ref = doc(db, col, id); batch.delete(ref); }); await batch.commit(); selectedUsers.clear(); updateUserBulkUI(); await loadList(); alert("✅ Exclusão concluída!"); } catch(e) { alert("Erro: " + e.message); } finally { btn.innerHTML = `<i data-lucide="trash-2"></i> EXCLUIR`; lucide.createIcons(); } }
function openBalanceEditor(uid, currentBalance, nomeUser) { const modal = document.getElementById('modal-editor'); const content = document.getElementById('modal-content'); const title = document.getElementById('modal-title'); modal.classList.remove('hidden'); title.innerText = "FINANCEIRO"; document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden'); content.innerHTML = `<div class="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6 text-center animate-fade"><p class="text-xs text-gray-400 uppercase font-bold">Saldo</p><h2 class="text-3xl font-black ${currentBalance < 0 ? 'text-red-500' : 'text-emerald-500'}">R$ ${currentBalance.toFixed(2)}</h2></div><div class="grid grid-cols-2 gap-4 animate-fade"><button onclick="window.setTransactionMode('credit')" id="btn-mode-credit" class="bg-emerald-900/50 border border-emerald-500/30 text-white p-4 rounded-xl hover:bg-emerald-900/80 transition"><p class="font-bold text-emerald-400">🟢 CRÉDITO</p></button><button onclick="window.setTransactionMode('debit')" id="btn-mode-debit" class="bg-red-900/50 border border-red-500/30 text-white p-4 rounded-xl hover:bg-red-900/80 transition"><p class="font-bold text-red-400">🔴 DÉBITO</p></button></div><div id="trans-form" class="mt-6 hidden animate-fade"><input type="number" id="trans-amount" class="inp-editor text-lg font-bold text-white mb-4" placeholder="0.00"><input type="text" id="trans-desc" class="inp-editor mb-4" placeholder="Motivo"><button onclick="window.executeAdjustment('${uid}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg">CONFIRMAR</button></div>`; window.tempTransMode = null; }
function setTransactionMode(mode) { window.tempTransMode = mode; document.getElementById('trans-form').classList.remove('hidden'); const btnCredit = document.getElementById('btn-mode-credit'); const btnDebit = document.getElementById('btn-mode-debit'); if (mode === 'credit') { btnCredit.classList.add('ring-2', 'ring-emerald-400'); btnDebit.classList.remove('ring-2', 'ring-red-400'); btnDebit.style.opacity = '0.5'; btnCredit.style.opacity = '1'; } else { btnDebit.classList.add('ring-2', 'ring-red-400'); btnCredit.classList.remove('ring-2', 'ring-emerald-400'); btnCredit.style.opacity = '0.5'; btnDebit.style.opacity = '1'; } }
async function executeAdjustment(uid) { const amount = parseFloat(document.getElementById('trans-amount').value); const desc = document.getElementById('trans-desc').value; const mode = window.tempTransMode; if (!amount || amount <= 0) return alert("Digite valor."); if (!desc) return alert("Digite motivo."); const finalAmount = mode === 'credit' ? amount : -amount; if(!confirm(`Confirmar?`)) return; const btn = document.querySelector('#trans-form button'); btn.innerText = "PROCESSANDO..."; btn.disabled = true; try { const db = window.db; const userRef = doc(db, "usuarios", uid); await runTransaction(db, async (transaction) => { const userDoc = await transaction.get(userRef); if (!userDoc.exists()) throw "Usuário inexistente!"; const newBalance = (userDoc.data().saldo || 0) + finalAmount; transaction.update(userRef, { saldo: newBalance, updated_at: serverTimestamp() }); }); alert("✅ Saldo atualizado!"); document.getElementById('modal-editor').classList.add('hidden'); loadList(); } catch (e) { alert("Erro: " + e.message); btn.innerText = "CONFIRMAR"; btn.disabled = false; } }
