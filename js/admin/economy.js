import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏦 MOTOR DE GOVERNANÇA ECONÔMICA ATLIVIO V2026
export async function init() {
    const container = document.getElementById('view-economy');
    if (!container) return;

    // Injeta o HTML da interface econômica
    container.innerHTML = `
        <div class="p-6 space-y-6 animate-fade">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div class="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                    <span class="text-xl">🏦</span>
                    <h3 class="text-lg font-bold text-white uppercase tracking-tighter">Banco Central & Saques</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label class="block text-[10px] font-black text-amber-500 uppercase mb-2 italic">Taxa Lucro B2B (%)</label>
                        <input type="number" id="conf-taxa-b2b" value="100" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-amber-500 transition">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-emerald-500 uppercase mb-2 italic">Spread Saque (Ex: 0.8)</label>
                        <input type="number" step="0.1" id="conf-spread-atlix" value="0.8" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-emerald-500 transition">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-blue-400 uppercase mb-2 italic">Saque Mínimo (ATLIX)</label>
                        <input type="number" id="conf-saque-minimo" value="50" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold outline-none focus:border-blue-500 transition">
                    </div>
                </div>
                <div class="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center justify-between mb-6">
                    <div>
                        <p class="text-[10px] font-black text-white uppercase">Liberar Saques PIX</p>
                        <p class="text-[8px] text-gray-500 uppercase">Se desligar, ninguém solicita saque</p>
                    </div>
                    <input type="checkbox" id="conf-status-pix" checked class="chk-custom">
                </div>

                <button onclick="window.saveEconomySettings()" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-xl shadow-2xl transition uppercase tracking-widest">
                    Atualizar Banco Central ⚡
                </button>
            </div>
        </div>
    `;

    console.log("🏦 Banco Central Atlivio: Interface Injetada.");
    await loadEconomySettings();
}

async function loadEconomySettings() {
    try {
        const dGlobal = await getDoc(doc(window.db, "settings", "global_economy"));
        if(dGlobal.exists()) {
            const data = dGlobal.data();
            
            // Sincroniza os novos campos injetados no admin.html
            // Sincroniza os novos campos com o DNA oficial do banco
            // Gil, unificamos o nome para 'taxa_lucro_b2b' para bater com o salvamento
            if(document.getElementById('conf-taxa-b2b')) document.getElementById('conf-taxa-b2b').value = data.taxa_lucro_b2b || 100;
            if(document.getElementById('conf-spread-atlix')) document.getElementById('conf-spread-atlix').value = data.spread_conversao || 0.8;
            if(document.getElementById('conf-saque-minimo')) document.getElementById('conf-saque-minimo').value = data.saque_minimo_atlix || 50;
            if(document.getElementById('conf-status-pix')) document.getElementById('conf-status-pix').checked = data.pagamentos_pix_ativos ?? true;
            if(document.getElementById('conf-validade-bonus')) document.getElementById('conf-validade-bonus').value = data.validade_bonus_meses || 6;
            
            // Mensagem Global (Herdada para manter compatibilidade)
            if(document.getElementById('conf-global-msg')) document.getElementById('conf-global-msg').value = data.global_msg || "";
        }
    } catch(e) { console.error("❌ Erro ao carregar economia:", e); }
}

// 💾 SALVAR POLÍTICA MONETÁRIA (Ação do Botão Azul no Admin)
/**
 * 🏦 SALVAMENTO EXCLUSIVO BANCO CENTRAL
 * Salva apenas as taxas e regras B2B, sem mexer nas configurações gerais.
 */
window.saveEconomySettings = async () => {
    const btn = event.target;
    btn.disabled = true;
    btn.innerText = "GRAVANDO NO BANCO...";

    try {
        const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const payload = {
            taxa_lucro_b2b: parseFloat(document.getElementById('conf-taxa-b2b').value || 100),
            spread_conversao: parseFloat(document.getElementById('conf-spread-atlix').value || 0.8),
            saque_minimo_atlix: parseInt(document.getElementById('conf-saque-minimo').value || 50),
            pagamentos_pix_ativos: document.getElementById('conf-status-pix').checked,
            updated_at: serverTimestamp()
        };

        await setDoc(doc(window.db, "settings", "global_economy"), payload, { merge: true });
        alert("✅ POLÍTICA MONETÁRIA ATUALIZADA!\nAs novas taxas já estão valendo para todos os usuários.");
        
    } catch (e) {
        console.error("Erro Economia:", e);
        alert("❌ Falha ao salvar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Atualizar Banco Central ⚡";
    }
};

console.log("🏦 [Economy Admin] Motor de Governança Soldado!");
// 🔐 EXPORTAÇÃO DE SEGURANÇA: Torna a função de salvamento visível para o botão HTML
window.saveEconomySettings = saveEconomySettings;
