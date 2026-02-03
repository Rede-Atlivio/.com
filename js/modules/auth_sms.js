// js/modules/auth_sms.js
import { auth, db } from '../config.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../app.js';

console.log("📲 Módulo SMS Iniciado");

// 1. MÁSCARA
window.mascaraTelefone = function(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 2) value = `(${value.substring(0,2)}) ${value.substring(2)}`;
    if (value.length > 7) value = `${value.substring(0,7)}-${value.substring(7)}`;
    input.value = value;
};

// 2. ENVIAR SMS
window.enviarSMSLogin = async function() {
    const phoneInput = document.getElementById('login-phone'); // ID CORRIGIDO
    const btn = document.getElementById('btn-login-send');

    if (!phoneInput || !phoneInput.value || phoneInput.value.length < 14) {
        return alert("Digite um número válido com DDD. Ex: (75) 99999-9999");
    }

    const rawPhone = phoneInput.value.replace(/\D/g, '');
    const phoneNumber = `+55${rawPhone}`;

    if(btn) { btn.innerText = "ENVIANDO..."; btn.disabled = true; }

    try {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible'
            });
        }
        
        console.log(`📨 Enviando SMS para ${phoneNumber}...`);
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        
        window.confirmationResult = confirmationResult;
        
        document.getElementById('lbl-login-phone').innerText = phoneNumber;
        document.getElementById('login-step-phone').classList.add('hidden');
        document.getElementById('login-step-code').classList.remove('hidden');

    } catch (error) {
        console.error("Erro SMS:", error);
        alert("Erro: " + error.message);
        if(window.recaptchaVerifier) window.recaptchaVerifier.clear();
    } finally {
        if(btn) { btn.innerText = "RECEBER CÓDIGO SMS 📲"; btn.disabled = false; }
    }
};

// 3. VALIDAR CÓDIGO
window.confirmarCodigoLogin = async function() {
    const code = document.getElementById('login-code').value;
    if (!code || code.length < 6) return alert("Digite o código de 6 dígitos.");

    const btn = document.getElementById('btn-login-verify');
    btn.innerText = "VALIDANDO..."; btn.disabled = true;

    try {
        const result = await window.confirmationResult.confirm(code);
        console.log("✅ Usuário logado:", result.user.uid);
        
        // Verifica se é novo
        const userRef = doc(db, "usuarios", result.user.uid);
        const snap = await getDoc(userRef);
        
        if(!snap.exists()) {
            await setDoc(userRef, {
                uid: result.user.uid,
                phone: result.user.phoneNumber,
                created_at: serverTimestamp(),
                is_provider: false,
                perfil_completo: false
            });
            
            // 🔥 Gatilho de automação para bônus inicial via Admin
            if (typeof window.concederBonusSeAtivo === 'function') {
                await window.concederBonusSeAtivo(result.user.uid);
            }
        }
        
        // O app.js vai detectar o login e redirecionar
        
    } catch (error) {
        console.error(error);
        alert("Código inválido.");
        btn.innerText = "ENTRAR AGORA 🚀"; btn.disabled = false;
    }
};
