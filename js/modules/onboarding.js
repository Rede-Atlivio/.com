import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ATENÇÃO: Se este arquivo for importado no index.html, deve ter type="module"

export async function checkOnboarding(user) {
    if (!user) return;

    // Acesso ao DB Global (Garante que app.js já rodou)
    const db = window.db; 
    if (!db) {
        console.warn("⚠️ Banco de dados não inicializado. Tentando novamente...");
        setTimeout(() => checkOnboarding(user), 500);
        return;
    }

    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    
    // BLINDAGEM CONTRA NULL POINTER (O erro que travava tudo)
    if(!modal || !form) {
        console.warn("⚠️ HTML de Onboarding não encontrado. Pulando verificação.");
        return; 
    }

    const inpName = document.getElementById('inp-onboard-name');
    const inpPhone = document.getElementById('inp-onboard-phone');

    try {
        // 1. Verifica no banco se já fez onboarding
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            // Lógica do Muro: Se já tem termos aceitos E nome real, libera.
            if (data.terms_accepted && data.nome && data.nome !== "User") {
                modal.classList.add('hidden'); 
                modal.style.display = 'none';
                return;
            }
        }

        // 2. Se chegou aqui, precisa fazer o Onboarding
        console.log("🛡️ Iniciando Onboarding Obrigatório...");
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; 

        // Pré-preenche se tiver dados parciais do Google Auth
        if(user.displayName && inpName && !inpName.value) inpName.value = user.displayName;
        if(user.phoneNumber && inpPhone && !inpPhone.value) inpPhone.value = user.phoneNumber;

        // 3. Listener do Formulário (Agora seguro)
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const nome = inpName.value.trim();
            const phone = inpPhone.value.trim();
            const chkTerms = document.getElementById('chk-terms');
            const terms = chkTerms ? chkTerms.checked : false;

            if (!terms) return alert("Você precisa aceitar os termos.");
            if (nome.length < 3) return alert("Digite seu nome completo.");

            const btn = document.getElementById('btn-onboard-submit');
            const originalText = btn.innerHTML;
            btn.innerHTML = `SALVANDO...`;
            btn.disabled = true;

            try {
                // Salva no Banco
                await updateDoc(userRef, {
                    nome: nome,
                    nome_profissional: nome, 
                    whatsapp: phone,
                    terms_accepted: true,
                    onboarded_at: serverTimestamp(),
                    status: 'ativo'
                });

                // Libera o usuário
                modal.classList.add('hidden');
                modal.style.display = 'none';
                
                // Recarrega para aplicar mudanças visuais
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
