import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
window.db = db;

// --- VARIÁVEIS DE CONTROLE ---
let chartInstance = null;
let itensSelecionados = new Set(); // Armazena IDs para exclusão em massa
let collectionAtual = ""; // Para saber o que excluir

// --- DADOS BRASILEIROS ---
const NOMES_BR = ["Carlos Silva", "Ana Souza", "Marcos Oliveira", "Fernanda Lima", "João Pedro", "Mariana Santos", "Rafael Costa", "Severino da Silva", "Cláudio Pedreiro", "Dona Maria Limpeza", "Fábio Eletricista", "Jorge Encanador"];
const PROFISSOES = [{cat:"Limpeza",nome:"Diarista",preco:150}, {cat:"Eletricista",nome:"Eletricista",preco:120}, {cat:"Encanador",nome:"Bombeiro",preco:100}, {cat:"Frete",nome:"Frete",preco:60}];
const VAGAS_DEMO = [{titulo:"Atendente",sal:"1.412,00"}, {titulo:"Vendedor",sal:"1.800,00"}, {titulo:"Estoque",sal:"1.600,00"}];

// --- 1. NAVEGAÇÃO E INICIALIZAÇÃO ---
window.loadData = async () => {
    initDashboard(); // Força recarregar dados do painel
};

window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'loja', 'financeiro', 'tools', 'users', 'opps'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
        document.getElementById(`nav-${v}`)?.classList.replace('text-indigo-400', 'text-slate-400');
    });

    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    document.getElementById(`nav-${viewName}`)?.classList.add('active');
    
    // Define contexto para exclusão em massa
    collectionAtual = viewName === 'links' ? 'tracked_links' : 
                      viewName === 'users' ? 'usuarios' : 
                      viewName === 'rh' ? 'candidates' : 
                      viewName === 'loja' ? 'products' : 
                      viewName === 'opps' ? 'opportunities' : '';

    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'links') carregarLinksRastreados();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'loja') { carregarProdutos(); carregarOportunidades(); }
    if(viewName === 'financeiro') carregarValidacoes();
    
    // Limpa seleção ao trocar de aba
    itensSelecionados.clear();
    atualizarBarraBulk();
};

// --- 2. LÓGICA DE SELEÇÃO EM MASSA (BULK) ---
window.toggleItem = (id) => {
    if(itensSelecionados.has(id)) itensSelecionados.delete(id);
    else itensSelecionados.add(id);
    atualizarBarraBulk();
};

window.selecionarTodos = (tipo) => {
    // Seleciona todos os checkboxes visíveis na tela atual
    const boxes = document.querySelectorAll('.custom-checkbox');
    boxes.forEach(box => {
        box.checked = true;
        itensSelecionados.add(box.getAttribute('data-id'));
    });
    atualizarBarraBulk();
};

function atualizarBarraBulk() {
    const bar = document.getElementById('bulk-action-bar');
    const count = document.getElementById('bulk-count');
    if(itensSelecionados.size > 0) {
        bar.classList.remove('hidden');
        count.innerText = itensSelecionados.size;
    } else {
        bar.classList.add('hidden');
    }
}

window.fecharBulkActions = () => {
    itensSelecionados.clear();
    document.querySelectorAll('.custom-checkbox').forEach(b => b.checked = false);
    atualizarBarraBulk();
};

window.executarExclusaoEmMassa = async () => {
    if(!confirm(`⚠️ TEM CERTEZA? Você vai apagar ${itensSelecionados.size} itens de ${collectionAtual}. Isso é irreversível.`)) return;
    
    const btn = document.querySelector('#bulk-action-bar button');
    btn.innerText = "Apagando..."; btn.disabled = true;

    try {
        const promises = Array.from(itensSelecionados).map(id => deleteDoc(doc(db, collectionAtual, id)));
        await Promise.all(promises);
        alert("✅ Itens Excluídos!");
        fecharBulkActions();
    } catch(e) {
        alert("Erro parcial: " + e.message);
    }
};

// --- 3. EXPORTAÇÃO DE DADOS (DOWNLOAD) ---
window.exportarDadosGeral = async () => {
    const tipo = prompt("O que deseja baixar? Digite:\n1 - Usuários\n2 - Links\n3 - Currículos");
    let coll = "";
    if(tipo == "1") coll = "usuarios";
    else if(tipo == "2") coll = "tracked_links";
    else if(tipo == "3") coll = "candidates";
    else return;

    try {
        const snap = await getDocs(collection(db, coll));
        if(snap.empty) return alert("Nada para baixar.");

        let csvContent = "data:text/csv;charset=utf-8,";
        const keys = Object.keys(snap.docs[0].data());
        csvContent += keys.join(",") + "\r\n"; // Cabeçalho

        snap.forEach(doc => {
            const row = keys.map(k => {
                let val = doc.data()[k];
                if(typeof val === 'object') val = JSON.stringify(val).replace(/,/g, ';'); // Evita quebra de CSV
                return val;
            }).join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `atlivio_export_${coll}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch(e) { alert("Erro ao exportar: " + e.message); }
};

// --- 4. DASHBOARD (CORREÇÃO DE DADOS) ---
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    if(!feed) return;

    // Removemos filtros complexos para garantir que dados apareçam
    const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        let stats = { views: 0, actions: 0, sales: 0 };

        if(snap.empty) { feed.innerHTML = "<p class='text-center text-slate-600 text-xs py-10'>Sem dados.</p>"; updateChart(stats); return; }

        snap.forEach(d => {
            const data = d.data();
            // Filtro manual JS para evitar erro de índice
            if(data.is_test !== undefined && data.is_test !== isTestMode) return;

            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            let icon = '🔹'; let color = 'text-slate-400';
            
            if (data.event.includes('LOGIN')) { icon = '🔑'; stats.views++; }
            if (data.event.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400 font-bold'; stats.views++; } 
            if (data.event.includes('CANDIDATURA')) { icon = '📝'; color = 'text-blue-400'; stats.actions++; }
            if (data.event.includes('PROPOSTA')) { icon = '💰'; color = 'text-green-400 font-bold'; stats.sales++; }

            feed.innerHTML += `<div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn"><div class="flex items-center gap-2"><span>${icon}</span><span class="${color}">${data.event}</span><span class="text-slate-500 truncate w-20">(${data.details?.source || 'user'})</span></div><span class="font-mono text-slate-600">${time}</span></div>`;
        });
        updateChart(stats);
    });
    loadKPIs();
}

function updateChart(data) {
    const ctx = document.getElementById('funnelChart');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['Visitas', 'Ações', 'Negócios'], datasets: [{ label: 'Hoje', data: [data.views, data.actions, data.sales], backgroundColor: ['#64748b', '#3b82f6', '#10b981'], borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#ffffff10' } } } }
    });
}

async function loadKPIs() {
    try {
        const snapUsers = await getCountFromServer(collection(db, "usuarios"));
        document.getElementById('kpi-users').innerText = snapUsers.data().count;
        const snapOnline = await getCountFromServer(query(collection(db, "active_providers"), where("is_online", "==", true)));
        document.getElementById('kpi-online').innerText = snapOnline.data().count;
        const snapJobs = await getCountFromServer(collection(db, "jobs"));
        document.getElementById('kpi-jobs').innerText = snapJobs.data().count;
        const snapLinks = await getCountFromServer(collection(db, "tracked_links"));
        document.getElementById('kpi-links').innerText = snapLinks.data().count;
    } catch(e) {}
}

// --- 5. FÁBRICA DE LINKS ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim();
    if(!slug) return alert("Digite o Slug.");
    try {
        await setDoc(doc(db, "tracked_links", slug), {
            slug, target_tab: document.getElementById('link-target').value, source: document.getElementById('link-source').value, clicks: 0, created_at: serverTimestamp()
        });
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        document.getElementById('finalLinkDisplay').innerText = `${baseUrl}?trk=${slug}`;
        document.getElementById('link-result').classList.remove('hidden');
        carregarLinksRastreados();
    } catch(e) { alert(e.message); }
};
window.copiarLink = () => navigator.clipboard.writeText(document.getElementById('finalLinkDisplay').innerText).then(()=>alert("Copiado!"));

function carregarLinksRastreados() {
    const list = document.getElementById('links-list');
    onSnapshot(query(collection(db, "tracked_links"), orderBy("created_at", "desc")), (snap) => {
        list.innerHTML = "";
        snap.forEach(d => { 
            const l=d.data(); 
            list.innerHTML += `
            <div class="flex justify-between bg-slate-800 p-3 rounded border border-slate-700 mb-2 animate-fadeIn">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')">
                    <div>
                        <span class="text-indigo-400 font-bold text-xs uppercase">${l.slug}</span>
                        <p class="text-[9px] text-slate-500">${l.source} → ${l.target_tab}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xl font-black text-white">${l.clicks}</span>
                    <button onclick="excluirItem('${d.id}', 'tracked_links')" class="text-red-500 text-[10px] ml-2">🗑️</button>
                </div>
            </div>`; 
        });
    });
}

// --- 6. RH COM EDIÇÃO E RESSALVA ---
window.carregarCandidaturas = () => {
    const list = document.getElementById('rh-cv-list');
    onSnapshot(collection(db, "candidates"), (snap) => {
        list.innerHTML = snap.empty ? "<p class='text-xs text-slate-500'>Vazio.</p>" : "";
        snap.forEach(d => {
            const cv = d.data();
            const statusColor = cv.status === 'approved' ? 'text-green-400' : (cv.status === 'rejected' ? 'text-red-400' : 'text-yellow-400');
            list.innerHTML += `
            <div class="bg-slate-800 p-4 rounded border border-slate-700 mb-2">
                <div class="flex justify-between items-start">
                    <div class="flex gap-2">
                        <input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')">
                        <div>
                            <h4 class="text-white text-xs font-bold">${cv.nome_completo}</h4>
                            <p class="text-[10px] text-slate-400">${cv.telefone} | ${cv.habilidades}</p>
                        </div>
                    </div>
                    <span class="${statusColor} text-[10px] font-bold uppercase">${cv.status || 'Pendente'}</span>
                </div>
                <div class="mt-3 flex gap-2 justify-end border-t border-slate-700 pt-2">
                    <button onclick="editarCandidato('${d.id}', '${cv.habilidades}')" class="text-[10px] bg-slate-700 text-white px-2 py-1 rounded">✏️ Editar / Aprovar com Ressalva</button>
                    <button onclick="decidirCandidato('${d.id}', true)" class="text-[10px] bg-green-600 text-white px-3 py-1 rounded">Aprovar</button>
                    <button onclick="decidirCandidato('${d.id}', false)" class="text-[10px] bg-red-600/50 text-white px-3 py-1 rounded">Recusar</button>
                </div>
            </div>`;
        });
    });
};

window.editarCandidato = async (id, textoAtual) => {
    const novoTexto = prompt("Edite as habilidades ou adicione uma ressalva para aprovar:", textoAtual);
    if(novoTexto && novoTexto !== textoAtual) {
        await updateDoc(doc(db, "candidates", id), { habilidades: novoTexto, status: "approved_with_changes" });
        alert("✅ Atualizado e Aprovado com Ressalva!");
    }
};

window.decidirCandidato = async (id, ok) => {
    try { await updateDoc(doc(db, "candidates", id), { status: ok ? 'approved' : 'rejected', moderated_at: serverTimestamp() }); } catch(e) { alert(e.message); }
};

// --- 7. FINANCEIRO E OUTROS ---
window.carregarValidacoes = () => {
    const list = document.getElementById('fin-mission-list');
    onSnapshot(query(collection(db, "mission_assignments")), (snap) => {
        list.innerHTML = snap.empty ? "<p class='text-xs text-slate-500'>Sem solicitações.</p>" : "";
        snap.forEach(d => {
            const m = d.data();
            list.innerHTML += `
            <div class="bg-slate-800 p-3 rounded mb-2 border border-slate-700">
                <div class="flex gap-2">
                    <input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')">
                    <div class="flex-1">
                        <div class="flex justify-between"><span class="text-white text-xs">${m.mission_title}</span><span class="text-green-400 text-xs font-mono">R$ ${m.valor_bruto}</span></div>
                        <p class="text-[10px] text-slate-500">Status: ${m.status}</p>
                    </div>
                </div>
                <div class="mt-2 flex gap-2 justify-end">
                    <button onclick="validarMissao('${d.id}', false, '${m.profile_id}', 0)" class="text-[9px] bg-red-900/50 text-white px-2 py-1 rounded">Rejeitar</button>
                    <button onclick="validarMissao('${d.id}', true, '${m.profile_id}', ${m.valor_bruto})" class="text-[9px] bg-green-600 text-white px-2 py-1 rounded">Pagar</button>
                </div>
            </div>`;
        });
    });
};

window.validarMissao = async (id, ok, uid, val) => {
    try {
        const ref = doc(db, "mission_assignments", id);
        if (ok) { await updateDoc(ref, { status: "approved", approved_at: serverTimestamp() }); await updateDoc(doc(db, "usuarios", uid), { saldo: increment(val) }); }
        else { await updateDoc(ref, { status: "rejected", rejected_at: serverTimestamp() }); }
    } catch(e) { alert(e.message); }
};

// --- 8. LOJA E OPPS ---
window.adicionarProduto = async () => {
    try { await addDoc(collection(db, "products"), { nome: document.getElementById('prod-nome').value, preco: document.getElementById('prod-preco').value, link: document.getElementById('prod-link').value, imagem: document.getElementById('prod-img').value }); alert("Salvo!"); } catch(e){alert(e.message);}
};
function carregarProdutos() {
    onSnapshot(collection(db, "products"), (snap) => { 
        document.getElementById('loja-list').innerHTML = snap.docs.map(d => `
        <div class="bg-slate-800 p-2 rounded flex justify-between items-center">
            <span class="text-white text-xs">${d.data().nome}</span>
            <input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')">
        </div>`).join(''); 
    });
}
window.adicionarOportunidade = async () => {
    try { await addDoc(collection(db, "opportunities"), { titulo: document.getElementById('opp-titulo').value, link: document.getElementById('opp-link').value, descricao: document.getElementById('opp-desc').value, created_at: serverTimestamp() }); alert("Publicado!"); } catch(e){alert(e.message);}
};
function carregarOportunidades() {
    onSnapshot(collection(db, "opportunities"), (snap) => { document.getElementById('opps-list').innerHTML = snap.docs.map(d => `<div class="bg-slate-800 p-2 rounded flex justify-between"><span class="text-white text-xs">${d.data().titulo}</span><input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')"></div>`).join(''); });
}

// --- 9. TOP USERS ---
function carregarTopUsuarios() {
    onSnapshot(query(collection(db, "usuarios"), orderBy("saldo", "desc"), limit(20)), (snap) => {
        document.getElementById('user-ranking-list').innerHTML = snap.docs.map((d, i) => `
        <div class="flex justify-between bg-slate-800 p-2 rounded mb-1 text-xs items-center">
            <div class="flex gap-2 items-center">
                <input type="checkbox" class="custom-checkbox" data-id="${d.id}" onchange="toggleItem('${d.id}')">
                <span class="text-white">#${i+1} ${d.data().email}</span>
            </div>
            <div class="flex gap-2">
                <span class="text-green-400">R$ ${d.data().saldo || 0}</span>
                <button onclick="excluirItem('${d.id}', 'usuarios')" class="text-red-500">🗑️</button>
            </div>
        </div>`).join('');
    });
}

window.excluirItem = async (id, coll) => { if(confirm("Apagar item?")) await deleteDoc(doc(db, coll, id)); };

// --- 10. IMPULSO ---
window.gerarDemonstracao = async (tipo) => {
    try {
        const promises = [];
        for(let i=0; i<3; i++) {
            if (tipo === 'servico') {
                const p = PROFISSOES[Math.floor(Math.random() * PROFISSOES.length)];
                const nome = NOMES_BR[Math.floor(Math.random() * NOMES_BR.length)];
                promises.push(addDoc(collection(db, "active_providers"), { nome_profissional: nome, is_online: true, is_seed: true, services: [{ category: p.cat, price: p.preco }], last_seen: serverTimestamp() }));
            }
            if (tipo === 'vaga') {
                const v = VAGAS_DEMO[Math.floor(Math.random() * VAGAS_DEMO.length)];
                promises.push(addDoc(collection(db, "jobs"), { titulo: v.titulo, descricao: "Vaga demonstrativa.", salario: `R$ ${v.sal}`, company_name: "Empresa Parceira", tipo: "CLT", is_seed: true, created_at: serverTimestamp() }));
            }
        }
        await Promise.all(promises); alert(`✅ 3 Impulsos Criados!`); loadKPIs();
    } catch(e) { alert("Erro: " + e.message); }
};

initDashboard();
