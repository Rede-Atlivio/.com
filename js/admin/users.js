import { collection, getDocs, doc, updateDoc, query, orderBy, limit, serverTimestamp, getDoc, writeBatch, runTransaction, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis de Estado
let currentType = 'users';
let selectedUsers = new Set();
let allLoadedUsers = []; 
let tempTransMode = null; 

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init(viewType) {
    currentType = viewType;
    selectedUsers.clear();
    allLoadedUsers = []; 
    
    // Atualiza UI de Bulk (Garante que a barra comece oculta)
    updateUserBulkUI();

    const headers = document.getElementById('list-header');
    const btnAdd = document.getElementById('btn-list-add');
    const searchInput = document.getElementById('list-search'); 
    
    // Header com Checkbox Mestre
    const checkHeader = `<th class="p-3 w-10"><input type="checkbox" id="check-users-all" class="chk-custom"></th>`;
    
    if (viewType === 'users') {
        headers.innerHTML = `${checkHeader}<th class="p-3">IDENTIFICAÇÃO</th><th class="p-3">TIPO</th><th class="p-3">STATUS / SALDO</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO USUÁRIO";
    } else {
        headers.innerHTML = `${checkHeader}<th class="p-3">PRESTADOR</th><th class="p-3">CATEGORIA</th><th class="p-3">STATUS</th><th class="p-3 text-right">AÇÕES</th>`;
        if(btnAdd) btnAdd.innerHTML = "+ NOVO PRESTADOR";
    }

    // Bind de Eventos (Seguro)
    if(btnAdd) btnAdd.onclick = function() { window.openEditor(viewType, null); };

    // Listener de Busca Seguro
    if(searchInput) {
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', function(e) {
            const termo = e.target.value ? e.target.value.toLowerCase() : "";
            filtrarListaLocal(termo);
        });
        newSearch.value = ""; 
    }
    
    // Listener do Checkbox Mestre
    const chkAll = document.getElementById('check-users-all');
    if(chkAll) {
        chkAll.addEventListener('change', function(e) {
            toggleUserSelectAll(e.target.checked);
        });
    }
    
    // Listener Bulk Delete
    const btnBulk = document.getElementById('btn-bulk-delete');
    if(btnBulk) btnBulk.onclick = executeUserBulkDelete;

    console.log(`✅ Módulo Users carregado e seguro: ${viewType}`);
    await loadList();
}

// ============================================================================
// 2. CARREGAMENTO (SHERLOCK HOLMES)
// ============================================================================
async function loadList() {
    const tbody = document.getElementById('list-body');
    const countEl = document.getElementById('list-count');
    
    // Loader Seguro
    tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></td></tr>`;

    try {
        const db = window.db;
        const col = currentType === 'users' ? 'usuarios' : 'active_providers';
        const q = query(collection(db, col), limit(200)); 

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
            
            // Lógica de Identificação
            let nomeReal = 'Desconhecido';
            if (data.nome_profissional) nomeReal = data.nome_profissional;
            else if (data.displayName) nomeReal = data.displayName;
            else if (data.nome && data.nome !== 'User') nomeReal = data.nome;
            else if (data.email) nomeReal = data.email.split('@')[0];
            
            if(nomeReal) {
                nomeReal = nomeReal.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
            }
            
            data._displayName = nomeReal; 
            data.saldo = parseFloat(data.saldo || data.wallet_balance || 0);

            allLoadedUsers.push(data);
        });

        countEl.innerText = `${allLoadedUsers.length} registros`;
        renderTable(allLoadedUsers);

    } catch (e) { console.error("Erro LoadList:", e); }
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
        const avatarImg = data.foto_perfil || data.photoURL || `https://ui-avatars.com/api/?name=${data._displayName}&background=random`;

        // Renderização Condicional (Usuário vs Prestador)
        if(currentType === 'users') {
            let statusClass = "text-green-400 border-green-500/50 bg-green-500/10";
            if(['banido', 'suspenso', 'rejeitado'].includes(data.status)) statusClass = "text-red-400 border-red-500/50 bg-red-500/10";
            if(data.status === 'ativo') statusClass = "text-blue-400 border-blue-500/50 bg-blue-500/10";
            
            const saldoClass = data.saldo < 0 ? 'text-red-400' : 'text-emerald-400';
            const origem = data.traffic_source ? `<span class="bg-gray-700 text-gray-300 px-1.5 rounded text-[9px] uppercase ml-2">${data.traffic_source}</span>` : '';

            // Checkbox com Evento Seguro via ID
            const checkboxHTML = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" id="chk-${data.id}" ${isChecked}></td>`;

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group">
                    ${checkboxHTML}
                    <td class="p-3">
                        <div class="flex items-center gap-3">
                            <img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10">
                            <div>
                                <div class="font-bold text-white text-sm flex items-center">${data._displayName} ${origem}</div>
                                <div class="text-[10px] text-gray-500 font-mono">${data.email || data.phone || data.id.substring(0,8)+'...'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-gray-400 text-xs uppercase font-bold tracking-wider">${data.is_provider ? 'Prestador' : 'Cliente'}</td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <span class="border ${statusClass} px-2 py-0.5 rounded text-[9px] uppercase font-bold">${data.status||'Ativo'}</span>
                            <span class="font-mono text-xs font-bold ${saldoClass}">R$ ${data.saldo.toFixed(2)}</span>
                        </div>
                    </td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition flex justify-end gap-1">
                        <button onclick="window.darBonus('${data.id}', '${data._displayName}')" class="bg-amber-900/50 hover:bg-amber-600 text-amber-200 border border-amber-800 px-2 py-1 rounded text-xs font-bold transition" title="Dar Bônus">🎁</button>
                        <button onclick="window.openBalanceEditor('${data.id}', ${data.saldo}, '${data._displayName}')" class="bg-emerald-900/50 hover:bg-emerald-600 text-emerald-200 border border-emerald-800 px-2 py-1 rounded text-xs font-bold transition" title="Gestão Financeira">💰</button>
                        <button onclick="window.openEditor('users','${data.id}')" class="bg-slate-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold transition">EDITAR</button>
                    </td>
                </tr>`;
        } else {
            // Layout Prestador
            let statusIcon = data.is_online ? "🟢" : "⚫";
            let statusLabel = data.status || "Novo";
            let rowOpacity = "opacity-100";

            if(data.status === 'em_analise') { statusIcon = "🟡"; statusLabel = "EM ANÁLISE"; }
            if(data.status === 'rejeitado') { statusIcon = "🔴"; statusLabel = "REJEITADO"; rowOpacity = "opacity-60"; }
            if(data.status === 'banido') { statusIcon = "⛔"; statusLabel = "BANIDO"; rowOpacity = "opacity-50 grayscale"; }
            
            const checkboxHTML = `<td class="p-3"><input type="checkbox" class="chk-user chk-custom" id="chk-${data.id}" ${isChecked}></td>`;

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition group ${rowOpacity}">
                    ${checkboxHTML}
                    <td class="p-3">
                        <div class="flex items-center gap-3">
                            <img src="${avatarImg}" class="w-8 h-8 rounded-full object-cover border border-white/10">
                            <div>
                                <div class="font-bold text-white text-sm">${data._displayName}</div>
                                <div class="text-[10px] text-gray-500">${data.bio ? data.bio.substring(0,20)+'...' : 'Sem bio'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3 text-gray-400 text-xs">
                        <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">
                            ${data.services?.[0]?.category || 'Sem serviço'}
                        </span>
                    </td>
                    <td class="p-3 text-xs font-bold text-white flex items-center gap-2 mt-2">
                        <span>${statusIcon}</span> ${statusLabel.toUpperCase()}
                    </td>
                    <td class="p-3 text-right opacity-80 group-hover:opacity-100 transition">
                        <button onclick="window.openEditor('active_providers','${data.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold shadow transition transform active:scale-95">
                            CURADORIA
                        </button>
                    </td>
                </tr>`;
        }
    });

    // Reattach listeners para checkboxes individuais
    document.querySelectorAll('.chk-user').forEach(c => {
        c.addEventListener('change', function(e) {
            const uid = e.target.id.replace('chk-', '');
            toggleUserItem(uid, e.target.checked);
        });
    });
}

function filtrarListaLocal(termo) {
    if(!termo) { renderTable(allLoadedUsers); return; }
    const filtrados = allLoadedUsers.filter(u => {
        const nome = (u._displayName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const id = (u.id || "").toLowerCase();
        return nome.includes(termo) || email.includes(termo) || id.includes(termo);
    });
    renderTable(filtrados);
}

// ============================================================================
// 3. AÇÕES EM MASSA (Restauradas e Explícitas)
// ============================================================================
function toggleUserSelectAll(checked) {
    document.querySelectorAll('.chk-user').forEach(c => {
        c.checked = checked;
        const uid = c.id.replace('chk-', '');
        toggleUserItem(uid, checked);
    });
}

function toggleUserItem(id, selected) {
    if(selected) selectedUsers.add(id);
    else selectedUsers.delete(id);
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
    if(!confirm(`EXCLUIR ${selectedUsers.size} registros PERMANENTEMENTE?`)) return;
    
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
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerHTML = `EXCLUIR`;
    }
}

// ============================================================================
// 4. EDITOR E AÇÕES (EXPOSTAS GLOBALMENTE)
// ============================================================================

// A. Abrir Editor
window.openEditor = async function(collectionName, id) {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    const realCollection = collectionName === 'services' ? 'active_providers' : (collectionName === 'users' ? 'usuarios' : collectionName);

    modal.classList.remove('hidden');
    title.innerText = id ? "EDITAR REGISTRO" : "NOVO REGISTRO";
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
    
    content.innerHTML = `<div class="p-10 text-center"><div class="loader border-t-blue-500 rounded-full border-4 border-gray-200 h-8 w-8 animate-spin mx-auto"></div></div>`;

    try {
        let data = {};
        if (id) {
            const docSnap = await getDoc(doc(window.db, realCollection, id));
            if (docSnap.exists()) data = docSnap.data();
        }

        let html = `<div class="space-y-4 animate-fade">`;

        // MÍDIA (Div balanceada)
        if (data.banner_url || data.foto_perfil) {
            html += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-4 flex gap-4">`;
            if(data.banner_url) html += `<div><p class="text-[9px]">Banner</p><img src="${data.banner_url}" class="h-20 w-32 object-cover rounded border border-gray-600"></div>`;
            if(data.foto_perfil) html += `<div><p class="text-[9px]">Avatar</p><img src="${data.foto_perfil}" class="w-16 h-16 object-cover rounded-full border border-gray-600"></div>`;
            html += `</div>`;
        }

        // CAMPOS
        const keys = id ? Object.keys(data).sort() : ['nome', 'email', 'status'];
        const ignored = ['created_at', 'updated_at', 'services', 'geo_location', 'is_demo', 'visibility_score', 'saldo', '_displayName', 'id', 'wallet_balance'];
        
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        keys.forEach(key => {
            if(ignored.includes(key)) return;
            const val = data[key] || "";
            if(key === 'status') {
                html += `<div><label class="inp-label">STATUS</label>
                <select id="edit-status" class="inp-editor">
                    <option value="ativo" ${val==='ativo'?'selected':''}>ATIVO</option>
                    <option value="suspenso" ${val==='suspenso'?'selected':''}>SUSPENSO</option>
                    <option value="banido" ${val==='banido'?'selected':''}>BANIDO</option>
                    <option value="em_analise" ${val==='em_analise'?'selected':''}>EM ANÁLISE</option>
                </select></div>`;
            } else {
                html += `<div><label class="inp-label">${key.toUpperCase()}</label><input type="text" id="edit-${key}" value="${val}" class="inp-editor"></div>`;
            }
        });
        html += `</div>`;

        // BOTÕES DE AÇÃO (Divs balanceadas)
        html += `<div class="border-t border-slate-700 pt-6 mt-6">
            <p class="text-center text-gray-400 text-[10px] uppercase font-bold mb-3">Painel de Controle</p>
            <div class="grid grid-cols-3 gap-3 mb-3">
                <button onclick="window.saveAction('${realCollection}', '${id}', 'rejeitar')" class="bg-red-900/50 hover:bg-red-600 border border-red-800 text-white py-3 rounded-lg font-bold text-xs">🚫 REJEITAR</button>
                <button onclick="window.saveAction('${realCollection}', '${id}', 'suspender')" class="bg-yellow-900/50 hover:bg-yellow-600 border border-yellow-800 text-white py-3 rounded-lg font-bold text-xs">⚠️ SUSPENDER</button>
                <button onclick="window.saveAction('${realCollection}', '${id}', 'aprovar')" class="bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-black text-xs shadow-lg">✅ APROVAR</button>
            </div>
            <div class="flex gap-3">
                <button onclick="window.saveAction('${realCollection}', '${id}', 'banir')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-xs shadow-lg">⛔ BANIR</button>
                <button onclick="window.saveAction('${realCollection}', '${id}', 'salvar')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs shadow-lg">💾 SALVAR DADOS</button>
            </div>
        </div>`;
        
        html += `</div>`; // Fecha .space-y-4
        content.innerHTML = html;

    } catch (e) { content.innerHTML = `<p class="text-red-500">Erro editor: ${e.message}</p>`; }
};

// B. Salvar Ação
window.saveAction = async function(collectionName, id, action) {
    if(!id) return alert("Erro: ID não definido.");
    if(!confirm(`Confirmar ação: ${action.toUpperCase()}?`)) return;

    try {
        const ref = doc(window.db, collectionName, id);
        let updates = { updated_at: serverTimestamp() };
        let msg = "";

        // Coleta Inputs
        document.querySelectorAll('[id^="edit-"]').forEach(inp => {
            const key = inp.id.replace('edit-', '');
            updates[key] = inp.value;
        });

        if (action === 'aprovar') {
            updates.status = (collectionName === 'active_providers') ? 'aprovado' : 'ativo';
            updates.is_online = false; 
            updates.visibility_score = 100;
            msg = "✅ Conta APROVADA.";
        } 
        else if (action === 'rejeitar') { updates.status = 'rejeitado'; msg = "🚫 Cadastro rejeitado."; }
        else if (action === 'suspender') { updates.status = 'suspenso'; msg = "⚠️ Conta SUSPENSA."; }
        else if (action === 'banir') { 
            updates.status = 'banido'; 
            updates.is_online = false;
            msg = "⛔ Conta BANIDA."; 
        }

        // Limpa chaves undefined
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        await updateDoc(ref, updates);
        
        // Log
        if(msg) {
            await addDoc(collection(window.db, "system_events"), {
                action: action.toUpperCase(),
                details: `${msg} (ID: ${id})`,
                user: "ADMIN",
                timestamp: serverTimestamp()
            });
        }

        document.getElementById('modal-editor').classList.add('hidden');
        await loadList();

    } catch (e) { alert("Erro ao salvar: " + e.message); }
};

// C. Gestão Financeira
window.openBalanceEditor = function(uid, currentBalance, nomeUser) { 
    const modal = document.getElementById('modal-editor'); 
    const content = document.getElementById('modal-content'); 
    const title = document.getElementById('modal-title'); 
    
    modal.classList.remove('hidden'); 
    title.innerText = "FINANCEIRO"; 
    document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden'); 
    
    content.innerHTML = `
        <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6 text-center animate-fade">
            <p class="text-xs text-gray-400 uppercase font-bold">Saldo Atual</p>
            <h2 class="text-3xl font-black ${currentBalance < 0 ? 'text-red-500' : 'text-emerald-500'}">R$ ${currentBalance.toFixed(2)}</h2>
            <p class="text-[10px] text-gray-500 mt-1">${nomeUser}</p>
        </div>
        <div class="grid grid-cols-2 gap-4 animate-fade">
            <button onclick="window.setTransactionMode('credit')" id="btn-mode-credit" class="bg-emerald-900/50 border border-emerald-500/30 text-white p-4 rounded-xl hover:bg-emerald-900/80 transition flex flex-col items-center">
                <span class="text-2xl mb-1">💰</span><span class="font-bold text-emerald-400 text-xs">ADICIONAR</span>
            </button>
            <button onclick="window.setTransactionMode('debit')" id="btn-mode-debit" class="bg-red-900/50 border border-red-500/30 text-white p-4 rounded-xl hover:bg-red-900/80 transition flex flex-col items-center">
                <span class="text-2xl mb-1">💸</span><span class="font-bold text-red-400 text-xs">REMOVER</span>
            </button>
        </div>
        <div id="trans-form" class="mt-6 hidden animate-fade bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p class="text-[10px] text-gray-400 mb-2 uppercase font-bold">Valor</p>
            <input type="number" id="trans-amount" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-lg font-bold text-white mb-4 outline-none focus:border-blue-500" placeholder="0.00">
            <p class="text-[10px] text-gray-400 mb-2 uppercase font-bold">Motivo (Obrigatório)</p>
            <input type="text" id="trans-desc" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-white mb-4 outline-none focus:border-blue-500" placeholder="Ex: Ajuste manual">
            <button onclick="window.executeAdjustment('${uid}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg">CONFIRMAR TRANSAÇÃO</button>
        </div>`; 
    tempTransMode = null; 
};

window.setTransactionMode = function(mode) { 
    tempTransMode = mode; 
    document.getElementById('trans-form').classList.remove('hidden'); 
    document.getElementById('trans-amount').focus();
};

window.executeAdjustment = async function(uid) { 
    const amount = parseFloat(document.getElementById('trans-amount').value); 
    const desc = document.getElementById('trans-desc').value; 
    const mode = tempTransMode; 
    
    if (!amount || amount <= 0) return alert("Digite um valor válido."); 
    if (!desc) return alert("Digite o motivo da transação."); 
    
    const finalAmount = mode === 'credit' ? amount : -amount; 
    
    if(!confirm(`Confirma ${mode === 'credit' ? 'ADICIONAR' : 'REMOVER'} R$ ${amount}?`)) return; 
    
    const btn = document.querySelector('#trans-form button'); 
    btn.innerText = "PROCESSANDO..."; 
    btn.disabled = true; 
    
    try { 
        const db = window.db; 
        const userRef = doc(db, "usuarios", uid); 
        
        await runTransaction(db, async (transaction) => { 
            const userDoc = await transaction.get(userRef); 
            if (!userDoc.exists()) throw "Usuário inexistente!"; 
            
            const currentBal = parseFloat(userDoc.data().wallet_balance || userDoc.data().saldo || 0);
            const newBalance = currentBal + finalAmount; 
            
            transaction.update(userRef, { 
                wallet_balance: newBalance,
                saldo: newBalance,
                updated_at: serverTimestamp() 
            }); 
            
            // Log Auditoria (Sem risco de XSS pois não exibimos desc direto sem tratar)
            const logRef = doc(collection(db, "system_events"));
            transaction.set(logRef, {
                action: "Financeiro Admin",
                details: `${mode.toUpperCase()} R$ ${amount} - ${desc}`,
                user: "ADMIN",
                uid: uid,
                timestamp: serverTimestamp()
            });
        }); 
        
        alert("✅ Saldo atualizado com sucesso!"); 
        document.getElementById('modal-editor').classList.add('hidden'); 
        loadList(); 
    } catch (e) { 
        alert("Erro: " + e.message); 
        btn.innerText = "CONFIRMAR TRANSAÇÃO"; 
        btn.disabled = false; 
    } 
};

// D. Dar Bônus Rápido (Função nova simplificada)
window.darBonus = async function(uid, nome) {
    const valorStr = prompt(`🎁 DAR BÔNUS PARA: ${nome}\n\nDigite o valor (Ex: 10):`);
    if(!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(',', '.'));
    if(isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    try {
        const db = window.db;
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "usuarios", uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "Erro: Usuário sumiu.";

            const currentBal = parseFloat(userDoc.data().wallet_balance || userDoc.data().saldo || 0);
            const novoSaldo = currentBal + valor;

            transaction.update(userRef, { 
                wallet_balance: novoSaldo,
                saldo: novoSaldo 
            });

            const logRef = doc(collection(db, "system_events"));
            transaction.set(logRef, {
                action: "Bônus",
                details: `Admin deu R$ ${valor} para ${nome}`,
                user: "ADMIN",
                uid: uid,
                timestamp: serverTimestamp()
            });
        });
        alert(`✅ R$ ${valor} enviados para ${nome}!`);
        loadList();
    } catch(e) {
        alert("Erro no bônus: " + e.message);
    }
};
