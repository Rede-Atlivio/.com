import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, getCountFromServer, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================================================
// 1. INICIALIZAÇÃO DA INTERFACE
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
                <h2 class="text-xl font-bold text-white mb-2">💰 Cérebro Financeiro (Master)</h2>
                <p class="text-xs text-gray-400 mb-6">Controle as regras de bloqueio e taxas do aplicativo em tempo real.</p>
                
                <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-600 mb-4">
    <p class="text-[10px] font-black text-emerald-400 uppercase mb-3 tracking-widest">⚡ CÉREBRO FINANCEIRO (PRESTADOR VS CLIENTE)</p>
    
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 bg-black/20 p-4 rounded-xl border border-white/5">
        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Taxa Prestador</label>
            <input type="number" step="0.01" id="conf-taxa-plataforma" class="inp-editor h-11 text-white font-mono text-center bg-slate-900" placeholder="0.20">
        </div>
        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-black text-purple-400 uppercase tracking-widest">Taxa Cliente</label>
            <input type="number" step="0.01" id="conf-taxa-cliente" class="inp-editor h-11 text-white font-mono text-center bg-slate-900" placeholder="0.05">
        </div>
        <div class="flex flex-col gap-1">
            <label class="text-[9px] font-black text-red-400 uppercase tracking-widest">Limite Dívida</label>
            <input type="number" id="conf-limite-divida" class="inp-editor h-11 text-white font-mono text-center bg-slate-900" placeholder="-60.00">
        </div>
    </div>

  <div class="grid grid-cols-2 gap-4 border-t border-slate-700 pt-4">
        <div>
            <label class="text-[10px] font-bold text-blue-400 uppercase">% Reserva Aceite (Prestador)</label>
            <input type="number" id="conf-pct-reserva-prestador" class="inp-editor h-10 text-white font-mono" placeholder="10">
        </div>
        <div>
            <label class="text-[10px] font-bold text-purple-400 uppercase">% Reserva Acordo (Cliente)</label>
            <input type="number" id="conf-pct-reserva-cliente" class="inp-editor h-10 text-white font-mono" placeholder="10">
        </div>
    </div>

   <div class="mt-4 p-3 bg-black/30 rounded-lg border border-white/5 flex items-center justify-between">
        <div>
            <p class="text-[10px] font-black text-white uppercase">Modo de Liquidação</p>
            <p class="text-[8px] text-gray-400 uppercase">Ativado: Completa valor total | Desativado: Só libera reserva</p>
        </div>
        <input type="checkbox" id="conf-completar-pagamento" class="chk-custom" onchange="window.validarAtivacaoLiquidacao(this)">
    </div>
</div>
                <div class="mt-2 border-t border-slate-700 pt-4">
    <p class="text-[9px] text-blue-400 font-bold mb-2 uppercase">Parâmetros Operacionais (App)</p>
    <div class="grid grid-cols-2 gap-4 mb-4">
        <div><label class="text-[9px] text-gray-500 uppercase">Valor Mín. Pedido</label><input type="number" id="conf-val-min" class="inp-editor h-8 text-white" placeholder="20.00"></div>
        <div><label class="text-[9px] text-gray-500 uppercase">Valor Máx. Pedido</label><input type="number" id="conf-val-max" class="inp-editor h-8 text-white" placeholder="500.00"></div>
    </div>
</div>

                <button onclick="window.saveBusinessRules()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-lg transition">
                    💾 SALVAR NOVAS REGRAS
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
    
    if(window.lucide) lucide.createIcons();
    await loadSettings();
}

// ============================================================================
// 2. LÓGICA DE CARREGAMENTO (LOAD) - V11.0 UNIFICADA
// ============================================================================
async function loadSettings() {
    try {
        const db = window.db;

        // 1. Carrega Aviso Global
        const dGlobal = await getDoc(doc(db, "configuracoes", "global"));
        if(dGlobal.exists()) {
            const data = dGlobal.data();
            document.getElementById('conf-global-msg').value = data.top_message || "";
            document.getElementById('conf-msg-active').checked = data.show_msg || false;
        }

        // 2. 🔥 Carrega Cérebro Financeiro (Lê o Novo e busca fallback no Legado)
        const dFin = await getDoc(doc(db, "settings", "financeiro"));
        const dLegado = await getDoc(doc(db, "configuracoes", "financeiro"));
        
        const data = dFin.exists() ? dFin.data() : {};
        const legado = dLegado.exists() ? dLegado.data() : {};

       // Sincroniza a Interface com os dados REAIS do Banco
        document.getElementById('conf-taxa-plataforma').value = data.taxa_plataforma ?? 0.20;
        document.getElementById('conf-taxa-cliente').value = data.taxa_cliente ?? 0.05;
        document.getElementById('conf-limite-divida').value = data.limite_divida ?? -60.00;
        
        // Ponto 3 e 4: Mapeia as porcentagens específicas e Modo de Liquidação
        document.getElementById('conf-pct-reserva-prestador').value = data.porcentagem_reserva ?? legado.porcentagem_reserva ?? 20;
        document.getElementById('conf-pct-reserva-cliente').value = data.porcentagem_reserva_cliente ?? 10;
        document.getElementById('conf-completar-pagamento').checked = data.completar_valor_total ?? true;

        // 3. Parâmetros Operacionais (Lê do Master com Fallback no Legado)
        document.getElementById('conf-val-min').value = data.valor_minimo ?? legado.valor_minimo ?? 20;
        document.getElementById('conf-val-max').value = data.valor_maximo ?? legado.valor_maximo ?? 500;

    } catch(e) { console.error("Erro ao carregar settings", e); }
}

// ============================================================================
// 3. FUNÇÕES DOS BOTÕES (RESTAURADAS E BLINDADAS)
// ============================================================================

// 💾 SALVAR AVISO GLOBAL
window.saveAppSettings = async () => {
    const msg = document.getElementById('conf-global-msg').value;
    const active = document.getElementById('conf-msg-active').checked;
    
    const btn = document.querySelector('button[onclick="window.saveAppSettings()"]');
    const txtOriginal = btn.innerText;
    btn.innerText = "⏳ SALVANDO..."; btn.disabled = true;

    try {
        await setDoc(doc(window.db, "configuracoes", "global"), {
            top_message: msg,
            show_msg: active,
            updated_at: new Date()
        }, {merge:true});
        alert("✅ Aviso Global atualizado com sucesso!");
    } catch(e) { alert("❌ Erro ao salvar aviso: " + e.message); }
    finally { btn.innerText = txtOriginal; btn.disabled = false; }
};

// 💾 SALVAR REGRAS FINANCEIRAS (MASTER V12.0 - ANTI-ERRO 400)
//Agora, garantimos que quando você clicar em "Salvar", a taxa do cliente também vá para o Firebase.
window.saveBusinessRules = async () => {
    const rawTaxaP = document.getElementById('conf-taxa-plataforma')?.value || "0";
    const rawTaxaC = document.getElementById('conf-taxa-cliente')?.value || "0";
    const rawLimite = document.getElementById('conf-limite-divida')?.value || "0";
    const rawPctPres = document.getElementById('conf-pct-reserva-prestador')?.value || "0";
    const rawPctCli = document.getElementById('conf-pct-reserva-cliente')?.value || "0";
    const rawValMin = document.getElementById('conf-val-min')?.value || "20";
    const rawValMax = document.getElementById('conf-val-max')?.value || "500";

    // 🛡️ BLINDAGEM DECIMAL: Transforma 20 em 0.20 e 5 em 0.05
    let taxaP = parseFloat(String(rawTaxaP).replace(',', '.'));
    if (taxaP > 1) taxaP = taxaP / 100;

    let taxaC = parseFloat(String(rawTaxaC).replace(',', '.'));
    if (taxaC > 1) taxaC = taxaC / 100;

    const payloadMaster = { 
        taxa_plataforma: Number(taxaP),
        taxa_cliente: Number(taxaC),
        limite_divida: Number(rawLimite),
        porcentagem_reserva: Number(rawPctPres),
        porcentagem_reserva_cliente: Number(rawPctCli),
        valor_minimo: Number(rawValMin),
        valor_maximo: Number(rawValMax),
        completar_valor_total: document.getElementById('conf-completar-pagamento').checked,
        updated_at: new Date(),
        modificado_por: "admin"
    };
    
    try {
        // GRAVAÇÃO UNIFICADA (Apenas na Coleção Master)
        await setDoc(doc(window.db, "settings", "financeiro"), payloadMaster, { merge: true });
        
        // Sincroniza o legado (usando a variável correta taxaP)
        await setDoc(doc(window.db, "configuracoes", "financeiro"), {
            porcentagem_reserva: Number(rawPctPres),
            taxa_prestador: Number(taxaP * 100),
            valor_minimo: Number(rawValMin),
            valor_maximo: Number(rawValMax),
            updated_at: new Date()
        }, { merge: true });

        alert("✅ REGRAS UNIFICADAS! Taxa Prestador: " + (taxaP * 100) + "% | Cliente: " + (taxaC * 100) + "%");
    } catch(e) { alert("Erro: " + e.message); }
};

// 🚀 AUDITORIA DE DADOS
window.runDataAudit = async () => {
    const res = document.getElementById('audit-results');
    res.innerHTML = "⏳ Varrendo coleções... Aguarde.";
    
    try {
        const db = window.db;
        const colUsers = collection(db, "usuarios");
        const colOrders = collection(db, "orders");
        
        const snapUsers = await getCountFromServer(colUsers);
        const snapOrders = await getCountFromServer(colOrders);
        
        res.innerHTML = `✅ VARREDURA COMPLETA\n\n`;
        res.innerHTML += `👤 Usuários Totais: ${snapUsers.data().count}\n`;
        res.innerHTML += `📦 Pedidos Totais: ${snapOrders.data().count}\n`;
        res.innerHTML += `📅 Data: ${new Date().toLocaleString()}`;
        
    } catch(e) {
        res.innerHTML = "❌ Erro na varredura: " + e.message;
    }
};

// 📄 GERAR RELATÓRIO (Stub Simples)
window.generatePDFReport = () => {
    // Como não temos biblioteca de PDF pesada, usamos o Print do navegador
    // que permite salvar como PDF. É mais rápido e leve.
    window.print(); 
};

// 🗑️ LIMPAR DADOS (DANGER)
window.clearDatabase = async () => {
    if(!confirm("⚠️ PERIGO EXTREMO!\n\nIsso apagará pedidos de teste e logs.\nDeseja continuar?")) return;
    
    alert("Função de limpeza profunda desativada por segurança neste momento.\nUse a lixeira individual.");
};
// 🔐 TRAVA DE SEGURANÇA PARA MODO DE LIQUIDAÇÃO
window.validarAtivacaoLiquidacao = (el) => {
    if (el.checked) {
        const confirmacao = prompt("⚠️ AVISO CRÍTICO:\nAtivar este modo obriga a plataforma a completar o pagamento integral ao prestador, mesmo que o cliente não tenha saldo.\n\nPara confirmar, digite exatamente:\nATIVAR MODO LIQUIDAÇÃO");
        
        if (confirmacao !== "ATIVAR MODO LIQUIDAÇÃO") {
            alert("❌ Confirmação inválida. Operação cancelada.");
            el.checked = false;
        } else {
            alert("✅ Modo de Liquidação Integral validado. Não esqueça de SALVAR as regras.");
        }
    }
};
