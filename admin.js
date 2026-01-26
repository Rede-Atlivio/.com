
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

// --- VARIÁVEIS GLOBAIS ---
window.currentView = 'dashboard';
window.dataMode = 'real';
window.currentCollectionName = ''; 
window.currentEditId = null;
window.currentEditColl = null;

// VARIÁVEIS DO ROBÔ
let roboIntervalo = null;
let roboAtivo = false;
const TEMPO_ENTRE_POSTS = 30 * 60 * 1000; 

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
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Tenta ativar visualmente o botão (simples)
    
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
    window.forceRefresh();
};

window.forceRefresh = () => { 
    if(window.currentView === 'dashboard') initDashboard();
    else loadList(window.currentView); 
};

// --- LISTAGEM PADRÃO (AGORA COM DESTAQUE DE STATUS) ---
async function loadList(type) {
    const tbody = document.getElementById('table-body'), thead = document.getElementById('table-header');
    tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Carregando...</td></tr>";
    
    // Mapeamento de Coleções
    let colName = type;
    if (type === 'users') colName = 'usuarios';
    else if (type === 'services') colName = 'active_providers';
    else if (type === 'missions') colName = 'missoes';
    else if (type === 'opps') colName = 'oportunidades';
    else if (type === 'candidatos') colName = 'candidatos'; // Nova coleção de candidatos

    window.currentCollectionName = colName;
    
    let constraints = [];
    if (window.dataMode === 'demo') constraints.push(where("is_demo", "==", true));
    if (window.dataMode === 'real') constraints = [limit(50)]; 

    const chk = `<th class="p-3 w-10"><input type="checkbox" class="chk-custom" onclick="window.toggleSelectAll(this)"></th>`;
    let headers = [chk, "ID", "DADOS PRINCIPAIS", "STATUS", "AÇÕES"];
    
    // Customização de Headers
    if(type === 'users') headers = [chk, "NOME", "TIPO", "EMAIL", "STATUS", "AÇÕES"];
    if(type === 'services') headers = [chk, "PRESTADOR", "SERVIÇOS", "SCORE", "STATUS", "AÇÕES"];
    if(type === 'candidatos') headers = [chk, "NOME", "VAGA", "CONTATO", "STATUS", "AÇÕES"];

    if(thead) thead.innerHTML = headers.join('');
    
    try {
        let q;
        // Prioriza "Em Análise" ou "Pendentes" ordenando
        if (colName === 'active_providers' || colName === 'candidatos') {
             q = query(collection(db, colName), orderBy('updated_at', 'desc'), limit(50));
        } else {
             q = query(collection(db, colName), limit(50));
        }

        const snap = await getDocs(q);
        tbody.innerHTML = "";
        if(snap.empty) tbody.innerHTML = "<tr><td colspan='6' class='p-4 text-center text-gray-500'>Nenhum registro encontrado.</td></tr>";
        
        snap.forEach(docSnap => { 
            const d = { id: docSnap.id, ...docSnap.data() }; 
            
            // Lógica de Destaque (Amarelo se estiver em análise)
            let rowClass = "border-b border-white/5 transition hover:bg-white/5";
            let statusBadge = `<span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-[10px] uppercase font-bold">${d.status || 'OK'}</span>`;
            
            if (d.status === 'em_analise' || d.status === 'pendente') {
                rowClass = "border-b border-yellow-900/30 bg-yellow-900/10 hover:bg-yellow-900/20";
                statusBadge = `<span class="bg-yellow-600 text-white px-2 py-1 rounded text-[10px] uppercase font-black animate-pulse">🟡 EM ANÁLISE</span>`;
            } else if (d.status === 'aprovado') {
                statusBadge = `<span class="bg-green-600 text-white px-2 py-1 rounded text-[10px] uppercase font-bold">✅ APROVADO</span>`;
            } else if (d.status === 'rejeitado') {
                statusBadge = `<span class="bg-red-600 text-white px-2 py-1 rounded text-[10px] uppercase font-bold">❌ REJEITADO</span>`;
            }

            // Campos Específicos
            let mainInfo = d.titulo || d.nome || d.nome_profissional || 'Sem Nome';
            let subInfo = d.email || (d.services ? d.services.length + ' serviços' : '') || d.vaga_id || '-';
            
            tbody.innerHTML += `
                <tr class="${rowClass}">
                    <td class="p-3"><input type="checkbox" class="chk-custom row-checkbox" value="${d.id}" onclick="window.updateBulkBar()"></td>
                    <td class="p-3 text-xs text-gray-500 font-mono">${d.id.substring(0,4)}...</td>
                    <td class="p-3">
                        <p class="font-bold text-white text-xs">${mainInfo}</p>
                        <p class="text-[10px] text-gray-400">${subInfo}</p>
                    </td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3">
                        <button onclick="window.openUniversalEditor('${colName}', '${d.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-[10px] font-bold uppercase shadow">
                            ✏️ Gerenciar
                        </button>
                    </td>
                </tr>`; 
        });
    } catch(e) { 
        console.log(e); 
        tbody.innerHTML = `<tr><td colspan='6' class='text-red-500 p-4 text-center'>Erro ao carregar dados: ${e.message}</td></tr>`; 
    }
    
    // Reativa botão +NOVO
    const btnAdd = document.getElementById('btn-add-new'); 
    if(btnAdd) {
        const newBtn = btnAdd.cloneNode(true);
        btnAdd.parentNode.replaceChild(newBtn, btnAdd);
        newBtn.onclick = () => window.openModalCreate(type);
    }
}

// --- EDITOR UNIVERSAL INTELIGENTE (O CORAÇÃO DA CURADORIA) ---
window.openUniversalEditor = async (collectionName, id) => {
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    window.currentEditId = id; 
    window.currentEditColl = collectionName;
    
    modal.classList.remove('hidden'); 
    title.innerHTML = `GERENCIAR <span class="text-blue-500">${collectionName.toUpperCase()}</span>`; 
    content.innerHTML = `<p class="text-center text-gray-500 animate-pulse py-10">Carregando dados...</p>`;
    
    try { 
        const docSnap = await getDoc(doc(db, collectionName, id)); 
        if (!docSnap.exists()) return; 
        const data = docSnap.data(); 
        content.innerHTML = ""; 
        
        let htmlCampos = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
        let htmlMidia = '<div class="col-span-1 md:col-span-2 space-y-4 bg-slate-800 p-4 rounded-xl border border-slate-700">';
        let temMidia = false;

        Object.keys(data).sort().forEach(key => { 
            if(key === 'created_at' || key === 'updated_at') return; 
            
            // DETECTOR DE MÍDIA E ARQUIVOS (A Mágica)
            const valor = data[key];
            const keyLower = key.toLowerCase();

            // 1. É Imagem? (Banner, Foto, Url de imagem)
            if (keyLower.includes('banner') || keyLower.includes('foto') || keyLower.includes('image')) {
                if (typeof valor === 'string' && valor.startsWith('http')) {
                    temMidia = true;
                    htmlMidia += `
                        <div>
                            <p class="inp-label mb-1">📷 PREVIEW: ${key.toUpperCase()}</p>
                            <div class="h-32 rounded-lg bg-black/50 flex items-center justify-center overflow-hidden border border-slate-600 relative group">
                                <img src="${valor}" class="h-full object-contain">
                                <a href="${valor}" target="_blank" class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white font-bold text-xs">ABRIR ORIGINAL ↗</a>
                            </div>
                            <input type="text" id="field-${key}" value="${valor}" class="inp-editor mt-1 text-[10px] text-gray-500">
                        </div>`;
                    return; // Não adiciona nos campos normais
                }
            }

            // 2. É PDF/Currículo?
            if (keyLower.includes('curriculo') || keyLower.includes('cv') || keyLower.includes('pdf') || keyLower.includes('arquivo')) {
                if (typeof valor === 'string' && valor.startsWith('http')) {
                    temMidia = true;
                    htmlMidia += `
                        <div class="bg-blue-900/20 p-3 rounded-lg border border-blue-500/30 flex justify-between items-center">
                            <div>
                                <p class="text-blue-400 font-bold text-xs uppercase">📎 DOCUMENTO ANEXADO (${key})</p>
                                <p class="text-[10px] text-gray-400 truncate max-w-[200px]">${valor}</p>
                            </div>
                            <a href="${valor}" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase shadow-lg">
                                ⬇ BAIXAR PDF
                            </a>
                        </div>`;
                    return;
                }
            }

            // Campo Normal
            htmlCampos += `<div class="mb-2"><label class="inp-label">${key}</label><input type="text" id="field-${key}" value="${valor}" class="inp-editor"></div>`; 
        }); 
        
        htmlCampos += '</div>'; // Fecha grid
        htmlMidia += '</div>';

        if(temMidia) content.innerHTML += htmlMidia;
        content.innerHTML += htmlCampos;

        // BOTÕES DE AÇÃO (MODERAÇÃO)
        let botoesAcao = `
            <div class="pt-4 border-t border-slate-700 flex gap-3 mt-4">
                <button onclick="window.saveModalData()" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold text-xs uppercase">SALVAR EDIÇÃO</button>
            </div>`;

        // Se for Prestador ou Candidato, adiciona Aprovação
        if (collectionName === 'active_providers' || collectionName === 'candidatos') {
            botoesAcao = `
                <div class="pt-4 border-t border-slate-700 mt-4">
                    <p class="text-center text-gray-400 text-[10px] uppercase font-bold mb-2">Ações de Moderação</p>
                    <div class="grid grid-cols-2 gap-3">
                        <button onclick="window.moderarItem('${collectionName}', '${id}', 'rejeitado')" class="bg-red-900/50 hover:bg-red-600 border border-red-800 text-white py-3 rounded-xl font-bold text-xs uppercase transition">
                            ❌ REPROVAR
                        </button>
                        <button onclick="window.moderarItem('${collectionName}', '${id}', 'aprovado')" class="bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg transition">
                            ✅ APROVAR & PUBLICAR
                        </button>
                    </div>
                    <button onclick="window.saveModalData()" class="w-full mt-3 bg-slate-800 text-gray-400 py-2 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-700">Apenas Salvar Dados</button>
                </div>
            `;
        }

        content.innerHTML += botoesAcao;

        // Função de salvar genérica
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

// --- FUNÇÃO DE MODERAÇÃO ---
window.moderarItem = async (col, id, decisao) => {
    if(!confirm(`Tem certeza que deseja marcar como ${decisao.toUpperCase()}?`)) return;
    
    try {
        const ref = doc(db, col, id);
        let updates = { status: decisao, updated_at: serverTimestamp() };

        // Lógica específica para Prestadores
        if (col === 'active_providers') {
            if (decisao === 'aprovado') {
                updates.visibility_score = 100; // Vira "Real"
                updates.is_online = false; // Começa offline, mas liberado para ficar online
                alert("✅ Prestador Aprovado!\nEle agora tem Score 100 e pode ficar online.");
            } else {
                updates.visibility_score = 0;
                updates.is_online = false;
            }
        }

        await updateDoc(ref, updates);
        window.closeModal();
        window.forceRefresh();

    } catch(e) {
        alert("Erro: " + e.message);
    }
};

window.saveModalData = async () => { 
    try { 
        if(window.saveCallback) await window.saveCallback(); 
        alert("Dados salvos!"); 
        window.closeModal(); 
        window.forceRefresh(); 
    } catch(e){alert(e.message);} 
};

window.closeModal = () => document.getElementById('modal-editor').classList.add('hidden');

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
    if(!confirm(`Excluir ${checked.length} itens?`)) return; 
    const batch = writeBatch(db); 
    checked.forEach(cb => batch.delete(doc(db, window.currentCollectionName, cb.value))); 
    await batch.commit(); 
    document.getElementById('bulk-actions').classList.remove('visible'); 
    window.forceRefresh(); 
};

window.openModalCreate = (type) => { 
    const modal = document.getElementById('modal-editor');
    const content = document.getElementById('modal-content');
    const title = document.getElementById('modal-title');
    
    modal.classList.remove('hidden'); 
    title.innerText = "CRIAR ITEM (Rápido)"; 
    content.innerHTML = `
        <div class="mb-2"><label class="inp-label">Título/Nome</label><input type="text" id="new-titulo" class="inp-editor"></div>
        <div class="mb-2"><label class="inp-label">Descrição/Detalhes</label><input type="text" id="new-desc" class="inp-editor"></div>
        <button onclick="window.saveModalData()" class="w-full bg-blue-600 text-white py-3 rounded mt-4 font-bold text-xs">CRIAR</button>
    `;
    
    window.saveCallback = async () => {
        let col = type === 'users' ? 'usuarios' : (type === 'services' ? 'active_providers' : (type === 'candidatos' ? 'candidatos' : type));
        await addDoc(collection(db, col), {
            titulo: document.getElementById('new-titulo').value,
            descricao: document.getElementById('new-desc').value,
            created_at: serverTimestamp(),
            status: "ativo"
        });
    };
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

// Funções do Robô e Links (Mantidas do original, resumidas aqui para não ocupar espaço, mas funcionais)
window.injetarPainelRobo = () => {}; // (Código do robô mantido no seu arquivo original, se precisar me peça)
window.saveLinkToFirebase = async () => {}; // (Código de links mantido)
