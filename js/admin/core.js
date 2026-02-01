import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÃO FIREBASE
const firebaseConfig = { apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg", authDomain: "atlivio-oficial-a1a29.firebaseapp.com", projectId: "atlivio-oficial-a1a29", storageBucket: "atlivio-oficial-a1a29.firebasestorage.app", messagingSenderId: "887430049204", appId: "1:887430049204:web:d205864a4b42d6799dd6e1" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "contatogilborges@gmail.com";

// EXPOR GLOBAIS
window.auth = auth;
window.db = db;
window.currentDataMode = 'real';
window.activeView = 'dashboard';

// ============================================================================
// INICIALIZAÇÃO SEGURA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const safeListener = (id, event, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, func);
    };

    safeListener('btn-login', 'click', loginAdmin);
    safeListener('btn-logout', 'click', logoutAdmin);
    safeListener('mode-real', 'click', () => setDataMode('real'));
    safeListener('mode-demo', 'click', () => setDataMode('demo'));
    safeListener('btn-refresh', 'click', () => switchView(window.activeView));

    // Navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            switchView(e.currentTarget.getAttribute('data-view'));
        });
    });

    const fecharTudo = () => {
        const modal = document.getElementById('modal-editor');
        const content = document.getElementById('modal-content');
        if (modal) modal.classList.add('hidden');
        if (content) {
            content.style.pointerEvents = 'auto';
            content.style.opacity = '1';
            content.innerHTML = '';
        }
    };
    window.fecharModalUniversal = fecharTudo;

    document.addEventListener('click', (e) => {
        if(e.target.closest('#btn-close-modal') || e.target.id === 'modal-editor') fecharTudo();
    });
    document.addEventListener('keydown', (e) => { if(e.key === "Escape") fecharTudo(); });

    onAuthStateChanged(auth, (user) => {
        if (user && user.email.toLowerCase() === ADMIN_EMAIL) unlockAdmin();
        else lockAdmin();
    });
});

function setDataMode(mode) {
    window.currentDataMode = mode;
    const btnReal = document.getElementById('mode-real');
    const btnDemo = document.getElementById('mode-demo');
    if (btnReal && btnDemo) {
        if (mode === 'real') {
            btnReal.className = "px-3 py-1 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-lg transition";
            btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
        } else {
            btnReal.className = "px-3 py-1 rounded text-[10px] font-bold text-gray-400 hover:text-white transition";
            btnDemo.className = "px-3 py-1 rounded text-[10px] font-bold bg-purple-600 text-white shadow-lg transition";
        }
    }
    switchView(window.activeView);
}

async function loginAdmin() { try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message); } }
function logoutAdmin() { signOut(auth).then(() => location.reload()); }

function unlockAdmin() {
    const ids = ['login-gate', 'admin-sidebar', 'admin-main'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'login-gate') el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });
    switchView('dashboard');
}

function lockAdmin() {
    const ids = ['login-gate', 'admin-sidebar', 'admin-main'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'login-gate') el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

// ============================================================================
// ROTEADOR BLINDADO (ATUALIZADO COM PRODUTOS)
// ============================================================================
window.switchView = async function(viewName) {
    window.activeView = viewName;
    console.log(`🚀 Carregando: ${viewName}`);
    
    const allViews = [
        'view-dashboard', 'view-list', 'view-finance', 'view-automation', 
        'view-settings', 'view-support', 'view-audit', 'view-tutorials',
        'view-missions', 'view-opportunities' 
    ];

    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden'); 
    });
    
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = viewName.toUpperCase();

    let moduleFile, containerId;
    
    // 2. DEFINIR ROTA (AGORA COM PRODUTOS)
    if (viewName === 'dashboard') { moduleFile = './dashboard.js'; containerId = 'view-dashboard'; }
    else if (['users', 'services'].includes(viewName)) { moduleFile = './users.js'; containerId = 'view-list'; }
    else if (['jobs', 'vagas'].includes(viewName)) { moduleFile = './jobs.js'; containerId = 'view-list'; }
    else if (viewName === 'missions') { moduleFile = './missions.js'; containerId = 'view-list'; }
    else if (viewName === 'opportunities') { moduleFile = './opportunities.js'; containerId = 'view-list'; }
    else if (viewName === 'products') { moduleFile = './products.js'; containerId = 'view-list'; } // <--- LINHA NOVA AQUI!
    else if (viewName === 'automation') { moduleFile = './automation.js'; containerId = 'view-automation'; }
    else if (viewName === 'finance') { moduleFile = './finance.js'; containerId = 'view-finance'; }
    else if (viewName === 'settings') { moduleFile = './settings.js'; containerId = 'view-settings'; }
    else if (viewName === 'support') { moduleFile = './support.js'; containerId = 'view-support'; }
    else if (viewName === 'audit') { moduleFile = './audit.js'; containerId = 'view-audit'; }
    else if (viewName === 'tutorials') { moduleFile = './tutorials.js'; containerId = 'view-tutorials'; }

    // 3. MOSTRAR CONTAINER
    if(containerId) {
        const el = document.getElementById(containerId);
        if(el) {
            el.classList.remove('hidden');
        } else {
            console.error(`❌ ERRO FATAL: Container HTML '${containerId}' não encontrado! Verifique admin.html`);
            const fallback = document.getElementById('view-list');
            if(fallback) fallback.classList.remove('hidden');
        }
    }

    // 4. CARREGAR JS
    if (moduleFile) {
        try {
            const module = await import(`${moduleFile}?v=${Date.now()}`);
            if (module.init) await module.init(viewName);
        } catch (e) {
            console.warn(`⚠️ Módulo ${viewName} falhou ou não existe: ${e.message}`);
        }
    }
};
// --- CONTROLE DA BARRA DE AÇÕES EM MASSA ---
window.updateBulkBar = () => { 
    const checked = document.querySelectorAll('.row-checkbox:checked'); 
    const count = checked.length; 
    const bar = document.getElementById('bulk-actions'); 
    const countEl = document.getElementById('bulk-count');

    if(countEl) countEl.innerText = count; 

    if(count > 0) {
        bar.classList.add('visible');
        bar.classList.remove('invisible');
        bar.style.transform = "translate(-50%, 0)"; // Faz subir
    } else {
        bar.classList.remove('visible');
        bar.classList.add('invisible');
        bar.style.transform = "translate(-50%, 200%)"; // Faz sumir
    }
};
// --- ABRE O MENU DE AÇÕES EM MASSA (EXCLUIR, BANIR, APROVAR) ---
window.abrirMenuAcoesMassa = () => {
    const selecionados = document.querySelectorAll('.row-checkbox:checked');
    const count = selecionados.length;
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    
    if (!modal || !content) return console.error("Modal não encontrado!");

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = `CONTROLE EM MASSA (${count})`;

    content.innerHTML = `
        <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700 mb-6">
            <p class="text-[10px] font-black text-blue-400 uppercase mb-4 tracking-widest">Ações Destrutivas / Status</p>
            <div class="grid grid-cols-1 gap-2">
                <button onclick="window.executarAcaoMassa('aprovar')" class="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-[10px] uppercase transition">✅ Aprovar Todos</button>
                <button onclick="window.executarAcaoMassa('banir')" class="bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold text-[10px] uppercase transition">🚫 Banir Todos</button>
                <button onclick="window.executarAcaoMassa('excluir')" class="bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-[10px] uppercase transition">🗑️ Excluir Definitivamente</button>
            </div>
        </div>
        <div class="p-4 bg-slate-950 rounded-xl border border-white/5">
            <p class="text-[10px] text-gray-500 font-bold mb-3 uppercase tracking-widest">Financeiro (Opcional)</p>
            <div class="flex gap-2">
                <input type="number" id="bulk-credit-val" placeholder="R$ 0,00" class="flex-1 p-3 rounded-lg bg-slate-900 text-white border border-slate-800 text-sm focus:border-blue-500 outline-none">
                <button onclick="window.executarAcaoMassa('credito')" class="bg-blue-600 text-white px-4 rounded-lg font-black text-[10px] uppercase">Enviar</button>
            </div>
        </div>
    `;
};
// --- EXECUTOR REAL DAS AÇÕES (APROVAR, BANIR, EXCLUIR, CRÉDITO) ---
window.executarAcaoMassa = async (acao) => {
    const selecionados = document.querySelectorAll('.row-checkbox:checked');
    if (selecionados.length === 0) return;

    if (!confirm(`Deseja aplicar a ação [${acao.toUpperCase()}] em ${selecionados.length} registros?`)) return;

    // Importação dinâmica dos comandos necessários do Firebase
    const { writeBatch, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const batch = writeBatch(window.db);
    
    // Identifica se estamos na aba de Usuários ou Prestadores para saber a coleção
    const colecaoPrincipal = window.activeView === 'users' ? 'usuarios' : 'active_providers';

    selecionados.forEach(cb => {
        const uid = cb.value;
        const refPrincipal = doc(window.db, colecaoPrincipal, uid);

        if (acao === 'excluir') {
            // PRUDÊNCIA: Deleta de ambas as coleções para não deixar rastro
            batch.delete(doc(window.db, "usuarios", uid));
            batch.delete(doc(window.db, "active_providers", uid));
        } else if (acao === 'banir') {
            batch.update(refPrincipal, { status: 'banido' });
        } else if (acao === 'aprovar') {
            batch.update(refPrincipal, { status: 'aprovado' });
        } else if (acao === 'credito') {
            const valor = parseFloat(document.getElementById('bulk-credit-val').value) || 0;
            if (valor > 0) {
                batch.update(doc(window.db, "usuarios", uid), { 
                    wallet_balance: (window.db.FieldValue?.increment(valor) || valor) 
                });
            }
        }
    });

    try {
        await batch.commit();
        alert("✅ Ação concluída com sucesso em massa!");
        window.fecharModalUniversal();
        window.switchView(window.activeView); // Recarrega a aba atual
    } catch (e) {
        console.error("Erro na execução em massa:", e);
        alert("❌ Falha na operação: " + e.message);
    }
};
