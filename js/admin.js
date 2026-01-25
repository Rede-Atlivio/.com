import { db } from './app.js';
import { collection, addDoc, getDocs, getCountFromServer, deleteDoc, doc, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chartInstance = null;

// --- 1. CONTROLE DE NAVEGAÇÃO ---
window.switchView = (viewName) => {
    ['dashboard', 'rh', 'financeiro', 'users', 'tools'].forEach(v => {
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
            if (data.event.includes('CANDIDATURA') || data.event.includes('CLICK')) { icon = '👆'; color = 'text-blue-400'; stats.actions++; }
            if (data.event.includes('PROPOSTA') || data.event.includes('SEED')) { icon = '💰'; color = 'text-green-400 font-bold'; stats.sales++; }

            feed.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${color}">${data.event}</span>
                        <span class="text-slate-600">(${data.profile_type || 'user'})</span>
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

// --- 3. MODO DEUS (SEED GENERATOR) ---
window.gerarSeed = async (tipo) => {
    const btn = event.target;
    btn.disabled = true; btn.innerText = "Criando...";
    
    try {
        if (tipo === 'servico') {
            const titulos = ["Marido de Aluguel", "Eletricista Rápido", "Limpeza Pós-Obra", "Formatatação de PC"];
            const titulo = titulos[Math.floor(Math.random() * titulos.length)];
            
            await addDoc(collection(db, "active_providers"), {
                nome_profissional: "Seed Pro " + Math.floor(Math.random() * 100),
                is_online: true,
                is_seed: true, // FLAG IMPORTANTE
                services: [{ category: "Outros", price: 100 + Math.floor(Math.random() * 200) }],
                last_seen: serverTimestamp()
            });
            await addDoc(collection(db, "system_events"), { event: "SEED_SERVICE_CREATED", user_id: "admin", timestamp: serverTimestamp() });
        }
        
        if (tipo === 'vaga') {
            const vagas = ["Vendedor de Loja", "Auxiliar Administrativo", "Recepcionista", "Entregador"];
            const vaga = vagas[Math.floor(Math.random() * vagas.length)];
            
            await addDoc(collection(db, "jobs"), {
                titulo: vaga,
                descricao: "Vaga urgente para início imediato. Salário compatível.",
                salario: "R$ 1." + Math.floor(Math.random() * 9) + "00,00",
                company_name: "Empresa Parceira",
                is_seed: true, // FLAG IMPORTANTE
                created_at: serverTimestamp()
            });
            await addDoc(collection(db, "system_events"), { event: "SEED_JOB_CREATED", user_id: "admin", timestamp: serverTimestamp() });
        }
        
        alert(`✅ ${tipo.toUpperCase()} Seed Criado!`);
    } catch(e) {
        alert("Erro: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "Gerar +1";
    }
};

// --- 4. RANKING DE USUÁRIOS (Novidade) ---
function carregarTopUsuarios() {
    const list = document.getElementById('user-ranking-list');
    if(!list) return;
    
    // Pega usuários ordenados por saldo (quem mais movimenta)
    const q = query(collection(db, "usuarios"), orderBy("saldo", "desc"), limit(10));
    
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        snap.forEach((d, index) => {
            const u = d.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
                    <div class="flex items-center gap-3">
                        <span class="text-lg font-black text-slate-600">#${index+1}</span>
                        <div>
                            <p class="text-white font-bold text-xs">${u.displayName || u.email}</p>
                            <p class="text-[10px] text-slate-400">${u.email}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-green-400 font-mono text-xs">R$ ${u.saldo?.toFixed(2) || '0.00'}</p>
                        <p class="text-[9px] text-slate-500">${u.stats?.events_count || 0} ações</p>
                    </div>
                </div>
            `;
        });
    });
}

// --- Funções Auxiliares (Candidaturas/Validações do código anterior mantidas) ---
window.carregarCandidaturas = () => { /* ... código anterior do RH ... */ };
window.decidirCandidato = async (uid, ok) => { /* ... código anterior ... */ };
window.carregarValidacoes = () => { /* ... código anterior financeiro ... */ };
window.validarMissao = async (id, ok, uid, val) => { /* ... código anterior ... */ };

// Inicializa
initDashboard();
