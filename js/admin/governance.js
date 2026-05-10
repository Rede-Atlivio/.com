import { db } from '../config.js'; 
// 💡 Um ponto (.) é a pasta atual (admin), dois pontos (..) volta para a pasta pai (js).
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-governance');
    if (!container) return;

    // 🎨 Desenha a interface de Gestão Jurídica
    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 animate-fade">
            <div class="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <div>
                    <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">⚖️ Governança e Leis</h2>
                    <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Controle de Termos, Privacidade e Compliance</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-gray-500 uppercase font-black mb-1">Versão Ativa</p>
                    <input type="text" id="gov-version" class="bg-slate-950 border border-slate-700 text-white font-black text-center py-1 px-3 rounded-lg w-24 focus:border-emerald-500 outline-none" placeholder="1.0.0">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest">📜 Termos de Uso</p>
                    <textarea id="gov-terms" rows="15" class="w-full bg-slate-950 border border-slate-700 text-gray-300 p-4 rounded-xl text-xs leading-relaxed focus:border-blue-500 outline-none custom-scrollbar" placeholder="Cole aqui os termos de uso..."></textarea>
                </div>

                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <p class="text-[10px] font-black text-purple-400 uppercase tracking-widest">🔐 Política de Privacidade</p>
                    <textarea id="gov-privacy" rows="15" class="w-full bg-slate-950 border border-slate-700 text-gray-300 p-4 rounded-xl text-xs leading-relaxed focus:border-purple-500 outline-none custom-scrollbar" placeholder="Cole aqui a política de privacidade..."></textarea>
                </div>
            </div>

            <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <input type="checkbox" id="gov-critical" class="chk-custom">
                    <label for="gov-critical" class="text-[10px] font-black text-red-500 uppercase cursor-pointer">Forçar Re-aceite de todos (Bloqueio Crítico)</label>
                </div>
                <button onclick="window.publicarNovasRegras()" id="btn-publish-gov" class="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-lg transition transform active:scale-95 flex items-center gap-2">
                    🚀 PUBLICAR E ATUALIZAR USUÁRIOS
                </button>
            </div>
        </div>
    `;

    carregarDadosGovernança();
}

async function carregarDadosGovernança() {
    try {
        const docSnap = await getDoc(doc(db, "configuracoes", "legal"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('gov-version').value = data.versao_atual || "1.0.0";
            document.getElementById('gov-terms').value = data.termos_uso_texto || "";
            document.getElementById('gov-privacy').value = data.politica_privacidade_texto || "";
            document.getElementById('gov-critical').checked = data.bloqueio_critico || false;
        }
    } catch (e) { console.error("Erro ao carregar governança:", e); }
}

window.publicarNovasRegras = async () => {
    const ver = document.getElementById('gov-version').value.trim();
    const termos = document.getElementById('gov-terms').value;
    const privacidade = document.getElementById('gov-privacy').value;
    const critico = document.getElementById('gov-critical').checked;

    if (!ver || !termos) return alert("Preencha a versão e os termos!");
    if (!confirm(`⚠️ ATENÇÃO: Deseja publicar a versão ${ver}?\n\nUsuários com versões antigas serão bloqueados até aceitarem as novas regras.`)) return;

    const btn = document.getElementById('btn-publish-gov');
    btn.disabled = true; btn.innerText = "⏳ PUBLICANDO...";

    try {
        const payload = {
            versao_atual: ver,
            termos_uso_texto: termos,
            politica_privacidade_texto: privacidade,
            bloqueio_critico: critico,
            data_publicacao: serverTimestamp(),
            ultima_alteracao_por: window.auth.currentUser.uid
        };

        // 1. Atualiza o Documento Mestre
        await setDoc(doc(db, "configuracoes", "legal"), payload, { merge: true });

        // 2. Gera Histórico Imutável
        const historicoId = `v_${ver.replace(/\./g, '_')}`;
        await setDoc(doc(db, "legal_history", historicoId), {
            ...payload,
            timestamp_arquivo: serverTimestamp()
        });

        alert("✅ REGRAS PUBLICADAS!\nO sistema de escala agora está sincronizado.");
    } catch (e) {
        alert("Erro ao publicar: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "🚀 PUBLICAR E ATUALIZAR USUÁRIOS";
    }
};
