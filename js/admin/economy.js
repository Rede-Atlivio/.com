import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🏦 MOTOR DE GOVERNANÇA ECONÔMICA ATLIVIO V2026
export async function init() {
    console.log("🏦 Banco Central Atlivio: Iniciando Política Monetária...");
    await loadEconomySettings();
}

async function loadEconomySettings() {
    try {
        const dGlobal = await getDoc(doc(window.db, "settings", "global_economy"));
        if(dGlobal.exists()) {
            const data = dGlobal.data();
            
            // Sincroniza os novos campos injetados no admin.html
            if(document.getElementById('conf-taxa-b2b')) document.getElementById('conf-taxa-b2b').value = data.taxa_b2b_atlivio || 100;
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
window.saveSettings = async () => {
    const btn = event.currentTarget;
    const txtOriginal = btn.innerText;
    btn.innerText = "⏳ ATUALIZANDO BANCO..."; btn.disabled = true;

    try {
        // Captura de dados da nova interface
        const taxaB2B = document.getElementById('conf-taxa-b2b').value;
        const spreadAtlix = document.getElementById('conf-spread-atlix').value;
        const saqueMin = document.getElementById('conf-saque-minimo').value;
        const statusPix = document.getElementById('conf-status-pix').checked;
        const valBonus = document.getElementById('conf-validade-bonus').value;
        const msgGlobal = document.getElementById('conf-global-msg').value;

        const payload = {
            taxa_b2b_atlivio: Number(taxaB2B),
            spread_conversao: Number(spreadAtlix),
            saque_minimo_atlix: Number(saqueMin),
            pagamentos_pix_ativos: statusPix,
            validade_bonus_meses: Number(valBonus),
            global_msg: msgGlobal,
            updated_at: serverTimestamp(),
            last_change_by: "Admin Atlivio"
        };

        // Gravação na nova coleção master de economia
        await setDoc(doc(window.db, "settings", "global_economy"), payload, { merge: true });

        alert("✅ POLÍTICA MONETÁRIA ATUALIZADA!\n\nLucro B2B, Spread de Saque e Regras de Segurança estão em vigor.");
        
    } catch(e) {
        alert("❌ Erro ao salvar economia: " + e.message);
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
};

console.log("🏦 [Economy Admin] Motor de Governança Soldado!");
