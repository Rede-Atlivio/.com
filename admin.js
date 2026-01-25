import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, updateDoc, doc, serverTimestamp, getCountFromServer, onSnapshot, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";
const SITE_URL = "https://rede-atlivio.github.io/.com"; 

window.auth = auth;
window.db = db;
let currentView = 'dashboard';
let dataMode = 'real';

// ============================================================================
// 💰 BANCO DE OFERTAS REAIS (SEU OURO ESTÁ AQUI)
// Edite esta lista com seus links de afiliado reais.
// O Robô vai sortear daqui.
// ============================================================================
const BANCO_DE_OFERTAS = [
    {
        titulo: "iPhone 13 (128GB) - Promoção Relâmpago",
        descricao: "O menor preço dos últimos 30 dias na Amazon. Aproveite antes que acabe o estoque.",
        tipo: "alerta", // ou 'cashback'
        link: "https://www.amazon.com.br/dp/B09V3HKI5?tag=SEU_TAG_AQUI", // COLOQUE SEU LINK AQUI
        badge: "🔥 Imperdível"
    },
    {
        titulo: "Fone Bluetooth Lenovo LP40",
        descricao: "O queridinho do momento. Ótimo grave e bateria dura muito.",
        tipo: "cashback",
        link: "https://shopee.com.br/link-do-produto", // COLOQUE SEU LINK AQUI
        badge: "🎵 Top Vendas"
    },
    {
        titulo: "Air Fryer Mondial 4L",
        descricao: "Essencial na cozinha. Desconto exclusivo para compra via App.",
        tipo: "alerta",
        link: "https://www.magazineluiza.com.br/seu-link",
        badge: "🍳 Cozinha"
    },
    {
        titulo: "Cupom R$ 30,00 Primeira Compra",
        descricao: "Válido para novos usuários no aplicativo parceiro.",
        tipo: "cashback",
        link: "#",
        badge: "💰 Economia"
    },
    {
        titulo: "Kit 3 Camisetas Básicas",
        descricao: "Algodão premium. Várias cores disponíveis.",
        tipo: "alerta",
        link: "#",
        badge: "👕 Moda"
    }
];

// VARIÁVEIS DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; // 30 Minutos (em milissegundos)

// ============================================================================

// --- LOGIN ---
window.loginAdmin = async () => { try { await signInWithPopup(auth, provider); checkAdmin(auth.currentUser); } catch (e) { alert(e.message); } };
window.logoutAdmin = () => signOut(auth).then(() => location.reload());

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    currentView = viewName;
    ['view-dashboard', 'view-list', 'view-finance', 'view-analytics', 'view-links', 'view-settings', 'view-generator'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('page-title').innerText = viewName.toUpperCase();
    document.getElementById('bulk-actions').classList.remove('visible');

    if(viewName === 'dashboard') { document.getElementById('view-dashboard').classList.remove('hidden'); initDashboard(); }
    else if(viewName === 'generator') { 
        document.getElementById('view-generator').classList.remove('hidden'); 
        injetarPainelRobo(); // Injeta o painel do robô visualmente
    }
    else if(viewName === 'links') { document.getElementById('view-links').classList.remove('hidden'); }
    else if(viewName === 'settings') { document.getElementById('view-settings').classList.remove('hidden'); loadSettings(); }
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

// --- FUNÇÃO DO ROBÔ (A MÁQUINA DE VENDAS) ---
window.injetarPainelRobo = () => {
    const container = document.getElementById('view-generator');
    // Evita duplicar se já existir
    if(document.getElementById('painel-robo-container')) return;

    const painelHtml = `
        <div id="painel-robo-container" class="glass-panel p-6 border border-emerald-500/50 mb-6 bg-emerald-900/10">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-xl font-black text-white italic">🤖 ROBÔ DE OFERTAS</h2>
                    <p class="text-xs text-emerald-400">Posta itens da sua lista a cada 30 minutos.</p>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-gray-400 uppercase font-bold mb-1">Status</p>
                    <div id="robo-status-text" class="text-red-500 font-black text-lg animate-pulse">PARADO 🛑</div>
                </div>
            </div>
            
            <div class="mt-4 flex gap-4">
                <button onclick="window.toggleRobo(true)" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition">
                    ▶️ LIGAR ROBÔ
                </button>
                <button onclick="window.toggleRobo(false)" class="flex-1 bg-red-900/50 hover:bg-red-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-red-800 transition">
                    ⏸️ PAUSAR
                </button>
            </div>
            <p class="text-[9px] text-gray-500 mt-2 text-center italic">⚠️ Mantenha esta aba aberta para o robô funcionar.</p>
        </div>
    `;
    
    // Insere antes do conteúdo existente
    container.insertAdjacentHTML('afterbegin', painelHtml);
};

window.toggleRobo = (ligar) => {
    const statusText = document.getElementById('robo-status-text');
    
    if (ligar) {
        if (roboAtivo) return; // Já está ligado
        roboAtivo = true;
        if(statusText) { statusText.innerText = "TRABALHANDO 🚀"; statusText.className = "text-emerald-400 font-black text-lg animate-pulse"; }
        
        // Executa a primeira vez imediatamente
        window.executarCicloRobo();
        
        // Inicia o loop
        roboIntervalo = setInterval(window.executarCicloRobo, TEMPO_ENTRE_POSTS);
        alert("🤖 ROBÔ INICIADO!\n\nEle vai postar uma oferta agora e depois a cada 30 minutos.\nNão feche esta aba.");
    } else {
        roboAtivo = false;
        clearInterval(roboIntervalo);
        if(statusText) { statusText.innerText = "PARADO 🛑"; statusText.className = "text-red-500 font-black text-lg"; }
        alert("Robô pausado.");
    }
};

window.executarCicloRobo = async () => {
    if (!roboAtivo) return;
    
    console.log("🤖 ROBÔ: Iniciando ciclo de postagem...");
    
    // Sorteia uma oferta da lista
    const oferta = BANCO_DE_OFERTAS[Math.floor(Math.random() * BANCO_DE_OFERTAS.length)];
    
    try {
        await addDoc(collection(db, "oportunidades"), {
            titulo: oferta.titulo,
            descricao: oferta.descricao,
            tipo: oferta.tipo,
            link: oferta.link,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            is_demo: false, // IMPORTANTE: É False para parecer real (sem etiqueta Exemplo)
            visibility_score: 100, // Alta prioridade para aparecer no topo
            origem: "robo_auto"
        });
        
        console.log(`✅ ROBÔ: Postou "${oferta.titulo}" com sucesso!`);
        
        // Feedback visual discreto no título da página
        document.title = "Atlivio Admin (Robô Postou!)";
        setTimeout(() => document.title = "Atlivio Admin | Comando Central", 5000);
        
    } catch (e) {
        console.error("❌ ROBÔ FALHOU:", e);
    }
};

// --- LISTAGEM E FUNÇÕES PADRÃO ---
// (Mantidas do código anterior para garantir funcionamento do resto)

async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    let colName = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'missions' ? 'missoes' : (type === 'opps' ? 'oportunidades' : type)));
    currentCollectionName = colName;
    
    let constraints = [];
    if (dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    
    // Se for modo real, mostra itens sem is_demo ou is_demo=false
    // Simplificação: no modo admin mostramos tudo se não for demo mode estrito
    if (dataMode === 'real') constraints = [limit(50)]; 

    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;
    let headers = [chk, "ID", "DADOS", "STATUS", "AÇÕES"];
    let fields = (d) => `<td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td><td class="p-3 text-xs text-gray-500">${d.id.substring(0,6)}</td><td class="p-3 font-bold text-white">${d.titulo||d.nome||d.nome_profissional||'Sem Nome'}</td><td class="p-3 text-xs">${d.status||'-'}</td><td class="p-3"><button onclick="window.openUniversalEditor('${colName}', '${d.id}')">✏️</button></td>`;

    if(type === 'users') { headers = [chk, "NOME", "TIPO", "SALDO", "STATUS", "AÇÕES"]; }
    if(thead) thead.innerHTML = headers.join('');
    
    try {
        // Ordenação por data para ver os posts do robô primeiro
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
        console.log(e); // Fallback se der erro de index
        tbody.innerHTML = `<tr><td colspan='6' class='text-red-500 p-4'>Erro (Index ou Conexão). Verifique Console.</td></tr>`; 
    }
    
    const btnAdd = document.getElementById('btn-add-new'); 
    if(btnAdd) btnAdd.onclick = () => window.openModalCreate(type);
}

// --- MANUTENÇÃO (EDITOR, ETC) ---
window.openModalCreate = (type) => { /* Mantido igual, simplificado aqui */ 
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    modal.classList.remove('hidden'); title.innerText = "CRIAR"; content.innerHTML = "<p>Use o Gerador para criar rápido.</p>";
};
window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor'), content = document.getElementById('modal-content'), title = document.getElementById('modal-title');
    currentEditId = id; currentEditColl = collectionName;
    modal.classList.remove('hidden'); title.innerText = "EDITAR";
    content.innerHTML = `<p class="text-center text-gray-500 animate-pulse">Carregando...</p>`;
    try {
        const docSnap = await getDoc(doc(db, collectionName, id));
        if (!docSnap.exists()) return;
        const data = docSnap.data(); content.innerHTML = ""; 
        Object.keys(data).sort().forEach(key => {
            if(key === 'created_at' || key === 'updated_at') return;
            content.innerHTML += `<div class="mb-2"><label class="inp-label">${key}</label><input type="text" id="field-${key}" value="${data[key]}" class="inp-editor"></div>`;
        });
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
window.saveModalData = async () => { try { if(window.saveCallback) await window.saveCallback(); alert("Salvo!"); window.closeModal(); window.forceRefresh(); } catch(e){alert(e.message);} };
window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');
window.toggleSelectAll = (src) => { document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = src.checked); window.updateBulkBar(); };
window.updateBulkBar = () => { const count = document.querySelectorAll('.row-checkbox:checked').length; const bar = document.getElementById('bulk-actions'); document.getElementById('bulk-count').innerText = count; if(count>0) bar.classList.add('visible'); else bar.classList.remove('visible'); };
window.deleteSelectedItems = async () => { const checked = document.querySelectorAll('.row-checkbox:checked'); if(!confirm("Excluir?")) return; const batch = writeBatch(db); checked.forEach(cb => batch.delete(doc(db, currentCollectionName, cb.value))); await batch.commit(); document.getElementById('bulk-actions').classList.remove('visible'); loadList(currentView); };

// --- BOILERPLATE ---
function checkAdmin(u) { if(u.email.toLowerCase().trim() === ADMIN_EMAIL) { document.getElementById('login-gate').classList.add('hidden'); document.getElementById('admin-sidebar').classList.remove('hidden'); document.getElementById('admin-main').classList.remove('hidden'); initDashboard(); } else { alert("ACESSO NEGADO."); signOut(auth); } }
onAuthStateChanged(auth, (user) => { if(user) checkAdmin(user); });
async function initDashboard() { try { const u = await getCountFromServer(collection(db, "usuarios")); document.getElementById('kpi-users').innerText = u.data().count; } catch(e){} }
window.runMassGenerator = () => { alert("Use o ROBÔ para gerar Oportunidades agora!"); }; // Desativa o gerador manual antigo para forçar uso do robô
