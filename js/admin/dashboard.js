import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-dashboard');
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="glass-panel p-5 border-l-2 border-blue-500"><p class="text-[10px] uppercase font-bold text-gray-400">USUÁRIOS TOTAIS</p><h3 class="text-2xl font-black text-white" id="kpi-users">...</h3></div>
            <div class="glass-panel p-5 border-l-2 border-green-500"><p class="text-[10px] uppercase font-bold text-gray-400">PRESTADORES ONLINE</p><h3 class="text-2xl font-black text-green-400" id="kpi-providers">...</h3></div>
            <div class="glass-panel p-5 border-l-2 border-purple-500"><p class="text-[10px] uppercase font-bold text-gray-400">VAGAS ATIVAS</p><h3 class="text-2xl font-black text-white" id="kpi-jobs">...</h3></div>
            <div class="glass-panel p-5 border-l-2 border-amber-500"><p class="text-[10px] uppercase font-bold text-gray-400">SALDO EM CARTEIRAS</p><h3 class="text-2xl font-black text-amber-400" id="kpi-balance">R$ ...</h3></div>
        </div>
        <div class="glass-panel p-10 text-center mt-6">
            <p class="text-gray-500">📊 Gráficos detalhados serão carregados aqui...</p>
        </div>
    `;
    
    // Carregamento Básico (Para não ficar vazio)
    // O Financeiro detalhado virá depois
    try {
        const db = window.db;
        const u = await getDocs(collection(db, "usuarios"));
        document.getElementById('kpi-users').innerText = u.size;
    } catch(e) { console.log("Dashboard waiting auth..."); }
}
