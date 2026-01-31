import { auth } from '../app.js';
import { RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../app.js';

console.log("📲 Módulo SMS Iniciado");

// 1. MÁSCARA DE TELEFONE (Resolve o erro 'mascaraTelefone is not defined')
window.mascaraTelefone = function(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11); // Limita tamanho
    
    // Formata (XX) XXXXX-XXXX
    if (value.length > 2) value = `(${value.substring(0,2)}) ${value.substring(2)}`;
    if (value.length > 9) value = `${value.substring(0,9)}-${value.substring(9)}`;
    
    input.value = value;
};

// 2. CONFIGURA RECAPTCHA
function setupRecaptcha() {
    if (!window.recaptchaVerifier) {
        // Cria container invisível se não existir
        if(!document.getElementById('recaptcha-container')) {
            const div = document.createElement('div');
            div.id = 'recaptcha-container';
            document.body.appendChild(div);
        }

        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': () => console.log("✅ Recaptcha Validado!")
        });
    }
}

// 3. ENVIAR SMS (Resolve o erro 'enviarSMSLogin is not a function')
window.enviarSMSLogin = async function() {
    const phoneInput = document.getElementById('phone-input'); // VERIFIQUE SE O ID É ESSE NO HTML
    const btn = document.querySelector('button[onclick="window.enviarSMSLogin()"]');

    if (!phoneInput || !phoneInput.value || phoneInput.value.length < 14) {
        return alert("Digite um número válido com DDD. Ex: (11) 99999-9999");
    }

    // Formata para +55...
    const rawPhone = phoneInput.value.replace(/\D/g, '');
    const phoneNumber = `+55${rawPhone}`;

    if(btn) { btn.innerText = "ENVIANDO..."; btn.disabled = true; }

    try {
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        
        console.log(`📨 Enviando SMS para ${phoneNumber}...`);
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        
        window.confirmationResult = confirmationResult;
        alert("✅ Código enviado! Verifique seu celular.");

        // Esconde input telefone, mostra input código (AJUSTE OS IDS SE NECESSÁRIO)
        const stepPhone = document.getElementById('step-phone-login'); // Div do telefone
        const stepCode = document.getElementById('step-code-login');   // Div do código
        
        if(stepPhone && stepCode) {
            stepPhone.classList.add('hidden');
            stepCode.classList.remove('hidden');
        } else {
            // Fallback se não tiver divs separadas
            const codigo = prompt("Digite o código SMS recebido:");
            if(codigo) window.validarCodigoSMS(codigo);
        }

    } catch (error) {
        console.error("Erro SMS:", error);
        alert("Erro ao enviar SMS: " + error.message);
        if(window.recaptchaVerifier) window.recaptchaVerifier.clear(); // Limpa recaptcha para tentar de novo
    } finally {
        if(btn) { btn.innerText = "RECEBER CÓDIGO"; btn.disabled = false; }
    }
};

// 4. VALIDAR CÓDIGO
window.validarCodigoSMS = async function(codigoDigitado = null) {
    let code = codigoDigitado;
    
    // Se não veio por parâmetro, tenta pegar do input
    if(!code) {
        const input = document.getElementById('otp-input');
        if(input) code = input.value;
    }

    if (!code) return alert("Digite o código de 6 dígitos.");

    try {
        const result = await window.confirmationResult.confirm(code);
        console.log("✅ Usuário logado:", result.user.uid);
        
        // Verifica/Cria Perfil Básico se não existir
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
        }
        
        alert("Login realizado com sucesso!");
        // O app.js (onAuthStateChanged) vai fazer o resto (redirecionar/esconder login)
        
    } catch (error) {
        console.error(error);
        alert("Código inválido.");
    }
};
