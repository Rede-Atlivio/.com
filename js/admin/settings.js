import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================
export async function init() {
    const container = document.getElementById('view-settings');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel p-6 border border-blue-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📢 Comunicação Global</h2>
                <p class="text-xs text-gray-400 mb-6">Esta mensagem aparecerá no topo do aplicativo para todos os usuários.</p>
                
                <label class="inp-label">MENSAGEM DE AVISO</label>
                <input type="text" id="conf-global-msg" class="inp-editor h-10 text-white mb-2" placeholder="Ex: Manutenção programada para Domingo...">
                
                <div class="flex items-center gap-2 mb-6">
                    <input type="checkbox" id="conf-msg-active" class="chk-custom">
                    <label for="conf-msg-active" class="text-xs text-gray-300 cursor-pointer">Mostrar Aviso?</label>
                </div>

                <button onclick="window.saveAppSettings()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR CONFIGURAÇÃO
                </button>
            </div>

            <div class="glass-panel p-6 border border-emerald-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📑 Relatórios Gerenciais</h2>
                <p class="text-xs text-gray-400 mb-6">Exporte os dados da plataforma para análise.</p>
                
                <div class="space-y-4">
                    <div class="p-4 bg-slate-800 rounded-xl border border-slate-700">
                        <p class="text-[10px] uppercase font-bold text-gray-500 mb-1">RELATÓRIO EXECUTIVO</p>
                        <p class="text-xs text-white mb-3">Resumo completo de usuários, finanças e métricas operacionais.</p>
                        <button onclick="window.generatePDFReport()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded font-bold text-xs uppercase flex items-center justify-center gap-2">
                            <i data-lucide="file-text" size="14"></i> GERAR PDF / IMPRIMIR
                        </button>
                    </div>
                </div>
            </div>

            <div class="col-span-1 md:col-span-2 glass-panel p-8 border border-red-900/50 bg-red-900/5 mt-4">
                <div class="flex items-start gap-4">
                    <div class="bg-red-900/20 p-3 rounded-full text-red-500">
                        <i data-lucide="alert-triangle" size="24"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-red-500 uppercase tracking-wide">ZONA DE PERIGO</h2>
                        <p class="text-sm text-gray-400 mt-1">
                            Ações aqui são irreversíveis. Tenha cuidado absoluto.
                        </p>
                    </div>
                </div>

                <div class="mt-6 p-6 bg-black/40 rounded-xl border border-red-900/30">
                    <h3 class="text-white font-bold mb-2">🔥 LIMPEZA DE DADOS DEMONSTRATIVOS</h3>
                    <p class="text-xs text-gray-500 mb-4">
                        Isso irá apagar <b>TODOS</b> os registros (Vagas, Usuários, Tarefas) marcados como <code>is_demo = true</code>.
                        Use isso para limpar o sistema após testes em massa.
                    </p>
                    <button onclick="window.clearDatabase()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-black text-xs uppercase shadow-lg shadow-red-900/20 transition">
                        🗑️ EXECUTAR LIMPEZA GERAL
                    </button>
                </div>
            </div>

        </div>
    `;
    
    lucide.createIcons();
    await loadSettings();
    console.log("✅ Módulo Settings Carregado.");
}

// ============================================================================
// 2. LÓGICA DE CONFIGURAÇÃO (AVISO GLOBAL)
// ============================================================================
async function loadSettings() {
    try {
        const db = window.db;
        const d = await getDoc(doc(db, "settings", "global"));
        if(d.exists()) {
            const data = d.data();
            document.getElementById('conf-global-msg').value = data.top_message || "";
            document.getElementById('conf-msg-active').checked = data.is_active || false;
        }
    } catch(e) { console.error("Erro ao carregar settings", e); }
}

window.saveAppSettings = async () => {
    const msg = document.getElementById('conf-global-msg').value;
    const active = document.getElementById('conf-msg-active').checked;
    
    try {
        const db = window.db;
        await setDoc(doc(db, "settings", "global"), { 
            top_message: msg,
            is_active: active,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ Configuração salva com sucesso!");
    } catch(e) { alert(e.message); }
};

// ============================================================================
// 3. LIMPEZA DE DADOS (ZONA DE PERIGO)
// ============================================================================
window.clearDatabase = async () => {
    const confirmacao = prompt("⚠️ PERIGO: ISSO APAGARÁ TODOS OS DADOS DE TESTE.\n\nPara confirmar, digite a palavra: DELETAR");
    
    if (confirmacao !== "DELETAR") {
        return alert("❌ Ação cancelada. A palavra de segurança estava incorreta.");
    }

    const btn = document.querySelector('button[onclick="window.clearDatabase()"]');
    const txtOriginal = btn.innerText;
    btn.innerText = "⏳ LIMPANDO BANCO DE DADOS...";
    btn.disabled = true;

    try {
        const db = window.db;
        const batch = writeBatch(db);
        let totalDeleted = 0;

        // Coleções para limpar
        const collections = ["jobs", "active_providers", "missoes", "oportunidades", "usuarios"];

        for (const colName of collections) {
            // Busca apenas demos
            const q = query(collection(db, colName), where("is_demo", "==", true));
            const snapshot = await getDocs(q);
            
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                totalDeleted++;
            });
        }

        if (totalDeleted > 0) {
            await batch.commit();
            alert(`✅ SUCESSO: ${totalDeleted} registros de teste foram apagados.`);
        } else {
            alert("ℹ️ Nenhum dado de teste encontrado para apagar.");
        }

        // Atualiza a tela se necessário
        if(window.forceRefresh) window.forceRefresh();

    } catch (e) {
        console.error(e);
        alert("Erro crítico ao limpar: " + e.message);
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
};

// ============================================================================
// 4. RELATÓRIO PDF (GERA HTML PARA IMPRESSÃO)
// ============================================================================
window.generatePDFReport = async () => {
    const btn = document.querySelector('button[onclick="window.generatePDFReport()"]');
    btn.innerText = "⏳ COLETANDO DADOS...";
    
    try {
        const db = window.db;
        
        // 1. Coleta Estatísticas
        const usersSnap = await getCountFromServer(collection(db, "usuarios"));
        const jobsSnap = await getCountFromServer(collection(db, "jobs"));
        const provSnap = await getCountFromServer(collection(db, "active_providers"));
        const oppsSnap = await getCountFromServer(collection(db, "oportunidades"));

        // Finanças (Rápida varredura)
        let totalCustodia = 0;
        const uSnap = await getDocs(collection(db, "usuarios"));
        uSnap.forEach(d => {
            const s = parseFloat(d.data().saldo || 0);
            if(s > 0) totalCustodia += s;
        });

        // 2. Monta o HTML do Relatório
        const reportContent = `
            <html>
            <head>
                <title>Relatório Executivo - Atlivio</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
                    .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f8fafc; }
                    .card h3 { margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; }
                    .card p { margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #0f172a; }
                    .footer { margin-top: 50px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
                    @media print { body { padding: 0; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>ATLIVIO .OS</h1>
                        <p>Relatório Operacional e Financeiro</p>
                    </div>
                    <div style="text-align: right;">
                        <p><strong>Data:</strong> ${new Date().toLocaleDateString()}</p>
                        <p><strong>Emissor:</strong> Admin (Automático)</p>
                    </div>
                </div>

                <h2>Resumo Operacional</h2>
                <div class="card-grid">
                    <div class="card">
                        <h3>Usuários Totais</h3>
                        <p>${usersSnap.data().count}</p>
                    </div>
                    <div class="card">
                        <h3>Prestadores Ativos</h3>
                        <p>${provSnap.data().count}</p>
                    </div>
                    <div class="card">
                        <h3>Vagas Publicadas</h3>
                        <p>${jobsSnap.data().count}</p>
                    </div>
                    <div class="card">
                        <h3>Oportunidades</h3>
                        <p>${oppsSnap.data().count}</p>
                    </div>
                </div>

                <h2>Resumo Financeiro</h2>
                <div class="card-grid">
                    <div class="card" style="border-left: 5px solid #10b981;">
                        <h3>Saldo em Custódia (Passivo)</h3>
                        <p>R$ ${totalCustodia.toFixed(2)}</p>
                    </div>
                    <div class="card">
                        <h3>Ticket Médio (Est.)</h3>
                        <p>R$ --</p>
                    </div>
                </div>

                <div class="footer">
                    <p>Este documento é confidencial e gerado automaticamente pelo sistema Atlivio Admin v3.0.</p>
                </div>

                <script>window.print();</script>
            </body>
            </html>
        `;

        // 3. Abre Janela de Impressão
        const win = window.open('', '_blank');
        win.document.write(reportContent);
        win.document.close();

    } catch (e) {
        alert("Erro ao gerar relatório: " + e.message);
    } finally {
        btn.innerText = "GERAR PDF / IMPRIMIR";
    }
};
