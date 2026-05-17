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

               // 🔥 SOLDA DE SEGURANÇA V2026: setDoc com merge garante a criação forçada das estruturas vitais
                await setDoc(userRef, {
                    uid: user.uid, // Registra o ID único do passaporte do usuário
                    displayName: nome, 
                    nome: nome,
                    nome_profissional: nome, 
                    whatsapp: phone,
                    telefone: phone,
                    terms_accepted: true,
                    onboarding_completed: true, // Garante a liberação permanente do Onboarding
                    onboarded_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    status: 'ativo',
                    perfil_completo: true,
                    role: 'user', // Perfil padrão inicial do ecossistema

                    // 🛰️ INFRAESTRUTURA DE NOTIFICAÇÃO (Push Admin)
                    fcm_token: window.last_fcm_token || sessionStorage.getItem('atlivio_fcm') || "",

                    // 📊 LEDGER & BEHAVIOR: Sincroniza os históricos e contadores de auditoria para o Admin
                    ledger: {
                        registros: [],
                        total_acoes: 0
                    },
                    behavior: {
                        home: { visitas: 1 },
                        cadastro_origem: "onboarding"
                    },

                    // 💰 INFRAESTRUTURA FINANCEIRA DE ESCALA (Evita iniciar como nulo)
                    wallet_balance: 0,
                    wallet_bonus: 0,
                    wallet_reserved: 0,
                    wallet_earnings: 0
                }, { merge: true }); // O Merge protege dados pré-existentes de links de indicação externos

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
