import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// CONFIGURAÇÃO
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
window.auth = auth;
let chartInstance = null;

// --- DADOS PARA SEED REALISTA ---
const NOMES_BR = ["Carlos Silva", "Ana Souza", "Marcos Oliveira", "Fernanda Lima", "João Pedro", "Mariana Santos", "Rafael Costa", "Beatriz Alves", "Lucas Pereira", "Juliana Rocha", "Severino da Silva", "Cláudio Pedreiro", "Dona Maria Limpeza"];
const PROFISSOES = [
    { cat: "Limpeza", nome: "Diarista Completa", preco: 150 },
    { cat: "Limpeza", nome: "Faxina Pós-Obra", preco: 250 },
    { cat: "Eletricista", nome: "Eletricista Residencial", preco: 120 },
    { cat: "Encanador", nome: "Bombeiro Hidráulico", preco: 100 },
    { cat: "Montador", nome: "Montagem de Móveis", preco: 80 },
    { cat: "Frete", nome: "Frete Pequeno", preco: 60 },
    { cat: "Jardinagem", nome: "Corte de Grama", preco: 70 }
];
const VAGAS_REAIS = [
    { titulo: "Atendente de Balcão", sal: "1.412,00" },
    { titulo: "Vendedor Interno", sal: "1.800,00 + Comiss." },
    { titulo: "Auxiliar de Estoque", sal: "1.600,00" },
    { titulo: "Recepcionista", sal: "1.500,00" },
    { titulo: "Frentista", sal: "1.900,00" },
    { titulo: "Motoboy", sal: "A combinar" },
    { titulo: "Auxiliar Administrativo", sal: "2.000,00" }
];

// --- 1. NAVEGAÇÃO ---
window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'financeiro', 'users', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    document.getElementById(`nav-${viewName}`).classList.add('active');
    
    // Carregamento sob demanda
    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'links') carregarLinksRastreados();
};

window.toggleModoTeste = () => {
    const isTest = document.getElementById('toggle-test').checked;
    document.getElementById('mode-label').innerText = isTest ? "MODO TESTE" : "DADOS REAIS";
    document.getElementById('mode-label').className = isTest ? "text-[10px] text-amber-400 uppercase font-bold tracking-wider" : "text-[10px] text-emerald-400 uppercase font-bold tracking-wider";
    initDashboard(); 
};

// --- 2. DASHBOARD ---
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    if(!feed) return;

    let q;
    try {
        q = query(collection(db, "system_events"), where("is_test", "==", isTestMode), orderBy("timestamp", "desc"), limit(50));
    } catch(e) {
        console.warn("Index faltando, usando fallback:", e);
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    }
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        let stats = { views: 0, actions: 0, sales: 0 };

        if(snap.empty) {
            feed.innerHTML = `<p class="text-center text-slate-600 text-xs py-10">Sem dados recentes.</p>`;
            // Mesmo sem dados, renderiza o gráfico zerado para não sumir
            updateChart({ views:0, actions:0, sales:0 });
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            if(data.is_test !== undefined && data.is_test !== isTestMode) return;

            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            let icon = '🔹'; let color = 'text-slate-400';

            if (data.event.includes('LOGIN')) { icon = '🔑'; stats.views++; }
            if (data.event.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400 font-bold'; stats.views++; } 
            if (data.event.includes('CLICK') || data.event.includes('CANDIDATURA')) { icon = '👆'; color = 'text-blue-400'; stats.actions++; }
            if (data.event.includes('SEED')) { icon = '🌱'; color = 'text-purple-400'; }

            feed.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${color}">${data.event}</span>
                        <span class="text-slate-500 truncate w-20">(${data.details?.source || 'app'})</span>
                    </div>
                    <span class="font-mono text-slate-600">${time}</span>
                </div>`;
        });
        updateChart(stats);
    });
    loadKPIs();
}

function updateChart(data) {
    const ctx = document.getElementById('funnelChart');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    
    // Garante que o gráfico apareça mesmo com zeros
    const views = data.views || 0;
    const actions = data.actions || 0;
    const sales = data.sales || 0;

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Visitas', 'Ações', 'Conversões'],
            datasets: [{
                label: 'Performance',
                data: [views, actions, sales],
                backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
                borderRadius: 4,
                barThickness: 40
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                x: { display: true, grid: { display: false }, ticks: { color: '#94a3b8' } }, 
                y: { display: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } 
            } 
        }
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
        
        // Link Counter Real-time
        const snapLinks = await getCountFromServer(collection(db, "tracked_links"));
        document.getElementById('kpi-links').innerText = snapLinks.data().count;
    } catch(e) { console.error(e); }
}

// --- 3. SEED REALISTA (MODO DEUS ATUALIZADO) ---
window.gerarSeed = async (tipo) => {
    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true; btn.innerText = "Gerando em massa...";

    try {
        // Gera 3 itens de uma vez para dar volume rápido
        const promises = [];
        
        for(let i=0; i<3; i++) {
            if (tipo === 'servico') {
                const p = PROFISSOES[Math.floor(Math.random() * PROFISSOES.length)];
                const nome = NOMES_BR[Math.floor(Math.random() * NOMES_BR.length)];
                
                promises.push(addDoc(collection(db, "active_providers"), {
                    nome_profissional: nome,
                    is_online: true, is_seed: true,
                    foto_perfil: `https://ui-avatars.com/api/?name=${nome}&background=random`,
                    services: [{ category: p.cat, price: p.preco }],
                    last_seen: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "SEED_SERVICE", is_test: false, timestamp: serverTimestamp() }));
            }
            
            if (tipo === 'vaga') {
                const v = VAGAS_REAIS[Math.floor(Math.random() * VAGAS_REAIS.length)];
                
                promises.push(addDoc(collection(db, "jobs"), {
                    titulo: v.titulo, descricao: "Vaga para início imediato. Necessário experiência básica e comprometimento.", 
                    salario: `R$ ${v.sal}`, company_name: "Empresa Parceira", company_id: "seed_admin",
                    tipo: "CLT", is_seed: true, created_at: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "SEED_JOB", is_test: false, timestamp: serverTimestamp() }));
            }
        }
        
        await Promise.all(promises);
        alert(`✅ 3 ${tipo === 'servico' ? 'Prestadores' : 'Vagas'} criados com sucesso!`);
        
        // Atualiza KPIs visualmente na hora
        loadKPIs(); 
        
    } catch(e) { alert("Erro: " + e.message); } 
    finally { btn.disabled = false; btn.innerText = originalText; }
};

// --- 4. FÁBRICA DE LINKS ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const target = document.getElementById('link-target').value;
    const source = document.getElementById('link-source').value || 'direct';
    if(!slug) return alert("Defina um identificador.");
    
    try {
        await setDoc(doc(db, "tracked_links", slug), { slug, target_tab: target, source, clicks: 0, created_at: serverTimestamp() });
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        document.getElementById('final-link-text').innerText = `${baseUrl}?trk=${slug}`;
        document.getElementById('link-result-box').classList.remove('hidden');
        alert("✅ Link Criado!");
        carregarLinksRastreados();
    } catch(e) { alert(e.message); }
};

window.copiarLinkGerado = () => { navigator.clipboard.writeText(document.getElementById('final-link-text').innerText).then(() => alert("Copiado!")); };

function carregarLinksRastreados() {
    const list = document.getElementById('links-list');
    if(!list) return;
    
    // O Snapshot ouve mudanças em tempo real (inclusive cliques)
    onSnapshot(query(collection(db, "tracked_links"), orderBy("created_at", "desc")), (snap) => {
        list.innerHTML = "";
        snap.forEach(d => {
            const l = d.data();
            list.innerHTML += `
            <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 animate-fadeIn mb-2">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-blue-400 font-bold text-xs uppercase tracking-wider">${l.slug}</span>
                        <span class="text-[9px] bg-slate-700 px-1 rounded text-slate-300 border border-slate-600">${l.source}</span>
                    </div>
                    <p class="text-[9px] text-slate-500 mt-1">Destino: <span class="text-slate-400">${l.target_tab}</span></p>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-black text-white">${l.clicks || 0}</span>
                    <span class="text-[8px] text-slate-500 block uppercase tracking-widest">Cliques</span>
                </div>
            </div>`;
        });
    });
}

// OUTROS
window.carregarCandidaturas = () => { /* manter lógica anterior */ };
window.carregarValidacoes = () => { /* manter lógica anterior */ };
function carregarTopUsuarios() { /* manter lógica anterior */ };

initDashboard();
