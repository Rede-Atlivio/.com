import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-dashboard');
    
    // Renderiza a estrutura (Skeleton)
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="glass-panel p-5 border-l-2 border-blue-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">USUÁRIOS TOTAIS</p>
                <h3 class="text-2xl font-black text-white" id="kpi-users"><div class="loader w-4 h-4 border-white"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-green-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">PRESTADORES ONLINE</p>
                <h3 class="text-2xl font-black text-green-400" id="kpi-providers"><div class="loader w-4 h-4 border-green-500"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-purple-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">VAGAS ATIVAS</p>
                <h3 class="text-2xl font-black text-white" id="kpi-jobs"><div class="loader w-4 h-4 border-white"></div></h3>
            </div>
            <div class="glass-panel p-5 border-l-2 border-amber-500">
                <p class="text-[10px] uppercase font-bold text-gray-400">SALDO EM CARTEIRAS</p>
                <h3 class="text-2xl font-black text-amber-400" id="kpi-balance"><div class="loader w-4 h-4 border-amber-500"></div></h3>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div class="glass-panel p-6">
                <h4 class="font-bold text-gray-300 mb-4 border-b border-gray-700 pb-2">📊 Status do Sistema</h4>
                <div id="chart-status" class="text-xs text-gray-500">Carregando métricas...</div>
            </div>
            <div class="glass-panel p-6 flex flex-col justify-center items-center text-center">
                <div class="text-4xl mb-2">🛡️</div>
                <h4 class="font-bold text-white">Painel de Controle</h4>
                <p class="text-[10px] text-gray-400">v15.4 (Stable)</p>
            </div>
        </div>
    `;
    
    try {
        const db = window.db;

        // 1. USUÁRIOS TOTAIS & SALDO FINANCEIRO
        // Buscamos todos para somar o saldo (wallet_balance)
        const usersSnap = await getDocs(collection(db, "usuarios"));
        let totalSaldo = 0;
        
        usersSnap.forEach(doc => {
            const data = doc.data();
            // Compatibilidade: lê 'wallet_balance' ou 'saldo'
            const valor = parseFloat(data.wallet_balance || data.saldo || 0);
            totalSaldo += valor;
        });

        document.getElementById('kpi-users').innerText = usersSnap.size;
        document.getElementById('kpi-balance').innerText = `R$ ${totalSaldo.toFixed(2).replace('.', ',')}`;

        // 2. PRESTADORES ONLINE
        // Query para contar apenas quem está com is_online == true
        const qOnline = query(collection(db, "active_providers"), where("is_online", "==", true));
        const providersSnap = await getDocs(qOnline);
        document.getElementById('kpi-providers').innerText = providersSnap.size;

        // 3. VAGAS ATIVAS
        // Conta vagas com status 'ativa'
        const qJobs = query(collection(db, "jobs"), where("status", "==", "ativa"));
        const jobsSnap = await getDocs(qJobs);
        document.getElementById('kpi-jobs').innerText = jobsSnap.size;

        // Atualiza status textual
        document.getElementById('chart-status').innerHTML = `
            <p>✅ Conexão com Banco: <b>ESTÁVEL</b></p>
            <p>👥 Média Saldo/Usuário: <b>R$ ${(usersSnap.size > 0 ? totalSaldo / usersSnap.size : 0).toFixed(2)}</b></p>
        `;

    } catch(e) { 
        console.error("Erro Dashboard:", e);
        document.getElementById('chart-status').innerHTML = `<span class="text-red-400">Erro de leitura: ${e.message}</span>`;
    }
}
