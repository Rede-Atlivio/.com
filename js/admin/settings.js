import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, getCountFromServer, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO DA INTERFACE (CONFIGURAÇÕES E AUDITORIA)
// ============================================================================
export async function init() {
    const container = document.getElementById('view-settings');
    if (!container) return;
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel p-6 border border-blue-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📢 Comunicação Global</h2>
                <p class="text-xs text-gray-400 mb-6">Esta mensagem aparecerá no topo do aplicativo para todos os usuários.</p>
                
                <label class="inp-label">MENSAGEM DE AVISO</label>
                <input type="text" id="conf-global-msg" class="inp-editor h-10 text-white mb-2" placeholder="Ex: Manutenção programada...">
                
                <div class="flex items-center gap-2 mb-6">
                    <input type="checkbox" id="conf-msg-active" class="chk-custom">
                    <label for="conf-msg-active" class="text-xs text-gray-300 cursor-pointer">Mostrar Aviso?</label>
                </div>

                <button onclick="window.saveAppSettings()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR CONFIGURAÇÃO
                </button>
            </div>

            <div class="glass-panel p-6 border border-blue-500/30">
    <h2 class="text-xl font-bold text-white mb-2">💰 Regras Financeiras Master</h2>
    <p class="text-xs text-gray-400 mb-6">Controle os limites de valores e taxas globais do sistema.</p>
    
    <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
            <label class="text-[10px] font-bold text-gray-500 uppercase">Min (R$)</label>
            <input type="number" id="conf-val-min" class="inp-editor h-10 text-white" placeholder="20.00">
        </div>
        <div>
            <label class="text-[10px] font-bold text-gray-500 uppercase">Max (R$)</label>
            <input type="number" id="conf-val-max" class="inp-editor h-10 text-white" placeholder="500.00">
        </div>
    </div>

    <label class="inp-label">TAXA DE RESERVA (%)</label>
    <input type="number" id="conf-taxa-reserva" class="inp-editor h-10 text-white mb-4" placeholder="10">

    <label class="inp-label">BÔNUS INICIAL (R$)</label>
    <input type="number" id="conf-bonus-valor" class="inp-editor h-10 text-white mb-6" placeholder="20.00">

    <button onclick="window.saveBusinessRules()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
        💾 ATUALIZAR REGRAS GLOBAIS
    </button>
</div>
                
                <label class="inp-label">VALOR DO BÔNUS INICIAL (R$)</label>
                <input type="number" id="conf-bonus-valor" class="inp-editor h-10 text-white mb-2" placeholder="20.00">
                
                <div class="flex items-center gap-2 mb-4">
                    <input type="checkbox" id="conf-bonus-active" class="chk-custom">
                    <label for="conf-bonus-active" class="text-xs text-gray-300 cursor-pointer">Ativar Bônus de Boas-Vindas?</label>
                </div>

                <label class="inp-label">TAXA DE INTERMEDIAÇÃO FIXA (R$)</label>
                <input type="number" id="conf-taxa-valor" class="inp-editor h-10 text-white mb-6" placeholder="5.00">

                <button onclick="window.saveBusinessRules()" class="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR REGRAS FINANCEIRAS
                </button>
            </div>

            <div class="glass-panel p-6 border border-amber-500/30">
                <h2 class="text-xl font-bold text-white mb-2">🔍 Auditoria de Dados</h2>
                <p class="text-xs text-gray-400 mb-6">Varredura automática por lixo eletrônico ou duplicados.</p>
                
                <div id="audit-results" class="bg-black/40 p-4 rounded-xl text-[10px] text-gray-300 font-mono mb-4 min-h-[80px] border border-white/5 whitespace-pre-wrap">Aguardando varredura profunda...</div>
                
                <button onclick="window.runDataAudit()" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold text-xs uppercase transition shadow-lg">
                    🚀 INICIAR VARREDURA AGORA
                </button>
            </div>

            <div class="glass-panel p-6 border border-emerald-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📑 Relatórios Gerenciais</h2>
                <p class="text-xs text-gray-400 mb-6">Exporte os dados da plataforma para análise.</p>
                
                <div class="p-4 bg-slate-800 rounded-xl border border-slate-700">
                    <p class="text-[10px] uppercase font-bold text-gray-500 mb-1">RELATÓRIO EXECUTIVO</p>
                    <p class="text-xs text-white mb-3">Resumo completo de usuários, finanças e métricas.</p>
                    <button onclick="window.generatePDFReport()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded font-bold text-xs uppercase flex items-center justify-center gap-2">
                        📄 GERAR PDF / IMPRIMIR
                    </button>
                </div>
            </div>

            <div class="col-span-1 md:col-span-2 glass-panel p-8 border border-red-900/50 bg-red-900/5 mt-4">
                <div class="flex items-start gap-4 mb-6">
                    <div class="bg-red-900/20 p-3 rounded-full text-red-500 text-xl">⚠️</div>
                    <div>
                        <h2 class="text-xl font-black text-red-500 uppercase tracking-wide">ZONA DE PERIGO</h2>
                        <p class="text-sm text-gray-400 mt-1">Ações irreversíveis. Tenha cuidado absoluto.</p>
                    </div>
                </div>

                <div class="p-6 bg-black/40 rounded-xl border border-red-900/30">
                    <h3 class="text-white font-bold mb-2">🔥 LIMPEZA DE DADOS DEMONSTRATIVOS</h3>
                    <p class="text-xs text-gray-500 mb-4">Apaga registros marcados como <code>is_demo = true</code> em Jobs, Providers, Missoes e Usuarios.</p>
                    <button onclick="window.clearDatabase()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-black text-xs uppercase shadow-lg transition">
                        🗑️ EXECUTAR LIMPEZA GERAL
                    </button>
                </div>
            </div>

        </div>
    `;
    
    lucide.createIcons();
    await loadSettings();
}

// ============================================================================
// 2. LÓGICA DE CARREGAMENTO E SALVAMENTO
// ============================================================================
async function loadSettings() {
    try {
        const d = await getDoc(doc(window.db, "settings", "global"));
        if(d.exists()) {
            const data = d.data();
            document.getElementById('conf-global-msg').value = data.top_message || "";
            document.getElementById('conf-msg-active').checked = data.is_active || false;
            document.getElementById('conf-bonus-valor').value = data.valor_bonus_promocional || 20.00;
            document.getElementById('conf-bonus-active').checked = data.bonus_boas_vindas_ativo || false;
            document.getElementById('conf-taxa-valor').value = data.taxa_intermediacao || 5.00;
        }
    } catch(e) { console.error("Erro ao carregar settings", e); }
}

window.saveAppSettings = async () => {
    const msg = document.getElementById('conf-global-msg').value;
    const active = document.getElementById('conf-msg-active').checked;
    try {
        await setDoc(doc(window.db, "settings", "global"), { 
            top_message: msg,
            is_active: active,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ Aviso de comunicação atualizado!");
    } catch(e) { alert("Erro: " + e.message); }
};

// 1. CARREGAR DADOS DE DOIS LUGARES DIFERENTES
async function loadSettings() {
    try {
        // Busca aviso global
        const dGlobal = await getDoc(doc(window.db, "settings", "global"));
        if(dGlobal.exists()) {
            const data = dGlobal.data();
            document.getElementById('conf-global-msg').value = data.top_message || "";
            document.getElementById('conf-msg-active').checked = data.is_active || false;
        }

        // Busca regras financeiras (A coleção que blinda o app)
        const dFin = await getDoc(doc(window.db, "configuracoes", "financeiro"));
        if(dFin.exists()) {
            const data = dFin.data();
            document.getElementById('conf-val-min').value = data.valor_minimo || 20;
            document.getElementById('conf-val-max').value = data.valor_maximo || 500;
            document.getElementById('conf-taxa-reserva').value = data.porcentagem_reserva || 10;
            document.getElementById('conf-bonus-valor').value = data.valor_bonus_entrada || 20;
        }
    } catch(e) { console.error("Erro ao carregar settings", e); }
}

// 2. SALVAR REGRAS FINANCEIRAS NO LUGAR CERTO
window.saveBusinessRules = async () => {
    const min = parseFloat(document.getElementById('conf-val-min').value) || 20;
    const max = parseFloat(document.getElementById('conf-val-max').value) || 500;
    const taxa = parseFloat(document.getElementById('conf-taxa-reserva').value) || 10;
    const bonus = parseFloat(document.getElementById('conf-bonus-valor').value) || 20;

    try {
        await setDoc(doc(window.db, "configuracoes", "financeiro"), { 
            valor_minimo: min,
            valor_maximo: max,
            porcentagem_reserva: taxa,
            valor_bonus_entrada: bonus,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ REGRAS FINANCEIRAS ATUALIZADAS!");
    } catch(e) { alert("Erro: " + e.message); }
};
        alert("✅ Governança financeira salva com sucesso!");
    } catch(e) { alert("Erro financeiro: " + e.message); }
};

// ============================================================================
// 3. AUDITORIA DE DADOS (IDENTIFICAÇÃO DE ERROS)
// ============================================================================
window.runDataAudit = async () => {
    const logArea = document.getElementById('audit-results');
    logArea.innerHTML = "🔍 Iniciando varredura profunda no banco...";
    
    try {
        // 1. Checa Coleção 'produtos' (PT) que deve ser deletada
        const colProd = await getDocs(query(collection(window.db, "produtos"), limit(1)));
        let report = `• Coleção 'produtos' (Lixo PT): ${!colProd.empty ? '⚠️ POSSUI DADOS' : '✅ LIMPA'}\n`;
        
        // 2. Busca Telefones Duplicados em Usuarios
        const usersSnap = await getDocs(collection(window.db, "usuarios"));
        let phones = {};
        let duplicados = 0;
        usersSnap.forEach(u => {
            const p = u.data().phone;
            if(p) {
                if(phones[p]) duplicados++;
                else phones[p] = true;
            }
        });
        report += `• Telefones Duplicados: ${duplicados > 0 ? '⚠️ ' + duplicados : '✅ 0'}\n`;

        // 3. Verifica existência do documento Global
        const globalRef = await getDoc(doc(window.db, "settings", "global"));
        report += `• Documento settings/global: ${globalRef.exists() ? '✅ OK' : '❌ AUSENTE'}\n`;

        logArea.innerHTML = report;
    } catch(e) { logArea.innerHTML = "❌ Erro na varredura: " + e.message; }
};

// ============================================================================
// 4. LIMPEZA E RELATÓRIO
// ============================================================================
window.clearDatabase = async () => {
    const confirmacao = prompt("⚠️ PERIGO: ISSO APAGARÁ DADOS DE TESTE.\n\nPara confirmar, digite: DELETAR");
    if (confirmacao !== "DELETAR") return alert("Ação cancelada.");

    const btn = document.querySelector('button[onclick="window.clearDatabase()"]');
    btn.innerText = "⏳ LIMPANDO...";
    btn.disabled = true;

    try {
        const batch = writeBatch(window.db);
        let totalDeleted = 0;
        const collections = ["jobs", "active_providers", "missoes", "oportunidades", "usuarios"];

        for (const colName of collections) {
            const q = query(collection(window.db, colName), where("is_demo", "==", true));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => { batch.delete(doc.ref); totalDeleted++; });
        }

        if (totalDeleted > 0) {
            await batch.commit();
            alert(`✅ SUCESSO: ${totalDeleted} registros apagados.`);
        } else {
            alert("Nenhum dado is_demo encontrado.");
        }
    } catch (e) { alert("Erro: " + e.message); }
    finally { btn.innerText = "🗑️ EXECUTAR LIMPEZA GERAL"; btn.disabled = false; }
};

window.generatePDFReport = async () => {
    try {
        const usersSnap = await getCountFromServer(collection(window.db, "usuarios"));
        const provSnap = await getCountFromServer(collection(window.db, "active_providers"));
        const jobsSnap = await getCountFromServer(collection(window.db, "jobs"));
        
        let totalCustodia = 0;
        const uSnap = await getDocs(collection(window.db, "usuarios"));
        uSnap.forEach(d => {
            const s = parseFloat(d.data().wallet_balance || d.data().saldo || 0);
            if(s > 0) totalCustodia += s;
        });

        const reportContent = `
            <html>
            <head><title>Relatório Atlivio</title><style>body{font-family:sans-serif;padding:40px;color:#333;}h1{color:#2563eb;border-bottom:2px solid #2563eb;} .card{border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:8px;background:#f8fafc;}</style></head>
            <body>
                <h1>ATLIVIO .OS - RELATÓRIO EXECUTIVO</h1>
                <p>Gerado em: ${new Date().toLocaleString()}</p>
                <div class="card"><strong>Usuários Totais:</strong> ${usersSnap.data().count}</div>
                <div class="card"><strong>Prestadores Ativos:</strong> ${provSnap.data().count}</div>
                <div class="card"><strong>Vagas Públicas:</strong> ${jobsSnap.data().count}</div>
                <div class="card"><strong>Total em Custódia:</strong> R$ ${totalCustodia.toFixed(2)}</div>
                <script>window.print();</script>
            </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win.document.write(reportContent);
        win.document.close();
    } catch (e) { alert("Erro PDF: " + e.message); }
};
