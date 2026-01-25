import { db } from './app.js';
import { collection, addDoc, getDocs, getCountFromServer, deleteDoc, setDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chartInstance = null;

// --- 1. CONTROLE DE NAVEGAÇÃO ---
window.switchView = (viewName) => {
    ['dashboard', 'links', 'rh', 'financeiro', 'users', 'tools'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        document.getElementById(`nav-${v}`)?.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    document.getElementById(`nav-${viewName}`)?.classList.add('active');

    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
    if(viewName === 'users') carregarTopUsuarios();
    if(viewName === 'links') carregarLinksRastreados();
};

// --- 2. DASHBOARD LIVE ---
function initDashboard() {
    const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const feed = document.getElementById('live-feed-content');
        if(!feed) return;
        feed.innerHTML = "";
        let stats = { views: 0, actions: 0, sales: 0 };

        snap.forEach(d => {
            const data = d.data();
            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            let icon = '🔹'; let color = 'text-slate-400';

            if (data.event.includes('LOGIN')) { icon = '🔑'; stats.views++; }
            if (data.event.includes('TRAFFIC')) { icon = '🚦'; color = 'text-yellow-400'; } // Novo evento de tráfego
            if (data.event.includes('CANDIDATURA') || data.event.includes('CLICK')) { icon = '👆'; color = 'text-blue-400'; stats.actions++; }
            if (data.event.includes('PROPOSTA') || data.event.includes('SEED')) { icon = '💰'; color = 'text-green-400 font-bold'; stats.sales++; }

            feed.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${color}">${data.event}</span>
                        <span class="text-slate-600">(${data.details?.source || 'app'})</span>
                    </div>
                    <span class="font-mono text-slate-600">${time}</span>
                </div>`;
        });
        updateChart(stats);
    });
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
                data: [data.views + 5, data.actions, data.sales],
                backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: '#ffffff10' } } } }
    });
}

// --- 3. FÁBRICA DE LINKS (NOVO) ---
window.criarLinkRastreado = async () => {
    const slug = document.getElementById('link-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const target = document.getElementById('link-target').value;
    const source = document.getElementById('link-source').value || 'direct';
    
    if(!slug) return alert("Defina um identificador único (ex: zap-grupo-1).");

    const btn = event.target;
    btn.innerText = "Gerando..."; btn.disabled = true;

    try {
        // Salva metadados do link
        await setDoc(doc(db, "tracked_links", slug), {
            slug: slug,
            target_tab: target,
            source: source,
            clicks: 0,
            created_at: serverTimestamp()
        });

        const baseUrl = window.location.href.replace('admin.html', 'index.html');
        // Gera link limpo com parâmetro de rastreio
        const finalUrl = `${baseUrl}?trk=${slug}`;
        
        document.getElementById('final-link-text').innerText = finalUrl;
        document.getElementById('link-result-box').classList.remove('hidden');
        
        alert("✅ Link Operacional Criado!");
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "🛠️ Gerar Link Operacional"; btn.disabled = false;
    }
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
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-blue-400 font-bold text-xs uppercase">${l.slug}</span>
                            <span class="text-[9px] bg-slate-700 px-1 rounded text-slate-400">${l.source}</span>
                        </div>
                        <p class="text-[9px] text-slate-500">Destino: ${l.target_tab}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-black text-white">${l.clicks}</span>
                        <span class="text-[9px] text-slate-500 block uppercase">Cliques</span>
                    </div>
                </div>`;
        });
    });
}

// --- 4. SEED & TOOLS ---
window.gerarSeed = async (tipo) => { /* ... mantido do código anterior ... */ };

// --- 5. RANKING & OUTROS ---
function carregarTopUsuarios() { /* ... mantido do código anterior ... */ }
window.carregarCandidaturas = () => { /* ... mantido ... */ };
window.decidirCandidato = async (uid, ok) => { /* ... mantido ... */ };
window.carregarValidacoes = () => { /* ... mantido ... */ };
window.validarMissao = async (id, ok, uid, val) => { /* ... mantido ... */ };

// Start
initDashboard();
