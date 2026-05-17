// js/modules/onboarding.js
// 1. IMPORTAÇÃO DO NOVO CHAVEIRO (ESSENCIAL)
import { db, auth } from '../config.js'; 

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export async function checkOnboarding(user) {
    if (!user) return;

    const modal = document.getElementById('modal-onboarding');
    const form = document.getElementById('form-onboarding');
    const inpName = document.getElementById('inp-onboard-name');
    const inpPhone = document.getElementById('inp-onboard-phone');
    
    if(!modal) return; 

    try {
        const userRef = doc(db, "usuarios", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            // Se já tem cadastro, libera
            if (data.onboarding_completed && data.nome && data.nome !== "User") {
                modal.classList.add('hidden');
                // Se já completou, apenas garante que o container principal apareça
                const appMain = document.getElementById('app-container');
                if(appMain) appMain.classList.remove('hidden');
                return;
            }
        }

        // Mostra Onboarding
        console.log("🛡️ Iniciando Onboarding...");
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; 

        if(user.displayName) inpName.value = user.displayName;
        if(user.phoneNumber) inpPhone.value = user.phoneNumber;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const nome = inpName.value.trim();
            const phone = inpPhone.value.trim();
            const terms = document.getElementById('chk-terms').checked;

            if (!terms) return alert("Aceite os termos.");
            if (nome.length < 3) return alert("Nome inválido.");

            const btn = document.getElementById('btn-onboard-submit');
            btn.innerHTML = `SALVANDO...`; btn.disabled = true;

            try {
                // 🔥 GRAVA O NOME NO AUTH
                await updateProfile(user, { displayName: nome });

                // GRAVA NO BANCO
                await updateDoc(userRef, {
                    displayName: nome, 
                    nome: nome,
                    nome_profissional: nome, 
                    whatsapp: phone,
                    terms_accepted: true,
                    onboarded_at: serverTimestamp(),
                    status: 'ativo',
                    perfil_completo: true
                });

               modal.classList.add('hidden');
                console.log("✅ Onboarding concluído. Liberando Maestro...");
                
                // Em vez de procurar o role-selection, nós apenas recarregamos
                // O app.js vai abrir direto na HOME e o Maestro fará o resto.
                setTimeout(() => window.location.reload(), 300);

            } catch (error) {
                console.error(error);
                alert("Erro: " + error.message);
                btn.innerHTML = "ENTRAR"; btn.disabled = false;
            }
        };
    } catch (e) { console.warn(e); }
}
