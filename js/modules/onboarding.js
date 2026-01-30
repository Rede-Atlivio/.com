import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function checkOnboarding(user) {
    if (!user) return;

    const db = window.db;
    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    const inpName = document.getElementById('inp-onboard-name');
    const inpPhone = document.getElementById('inp-onboard-phone');
    
    if(!modal) return; // Se não colocou o HTML, aborta silenciosamente

    try {
        // 1. Verifica no banco se já fez onboarding
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            
            // Lógica do Muro: Se já tem termos aceitos E nome, libera.
            if (data.terms_accepted && data.nome && data.nome !== "User") {
                modal.classList.add('hidden'); // Libera o acesso
                return;
            }
        }

        // 2. Se chegou aqui, precisa fazer o Onboarding
        console.log("🛡️ Iniciando Onboarding Obrigatório...");
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Garante flexbox

        // Pré-preenche se tiver dados parciais
        if(user.displayName) inpName.value = user.displayName;
        if(user.phoneNumber) inpPhone.value = user.phoneNumber;

        // 3. Listener do Formulário
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const nome = inpName.value.trim();
            const phone = inpPhone.value.trim();
            const terms = document.getElementById('chk-terms').checked;

            if (!terms) return alert("Você precisa aceitar os termos.");
            if (nome.length < 3) return alert("Digite seu nome completo.");

            const btn = document.getElementById('btn-onboard-submit');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<div class="loader w-5 h-5 border-white animate-spin"></div> SALVANDO...`;
            btn.disabled = true;

            try {
                // Salva no Banco
                await updateDoc(userRef, {
                    nome: nome,
                    nome_profissional: nome, // Replica para evitar falhas no admin
                    whatsapp: phone,
                    terms_accepted: true,
                    onboarded_at: serverTimestamp(),
                    status: 'ativo' // Garante que entra como ativo
                });

                // Atualiza perfil no Auth também (opcional mas bom)
                /* try { await updateProfile(user, { displayName: nome }); } catch(e){} */

                // Libera o usuário
                modal.classList.add('hidden');
                modal.style.display = 'none';
                
                // Recarrega a página para atualizar nomes no cabeçalho
                window.location.reload();

            } catch (error) {
                console.error("Erro onboarding:", error);
                alert("Erro ao salvar: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

    } catch (e) {
        console.warn("Erro verificação onboarding:", e);
    }
}
