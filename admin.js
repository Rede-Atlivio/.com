import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

window.auth = auth;
window.db = db;

// --- VARIÁVEIS GLOBAIS (BLINDADAS) ---
// Usamos window. para garantir que sejam acessíveis em todo o arquivo
window.currentView = 'dashboard';
window.dataMode = 'real';
window.currentCollectionName = ''; // AQUI ESTAVA O ERRO, AGORA ESTÁ FIXO
window.currentEditId = null;
window.currentEditColl = null;

// VARIÁVEIS DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; // 30 Minutos

// --- LOGIN ---
window.loginAdmin = async () => { try { await signInWithPopup(auth, provider); checkAdmin(auth.currentUser); } catch (e) { alert(e.message); } };
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    window.currentView = viewName;
    const views = ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();
    
    const bulkBar = document.getElementById('bulk-actions');
    if(bulkBar) bulkBar.classList.remove('visible');

    if(viewName === 'dashboard') { 
        document.getElementById('view-dashboard').classList.remove('hidden'); 
        initDashboard(); 
    }
    else if(viewName === 'generator') { 
        document.getElementById('view-generator').classList.remove('hidden'); 
        injetarPainelRobo(); 
        listarCampanhasAtivas(); 
    }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
    else if(viewName === 'finance') { document.getElementById('view-finance').classList.remove('hidden'); }
    else { 
        document.getElementById('view-list').classList.remove('hidden'); 
        loadList(viewName); 
    }
};

window.toggleDataMode = (mode) => {
    window.dataMode = mode;
    const btnReal = document.getElementById('btn-mode-real');
    const btnDemo = document.getElementById('btn-mode-demo');
    
    if (btnReal) btnReal.className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    if (btnDemo) btnDemo.className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    window.forceRefresh();
};

window.forceRefresh = () => { 
    if(['users', 'services', 'missions', 'jobs', 'opps'].includes(window.currentView)) {
        loadList(window.currentView); 
    } else if (window.currentView === 'dashboard') {
        initDashboard(); 
    }
};

// ============================================================================
// 🤖 PAINEL DO ROBÔ & GERENCIADOR DE LINKS
// ============================================================================

window.injetarPainelRobo = () => {
    const container = document.getElementById('view-generator');
    if(document.getElementById('painel-robo-container')) return;

    const painelHtml = `
        <div id="painel-robo-container" class="glass-panel p-6 border border-emerald-500/50 mb-6 bg-emerald-900/10">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-white italic">🤖 ROBÔ DE OFERTAS</h2>
                    <p class="text-xs text-emerald-400">Posta itens da sua lista abaixo a cada 30 minutos.</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Status</p>
                    <div id="robo-status-text" class="text-red-500 font-black text-lg animate-pulse">PARADO 🛑</div>
                </div>
            </div>
            <div class="mt-4 flex gap-4">
                <button onclick="window.toggleRobo(true)" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition">▶️ LIGAR ROBÔ</button>
                <button onclick="window.toggleRobo(false)" class="flex-1 bg-red-900/50 hover:bg-red-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-red-800 transition">⏸️ PAUSAR</button>
            </div>
        </div>

        <div class="glass-panel p-6 border border-blue-500/30 mb-6">
            <h3 class="text-lg font-bold text-white mb-4">📚 Minha Lista de Links (Afiliado)</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <input type="text" id="camp-titulo" placeholder="Título (Ex: iPhone 13 Promo)" class="inp-editor">
                <input type="text" id="camp-link" placeholder="Seu Link de Afiliado" class="inp-editor text-blue-300">
                <input type="text" id="camp-desc" placeholder="Descrição curta..." class="inp-editor md:col-span-2">
                <div class="flex gap-2 md:col-span-2">
                    <select id="camp-tipo" class="inp-editor w-32">
                        <option value="alerta">🔴 Alerta</option>
                        <option value="cashback">🟢 Cashback</option>
                    </select>
                    <button onclick="window.adicionarCampanha()" class="bg-blue-600 text-white px-6 rounded-lg font-bold text-xs uppercase hover:bg-blue-500 flex-1">+ Adicionar à Lista</button>
                </div>
            </div>
            <p class="text-[10px] text-gray-400 uppercase font-bold mb-2">Itens Ativos no Robô:</p>
            <div id="lista-campanhas" class="space-y-2 max-h-60 overflow-y-auto">
                <p class="text-center text-gray-500 text-xs py-4">Carregando lista...</p>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('afterbegin', painelHtml);
};

window.adicionarCampanha = async () => {
    const titulo = document.getElementById('camp-titulo').value;
    const link = document.getElementById('camp-link').value;
    const desc = document.getElementById('camp-desc').value;
    const tipo = document.getElementById('camp-tipo').value;

    if(!titulo || !link) return alert("Preencha Título e Link.");

    try {
        await addDoc(collection(db, "bot_library"), {
            titulo: titulo,
            link: link,
            descricao: desc || "Oferta imperdível.",
            tipo: tipo,
            created_at: serverTimestamp()
        });
        
        document.getElementById('camp-titulo').value = "";
        document.getElementById('camp-link').value = "";
        document.getElementById('camp-desc').value = "";
        
        alert("✅ Link salvo na biblioteca do Robô!");
        window.listarCampanhasAtivas();
    } catch(e) { alert("Erro: " + e.message); }
};

window.listarCampanhasAtivas = async () => {
    const lista = document.getElementById('lista-campanhas');
    if(!lista) return;

    const q = query(collection(db, "bot_library"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);

    lista.innerHTML = "";
    if(snap.empty) {
        lista.innerHTML = `<p class="text-center text-gray-500 text-xs py-4">Nenhum link cadastrado. O robô não vai funcionar.</p>`;
        return;
    }

    snap.forEach(d => {
        const item = d.data();
        lista.innerHTML += `
            <div class="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-white/5">
                <div class="truncate pr-2">
                    <p class="text-xs text-white font-bold">${item.titulo}</p>
                    <p class="text-[9px] text-blue-400 truncate">${item.link}</p>
                </div>
                <button onclick="window.removerCampanha('${d.id}')" class="text-red-500 hover:text-red-400 font-bold px-2">🗑️</button>
            </div>
        `;
    });
};

window.removerCampanha = async (id) => {
    if(!confirm("Remover este item da lista do robô?")) return;
    await deleteDoc(doc(db, "bot_library", id));
    window.listarCampanhasAtivas();
};

window.toggleRobo = (ligar) => {
    const statusText = document.getElementById('robo-status-text');
    if (ligar) {
        if (roboAtivo) return;
        
        getDocs(collection(db, "bot_library")).then(snap => {
            if(snap.empty) {
                alert("⚠️ Adicione pelo menos 1 link na lista abaixo antes de ligar o robô!");
                return;
            }
            roboAtivo = true;
            if(statusText) { statusText.innerText = "TRABALHANDO 🚀"; statusText.className = "text-emerald-400 font-black text-lg animate-pulse"; }
            window.executarCicloRobo();
            roboIntervalo = setInterval(window.executarCicloRobo, TEMPO_ENTRE_POSTS);
            alert("🤖 ROBÔ INICIADO!\nEle usará sua lista de links cadastrados.");
        });
    } else {
        roboAtivo = false;
        clearInterval(roboIntervalo);
        if(statusText) { statusText.innerText = "PARADO 🛑"; statusText.className = "text-red-500 font-black text-lg"; }
        alert("Robô pausado.");
    }
};

window.executarCicloRobo = async () => {
    if (!roboAtivo) return;
    console.log("🤖 ROBÔ: Buscando munição na biblioteca...");
    try {
        const snap = await getDocs(collection(db, "bot_library"));
        if(snap.empty) {
            console.log("❌ Robô parou: Biblioteca vazia.");
            window.toggleRobo(false);
            return;
        }
        const opcoes = snap.docs.map(d => d.data());
        const oferta = opcoes[Math.floor(Math.random() * opcoes.length)];
        
        await addDoc(collection(db, "oportunidades"), {
            titulo: oferta.titulo,
            descricao: oferta.descricao,
            tipo: oferta.tipo,
            link: oferta.link,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: false, 
            visibility_score: 100,
            origem: "robo_auto"
        });
        
        console.log(`✅ ROBÔ: Postou "${oferta.titulo}"!`);
        document.title = "Atlivio Admin (POSTOU!)";
        setTimeout(() => document.title = "Atlivio Admin", 5000);
    } catch (e) { console.error("❌ ROBÔ FALHOU:", e); }
};

// --- LISTAGEM PADRÃO ---

async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    // Define a coleção
    let colName = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
    
    // --- CORREÇÃO DEFINITIVA: Atualiza a variável Global ---
    window.currentCollectionName = colName;
    
    let constraints = [];
    if (window.dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    if (window.dataMode === 'real') constraints = [limit(50)]; 

    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;
    let headers = [chk, "ID", "DADOS", "STATUS", "AÇÕES"];
    let fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 text-xs text-gray-500">${d.id.substring(0,6)}</td><td class="p-3 font-bold text-white">${d.titulo||d.nome||d.nome_profissional||'Sem Nome'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`;

    if(type === 'users') { headers = [chk, "NOME", "TIPO", "SALDO", "STATUS", "AÇÕES"]; }
    if(thead) thead.innerHTML = headers.join('');
    
    try {
        let q;
        if(colName === 'oportunidades' || colName === 'jobs') {
             q = query(collection(db, colName), orderBy('created_at', 'desc'), limit(50));
        } else {
             q = query(collection(db, colName), limit(50));
        }

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Vazio.</td></tr>";
        snap.forEach(docSnap => { 
            const d = { id: docSnap.id, ...docSnap.data() }; 
            tbody.innerHTML += `<tr class="table-row border-b border-white/5 transition">${fields(d)}</tr>`; 
        });
    } catch(e) { 
        console.log(e); 
        tbody.innerHTML = `<tr><td colspan='6' class='text-red-500 p-4'>Erro. Verifique Console.</td></tr>`; 
    }
    
    // REATIVAÇÃO DO BOTÃO + NOVO (GARANTIA)
    const btnAdd = document.getElementById('btn-add-new'); 
    if(btnAdd) {
        // Remove listeners antigos para evitar duplicação
        const newBtn = btnAdd.cloneNode(true);
        btnAdd.parentNode.replaceChild(newBtn, btnAdd);
        
        // Adiciona o novo listener
        newBtn.onclick = () => window.openModalCreate(type);
        console.log("✅ Botão + NOVO ativado para: " + type);
    }
}

// --- OUTROS E UTILITÁRIOS ---

window.toggleSelectAll = (src) => { 
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = src.checked); 
    window.updateBulkBar(); 
};

window.updateBulkBar = () => { 
    const count = document.querySelectorAll('.row-checkbox:checked').length; 
    const bar = document.getElementById('bulk-actions'); 
    document.getElementById('bulk-count').innerText = count; 
    if(count>0) bar.classList.add('visible'); 
    else bar.classList.remove('visible'); 
};

window.deleteSelectedItems = async () => { 
    const checked = document.querySelectorAll('.row-checkbox:checked'); 
    if(!confirm("Excluir?")) return; 
    const batch = writeBatch(db); 
    checked.forEach(cb => batch.delete(doc(db, window.currentCollectionName, cb.value))); 
    await batch.commit(); 
    document.getElementById('bulk-actions').classList.remove('visible'); 
    loadList(window.currentView); 
};

window.openModalCreate = (type) => { 
    console.log("🛠️ Abrindo modal para:", type);
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    if(!modal) {
        console.error("❌ Modal não encontrado no HTML!");
        return;
    }
    
    modal.classList.remove('hidden'); 
    title.innerText = "CRIAR ITEM"; 
    
    // Formulário simples para criação manual (fallback)
    content.innerHTML = `
        <div class="mb-4 text-center text-gray-400 text-xs">
            Para Oportunidades, use o <b>Painel do Robô</b> na aba GERADOR.<br>
            Para outros itens, use o formulário abaixo.
        </div>
        <div class="mb-2"><label class="inp-label">Título</label><input type="text" id="new-titulo" class="inp-editor" placeholder="Nome do item"></div>
        <div class="mb-2"><label class="inp-label">Descrição</label><input type="text" id="new-desc" class="inp-editor" placeholder="Detalhes..."></div>
        <div class="mt-4 flex justify-end">
            <button onclick="window.saveModalData()" class="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold uppercase">SALVAR</button>
        </div>
    `;
    
    window.saveCallback = async () => {
        const titulo = document.getElementById('new-titulo').value;
        const desc = document.getElementById('new-desc').value;
        if(!titulo) return alert("Título obrigatório");
        
        let col = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
        
        await addDoc(collection(db, col), {
            titulo: titulo,
            descricao: desc,
            created_at: serverTimestamp(),
            status: "ativo"
        });
    };
};

window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    window.currentEditId = id; 
    window.currentEditColl = collectionName;
    
    modal.classList.remove('hidden'); 
    title.innerText = "EDITAR"; 
    content.innerHTML = `<p class="text-center text-gray-500 animate-pulse">Carregando...</p>`;
    
    try { 
        const docSnap = await getDoc(doc(db, collectionName, id)); 
        if (!docSnap.exists()) return; 
        const data = docSnap.data(); 
        content.innerHTML = ""; 
        
        Object.keys(data).sort().forEach(key => { 
            if(key === 'created_at' || key === 'updated_at') return; 
            content.innerHTML += `<div class="mb-2"><label class="inp-label">${key}</label><input type="text" id="field-${key}" value="${data[key]}" class="inp-editor"></div>`; 
        }); 
        
        content.innerHTML += `
            <div class="mt-4 flex justify-end">
                <button onclick="window.saveModalData()" class="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold uppercase">SALVAR ALTERAÇÕES</button>
            </div>
        `;

        window.saveCallback = async () => { 
            const updates = { updated_at: serverTimestamp() }; 
            Object.keys(data).forEach(key => { 
                if(key === 'created_at' || key === 'updated_at') return; 
                const el = document.getElementById(`field-${key}`); 
                if(el) updates[key] = el.value; 
            }); 
            await updateDoc(doc(db, collectionName, id), updates); 
        }; 
    } catch(e) { alert(e.message); } 
};

window.saveModalData = async () => { 
    try { 
        if(window.saveCallback) await window.saveCallback(); 
        alert("Salvo!"); 
        window.closeModal(); 
        window.forceRefresh(); 
    } catch(e){alert(e.message);} 
};

window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');

window.saveSettings = async () => { 
    const msg = document.getElementById('conf-global-msg')?.value || "";
    const btn = document.querySelector('button[onclick="window.saveSettings()"]');
    if(btn) { btn.innerText = "⏳ SALVANDO..."; btn.disabled = true; }

    try {
        // Salva apenas o aviso global para o app
        await setDoc(doc(db, "configuracoes", "global"), { 
            top_message: msg,
            show_msg: msg.length > 0,
            updated_at: serverTimestamp() 
        }, {merge:true}); 

        alert("✅ AVISO GLOBAL ATUALIZADO!"); 
    } catch (e) { 
        alert("Erro ao salvar: " + e.message); 
    } finally {
        if(btn) { btn.innerText = "Atualizar Todas as Regras Agora ⚡"; btn.disabled = false; }
    }
};

window.loadSettings = async () => { 
    try { 
        // Carrega mensagem
        const dGlobal = await getDoc(doc(db, "settings", "global")); 
        if(dGlobal.exists()) document.getElementById('conf-global-msg').value = dGlobal.data().top_message || ""; 
        
        // Carrega regras financeiras
        const dFin = await getDoc(doc(db, "configuracoes", "financeiro"));
        if(dFin.exists()) {
            const data = dFin.data();
            if(document.getElementById('conf-val-min')) document.getElementById('conf-val-min').value = data.valor_minimo || 20;
            if(document.getElementById('conf-val-max')) document.getElementById('conf-val-max').value = data.valor_maximo || 500;
            if(document.getElementById('conf-taxa-reserva')) document.getElementById('conf-taxa-reserva').value = data.porcentagem_reserva || 10;
        }
    } catch(e){ console.error("Erro ao carregar:", e); } 
};
window.clearDatabase = async () => { 
    if(confirm("Apagar TUDO do modo DEMO?")) { 
        const batch = writeBatch(db); 
        const q = query(collection(db, "usuarios"), where("is_demo", "==", true)); 
        const s = await getDocs(q); 
        s.forEach(d=>batch.delete(d.ref)); 
        await batch.commit(); 
        alert("Limpo!"); 
    } 
};

function checkAdmin(u) { 
    if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { 
        document.getElementById('login-gate').classList.add('hidden'); 
        document.getElementById('admin-sidebar').classList.remove('hidden'); 
        document.getElementById('admin-main').classList.remove('hidden'); 
        initDashboard(); 
    } else { 
        alert("ACESSO NEGADO."); 
        signOut(auth); 
    } 
}

onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });

async function initDashboard() { 
    try { 
        const u = await getCountFromServer(collection(db, "usuarios")); 
        document.getElementById('kpi-users').innerText = u.data().count; 
    } catch(e){} 
}

// Desativa o gerador manual antigo
window.runMassGenerator = () => { alert("Use o NOVO Painel do Robô acima! ☝️"); };
// ☢️ COMANDO MASTER: FORÇAR ATUALIZAÇÃO EM TODOS OS USUÁRIOS
window.dispararUpdateGlobal = async function() {
    if (!confirm("⚠️ ATENÇÃO: Isso forçará TODOS os usuários logados a recarregarem o app e limparem o cache. Confirmar?")) return;
    
    try {
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(doc(window.db, "settings", "deploy"), {
            force_reset_timestamp: serverTimestamp(),
            reason: "Atualização de Sistema V22",
            admin_by: "Gil Borges"
        }, { merge: true });
        
        alert("🚀 COMANDO ENVIADO! Os usuários serão atualizados em tempo real.");
    } catch (e) {
        alert("Erro ao disparar update: " + e.message);
    }
};
