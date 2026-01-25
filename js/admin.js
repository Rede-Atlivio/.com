import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. CONFIGURAÇÃO DIRETA (Para não depender do app.js)
const firebaseConfig = {
  apiKey: "AIzaSyCj89AhXZ-cWQXUjO7jnQtwazKXInMOypg",
  authDomain: "atlivio-oficial-a1a29.firebaseapp.com",
  projectId: "atlivio-oficial-a1a29",
  storageBucket: "atlivio-oficial-a1a29.firebasestorage.app",
  messagingSenderId: "887430049204",
  appId: "1:887430049204:web:d205864a4b42d6799dd6e1"
};

// 2. INICIALIZAÇÃO
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Exposição Global para Debug
window.db = db;
window.auth = auth;

let chartInstance = null;

// --- 3. FUNÇÕES GLOBAIS (Registrando na Janela) ---

// NAVEGAÇÃO
window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'financeiro', 'users', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    document.getElementById(`nav-${viewName}`)?.classList.add('active');
    
    const titulos = {
        'dashboard': 'Visão Geral', 'links': 'Fábrica de Links', 'users': 'Top Usuários',
        'rh': 'RH & Talentos', 'financeiro': 'Financeiro', 'tools': 'Ferramentas Seed'
    };
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = titulos[viewName] || 'Admin';

    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'links') carregarLinksRastreados();
};

// MODO TESTE
window.toggleModoTeste = () => {
    const isTest = document.getElementById('toggle-test').checked;
    const label = document.getElementById('mode-label');
    if (isTest) {
        label.innerText = "MODO TESTE";
        label.className = "text-[10px] text-amber-400 uppercase font-bold tracking-wider";
    } else {
        label.innerText = "DADOS REAIS";
        label.className = "text-[10px] text-emerald-400 uppercase font-bold tracking-wider";
    }
    initDashboard(); 
};

// DASHBOARD
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    
    if(!feed) return;
    feed.innerHTML = "<p class='text-center text-slate-600 text-xs py-10'>Carregando...</p>";

    let q;
    try {
        q = query(collection(db, "system_events"), where("is_test", "==", isTestMode), orderBy("timestamp", "desc"), limit(50));
    } catch(e) {
        console.warn("Fallback query (sem filtro de teste):", e);
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    }
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        let stats = { views: 0, actions: 0, sales: 0 };

        if(snap.empty) {
            feed.innerHTML = `<p class="text-center text-slate-600 text-xs py-10">Sem dados recentes.</p>`;
            updateChart(stats);
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            // Filtro manual se query falhar
            if(data.is_test !== undefined && data.is_test !== isTestMode) return;

            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            let icon = '🔹'; let color = 'text-slate-400';

            if (data.event.includes('LOGIN')) { icon = '🔑'; stats.views++; }
            if (data.event.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400 font-bold'; } 
            if (data.event.includes('CANDIDATURA') || data.event.includes('CLICK')) { icon = '👆'; color = 'text-blue-400'; stats.actions++; }
            if (data.event.includes('PROPOSTA') || data.event.includes('SEED')) { icon = '💰'; color = 'text-green-400 font-bold'; stats.sales++; }

            feed.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${color}">${data.event}</span>
                        <span class="text-slate-600">(${data.details?.source || data.profile_type || 'user'})</span>
                    </div>
                    <span class="font-mono text-slate-600">${time}</span>
                </div>`;
        });
        updateChart(stats);
    });
    loadKPIs();
}

async function loadKPIs() {
    try {
        const snapUsers = await getCountFromServer(collection(db, "usuarios"));
        document.getElementById('kpi-users').innerText = snapUsers.data().count;
        // Outros KPIs...
    } catch(e) { console.error("Erro KPIs", e); }
}

function updateChart(data) {
    const ctx = document.getElementById('funnelChart');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tráfego', 'Interações', 'Conversões'],
            datasets: [{
                label: 'Hoje',
                data: [data.views, data.actions, data.sales],
                backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#ffffff10' } } } }
    });
}

// FÁBRICA DE LINKS
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const target = document.getElementById('link-target').value;
    const source = document.getElementById('link-source').value || 'direct';
    if(!slug) return alert("Defina um identificador.");
    
    const btn = document.getElementById('btn-create-link');
    btn.innerText = "Gerando..."; btn.disabled = true;

    try {
        await setDoc(doc(db, "tracked_links", slug), { slug, target_tab: target, source, clicks: 0, created_at: serverTimestamp() });
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        document.getElementById('final-link-text').innerText = `${baseUrl}?trk=${slug}`;
        document.getElementById('link-result-box').classList.remove('hidden');
        alert("✅ Link Criado!");
        carregarLinksRastreados();
    } catch(e) { alert(e.message); } 
    finally { btn.innerText = "🛠️ Gerar Link Operacional"; btn.disabled = false; }
};

window.copiarLinkGerado = () => { navigator.clipboard.writeText(document.getElementById('final-link-text').innerText).then(() => alert("Copiado!")); };

function carregarLinksRastreados() {
    const list = document.getElementById('links-list');
    if(!list) return;
    onSnapshot(query(collection(db, "tracked_links"), orderBy("created_at", "desc")), (snap) => {
        list.innerHTML = "";
        snap.forEach(d => {
            const l = d.data();
            list.innerHTML += `<div class="flex justify-between bg-slate-800 p-3 rounded border border-slate-700 mb-2"><div><span class="text-blue-400 font-bold text-xs">${l.slug}</span><p class="text-[9px] text-slate-500">${l.source} -> ${l.target_tab}</p></div><span class="text-xl font-black text-white">${l.clicks}</span></div>`;
        });
    });
}

// SEED (MODO DEUS)
window.gerarSeed = async (tipo) => {
    try {
        if (tipo === 'servico') {
            await addDoc(collection(db, "active_providers"), { nome_profissional: "Seed Pro", is_online: true, is_seed: true, services: [{category:"Outros", price:150}], last_seen: serverTimestamp() });
            await addDoc(collection(db, "system_events"), { event: "SEED_SERVICE", is_test: false, timestamp: serverTimestamp() });
        }
        if (tipo === 'vaga') {
            await addDoc(collection(db, "jobs"), { titulo: "Vaga Seed", descricao: "Teste", salario: "R$ 2000", is_seed: true, created_at: serverTimestamp() });
            await addDoc(collection(db, "system_events"), { event: "SEED_JOB", is_test: false, timestamp: serverTimestamp() });
        }
        alert("✅ Seed Gerado!");
    } catch(e) { alert(e.message); }
};

// OUTROS
window.carregarCandidaturas = () => { /* ... usar lógica anterior se precisar ... */ };
window.carregarValidacoes = () => { /* ... usar lógica anterior se precisar ... */ };
function carregarTopUsuarios() { /* ... usar lógica anterior se precisar ... */ };

// START
initDashboard();
