import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURAÇÃO (Independente do site principal) ---
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

// Exposição para debug, se precisar
window.db = db;
window.auth = auth;

let chartInstance = null;

// --- 2. BANCO DE DADOS PARA "IMPULSO" (SIMULAÇÃO REALISTA) ---
const NOMES_BR = [
    "Carlos Silva", "Ana Souza", "Marcos Oliveira", "Fernanda Lima", "João Pedro", 
    "Mariana Santos", "Rafael Costa", "Beatriz Alves", "Lucas Pereira", "Juliana Rocha", 
    "Severino da Silva", "Cláudio Pedreiro", "Dona Maria Limpeza", "Fábio Eletricista", 
    "Jorge Encanador", "Patrícia Manicure", "Roberto Fretes"
];

const PROFISSOES_DEMO = [
    { cat: "Limpeza", nome: "Diarista (Perfil Demo)", preco: 150 },
    { cat: "Limpeza", nome: "Faxina Pós-Obra", preco: 250 },
    { cat: "Eletricista", nome: "Instalação Elétrica (Exemplo)", preco: 120 },
    { cat: "Encanador", nome: "Reparo Hidráulico", preco: 100 },
    { cat: "Montador", nome: "Montagem de Móveis", preco: 80 },
    { cat: "Frete", nome: "Frete Pequeno", preco: 60 },
    { cat: "Jardinagem", nome: "Poda e Limpeza", preco: 70 },
    { cat: "Outros", nome: "Faz Tudo (Marido de Aluguel)", preco: 90 }
];

const VAGAS_DEMO = [
    { titulo: "Atendente de Balcão", sal: "1.412,00" },
    { titulo: "Vendedor Interno", sal: "1.800,00 + Comiss." },
    { titulo: "Auxiliar de Estoque", sal: "1.600,00" },
    { titulo: "Recepcionista", sal: "1.500,00" },
    { titulo: "Frentista", sal: "1.900,00" },
    { titulo: "Motoboy", sal: "A combinar" },
    { titulo: "Auxiliar Administrativo", sal: "2.000,00" }
];

// --- 3. NAVEGAÇÃO ENTRE ABAS ---
window.switchView = (viewName) => {
    // Esconde todas
    ['dashboard', 'links', 'rh', 'loja', 'opps', 'financeiro', 'users', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });

    // Mostra atual
    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    document.getElementById(`nav-${viewName}`)?.classList.add('active');
    
    // Atualiza Título no Topo
    const titulos = {
        'dashboard': 'Visão Geral', 
        'links': 'Rastreador de Links', 
        'users': 'Ranking de Usuários',
        'rh': 'RH & Vagas', 
        'financeiro': 'Fluxo de Caixa', 
        'tools': 'Ferramentas de Impulso', // Nome atualizado
        'loja': 'Produtos & Loja',
        'opps': 'Oportunidades'
    };
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = titulos[viewName] || 'Painel Admin';

    // Carrega dados específicos da aba
    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'links') carregarLinksRastreados();
    if(viewName === 'loja') carregarProdutos();
    if(viewName === 'opps') carregarOportunidades();
};

// --- 4. TOGGLE MODO TESTE ---
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

// --- 5. DASHBOARD LIVE (O Pulso da Plataforma) ---
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    
    if(!feed) return;
    feed.innerHTML = "<p class='text-center text-slate-600 text-xs py-10'>Conectando satélite...</p>";

    let q;
    try {
        // Tenta query otimizada (requer índice)
        q = query(
            collection(db, "system_events"), 
            where("is_test", "==", isTestMode), 
            orderBy("timestamp", "desc"), 
            limit(50)
        );
    } catch(e) {
        // Fallback se faltar índice
        console.warn("Usando fallback de query:", e);
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    }
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        
        let stats = { views: 0, actions: 0, sales: 0 };

        if(snap.empty) {
            feed.innerHTML = `<p class="text-center text-slate-600 text-xs py-10">Sem atividade ${isTestMode ? 'de teste' : 'real'} recente.</p>`;
            updateChart(stats);
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            // Filtragem manual de segurança
            if(data.is_test !== undefined && data.is_test !== isTestMode) return;

            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            
            // TRADUÇÃO VISUAL DOS EVENTOS
            let icon = '🔹'; 
            let color = 'text-slate-400';
            let eventName = data.event;

            if (eventName.includes('LOGIN')) { icon = '🔑'; stats.views++; eventName = "Login Realizado"; }
            if (eventName.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400 font-bold'; eventName = "Clique em Link"; stats.views++; } 
            if (eventName.includes('CANDIDATURA')) { icon = '📝'; color = 'text-blue-400'; eventName = "Candidatura"; stats.actions++; }
            if (eventName.includes('CLICK')) { icon = '👆'; color = 'text-blue-300'; stats.actions++; }
            if (eventName.includes('PROPOSTA')) { icon = '💰'; color = 'text-green-400 font-bold'; eventName = "Proposta ($)"; stats.sales++; }
            if (eventName.includes('SEED') || eventName.includes('DEMO')) { icon = '🌱'; color = 'text-purple-400'; eventName = "Criação Demo"; }

            feed.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${color}">${eventName}</span>
                        <span class="text-slate-500 truncate w-20">(${data.details?.source || 'user'})</span>
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

        const snapOnline = await getCountFromServer(query(collection(db, "active_providers"), where("is_online", "==", true)));
        document.getElementById('kpi-online').innerText = snapOnline.data().count;

        const snapJobs = await getCountFromServer(collection(db, "jobs"));
        document.getElementById('kpi-jobs').innerText = snapJobs.data().count;

        // Links ativos
        const snapLinks = await getCountFromServer(collection(db, "tracked_links"));
        document.getElementById('kpi-links').innerText = snapLinks.data().count;
    } catch(e) { console.error("Erro KPIs", e); }
}

function updateChart(data) {
    const ctx = document.getElementById('funnelChart');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Acessos', 'Interações', 'Conversões'],
            datasets: [{
                label: 'Performance Hoje',
                data: [data.views, data.actions, data.sales],
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
                x: { display: true, grid: { display: false }, ticks: { color: '#94a3b8', font: {size: 10} } }, 
                y: { display: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } 
            } 
        }
    });
}

// --- 6. GERADOR DE DEMONSTRAÇÃO (ANTIGO SEED) ---
// Humanizado e realista
window.gerarDemonstracao = async (tipo) => {
    const btn = event.target;
    const textoOriginal = btn.innerText;
    btn.disabled = true; 
    btn.innerText = "Criando...";

    try {
        const promises = [];
        
        // Gera 3 itens de uma vez para popular rápido
        for(let i=0; i<3; i++) {
            
            // PRESTADOR FAKE (Demonstração)
            if (tipo === 'servico') {
                const p = PROFISSOES_DEMO[Math.floor(Math.random() * PROFISSOES_DEMO.length)];
                const nome = NOMES_BR[Math.floor(Math.random() * NOMES_BR.length)];
                
                promises.push(addDoc(collection(db, "active_providers"), {
                    nome_profissional: nome,
                    is_online: true, 
                    is_seed: true, // Flag CRÍTICA para o app saber que é demo
                    foto_perfil: `https://ui-avatars.com/api/?name=${nome}&background=random`,
                    services: [{ category: p.cat, price: p.preco }],
                    last_seen: serverTimestamp()
                }));
                // Loga o evento
                promises.push(addDoc(collection(db, "system_events"), { event: "DEMO_SERVICE_CREATED", is_test: false, timestamp: serverTimestamp() }));
            }
            
            // VAGA FAKE (Demonstração)
            if (tipo === 'vaga') {
                const v = VAGAS_DEMO[Math.floor(Math.random() * VAGAS_DEMO.length)];
                
                promises.push(addDoc(collection(db, "jobs"), {
                    titulo: `${v.titulo} (Exemplo)`, 
                    descricao: "Esta é uma vaga demonstrativa para ilustrar o formato da plataforma. Em breve, vagas reais estarão disponíveis.", 
                    salario: `R$ ${v.sal}`, 
                    company_name: "Empresa Parceira", 
                    company_id: "demo_admin",
                    tipo: "CLT", 
                    is_seed: true, // Flag CRÍTICA
                    created_at: serverTimestamp()
                }));
                promises.push(addDoc(collection(db, "system_events"), { event: "DEMO_JOB_CREATED", is_test: false, timestamp: serverTimestamp() }));
            }
        }
        
        await Promise.all(promises);
        alert(`✅ 3 Itens de Demonstração (${tipo}) criados com sucesso!`);
        
        loadKPIs(); // Atualiza números na hora
        
    } catch(e) {
        alert("Erro ao criar demonstração: " + e.message);
    } finally {
        btn.disabled = false; 
        btn.innerText = textoOriginal;
    }
};

// --- 7. FÁBRICA DE LINKS (Com Contagem Real) ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const target = document.getElementById('link-target').value;
    const source = document.getElementById('link-source').value || 'direct';
    
    if(!slug) return alert("Digite um nome para o link (Slug).");

    const btn = document.getElementById('btn-create-link');
    btn.innerText = "Criando..."; btn.disabled = true;

    try {
        await setDoc(doc(db, "tracked_links", slug), {
            slug: slug,
            target_tab: target,
            source: source,
            clicks: 0,
            created_at: serverTimestamp()
        });

        // Gera URL limpa baseada na localização atual
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        const finalUrl = `${baseUrl}?trk=${slug}`;
        
        document.getElementById('final-link-text').innerText = finalUrl;
        document.getElementById('link-result-box').classList.remove('hidden');
        
        alert("✅ Link Criado!");
        carregarLinksRastreados();
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "Gerar Link"; btn.disabled = false;
    }
};

window.copiarLinkGerado = () => {
    const text = document.getElementById('final-link-text').innerText;
    navigator.clipboard.writeText(text).then(() => alert("Link copiado para a área de transferência!"));
};

function carregarLinksRastreados() {
    const list = document.getElementById('links-list');
    if(!list) return;

    // Snapshot garante atualização em tempo real dos cliques
    const q = query(collection(db, "tracked_links"), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        if (snap.empty) {
            list.innerHTML = "<p class='text-center text-slate-600 text-xs'>Nenhum link ativo.</p>";
            return;
        }

        snap.forEach(d => {
            const l = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 mb-2 animate-fadeIn">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-blue-400 font-bold text-xs uppercase tracking-wider">${l.slug}</span>
                            <span class="text-[9px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 border border-slate-600 uppercase">${l.source}</span>
                        </div>
                        <p class="text-[9px] text-slate-500 mt-1">Leva para: <span class="text-slate-400 font-bold">${l.target_tab}</span></p>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-black text-white">${l.clicks || 0}</span>
                        <span class="text-[8px] text-slate-500 block uppercase tracking-widest">Cliques</span>
                    </div>
                </div>`;
        });
    });
}

// --- 8. GESTÃO DE PRODUTOS & OPORTUNIDADES ---
window.adicionarProduto = async () => {
    const nome = document.getElementById('prod-nome').value;
    const preco = document.getElementById('prod-preco').value;
    const link = document.getElementById('prod-link').value;
    const img = document.getElementById('prod-img').value;

    if(!nome || !preco) return alert("Preencha nome e preço.");

    try {
        await addDoc(collection(db, "products"), {
            nome, preco, link, imagem: img, created_at: serverTimestamp()
        });
        alert("✅ Produto Adicionado à Loja!");
        document.getElementById('prod-nome').value = ""; // Limpa campo
    } catch(e) { alert(e.message); }
};

function carregarProdutos() {
    onSnapshot(collection(db, "products"), (snap) => {
        const list = document.getElementById('loja-list');
        if(!list) return;
        list.innerHTML = snap.docs.map(d => `
            <div class="bg-slate-800 p-3 rounded border border-slate-700">
                <p class="text-white text-xs font-bold">${d.data().nome}</p>
                <p class="text-green-400 text-xs">R$ ${d.data().preco}</p>
            </div>
        `).join('');
    });
}

window.adicionarOportunidade = async () => {
    const titulo = document.getElementById('opp-titulo').value;
    const link = document.getElementById('opp-link').value;
    const desc = document.getElementById('opp-desc').value;

    if(!titulo) return alert("Título obrigatório.");

    try {
        await addDoc(collection(db, "opportunities"), {
            titulo, link, descricao: desc, created_at: serverTimestamp()
        });
        alert("✅ Oportunidade Publicada!");
    } catch(e) { alert(e.message); }
};

function carregarOportunidades() {
    onSnapshot(collection(db, "opportunities"), (snap) => {
        const list = document.getElementById('opps-list');
        if(!list) return;
        list.innerHTML = snap.docs.map(d => `
            <div class="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between">
                <span class="text-white text-xs font-bold">${d.data().titulo}</span>
                <a href="${d.data().link}" target="_blank" class="text-blue-400 text-[10px]">Ver Link</a>
            </div>
        `).join('');
    });
}

// --- 9. GESTÃO DE USERS & RH (Funções Legado Mantidas) ---
function carregarTopUsuarios() {
    const list = document.getElementById('user-ranking-list');
    if(!list) return;
    const q = query(collection(db, "usuarios"), orderBy("saldo", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach((d, index) => {
            const u = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 mb-2">
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-black text-slate-600">#${index+1}</span>
                        <div><p class="text-white font-bold text-xs">${u.displayName || u.email}</p><p class="text-[10px] text-slate-400">${u.email}</p></div>
                    </div>
                    <div class="text-right"><p class="text-green-400 font-mono text-xs">R$ ${u.saldo?.toFixed(2) || '0.00'}</p><p class="text-[9px] text-slate-500">${u.stats?.events_count || 0} ações</p></div>
                </div>`;
        });
    });
}

window.carregarCandidaturas = () => {
    const container = document.getElementById('rh-cv-list');
    if(!container) return;
    onSnapshot(collection(db, "candidates"), (snap) => {
        container.innerHTML = "";
        if(snap.empty) { container.innerHTML = "<p class='text-slate-600 text-xs text-center'>Sem currículos.</p>"; return; }
        snap.forEach(d => {
            const cv = d.data();
            const statusColor = cv.status === 'approved' ? 'text-green-400' : 'text-yellow-400';
            const pdfBtn = cv.curriculo_pdf ? `<a href="${cv.curriculo_pdf}" target="_blank" class="text-blue-400 underline ml-2">PDF</a>` : '';
            
            container.innerHTML += `
                <div class="bg-slate-800 p-3 rounded border border-slate-700 mb-2">
                    <div class="flex justify-between"><span class="text-white text-xs font-bold">${cv.nome_completo}</span><span class="${statusColor} text-[10px] uppercase">${cv.status || 'Pendente'}</span></div>
                    <p class="text-[10px] text-slate-400">${cv.habilidades} ${pdfBtn}</p>
                    <div class="mt-2 flex gap-2">
                        <button onclick="decidirCandidato('${d.id}', true)" class="text-[9px] bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-900/50">Aprovar</button>
                        <button onclick="decidirCandidato('${d.id}', false)" class="text-[9px] bg-red-900/30 text-red-400 px-2 py-1 rounded border border-red-900/50">Rejeitar</button>
                    </div>
                </div>`;
        });
    });
};

window.decidirCandidato = async (uid, ok) => {
    if(!confirm("Tem certeza?")) return;
    try { await updateDoc(doc(db, "candidates", uid), { status: ok ? 'approved' : 'rejected', moderated_at: serverTimestamp() }); } catch(e) { alert(e.message); }
};

window.carregarValidacoes = () => {
    // Mantém lógica de missões se houver
    const container = document.getElementById('fin-mission-list');
    if(container) container.innerHTML = "<p class='text-slate-600 text-xs text-center'>Módulo Financeiro Ativo.</p>";
};

// INICIALIZAÇÃO AUTOMÁTICA
initDashboard();
