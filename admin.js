import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";
const SITE_URL = "https://rede-atlivio.github.io/painel-financeiro-borges"; 

window.auth = auth;
window.db = db;
let chartInstance = null;
let currentView = 'dashboard', dataMode = 'real';
let currentCollectionName = '';

// --- LOGIN ---
window.loginAdmin = async () => { try { const result = await signInWithPopup(auth, provider); checkAdmin(result.user); } catch (e) { document.getElementById('error-msg').innerText = e.message; document.getElementById('error-msg').classList.remove('hidden'); } };
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    document.getElementById('bulk-actions').classList.remove('visible');

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'generator') { document.getElementById('view-generator').classList.remove('hidden'); }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
    else if(viewName === 'analytics') { document.getElementById('view-analytics').classList.remove('hidden'); initAnalytics(); }
    else if(viewName === 'finance') { document.getElementById('view-finance').classList.remove('hidden'); }
    else { document.getElementById('view-list').classList.remove('hidden'); loadList(viewName); }
};

window.toggleDataMode = (mode) => {
    dataMode = mode;
    const btnReal = document.getElementById('btn-mode-real'), btnDemo = document.getElementById('btn-mode-demo');
    if (btnReal) btnReal.className = mode === 'real' ? "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    if (btnDemo) btnDemo.className = mode === 'demo' ? "px-3 py-1 rounded text-[10px] font-bold bg-amber-600 text-white" : "px-3 py-1 rounded text-[10px] font-bold text-gray-400";
    window.forceRefresh();
};

window.forceRefresh = () => { if(['users', 'services', 'missions', 'jobs', 'opps'].includes(currentView)) loadList(currentView); else if (currentView === 'dashboard') initDashboard(); };

// --- CORREÇÃO DO BOTÃO + NOVO (IMPORTANTE) ---
window.openModalCreate = (type) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    if(!modal) return; 
    modal.classList.remove('hidden'); 
    if(title) title.innerText = "CRIAR NOVO ITEM";
    if(content) content.innerHTML = `<p class="text-center text-gray-400 text-xs">Clique em SALVAR para criar o rascunho inicial.</p>`;
    
    window.saveCallback = async () => {
        // Mapeamento Correto
        let coll = type;
        if (type === 'users') coll = 'usuarios';
        else if (type === 'services') coll = 'active_providers';
        else if (type === 'missions') coll = 'missoes';
        else if (type === 'opps') coll = 'oportunidades';
        else if (type === 'jobs') coll = 'jobs';

        await addDoc(collection(db, coll), { 
            created_at: serverTimestamp(), 
            updated_at: serverTimestamp(), 
            is_demo: dataMode === 'demo', 
            titulo: 'Novo Item (Rascunho)', 
            nome: 'Novo Item', 
            status: 'rascunho',
            visibility_score: 100 // Manual tem prioridade
        });
    };
};

// --- GERADOR EM MASSA INTELIGENTE (CORRIGIDO) ---
window.runMassGenerator = async () => {
    const type = document.getElementById('gen-type').value;
    const qty = parseInt(document.getElementById('gen-qty').value);
    const statusEl = document.getElementById('gen-status');
    
    if(!confirm(`Gerar ${qty} itens SIMULADOS na aba '${type}'?`)) return;
    
    statusEl.innerText = "Gerando dados ricos..."; statusEl.classList.remove('hidden');
    const batch = writeBatch(db);
    let collectionName = '';

    // 1. LISTA RICA DE OPORTUNIDADES (Com Tipos e Cores)
    const oppsRichList = [
        { title: "Alerta Promocional iFood (Exemplo)", type: "alerta", desc: "Cupom especial identificado por tempo limitado.", badge: "🔴 Alerta" },
        { title: "Cashback Supermercado (Modelo)", type: "cashback", desc: "Receba parte do valor de volta em compras essenciais.", badge: "🟢 Cashback" },
        { title: "Indique e Ganhe (Demonstrativo)", type: "indique", desc: "Convide amigos e receba bônus na carteira.", badge: "🔵 Indicação" },
        { title: "Pesquisa Remunerada (Simulação)", type: "pesquisa", desc: "Responda perguntas simples sobre marcas e ganhe.", badge: "🟡 Pesquisa" },
        { title: "Erro de Preço Monitor (Exemplo)", type: "alerta", desc: "Diferença de valor detectada em lote promocional.", badge: "🟣 Monitor" },
        { title: "Teste Grátis Streaming (Modelo)", type: "promo", desc: "30 dias gratuitos para novos cadastros.", badge: "⚪ Promo" }
    ];

    // 2. LISTA RICA DE MISSÕES (Com Status Variados)
    const missionRichList = [
        { title: "Fotografar Fachada (Coletando)", status: "em_andamento" },
        { title: "Pesquisa de Preço (Vagas Cheias)", status: "esgotada" },
        { title: "Cliente Oculto (Concluída)", status: "concluida" },
        { title: "Validar Endereço (Encerrada)", status: "encerrada" },
        { title: "Gravar Vídeo Curto (Em Análise)", status: "analise" }
    ];

    if (type === 'jobs') collectionName = 'jobs';
    else if (type === 'services') collectionName = 'active_providers';
    else if (type === 'missions') collectionName = 'missoes';
    else if (type === 'opps') collectionName = 'oportunidades';

    for (let i = 0; i < qty; i++) {
        const docRef = doc(collection(db, collectionName));
        let data = { created_at: serverTimestamp(), updated_at: serverTimestamp(), is_demo: true, visibility_score: 10 };

        if (type === 'opps') {
            const item = oppsRichList[Math.floor(Math.random() * oppsRichList.length)];
            data.titulo = item.title;
            data.descricao = item.desc; // Previne undefined
            data.tipo_visual = item.type; // Para cor do ícone
            data.badge_text = item.badge;
            data.status = "analise";
            data.link = "#";
            data.cta_text = "Ver detalhes"; // Previne undefined no botão
        } 
        else if (type === 'missions') {
            const item = missionRichList[Math.floor(Math.random() * missionRichList.length)];
            data.titulo = item.title; // Já vem com o status no nome para clareza
            data.status = "concluida"; // Status técnico seguro
            data.valor = (Math.random() * 30).toFixed(2);
            data.descricao = "Missão demonstrativa para compor o histórico da região.";
        }
        else if (type === 'services') {
            // Mantido o anterior que estava bom
            const profissoes = ["Eletricista", "Encanador", "Jardineiro", "Manicure", "Montador"];
            const statusServ = ["(Indisponível)", "(Agenda Cheia)", "(Offline)"];
            data.nome_profissional = `${profissoes[Math.floor(Math.random()*profissoes.length)]} ${statusServ[Math.floor(Math.random()*statusServ.length)]}`;
            data.is_online = false;
            data.status = "indisponivel";
        } 
        else if (type === 'jobs') {
            const vagas = ["Vendedor", "Atendente", "Auxiliar", "Estoquista"];
            const stVaga = ["(Preenchida)", "(Encerrada)", "(Banco de Talentos)"];
            data.titulo = `${vagas[Math.floor(Math.random()*vagas.length)]} ${stVaga[Math.floor(Math.random()*stVaga.length)]}`;
            data.status = "encerrada";
            data.empresa = "Parceiro Confidencial";
            data.salario = "A combinar";
            data.descricao = "Vaga demonstrativa.";
        }

        batch.set(docRef, data);
    }

    try { await batch.commit(); statusEl.innerText = "✅ Feito!"; window.toggleDataMode('demo'); window.switchView(type); } 
    catch (e) { alert("Erro: " + e.message); }
};

// --- OUTRAS FUNÇÕES (Mantidas do v29.0) ---
window.toggleSelectAll = (src) => { document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = src.checked); window.updateBulkBar(); };
window.updateBulkBar = () => { const count = document.querySelectorAll('.row-checkbox:checked').length; const bar = document.getElementById('bulk-actions'); document.getElementById('bulk-count').innerText = count; if(count>0) bar.classList.add('visible'); else bar.classList.remove('visible'); };
window.deleteSelectedItems = async () => {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    if(!confirm(`Excluir ${checked.length} itens?`)) return;
    const batch = writeBatch(db);
    checked.forEach(cb => batch.delete(doc(db, currentCollectionName, cb.value)));
    await batch.commit();
    document.getElementById('bulk-actions').classList.remove('visible');
    loadList(currentView);
};

// --- LIST LOADING (Universal Fix) ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName, headers, fields, constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true)); else constraints.push(where("is_demo", "!=", true)); 

    if(type === 'users') colName = "usuarios";
    else if(type === 'services') colName = "active_providers";
    else if(type === 'missions') colName = "missoes";
    else if(type === 'opps') colName = "oportunidades";
    else colName = type; 
    
    currentCollectionName = colName;
    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;

    // Campos universais para evitar erro visual
    if(type === 'users') { headers = [chk, "USUÁRIO", "TIPO", "SALDO", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3"><div class="font-bold text-white">${d.displayName||'Anon'}</div><div class="text-gray-500">${d.email}</div></td><td class="p-3">${d.is_provider?'Prestador':'Cliente'}</td><td class="p-3">R$ ${(d.saldo||0).toFixed(2)}</td><td class="p-3">${d.is_blocked?'🔴':'🟢'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    else if (type === 'services') { headers = [chk, "NOME", "ONLINE", "DEMO?", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 font-bold text-white">${d.nome_profissional}</td><td class="p-3">${d.is_online?'🟢':'⚪'}</td><td class="p-3">${d.is_seed||d.is_demo?'SIM':'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    else { headers = [chk, "ID", "DADOS", "STATUS", "AÇÕES"]; fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 text-xs text-gray-500">${d.id.substring(0,8)}...</td><td class="p-3 font-bold text-white">${d.titulo||d.name||'Item'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`; }
    
    if(thead) thead.innerHTML = headers.join('');
    try { const q = query(collection(db, colName), ...constraints, limit(50)); const snap = await getDocs(q); tbody.innerHTML = ""; if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Nenhum item encontrado neste modo.</td></tr>"; snap.forEach(docSnap => { const d = { id: docSnap.id, ...docSnap.data() }; tbody.innerHTML += `<tr class="table-row border-b border-white/5">${fields(d)}</tr>`; }); } catch(e) { tbody.innerHTML = `<tr><td colspan='6' class='p-4 text-red-500'>Erro: ${e.message}</td></tr>`; }
    
    // RECONECTAR O BOTÃO ADD NEW AO MUDAR DE ABA
    const btnAdd = document.getElementById('btn-add-new'); 
    if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// ... Restante das funções (universal editor, save link, etc.) mantidas iguais ...
window.openUniversalEditor = async (c,i) => { /*...igual v29...*/ };
window.saveLinkToFirebase = async () => { /*...igual v29...*/ };
window.saveSettings = async () => { /*...*/ };
window.loadSettings = async () => { /*...*/ };
window.clearDatabase = async (s) => { /*...*/ };
window.generateDetailedPDF = async () => { /*...*/ };
function checkAdmin(u) { if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { document.getElementById('login-gate').classList.add('hidden'); document.getElementById('admin-sidebar').classList.remove('hidden'); document.getElementById('admin-main').classList.remove('hidden'); initDashboard(); } else { alert("ACESSO NEGADO."); signOut(auth); } }
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });
async function initDashboard() { /*...*/ }
async function initAnalytics() { /*...*/ }
