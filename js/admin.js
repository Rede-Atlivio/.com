import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

// --- DADOS REAIS ---
const NOMES_BR = ["Carlos Silva", "Ana Souza", "Marcos Oliveira", "Fernanda Lima", "João Pedro", "Mariana Santos", "Rafael Costa", "Beatriz Alves", "Lucas Pereira", "Juliana Rocha", "Severino da Silva", "Cláudio Pedreiro", "Dona Maria Limpeza"];
const PROFISSOES = [
    { cat: "Limpeza", nome: "Diarista Completa", preco: 150 }, 
    { cat: "Limpeza", nome: "Faxina Pós-Obra", preco: 250 },
    { cat: "Eletricista", nome: "Eletricista Residencial", preco: 120 }, 
    { cat: "Encanador", nome: "Bombeiro Hidráulico", preco: 100 },
    { cat: "Montador", nome: "Montagem de Móveis", preco: 80 }
];
const VAGAS_REAIS = [
    { titulo: "Atendente de Balcão", sal: "1.412,00" }, 
    { titulo: "Vendedor Interno", sal: "1.800,00 + Comiss." },
    { titulo: "Auxiliar de Estoque", sal: "1.600,00" }, 
    { titulo: "Recepcionista", sal: "1.500,00" }
];

let chartInstance = null;

// NAVEGAÇÃO
window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'loja', 'opps', 'financeiro', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    document.getElementById(`nav-${viewName}`).classList.add('active');
    document.getElementById('page-title').innerText = viewName.toUpperCase();

    if(viewName === 'links') carregarLinksRastreados();
    if(viewName === 'loja') carregarProdutos();
    if(viewName === 'opps') carregarOportunidades();
    if(viewName === 'rh') carregarCandidaturas();
};

window.toggleModoTeste = () => {
    const isTest = document.getElementById('toggle-test').checked;
    document.getElementById('mode-label').innerText = isTest ? "MODO TESTE" : "DADOS REAIS";
    initDashboard(); 
};

// DASHBOARD
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    if(!feed) return;

    let q;
    try {
        q = query(collection(db, "system_events"), where("is_test", "==", isTestMode), orderBy("timestamp", "desc"), limit(50));
    } catch(e) {
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    }
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        let stats = { views: 0, actions: 0, sales: 0 };
        
        if(snap.empty) { feed.innerHTML = `<p class='text-center text-slate-600 text-xs py-10'>Sem dados.</p>`; updateChart(stats); return; }

        snap.forEach(d => {
            const data = d.data();
            if(data.is_test !== undefined && data.is_test !== isTestMode) return;
            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            let icon = '🔹'; let color = 'text-slate-400';
            
            if (data.event.includes('LOGIN')) { icon = '🔑'; stats.views++; }
            if (data.event.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400 font-bold'; stats.views++; } 
            if (data.event.includes('CANDIDATURA')) { icon = '📝'; color = 'text-blue-400'; stats.actions++; }
            
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

// FÁBRICA DE LINKS (Com contagem funcionando)
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim();
    if(!slug) return alert("Digite o Slug.");
    try {
        await setDoc(doc(db, "tracked_links", slug), {
            slug: slug,
            target_tab: document.getElementById('link-target').value,
            source: document.getElementById('link-source').value,
            clicks: 0,
            created_at: serverTimestamp()
        });
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        document.getElementById('final-link-text').innerText = `${baseUrl}?trk=${slug}`;
        document.getElementById('link-result-box').classList.remove('hidden');
        carregarLinksRastreados();
    } catch(e) { alert(e.message); }
};

window.copiarLinkGerado = () => navigator.clipboard.writeText(document.getElementById('final-link-text').innerText).then(()=>alert("Copiado!"));

function carregarLinksRastreados() {
    onSnapshot(query(collection(db, "tracked_links"), orderBy("created_at", "desc")), (snap) => {
        const list = document.getElementById('links-list');
        list.innerHTML = "";
        snap.forEach(d => { const l=d.data(); list.innerHTML += `<div class="flex justify-between bg-slate-800 p-3 rounded mb-2"><div><span class="text-blue-400 font-bold text-xs">${l.slug}</span><p class="text-[9px] text-slate-500">${l.source}</p></div><span class="text-xl font-black text-white">${l.clicks}</span></div>`; });
    });
}

// IMPULSO (ANTIGO SEED)
window.gerarSeed = async (tipo) => {
    const btn = event.target;
    btn.innerText = "Gerando..."; btn.disabled = true;
    try {
        const promises = [];
        for(let i=0; i<5; i++) {
            if (tipo === 'servico') {
                const p = PROFISSOES[Math.floor(Math.random() * PROFISSOES.length)];
                const nome = NOMES_BR[Math.floor(Math.random() * NOMES_BR.length)];
                promises.push(addDoc(collection(db, "active_providers"), {
                    nome_profissional: nome, is_online: true, is_seed: true, foto_perfil: `https://ui-avatars.com/api/?name=${nome}&background=random`,
                    services: [{ category: p.cat, price: p.preco }], last_seen: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "IMPULSO_SERVICE", is_test: false, timestamp: serverTimestamp() }));
            }
            if (tipo === 'vaga') {
                const v = VAGAS_REAIS[Math.floor(Math.random() * VAGAS_REAIS.length)];
                promises.push(addDoc(collection(db, "jobs"), {
                    titulo: v.titulo, descricao: "Vaga para início imediato. Experiência desejável.", 
                    salario: `R$ ${v.sal}`, company_name: "Empresa Parceira", company_id: "impulso_admin", tipo: "CLT", is_seed: true, created_at: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "IMPULSO_JOB", is_test: false, timestamp: serverTimestamp() }));
            }
        }
        await Promise.all(promises);
        alert(`✅ 5 ${tipo}s de Impulso criados!`);
        loadKPIs();
    } catch(e) { alert(e.message); } finally { btn.disabled = false; btn.innerText = "Gerar +5"; }
};

// LOJA & OPPS
window.adicionarProduto = async () => {
    try {
        await addDoc(collection(db, "products"), {
            nome: document.getElementById('prod-nome').value, preco: document.getElementById('prod-preco').value,
            link: document.getElementById('prod-link').value, imagem: document.getElementById('prod-img').value, created_at: serverTimestamp()
        });
        alert("Salvo!");
    } catch(e) { alert(e.message); }
};
function carregarProdutos() {
    onSnapshot(collection(db, "products"), (snap) => {
        document.getElementById('loja-list').innerHTML = snap.docs.map(d => `<div class="bg-slate-800 p-2 rounded"><p class="text-white text-xs">${d.data().nome}</p></div>`).join('');
    });
}

window.adicionarOportunidade = async () => {
    try {
        await addDoc(collection(db, "opportunities"), {
            titulo: document.getElementById('opp-titulo').value, link: document.getElementById('opp-link').value,
            descricao: document.getElementById('opp-desc').value, created_at: serverTimestamp()
        });
        alert("Publicado!");
    } catch(e) { alert(e.message); }
};
function carregarOportunidades() {
    onSnapshot(collection(db, "opportunities"), (snap) => {
        document.getElementById('opps-list').innerHTML = snap.docs.map(d => `<div class="bg-slate-800 p-3 rounded mb-2"><p class="text-white text-xs font-bold">${d.data().titulo}</p></div>`).join('');
    });
}

// RH
window.carregarCandidaturas = () => {
    onSnapshot(collection(db, "candidates"), (snap) => {
        document.getElementById('rh-cv-list').innerHTML = snap.docs.map(d => `<div class="bg-slate-800 p-3 rounded mb-2"><p class="text-white text-xs">${d.data().nome_completo}</p></div>`).join('');
    });
};

initDashboard();
