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
                <input type="text" id="conf-global-msg" class="inp-editor h-10 text-white mb-4" placeholder="Ex: Manutenção programada...">
                
                <div class="flex items-center gap-2 mb-6">
                    <input type="checkbox" id="conf-msg-active" class="chk-custom">
                    <label for="conf-msg-active" class="text-xs text-gray-300 cursor-pointer">Mostrar Aviso?</label>
                </div>

                <button onclick="window.saveAppSettings()" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR AVISO GLOBAL
                </button>
            </div>

            <div class="glass-panel p-6 border border-emerald-500/30">
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

                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Taxa Reserva (%)</label>
                        <input type="number" id="conf-taxa-reserva" class="inp-editor h-10 text-white" placeholder="10">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-gray-500 uppercase">Bônus Entrada (R$)</label>
                        <input type="number" id="conf-bonus-valor" class="inp-editor h-10 text-white" placeholder="20.00">
                    </div>
                </div>

                <button onclick="window.saveBusinessRules()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 ATUALIZAR REGRAS FINANCEIRAS
                </button>
            </div>

            <div class="glass-panel p-6 border border-amber-500/30">
                <h2 class="text-xl font-bold text-white mb-2">🔍 Auditoria de Dados</h2>
                <div id="audit-results" class="bg-black/40 p-4 rounded-xl text-[10px] text-gray-300 font-mono mb-4 min-h-[80px] border border-white/5 whitespace-pre-wrap">Aguardando varredura...</div>
                <button onclick="window.runDataAudit()" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold text-xs uppercase transition">🚀 INICIAR VARREDURA</button>
            </div>

            <div class="glass-panel p-6 border border-slate-500/30">
                <h2 class="text-xl font-bold text-white mb-2">📑 Relatórios</h2>
                <button onclick="window.generatePDFReport()" class="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold text-xs uppercase">📄 GERAR PDF EXECUTIVO</button>
            </div>

            <div class="col-span-1 md:col-span-2 glass-panel p-8 border border-red-900/50 bg-red-900/5 mt-4">
                <h2 class="text-xl font-black text-red-500 uppercase mb-4">⚠️ ZONA DE PERIGO</h2>
                <button onclick="window.clearDatabase()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-black text-xs uppercase shadow-lg">🗑️ LIMPAR DADOS DEMO</button>
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
        // 1. Carrega Aviso Global
        const dGlobal = await getDoc(doc(window.db, "settings", "global"));
        if(dGlobal.exists()) {
            const data = dGlobal.data();
            document.getElementById('conf-global-msg').value = data.top_message || "";
            document.getElementById('conf-msg-active').checked = data.is_active || false;
        }

        // 2. Carrega Regras Financeiras
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

window.saveAppSettings = async () => {
    const msg = document.getElementById('conf-global-msg').value;
    const active = document.getElementById('conf-msg-active').checked;
    try {
        await setDoc(doc(window.db, "settings", "global"), { 
            top_message: msg,
            is_active: active,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ Aviso global atualizado!");
    } catch(e) { alert("Erro: " + e.message); }
};

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

// ... (Manter funções de Auditoria, Limpeza e PDF iguais abaixo)
