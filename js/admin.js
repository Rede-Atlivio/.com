import { db } from './app.js';
import { collection, query, where, orderBy, limit, onSnapshot, getCountFromServer, doc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chartInstance = null;

// --- 1. CONTROLE DE NAVEGAÇÃO ---
window.switchView = (viewName) => {
    // Esconde todas as views
    ['dashboard', 'rh', 'financeiro', 'servicos'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
        
        const nav = document.getElementById(`nav-${v}`);
        if(nav) nav.classList.remove('active');
    });

    // Mostra a selecionada
    const target = document.getElementById(`view-${viewName}`);
    if(target) target.classList.remove('hidden');
    
    const activeNav = document.getElementById(`nav-${viewName}`);
    if(activeNav) activeNav.classList.add('active');

    // Carrega dados específicos se necessário
    if(viewName === 'rh') carregarCandidaturas();
    if(viewName === 'financeiro') carregarValidacoes();
};

// --- 2. DASHBOARD LIVE (O Cérebro do Sniper) ---
function initDashboard() {
    // Escuta eventos em tempo real
    const q = query(collection(db, "system_events"), orderBy("timestamp", "desc"), limit(50));
    
    onSnapshot(q, (snap) => {
        const feedContainer = document.getElementById('live-feed-content');
        feedContainer.innerHTML = "";
        
        let eventsData = { views: 0, actions: 0, sales: 0 }; // Para o gráfico

        snap.forEach(d => {
            const data = d.data();
            const time = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : '--:--';
            
            // Ícones e Cores por tipo de evento
            let icon = '🔹';
            let colorClass = 'text-slate-400';
            
            if (data.event.includes('LOGIN')) { icon = '🔑'; eventsData.views++; }
            if (data.event.includes('CANDIDATURA')) { icon = '📝'; colorClass = 'text-blue-400 font-bold'; eventsData.actions++; }
            if (data.event.includes('PROPOSTA')) { icon = '💰'; colorClass = 'text-green-400 font-bold'; eventsData.sales++; }
            
            feedContainer.innerHTML += `
                <div class="flex justify-between items-center text-[10px] py-2 border-b border-white/5 animate-fadeIn">
                    <div class="flex items-center gap-2">
                        <span>${icon}</span>
                        <span class="${colorClass}">${data.event}</span>
                        <span class="text-slate-600">(${data.user_email?.split('@')[0] || 'Anon'})</span>
                    </div>
                    <span class="font-mono text-slate-600">${time}</span>
                </div>
            `;
        });

        updateChart(eventsData);
    });

    // Carrega KPIs Estáticos
    loadKPIs();
}

async function loadKPIs() {
    try {
        const snapUsers = await getCountFromServer(collection(db, "usuarios"));
        document.getElementById('kpi-users').innerText = snapUsers.data().count;

        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const snapOnline = await getCountFromServer(qOnline);
        document.getElementById('kpi-online').innerText = snapOnline.data().count;
        
        // Exemplo: Soma de saldo (teria que fazer uma cloud function pra isso em escala, mas aqui vai simplificado)
        // Por enquanto deixamos placeholder
    } catch(e) { console.error("Erro KPIs", e); }
}

function updateChart(data) {
    const ctx = document.getElementById('funnelChart');
    if(!ctx) return;

    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Acessos', 'Ações (RH/Jobs)', 'Negócios'],
            datasets: [{
                label: 'Conversão Hoje',
                data: [data.views + 10, data.actions, data.sales], // +10 fake pra não ficar vazio no inicio
                backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                x: { grid: { display: false }, ticks: { color: '#64748b' } }
            }
        }
    });
}

// --- 3. GESTÃO DE RH (Talentos) ---
window.carregarCandidaturas = () => {
    const container = document.getElementById('rh-cv-list');
    const badge = document.getElementById('badge-rh');
    
    // Busca candidatos pendentes ou não aprovados
    const q = query(collection(db, "candidates")); 

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        let count = 0;

        snap.forEach(d => {
            const cv = d.data();
            if (cv.status === 'approved') return; // Pula aprovados
            count++;

            const pdfLink = cv.curriculo_pdf 
                ? `<a href="${cv.curriculo_pdf}" target="_blank" class="text-blue-400 hover:text-blue-300 underline text-[10px]">Ver PDF</a>` 
                : `<span class="text-slate-600 text-[10px]">Sem PDF</span>`;

            container.innerHTML += `
                <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-white text-sm">${cv.nome_completo}</h4>
                        <p class="text-[10px] text-slate-400">${cv.habilidades}</p>
                        <div class="mt-1 flex gap-2">${pdfLink}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="decidirCandidato('${d.id}', false)" class="p-2 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"><i data-lucide="x" size="14"></i></button>
                        <button onclick="decidirCandidato('${d.id}', true)" class="p-2 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20"><i data-lucide="check" size="14"></i></button>
                    </div>
                </div>`;
        });
        
        if(badge) {
            badge.innerText = count;
            badge.classList.remove('hidden');
            if(count === 0) badge.classList.add('hidden');
        }
        
        if(count === 0) container.innerHTML = `<p class="text-center text-slate-600 text-xs py-4">Tudo limpo.</p>`;
        lucide.createIcons();
    });
};

window.decidirCandidato = async (uid, aprovar) => {
    if(!confirm("Confirmar ação?")) return;
    try {
        await updateDoc(doc(db, "candidates", uid), {
            status: aprovar ? 'approved' : 'rejected',
            moderated_at: serverTimestamp()
        });
    } catch(e) { alert("Erro: " + e.message); }
};

// --- 4. GESTÃO FINANCEIRA (Missões) ---
window.carregarValidacoes = () => {
    const container = document.getElementById('fin-mission-list');
    const badge = document.getElementById('badge-fin');
    
    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"));

    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        let count = 0;
        
        snap.forEach(d => {
            count++;
            const item = d.data();
            container.innerHTML += `
                <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                    <div class="flex justify-between">
                        <span class="font-bold text-white text-xs">${item.mission_title}</span>
                        <span class="text-green-400 font-mono text-xs">R$ ${item.valor_bruto}</span>
                    </div>
                    <div class="flex justify-between items-end mt-2">
                        <a href="${item.photo_url}" target="_blank" class="text-[10px] text-blue-400 underline">📸 Ver Prova</a>
                        <div class="flex gap-2">
                            <button onclick="validarMissao('${d.id}', false, '${item.profile_id}', 0)" class="text-[10px] text-red-400 border border-red-900/50 px-2 py-1 rounded">Rejeitar</button>
                            <button onclick="validarMissao('${d.id}', true, '${item.profile_id}', ${item.valor_bruto})" class="text-[10px] bg-green-600 text-white px-3 py-1 rounded font-bold">Pagar</button>
                        </div>
                    </div>
                </div>`;
        });

        if(badge) {
            badge.innerText = count;
            badge.classList.remove('hidden');
            if(count === 0) badge.classList.add('hidden');
        }
        if(count === 0) container.innerHTML = `<p class="text-center text-slate-600 text-xs py-4">Caixa limpo.</p>`;
    });
};

window.validarMissao = async (docId, aprovar, userId, valor) => {
    // Mesma lógica de validação anterior...
    try {
        const assignmentRef = doc(db, "mission_assignments", docId);
        if (aprovar) {
            await updateDoc(assignmentRef, { status: "approved", approved_at: serverTimestamp() });
            await updateDoc(doc(db, "usuarios", userId), { saldo: increment(valor) });
        } else {
            await updateDoc(assignmentRef, { status: "rejected", rejected_at: serverTimestamp() });
        }
    } catch(e) { alert("Erro: " + e.message); }
};

// --- START ---
initDashboard();
