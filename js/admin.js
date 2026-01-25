import { db } from './app.js';
import { collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chartInstance = null;

// --- 1. CONTROLE DE NAVEGAÇÃO ---
window.switchView = (viewName) => {
    // Esconde todas as views
    ['dashboard', 'links', 'rh', 'financeiro', 'users', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });

    // Mostra a selecionada
    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    document.getElementById(`nav-${viewName}`)?.classList.add('active');
    
    // Atualiza título da página
    const titulos = {
        'dashboard': 'Visão Geral', 'links': 'Fábrica de Links', 'users': 'Top Usuários',
        'rh': 'RH & Talentos', 'financeiro': 'Financeiro', 'tools': 'Ferramentas Seed'
    };
    document.getElementById('page-title').innerText = titulos[viewName] || 'Admin';

    // Carrega dados específicos
    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'links') carregarLinksRastreados();
};

// --- 2. CONTROLE MODO TESTE ---
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
    // Recarrega Dashboard
    initDashboard(); 
};

// --- 3. DASHBOARD LIVE (FILTRADO) ---
function initDashboard() {
    const isTestMode = document.getElementById('toggle-test')?.checked || false;
    const feed = document.getElementById('live-feed-content');
    
    if(!feed) return;
    feed.innerHTML = "<p class='text-center text-slate-600 text-xs py-10'>Carregando...</p>";

    // Tenta query com filtro. Se der erro de index, avisa no console.
    let q;
    try {
        q = query(
            collection(db, "system_events"), 
            where("is_test", "==", isTestMode), 
            orderBy("timestamp", "desc"), 
            limit(50)
        );
    } catch(e) {
        console.warn("Se der erro de índice, crie no Firebase Console.", e);
        // Fallback sem filtro complexo para não travar
        q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    }
    
    onSnapshot(q, (snap) => {
        feed.innerHTML = "";
        
        if(snap.empty) {
            feed.innerHTML = `<p class="text-center text-slate-600 text-xs py-10">Sem dados ${isTestMode ? 'de teste' : 'reais'} recentes.</p>`;
            updateChart({ views:0, actions:0, sales:0 });
            return;
        }

        let stats = { views: 0, actions: 0, sales: 0 };

        snap.forEach(d => {
            const data = d.data();
            // Filtragem manual caso o query do Firebase falhe por falta de index
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

        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const snapOnline = await getCountFromServer(qOnline);
        document.getElementById('kpi-online').innerText = snapOnline.data().count;

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
            labels: ['Tráfego', 'Interações', 'Conversões'],
            datasets: [{
                label: 'Atividade Hoje',
                data: [data.views, data.actions, data.sales],
                backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#ffffff10' } } } }
    });
}

// --- 4. FÁBRICA DE LINKS ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const target = document.getElementById('link-target').value;
    const source = document.getElementById('link-source').value || 'direct';
    
    if(!slug) return alert("Defina um identificador único (ex: zap-grupo-1).");

    const btn = document.getElementById('btn-create-link');
    btn.innerText = "Gerando..."; btn.disabled = true;

    try {
        await setDoc(doc(db, "tracked_links", slug), {
            slug: slug,
            target_tab: target,
            source: source,
            clicks: 0,
            created_at: serverTimestamp()
        });

        // URL base correta
        const baseUrl = window.location.href.replace('admin.html', 'index.html').split('?')[0];
        const finalUrl = `${baseUrl}?trk=${slug}`;
        
        document.getElementById('final-link-text').innerText = finalUrl;
        document.getElementById('link-result-box').classList.remove('hidden');
        
        alert("✅ Link Operacional Criado!");
        carregarLinksRastreados();
    } catch(e) { alert("Erro: " + e.message); } 
    finally { btn.innerText = "🛠️ Gerar Link Operacional"; btn.disabled = false; }
};

window.copiarLinkGerado = () => {
    const text = document.getElementById('final-link-text').innerText;
    navigator.clipboard.writeText(text).then(() => alert("Link copiado!"));
};

function carregarLinksRastreados() {
    const list = document.getElementById('links-list');
    if(!list) return;

    const q = query(collection(db, "tracked_links"), orderBy("created_at", "desc"));
    
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach(d => {
            const l = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 animate-fadeIn">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-blue-400 font-bold text-xs uppercase tracking-wider">${l.slug}</span>
                            <span class="text-[9px] bg-slate-700 px-1 rounded text-slate-300 border border-slate-600">${l.source}</span>
                        </div>
                        <p class="text-[9px] text-slate-500 mt-1">Destino: <span class="text-slate-400">${l.target_tab}</span></p>
                    </div>
                    <div class="text-right">
                        <span class="text-xl font-black text-white">${l.clicks}</span>
                        <span class="text-[8px] text-slate-500 block uppercase tracking-widest">Cliques</span>
                    </div>
                </div>`;
        });
    });
}

// --- 5. SEED & TOOLS ---
window.gerarSeed = async (tipo) => {
    const btn = event.target;
    btn.disabled = true; btn.innerText = "Criando...";
    try {
        if (tipo === 'servico') {
            const titulos = ["Marido de Aluguel", "Eletricista Rápido", "Limpeza Pós-Obra", "Formatatação de PC"];
            const titulo = titulos[Math.floor(Math.random() * titulos.length)];
            await addDoc(collection(db, "active_providers"), {
                nome_profissional: "Seed Pro " + Math.floor(Math.random() * 100),
                is_online: true, is_seed: true,
                services: [{ category: "Outros", price: 100 + Math.floor(Math.random() * 200) }],
                last_seen: serverTimestamp()
            });
            await addDoc(collection(db, "system_events"), { event: "SEED_SERVICE_CREATED", user_id: "admin", is_test: false, timestamp: serverTimestamp() });
        }
        if (tipo === 'vaga') {
            const vagas = ["Vendedor de Loja", "Auxiliar Administrativo", "Recepcionista", "Entregador"];
            const vaga = vagas[Math.floor(Math.random() * vagas.length)];
            await addDoc(collection(db, "jobs"), {
                titulo: vaga, descricao: "Vaga urgente. Seed.", salario: "R$ 1.500,00", company_name: "Empresa Parceira",
                is_seed: true, created_at: serverTimestamp()
            });
            await addDoc(collection(db, "system_events"), { event: "SEED_JOB_CREATED", user_id: "admin", is_test: false, timestamp: serverTimestamp() });
        }
        alert(`✅ ${tipo.toUpperCase()} Seed Criado!`);
    } catch(e) { alert("Erro: " + e.message); } 
    finally { btn.disabled = false; btn.innerText = "Gerar +1"; }
};

// --- 6. OUTRAS LISTAGENS ---
// (Mantenho as mesmas funções já aprovadas para RH, Financeiro e Users)
function carregarTopUsuarios() {
    const list = document.getElementById('user-ranking-list');
    if(!list) return;
    const q = query(collection(db, "usuarios"), orderBy("saldo", "desc"), limit(10));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach((d, index) => {
            const u = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
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
    const q = query(collection(db, "candidates")); 
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const cv = d.data();
            if (cv.status === 'approved') return;
            const pdfLink = cv.curriculo_pdf ? `<a href="${cv.curriculo_pdf}" target="_blank" class="text-blue-400 underline text-[10px]">Ver PDF</a>` : `<span class="text-slate-600 text-[10px]">Sem PDF</span>`;
            container.innerHTML += `
                <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div><h4 class="font-bold text-white text-sm">${cv.nome_completo}</h4><p class="text-[10px] text-slate-400">${cv.habilidades}</p><div class="mt-1 flex gap-2">${pdfLink}</div></div>
                    <div class="flex gap-2"><button onclick="decidirCandidato('${d.id}', false)" class="p-2 rounded bg-red-500/10 text-red-500"><i data-lucide="x" size="14"></i></button><button onclick="decidirCandidato('${d.id}', true)" class="p-2 rounded bg-green-500/10 text-green-500"><i data-lucide="check" size="14"></i></button></div>
                </div>`;
        });
        if(container.innerHTML === "") container.innerHTML = `<p class="text-center text-slate-600 text-xs py-4">Tudo limpo.</p>`;
        lucide.createIcons();
    });
};

window.decidirCandidato = async (uid, ok) => {
    if(!confirm("Confirmar?")) return;
    try { await updateDoc(doc(db, "candidates", uid), { status: ok ? 'approved' : 'rejected', moderated_at: serverTimestamp() }); } catch(e) { alert(e.message); }
};

window.carregarValidacoes = () => {
    const container = document.getElementById('fin-mission-list');
    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const item = d.data();
            container.innerHTML += `
                <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                    <div class="flex justify-between"><span class="font-bold text-white text-xs">${item.mission_title}</span><span class="text-green-400 font-mono text-xs">R$ ${item.valor_bruto}</span></div>
                    <div class="flex justify-between items-end mt-2"><a href="${item.photo_url}" target="_blank" class="text-[10px] text-blue-400 underline">📸 Ver Prova</a><div class="flex gap-2"><button onclick="validarMissao('${d.id}', false, '${item.profile_id}', 0)" class="text-[10px] text-red-400 border border-red-900/50 px-2 py-1 rounded">Rejeitar</button><button onclick="validarMissao('${d.id}', true, '${item.profile_id}', ${item.valor_bruto})" class="text-[10px] bg-green-600 text-white px-3 py-1 rounded font-bold">Pagar</button></div></div>
                </div>`;
        });
        if(container.innerHTML === "") container.innerHTML = `<p class="text-center text-slate-600 text-xs py-4">Caixa limpo.</p>`;
    });
};

window.validarMissao = async (id, ok, uid, val) => {
    try {
        const ref = doc(db, "mission_assignments", id);
        if (ok) { await updateDoc(ref, { status: "approved", approved_at: serverTimestamp() }); await updateDoc(doc(db, "usuarios", uid), { saldo: increment(val) }); }
        else { await updateDoc(ref, { status: "rejected", rejected_at: serverTimestamp() }); }
    } catch(e) { alert(e.message); }
};

// Start
initDashboard();
