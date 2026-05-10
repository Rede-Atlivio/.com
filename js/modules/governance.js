import { db, auth } from '../config.js';
import { doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function verificarTermosJuridicos(uid) {
    try {
        // 1. Busca a Versão que o Admin definiu como atual
        const configSnap = await getDoc(doc(db, "configuracoes", "legal"));
        if (!configSnap.exists()) return;
        const config = configSnap.data();

        // 2. Busca o Perfil do Usuário atualizado direto do banco (sem cache)
        const userSnap = await getDoc(doc(db, "usuarios", uid));
        if (!userSnap.exists()) return;
        const user = userSnap.data();

        const versaoAdmin = String(config.versao_atual || "1.0.0").trim();
        const versaoUsuario = String(user.termo_aceito_versao || "0.0.0").trim();

        console.log(`⚖️ Governança: Admin(${versaoAdmin}) vs Usuário(${versaoUsuario})`);

        // 3. TRAVA INTELIGENTE: Só abre se a versão for diferente E o bloqueio crítico estiver ON
        // Se o bloqueio crítico for FALSE, e ele já tem a versão certa, não incomoda o usuário.
        if (config.bloqueio_critico === true) {
            if (versaoAdmin !== versaoUsuario) {
                abrirModalAceiteTermos(config);
            }
        } else if (versaoAdmin !== versaoUsuario) {
            // Se não é crítico, mas a versão mudou, também abre (Fluxo Normal)
            abrirModalAceiteTermos(config);
        }

    } catch (e) { console.warn("⚖️ Governança: Erro na verificação.", e); }
}

function abrirModalAceiteTermos(config) {
    const modal = document.getElementById('modal-termos-obrigatorio');
    if (!modal) return;

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
    btn.innerText = "⏳ SALVANDO ACEITE...";

    try {
        const userRef = doc(db, "usuarios", user.uid);
        
        await updateDoc(userRef, {
            termo_aceito_versao: verAtiva,
            termo_aceito_em: serverTimestamp(),
            terms_accepted: true,
            historico_aceites: arrayUnion({ versao: verAtiva, data: new Date().toISOString() })
        });

        // 🚀 ATUALIZAÇÃO LOCAL: Força o perfil local a saber que já aceitou
        if(window.userProfile) window.userProfile.termo_aceito_versao = verAtiva;

        document.getElementById('modal-termos-obrigatorio').classList.add('hidden');
        document.getElementById('modal-termos-obrigatorio').classList.remove('flex');
        
        console.log("✅ Termos aceitos e registrados!");
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
        btn.disabled = false;
        btn.innerText = "LI E ACEITO AS NOVAS REGRAS";
    }
};
