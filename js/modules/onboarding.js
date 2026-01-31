import { db, auth } from '../app.js';
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export async function checkOnboarding(user) {
    if (!user) return;

    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    const inpName = document.getElementById('inp-onboard-name');
    const inpPhone = document.getElementById('inp-onboard-phone');
    
    if(!modal) return; 

    try {
        // 1. Verifica no banco se já fez onboarding
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            // Lógica do Muro: Se já tem termos aceitos E nome, libera.
            if (data.terms_accepted && data.nome && data.nome !== "User") {
                modal.classList.add('hidden');
                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
                return;
            }
        }

        // 2. Se chegou aqui, precisa fazer o Onboarding
        console.log("🛡️ Iniciando Onboarding Obrigatório...");
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; 

        // Pré-preenche se tiver dados
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
            btn.innerHTML = `SALVANDO...`;
            btn.disabled = true;

            try {
                // 🔥 PASSO CRUCIAL: Atualiza o nome no AUTH do Firebase
                // Isso garante que auth.currentUser.displayName não seja null
                await updateProfile(user, { displayName: nome });

                // Salva no Banco de Dados
                await updateDoc(userRef, {
                    displayName: nome, // Importante para o chat e vagas
                    nome: nome,
                    nome_profissional: nome, 
                    whatsapp: phone,
                    terms_accepted: true,
                    onboarded_at: serverTimestamp(),
                    status: 'ativo',
                    perfil_completo: true // Marca como completo
                });

                // Libera o usuário
                modal.classList.add('hidden');
                modal.style.display = 'none';
                
                // Redireciona para seleção de perfil ou app
                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('role-selection').classList.remove('hidden');

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
