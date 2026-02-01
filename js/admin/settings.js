import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, getCountFromServer, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO DA INTERFACE (CONFIGURAÇÕES E AUDITORIA)
// ============================================================================
export async function init() {
    const container = document.getElementById('view-settings');
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade">
            
            <div class="glass-panel p-6 border border-blue-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📢 Comunicação Global</h2>
                <p class="text-xs text-gray-400 mb-6">Aviso no topo do app para todos os usuários.</p>
                <label class="inp-label">MENSAGEM DE AVISO</label>
                <input type="text" id="conf-global-msg" class="inp-editor h-10 text-white mb-2" placeholder="Ex: Manutenção programada...">
                <div class="flex items-center gap-2 mb-6">
                    <input type="checkbox" id="conf-msg-active" class="chk-custom">
                    <label for="conf-msg-active" class="text-xs text-gray-300 cursor-pointer">Mostrar Aviso?</label>
                </div>
                <button onclick="window.saveAppSettings()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR AVISO
                </button>
            </div>

            <div class="glass-panel p-6 border border-purple-500/30">
                <h2 class="text-xl font-bold text-white mb-2">🎁 Regras de Bônus (R$ 20)</h2>
                <p class="text-xs text-gray-400 mb-6">Controle o bônus de boas-vindas e a taxa Atlivio.</p>
                
                <label class="inp-label">VALOR DO BÔNUS INICIAL (R$)</label>
                <input type="number" id="conf-bonus-valor" class="inp-editor h-10 text-white mb-2" placeholder="20.00">
                
                <div class="flex items-center gap-2 mb-4">
                    <input type="checkbox" id="conf-bonus-active" class="chk-custom">
                    <label for="conf-bonus-active" class="text-xs text-gray-300 cursor-pointer">Ativar Campanha de Bônus?</label>
                </div>

                <label class="inp-label">TAXA DE INTERMEDIAÇÃO (R$)</label>
                <input type="number" id="conf-taxa-valor" class="inp-editor h-10 text-white mb-6" placeholder="5.00">

                <button onclick="window.saveBusinessRules()" class="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR REGRAS FINANCEIRAS
                </button>
            </div>

            <div class="glass-panel p-6 border border-amber-500/30">
                <h2 class="text-xl font-bold text-white mb-2">🔍 Auditoria de Dados</h2>
                <p class="text-xs text-gray-400 mb-6">Detectar usuários duplicados ou coleções fantasmas.</p>
                <div id="audit-results" class="bg-black/20 p-3 rounded-lg text-[10px] text-gray-400 font-mono mb-4 min-h-[60px] whitespace-pre-wrap">
                    Aguardando varredura...
                </div>
                <button onclick="window.runDataAudit()" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded font-bold text-xs uppercase transition">
                    🚀 INICIAR VARREDURA PROFUNDA
                </button>
            </div>

            <div class="glass-panel p-6 border border-emerald-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📑 Relatórios Gerenciais</h2>
                <p class="text-xs text-gray-400 mb-6">Exporte dados para PDF.</p>
                <button onclick="window.generatePDFReport()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded font-bold text-xs uppercase flex items-center justify-center gap-2 transition">
                    📄 GERAR PDF EXECUTIVO
                </button>
            </div>

            <div class="col-span-1 md:col-span-2 glass-panel p-6 border border-red-900/50 bg-red-900/5 mt-4">
                <h2 class="text-xl font-black text-red-500 uppercase">ZONA DE PERIGO</h2>
                <p class="text-xs text-gray-500 mb-4">Limpeza irreversível de dados demonstrativos (is_demo = true).</p>
                <button onclick="window.clearDatabase()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-black text-xs uppercase transition">
                    🗑️ EXECUTAR LIMPEZA GERAL
                </button>
            </div>
        </div>
    `;
    
    lucide.createIcons();
    await loadSettings();
    console.log("✅ Módulo Settings Carregado.");
}

// ============================================================================
// 2. CARREGAMENTO E SALVAMENTO (REGRAS E AVISOS)
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
        alert("✅ Aviso Global atualizado!");
    } catch(e) { alert(e.message); }
};

window.saveBusinessRules = async () => {
    const valorBonus = parseFloat(document.getElementById('conf-bonus-valor').value) || 0;
    const bonusAtivo = document.getElementById('conf-bonus-active').checked;
    const taxa = parseFloat(document.getElementById('conf-taxa-valor').value) || 0;

    try {
        await setDoc(doc(window.db, "settings", "global"), { 
            valor_bonus_promocional: valorBonus,
            bonus_boas_vindas_ativo: bonusAtivo,
            taxa_intermediacao: taxa,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ Regras Financeiras salvas! O sistema de bônus agora segue estes valores.");
    } catch(e) { alert(e.message); }
};

// ============================================================================
// 3. AUDITORIA DE DADOS (IDENTIFICAÇÃO DE ERROS)
// ============================================================================
window.runDataAudit = async () => {
    const logArea = document.getElementById('audit-results');
    logArea.innerHTML = "🔍 Iniciando varredura profunda...";
    
    try {
        // Teste de Coleções Duplicadas
        const colProd = await getDocs(query(collection(window.db, "produtos"), limit(1)));
        let report = `• Coleção 'produtos' (PT): ${!colProd.empty ? '⚠️ POSSUI LIXO' : '✅ LIMPA'}\n`;
        
        // Busca Usuários Duplicados (Mesmo Telefone)
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

        // Verifica Documentos de Configuração
        const globalRef = await getDoc(doc(window.db, "settings", "global"));
        report += `• Configurações Globais: ${globalRef.exists() ? '✅ OK' : '❌ AUSENTE'}\n`;

        logArea.innerHTML = report;
    } catch(e) {
        logArea.innerHTML = "❌ Erro na varredura: " + e.message;
    }
};

// ============================================================================
// 4. LIMPEZA DE DADOS (ZONA DE PERIGO)
// ============================================================================
window.clearDatabase = async () => {
    const confirmacao = prompt("⚠️ PERIGO: ISSO APAGARÁ TODOS OS DADOS DE TESTE.\n\nPara confirmar, digite a palavra: DELETAR");
    if (confirmacao !== "DELETAR") return alert("❌ Ação cancelada.");

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
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                totalDeleted++;
            });
        }

        if (totalDeleted > 0) {
            await batch.commit();
            alert(`✅ SUCESSO: ${totalDeleted} registros apagados.`);
        } else {
            alert("ℹ️ Nenhum dado de teste encontrado.");
        }
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "🗑️ EXECUTAR LIMPEZA GERAL";
        btn.disabled = false;
    }
};

// ============================================================================
// 5. RELATÓRIO PDF (IMPRESSÃO)
// ============================================================================
window.generatePDFReport = async () => {
    const btn = document.querySelector('button[onclick="window.generatePDFReport()"]');
    btn.innerText = "⏳ COLETANDO...";
    
    try {
        const usersSnap = await getCountFromServer(collection(window.db, "usuarios"));
        const jobsSnap = await getCountFromServer(collection(window.db, "jobs"));
        const provSnap = await getCountFromServer(collection(window.db, "active_providers"));
        const oppsSnap = await getCountFromServer(collection(window.db, "oportunidades"));

        let totalCustodia = 0;
        const uSnap = await getDocs(collection(window.db, "usuarios"));
        uSnap.forEach(d => {
            const s = parseFloat(d.data().wallet_balance || d.data().saldo || 0);
            if(s > 0) totalCustodia += s;
        });

        const reportContent = `
            <html>
            <head>
                <title>Relatório Executivo - Atlivio</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                    .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 40px 0; }
                    .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f8fafc; }
                    .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #94a3b8; }
                </style>
            </head>
            <body>
                <h1>ATLIVIO .OS - RELATÓRIO EXECUTIVO</h1>
                <p>Data: ${new Date().toLocaleDateString()} | Emissor: Admin</p>
                <div class="card-grid">
                    <div class="card"><h3>Usuários</h3><p>${usersSnap.data().count}</p></div>
                    <div class="card"><h3>Prestadores</h3><p>${provSnap.data().count}</p></div>
                    <div class="card"><h3>Vagas</h3><p>${jobsSnap.data().count}</p></div>
                    <div class="card"><h3>Saldo em Custódia</h3><p>R$ ${totalCustodia.toFixed(2)}</p></div>
                </div>
                <div class="footer">Confidencial - Sistema Atlivio Admin v3.0</div>
                <script>window.print();</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(reportContent);
        win.document.close();
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "📄 GERAR PDF EXECUTIVO";
    }
};
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
