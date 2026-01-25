import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIGURAÇÃO ATLIVIO ---
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
window.db = db; // Debug

// --- DADOS PARA "IMPULSO" (HUMANIZADOS) ---
const NOMES_BR = ["Carlos Silva", "Ana Souza", "Marcos Oliveira", "Fernanda Lima", "João Pedro", "Mariana Santos", "Rafael Costa", "Severino da Silva", "Cláudio Pedreiro", "Dona Maria Limpeza", "Fábio Eletricista", "Jorge Encanador"];
const PROFISSOES = [
    { cat: "Limpeza", nome: "Diarista (Perfil Demo)", preco: 150 },
    { cat: "Eletricista", nome: "Eletricista (Exemplo)", preco: 120 },
    { cat: "Encanador", nome: "Bombeiro Hidráulico", preco: 100 },
    { cat: "Frete", nome: "Frete Pequeno", preco: 60 }
];
const VAGAS_DEMO = [
    { titulo: "Atendente de Balcão", sal: "1.412,00" },
    { titulo: "Vendedor Interno", sal: "1.800,00" },
    { titulo: "Auxiliar de Estoque", sal: "1.600,00" },
    { titulo: "Recepcionista", sal: "1.500,00" }
];

// --- NAVEGAÇÃO ---
window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'loja', 'financeiro', 'tools', 'users'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
        document.getElementById(`nav-${v}`)?.classList.replace('text-indigo-400', 'text-slate-400');
    });

    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    
    const activeNav = document.getElementById(`nav-${viewName}`);
    if(activeNav) {
        activeNav.classList.add('active');
        activeNav.classList.replace('text-slate-400', 'text-indigo-400');
    }

    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'links') carregarLinksRastreados();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'loja') carregarProdutos();
};

// --- CORE DO SNIPER (LOAD DATA) ---
window.loadData = async () => {
    const isTestView = document.getElementById('toggle-test').checked;
    
    // Atualiza Labels
    const modeLabel = document.getElementById('mode-label');
    if(isTestView) {
        modeLabel.innerText = "MEUS TESTES (ADMIN)";
        modeLabel.className = "text-[10px] text-amber-400 uppercase font-bold tracking-wider";
    } else {
        modeLabel.innerText = "CLIENTES REAIS";
        modeLabel.className = "text-[10px] text-emerald-400 uppercase font-bold tracking-wider";
    }

    // QUERY HÍBRIDA (Sistema de Eventos da Atlivio)
    // Tenta filtrar por is_test. Se falhar por index, pega tudo e filtra no JS.
    let q;
    try {
        q = query(collection(db, "system_events"), where("is_test", "==", isTestView), orderBy("timestamp", "desc"), limit(100));
    } catch(e) {
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(100));
    }

    onSnapshot(q, (snap) => {
        const feedEl = document.getElementById('live-feed');
        if(!feedEl) return;
        feedEl.innerHTML = '';

        let viewsCount = 0, actionsCount = 0, salesCount = 0, linksCount = 0;

        if (snap.empty) {
            feedEl.innerHTML = '<div class="text-center text-gray-700 text-xs py-10">Sem dados recentes.</div>';
        } else {
            snap.forEach(doc => {
                const data = doc.data();
                // Filtro manual de segurança
                if (data.is_test !== undefined && data.is_test !== isTestView) return;

                // Contagem para o Funil
                if (data.event.includes('TRAFFIC') || data.event.includes('LOGIN')) viewsCount++;
                if (data.event.includes('CLICK') || data.event.includes('CANDIDATURA')) actionsCount++;
                if (data.event.includes('PROPOSTA') || data.event.includes('DEMO')) salesCount++;

                // Renderiza Feed Estilo Sniper
                const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
                let icon = '🔹'; let colorClass = 'text-slate-400';
                
                if(data.event.includes('TRAFFIC')) { icon = '🚦'; colorClass = 'text-yellow-400 font-bold'; }
                if(data.event.includes('CANDIDATURA')) { icon = '📝'; colorClass = 'text-blue-400 font-bold'; }
                if(data.event.includes('DEMO')) { icon = '🌱'; colorClass = 'text-purple-400 font-bold'; }

                feedEl.innerHTML += `
                <div class="p-3 bg-slate-800/50 rounded border border-white/5 mb-2 hover:border-indigo-500/30 transition animate-fadeIn">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <span>${icon}</span>
                            <span class="text-xs font-bold text-white">${data.event}</span>
                            <span class="text-[9px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">${time}</span>
                        </div>
                        <span class="${colorClass} text-[10px]">${data.details?.source || 'app'}</span>
                    </div>
                </div>`;
            });
        }

        // Atualiza KPIs
        document.getElementById('kpi-views').innerText = viewsCount;
        document.getElementById('kpi-actions').innerText = actionsCount;
        document.getElementById('kpi-sales').innerText = salesCount;
        
        // Renderiza Funil
        renderFunnel(viewsCount, actionsCount, salesCount);
    });
    
    // Carrega Links Ativos (KPI Extra)
    const linksSnap = await getCountFromServer(collection(db, "tracked_links"));
    document.getElementById('kpi-links').innerText = linksSnap.data().count;
};

function renderFunnel(views, actions, sales) {
    const container = document.getElementById('funnel-container');
    if(!container) return;
    
    // Lógica visual do Sniper (Barras de progresso)
    const max = views > 0 ? views : 1;
    
    const steps = [
        { label: "TRÁFEGO (VIEWS)", count: views, color: "bg-indigo-500" },
        { label: "AÇÕES (CLIQUES)", count: actions, color: "bg-blue-500" },
        { label: "CONVERSÕES (R$)", count: sales, color: "bg-emerald-500" }
    ];

    container.innerHTML = steps.map(s => {
        const width = (s.count / max) * 100;
        return `
        <div class="funnel-step active">
            <div class="flex justify-between items-end mb-1">
                <p class="metric-label text-slate-400">${s.label}</p>
                <p class="text-lg font-black text-white">${s.count}</p>
            </div>
            <div class="progress-bar-bg bg-slate-800 h-2 rounded overflow-hidden">
                <div class="h-full ${s.color}" style="width: ${width}%"></div>
            </div>
        </div>`;
    }).join('');
}

// --- FÁBRICA DE LINKS (LINK FACTORY) ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim();
    if(!slug) return alert("Digite um Slug.");
    const btn = document.getElementById('btnSaveLink');
    btn.innerText = "GERANDO..."; btn.disabled = true;

    try {
        await setDoc(doc(db, "tracked_links", slug), {
            slug: slug,
            target_tab: document.getElementById('link-target').value,
            source: document.getElementById('link-source').value,
            clicks: 0,
            created_at: serverTimestamp()
        });
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        const finalUrl = `${baseUrl}?trk=${slug}`;
        
        document.getElementById('finalLinkDisplay').innerText = finalUrl;
        document.getElementById('codeResult').classList.remove('hidden');
        carregarLinksRastreados();
    } catch(e) { alert(e.message); } 
    finally { btn.innerText = "💾 GERAR LINK RASTREADO"; btn.disabled = false; }
};

window.copiarLinkGerado = () => navigator.clipboard.writeText(document.getElementById('finalLinkDisplay').innerText).then(()=>alert("Copiado!"));

function carregarLinksRastreados() {
    onSnapshot(query(collection(db, "tracked_links"), orderBy("created_at", "desc")), (snap) => {
        const list = document.getElementById('links-list');
        list.innerHTML = "";
        snap.forEach(d => { 
            const l=d.data(); 
            list.innerHTML += `
            <div class="flex justify-between bg-slate-800 p-3 rounded border border-slate-700 mb-2 animate-fadeIn">
                <div>
                    <span class="text-indigo-400 font-bold text-xs uppercase">${l.slug}</span>
                    <p class="text-[9px] text-slate-500">${l.source} → ${l.target_tab}</p>
                </div>
                <div class="text-right">
                    <span class="text-xl font-black text-white">${l.clicks}</span>
                    <span class="text-[9px] block text-slate-500">CLIQUES</span>
                </div>
            </div>`; 
        });
    });
}

// --- FERRAMENTAS DE IMPULSO (ANTIGO SEED) ---
window.gerarDemonstracao = async (tipo) => {
    try {
        const promises = [];
        for(let i=0; i<3; i++) {
            if (tipo === 'servico') {
                const p = PROFISSOES[Math.floor(Math.random() * PROFISSOES.length)];
                const nome = NOMES_BR[Math.floor(Math.random() * NOMES_BR.length)];
                promises.push(addDoc(collection(db, "active_providers"), {
                    nome_profissional: nome, is_online: true, is_seed: true,
                    foto_perfil: `https://ui-avatars.com/api/?name=${nome}&background=random`,
                    services: [{ category: p.cat, price: p.preco }], last_seen: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "DEMO_SERVICE_CREATED", is_test: false, timestamp: serverTimestamp() }));
            }
            if (tipo === 'vaga') {
                const v = VAGAS_DEMO[Math.floor(Math.random() * VAGAS_DEMO.length)];
                promises.push(addDoc(collection(db, "jobs"), {
                    titulo: `${v.titulo} (Demo)`, descricao: "Vaga demonstrativa para expansão.", 
                    salario: `R$ ${v.sal}`, company_name: "Empresa Parceira", company_id: "demo_admin", 
                    tipo: "CLT", is_seed: true, created_at: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "DEMO_JOB_CREATED", is_test: false, timestamp: serverTimestamp() }));
            }
        }
        await Promise.all(promises);
        alert(`✅ 3 Itens de Impulso (${tipo}) criados!`);
    } catch(e) { alert("Erro: " + e.message); }
};

// --- UTILITÁRIOS: LIMPEZA ---
window.confirmWipe = async () => {
    if(!confirm("⚠️ PERIGO: Isso apagará TODOS os eventos e dados de teste. Continuar?")) return;
    try {
        const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(500));
        const snap = await getDocs(q);
        const batch = [];
        snap.forEach(d => deleteDoc(d.ref)); // Em produção usaria batch, aqui simplificado
        alert("✅ Limpeza Concluída!");
        location.reload();
    } catch(e) { alert(e.message); }
};

// --- OUTROS MÓDULOS (RH, LOJA, ETC) ---
// (Mantendo lógica simples para não estourar tamanho, expandir conforme necessidade)
window.carregarCandidaturas = () => {
    const list = document.getElementById('rh-cv-list');
    onSnapshot(collection(db, "candidates"), (snap) => {
        list.innerHTML = snap.empty ? "<p class='text-xs text-slate-500'>Vazio.</p>" : snap.docs.map(d => `<div class="bg-slate-800 p-2 rounded mb-1 text-xs text-white">${d.data().nome_completo}</div>`).join('');
    });
};
window.adicionarProduto = async () => {
    try { await addDoc(collection(db, "products"), { nome: document.getElementById('prod-nome').value, preco: document.getElementById('prod-preco').value, link: document.getElementById('prod-link').value, imagem: document.getElementById('prod-img').value }); alert("Salvo!"); } catch(e){alert(e.message);}
};
function carregarProdutos() {
    onSnapshot(collection(db, "products"), (snap) => { document.getElementById('loja-list').innerHTML = snap.docs.map(d => `<div class="bg-slate-800 p-2 rounded text-xs text-white">${d.data().nome}</div>`).join(''); });
}
function carregarTopUsuarios() {
    onSnapshot(query(collection(db, "usuarios"), orderBy("saldo", "desc"), limit(10)), (snap) => {
        document.getElementById('user-ranking-list').innerHTML = snap.docs.map((d, i) => `<div class="flex justify-between bg-slate-800 p-2 rounded mb-1 text-xs"><span class="text-white">#${i+1} ${d.data().email}</span><span class="text-green-400">R$ ${d.data().saldo || 0}</span></div>`).join('');
    });
}

// INICIALIZAR
window.loadData();
