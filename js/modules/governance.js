import { db, auth } from '../config.js';
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function verificarTermosJuridicos(uid) {
    try {
        // 1. Busca a Versão que o Admin definiu como atual
        const configSnap = await getDoc(doc(db, "configuracoes", "legal"));
        if (!configSnap.exists()) return;
        const config = configSnap.data();

        // 2. Busca o Perfil do Usuário
        const userSnap = await getDoc(doc(db, "usuarios", uid));
        const user = userSnap.data();

        const versaoAdmin = config.versao_atual;
        const versaoUsuario = user.termo_aceito_versao || "0.0.0";

        // 3. COMPARADOR DE ESCALA: Se a versão for diferente OU bloqueio crítico ativo
        if (versaoAdmin !== versaoUsuario || config.bloqueio_critico) {
            abrirModalAceiteTermos(config);
        }
    } catch (e) { console.warn("⚖️ Governança: Aguardando estabilidade...", e); }
}

function abrirModalAceiteTermos(config) {
    const modal = document.getElementById('modal-termos-obrigatorio');
    if (!modal) return;

    // Injeta os textos do Admin no Modal
    document.getElementById('texto-termos-uso').innerText = config.termos_uso_texto;
    document.getElementById('texto-politica-privacidade').innerText = config.politica_privacidade_texto;
    document.getElementById('display-versao-termo').innerText = config.versao_atual;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.aceitarNovosTermos = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-aceitar-termos');
    const verAtiva = document.getElementById('display-versao-termo').innerText;
    
    btn.disabled = true;
    btn.innerText = "⏳ PROCESSANDO...";

    try {
        const userRef = doc(db, "usuarios", user.uid);
        
        // Atualiza os campos que o robô mapeou + os novos de controle
        await updateDoc(userRef, {
            terms_accepted: true, // Mantém compatibilidade com seu campo antigo
            termo_aceito_versao: verAtiva,
            termo_aceito_em: serverTimestamp(),
            historico_aceites: arrayUnion({ versao: verAtiva, data: new Date() })
        });

        document.getElementById('modal-termos-obrigatorio').classList.add('hidden');
        console.log("✅ Termos aceitos com sucesso!");
    } catch (e) {
        alert("Erro ao salvar aceite: " + e.message);
        btn.disabled = false;
        btn.innerText = "LI E ACEITO OS TERMOS";
    }
};
