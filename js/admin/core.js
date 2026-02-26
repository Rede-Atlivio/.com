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
        'view-missions', 'view-opportunities', 'view-maestro' 
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
    else if (viewName === 'maestro') { moduleFile = './automation.js'; containerId = 'view-maestro'; }
    else if (viewName === 'finance') { moduleFile = './finance.js'; containerId = 'view-finance'; }
    else if (viewName === 'settings') { 
        moduleFile = './settings.js'; 
        containerId = 'view-settings';
        // 🚀 CARGA DE APOIO: Garante que o motor de bônus do automation esteja disponível
        import('./automation.js?v=' + Date.now()).catch(e => console.warn("Erro ao pré-carregar automation:", e));
    }
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
            
            // 🚀 GATILHO MAESTRO: Executa a interface se a rota for maestro
            if (viewName === 'maestro' && window.carregarMaestro) {
                await window.carregarMaestro();
            }
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
    
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = `CONTROLE EM MASSA (${count})`;

    // FINANCEIRO REMOVIDO DAQUI PARA EVITAR PONTAS SOLTAS
    content.innerHTML = `
        <div class="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <p class="text-[10px] font-black text-blue-400 uppercase mb-4 tracking-widest text-center">Gestão de Status e Banco</p>
            <div class="grid grid-cols-1 gap-3">
                <button onclick="window.executarAcaoMassa('aprovar')" class="bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg transition">✅ Aprovar Todos</button>
                <button onclick="window.executarAcaoMassa('banir')" class="bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg transition">🚫 Banir / Suspender</button>
                <div class="h-px bg-slate-700 my-2"></div>
                <button onclick="window.executarAcaoMassa('excluir')" class="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg transition">🗑️ EXCLUIR DEFINITIVAMENTE (DUPLO)</button>
            </div>
            <p class="text-[9px] text-gray-500 mt-4 text-center">A exclusão removerá dados de 'usuarios' e 'active_providers' simultaneamente.</p>
        </div>
    `;
};

// --- LOGICA PARA O BOTÃO "+ NOVO" ---
window.abrirModalCriarNovo = () => {
    const view = window.activeView;
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    document.getElementById('modal-title').innerText = `CRIAR NOVO: ${view.toUpperCase()}`;

    if (view === 'services') {
        content.innerHTML = `
            <div class="space-y-4">
                <input type="text" id="new-prov-uid" placeholder="Cole o UID do Usuário" class="inp-editor">
                <input type="text" id="new-prov-nome" placeholder="Nome Profissional" class="inp-editor">
                <input type="text" id="new-prov-cat" placeholder="Categoria (Ex: Encanador)" class="inp-editor">
                <button onclick="window.salvarNovoPrestador()" class="w-full bg-blue-600 py-3 rounded-xl font-bold uppercase text-xs">Criar Prestador</button>
            </div>`;
    } else {
        content.innerHTML = `<p class="text-center text-gray-400 py-10">Use o Painel do Robô ou Gerador para criar ${view}.</p>`;
    }
};

window.salvarNovoPrestador = async () => {
    const uid = document.getElementById('new-prov-uid').value.trim();
    const nome = document.getElementById('new-prov-nome').value.trim();
    const cat = document.getElementById('new-prov-cat').value.trim();
    
    if(!uid || !nome) return alert("UID e Nome são obrigatórios.");

    const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    try {
        await setDoc(doc(window.db, "active_providers", uid), {
            uid: uid,
            nome_profissional: nome,
            category: cat,
            status: 'aprovado',
            is_online: true,
            created_at: serverTimestamp()
        });
        alert("✅ Prestador criado!");
        window.fecharModalUniversal();
        window.switchView('services');
    } catch(e) { alert("Erro: " + e.message); }
};

// --- EXECUTOR REAL DAS AÇÕES ---
window.executarAcaoMassa = async (acao) => {
    const selecionados = document.querySelectorAll('.row-checkbox:checked');
    if (selecionados.length === 0) return;
    if (!confirm(`Confirmar [${acao.toUpperCase()}] em ${selecionados.length} registros?`)) return;

    const { writeBatch, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const batch = writeBatch(window.db);
    const colecaoPrincipal = window.activeView === 'users' ? 'usuarios' : 'active_providers';

    selecionados.forEach(cb => {
        const uid = cb.value;
        if (acao === 'excluir') {
            batch.delete(doc(window.db, "usuarios", uid));
            batch.delete(doc(window.db, "active_providers", uid));
        } else {
            batch.update(doc(window.db, colecaoPrincipal, uid), { status: acao === 'aprovar' ? 'aprovado' : 'banido' });
        }
    });

    await batch.commit();
    window.fecharModalUniversal();
    window.switchView(window.activeView);
};
// --- SALVAMENTO AVANÇADO (COM TRATAMENTO NUMÉRICO PARA SALDO) ---
window.saveModalData = async () => { 
    try { 
        const { updateDoc, doc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const id = window.currentEditId;
        const col = window.currentEditColl;
        const updates = { updated_at: serverTimestamp() };

        // Pega todos os inputs que o editor criou dinamicamente
        const inputs = document.querySelectorAll('#modal-content input');
        
        inputs.forEach(input => {
            const key = input.id.replace('field-', '');
            let val = input.value;

            // 💎 REGRA DE OURO: Se o campo for de saldo ou reserva, salva como NÚMERO
            if (key === 'wallet_balance' || key === 'wallet_reserved' || key === 'saldo') {
                updates[key] = parseFloat(val) || 0;
            } else {
                updates[key] = val;
            }
        });

        await updateDoc(doc(window.db, col, id), updates);
        
        alert("✅ Dados e Saldo atualizados com sucesso!");
        window.fecharModalUniversal();
        window.switchView(window.activeView); 
    } catch(e) {
        alert("❌ Erro ao salvar: " + e.message);
    } 
};

// ============================================================================
// ✅ PONTE ADMINISTRATIVA: LIQUIDAÇÃO VIA CHAT CORE (ATLIVIO V50)
// ============================================================================
// ✅ PONTE ADMINISTRATIVA OTIMIZADA PARA MASSA
window.finalizarManualmente = async (orderId) => {
    try {
        const chatModule = await import('/.com/js/modules/chat.js?v=' + Date.now());
        // Executa e aguarda a promessa. Lança erro para o loop de massa capturar se falhar.
        await chatModule.finalizarServicoPassoFinalAction(orderId, true);
        console.log(`✅ Ordem ${orderId} liquidada.`);
        return true;
    } catch (e) {
        console.error(`❌ Falha na liquidação manual (${orderId}):`, e);
        throw e; // Repassa o erro para o Motor de Massa decidir o que fazer
    }
};

// ⚡ MOTOR DE LIQUIDAÇÃO EM MASSA (PASSO 0 - SEGURO)
window.liquidarTodasExpiradas = async () => {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    if (!confirm("⚠️ AÇÃO EM MASSA: Deseja liquidar TODOS os serviços em ANDAMENTO com mais de 12h?")) return;

    try {
        // Filtra apenas o que está em andamento. Disputas são ignoradas por segurança.
        const q = query(collection(window.db, "orders"), where("status", "==", "in_progress"), where("system_step", "==", 3));
        const snap = await getDocs(q);
        
        let sucessos = 0, falhas = 0;
        let listaFalhas = [];

        for (const d of snap.docs) {
            try {
                const p = d.data();
                const inicio = p.real_start?.toDate ? p.real_start.toDate() : new Date(p.real_start);
                const decorridoH = (Date.now() - inicio.getTime()) / (1000 * 60 * 60);

                if (decorridoH >= 12) {
                    await window.finalizarManualmente(d.id);
                    sucessos++;
                }
            } catch (innerError) {
                falhas++;
                listaFalhas.push(`ID ${d.id}: ${innerError}`);
            }
        }

        alert(`PROCESSO FINALIZADO:\n✅ Sucessos: ${sucessos}\n❌ Falhas: ${falhas}`);
        window.switchView('dashboard');
    } catch (e) { alert("Erro no motor de massa: " + e.message); }
};

// ============================================================================
// ♻️ AÇÃO MASTER REFUND: ESTORNO ADMINISTRATIVO (ATLIVIO V43)
// ============================================================================
window.reembolsarManualmente = async (orderId) => {
    const motivoPrivado = prompt("📝 MOTIVO INTERNO (Para Auditoria):");
    if (!motivoPrivado) return;

    const motivoPublico = prompt("⚖️ RESUMO PARA OS USUÁRIOS (Ex: Descumprimento de regras):", "Decisão administrativa após análise de evidências.");
    if (!motivoPublico) return;

    if (!confirm("⚠️ MASTER REFUND: Deseja estornar o valor integral para o CLIENTE?")) return;

    const { runTransaction, doc, collection, serverTimestamp, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

    try {
        await runTransaction(window.db, async (transaction) => {
            const orderRef = doc(window.db, "orders", orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw "Ordem não encontrada.";
            
            const pedido = orderSnap.data();
            const resCliente = parseFloat(pedido.value_reserved_client || 0);
            const resProvider = parseFloat(pedido.value_reserved_provider || 0);

            const clientRef = doc(window.db, "usuarios", pedido.client_id);
            const providerRef = doc(window.db, "usuarios", pedido.provider_id);

            const [cSnap, pSnap] = await Promise.all([
                transaction.get(clientRef),
                transaction.get(providerRef)
            ]);

            // 1. Estorna as Reservas para seus respectivos donos originais
            transaction.update(clientRef, { 
                wallet_reserved: Math.max(0, (cSnap.data().wallet_reserved || 0) - resCliente),
                wallet_balance: increment(resCliente) // Devolve apenas o que era do cliente
            });
            transaction.update(providerRef, { 
                wallet_reserved: Math.max(0, (pSnap.data().wallet_reserved || 0) - resProvider),
                wallet_balance: increment(resProvider) // Devolve apenas o que era do prestador
            });
            
            // 2. Cancela a Ordem com marcação de reembolso
            transaction.update(orderRef, {
                status: 'cancelled',
                system_step: 4,
                completed_at: serverTimestamp(),
                finalizado_por: 'admin',
                admin_decision_type: 'refund',
                admin_decision_notes: motivoPrivado,
                admin_public_reason: motivoPublico
            });

            // 3. Log de Arbitragem no Chat
            transaction.set(doc(collection(window.db, `chats/${orderId}/messages`)), {
                text: `⚖️ MEDIAÇÃO ATLIVIO: Serviço cancelado com estorno total ao cliente. \n\nVeredito: ${motivoPublico}`,
                sender_id: 'system',
                timestamp: serverTimestamp()
            });
        });

        alert("♻️ REEMBOLSO PROCESSADO COM SUCESSO!");
        if(window.activeView === 'dashboard') window.switchView('dashboard');
    } catch (e) {
        console.error(e);
        alert("Erro no Refund: " + e);
    }
};

// ☢️ COMANDO MASTER: DISPARAR LIMPEZA GLOBAL (FORCE UPDATE NOS USUÁRIOS)
window.dispararLimpezaGlobal = async function() {
    if (!confirm("⚠️ ATENÇÃO: Isso forçará TODOS os usuários logados no app a limparem o cache e recarregarem agora. Confirmar?")) return;
    
    try {
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(doc(window.db, "settings", "deploy"), {
            force_reset_timestamp: serverTimestamp(),
            reason: "Limpeza de Sistema e Cache V22",
            admin_by: "Gil Borges"
        }, { merge: true });
        
        alert("🚀 COMANDO DE LIMPEZA ENVIADO! Os usuários serão resetados em tempo real.");
    } catch (e) {
        alert("Erro ao disparar limpeza: " + e.message);
    }
};
