import { auth, db, provider } from './app.js';
import { onAuthStateChanged, updateProfile, RecaptchaVerifier, signInWithPhoneNumber, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAILS = ["contatogilborges@gmail.com"]; 
const DEFAULT_TENANT = "atlivio_fsa_01";

export let userProfile = null; 
window.userProfile = null;

// ============================================================================
// 1. SISTEMA DE TERMOS E POLÍTICA
// ============================================================================
window.openTerms = (tipo) => {
    const modal = document.getElementById('modal-terms');
    const titulo = document.getElementById('term-title');
    const conteudo = document.getElementById('term-content');
    
    if(!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex'; 

    if (tipo === 'termos') {
        titulo.innerText = "Termos de Uso";
        conteudo.innerHTML = `
            <p class="font-bold">1. Aceite</p><p>Ao usar o Atlivio, você concorda em agir com honestidade.</p>
            <p class="font-bold mt-2">2. Serviços</p><p>Não nos responsabilizamos pela execução do serviço.</p>
            <p class="font-bold mt-2">3. Pagamentos</p><p>O uso da plataforma é gratuito para solicitar.</p>
        `;
    } else {
        titulo.innerText = "Política de Privacidade";
        conteudo.innerHTML = `<p>Seus dados (Telefone e Nome) são usados apenas para identificação. Não vendemos seus dados.</p>`;
    }
};

// ============================================================================
// 2. LÓGICA DE CADASTRO (Função que estava faltando)
// ============================================================================
window.finalizarCadastro = async () => {
    const btn = document.getElementById('btn-onboard-submit');
    const checkbox = document.getElementById('chk-terms');
    const nomeInput = document.getElementById('inp-onboard-name');
    const phoneInput = document.getElementById('inp-onboard-phone');

    // Anti-Sabotagem
    if (!btn || !checkbox || !nomeInput) {
        return alert("Erro crítico: Formulário incompleto. Recarregue a página.");
    }

    // Anti-Metralhadora
    if (btn.disabled) return;
    
    const nome = nomeInput.value.trim();
    const phone = phoneInput ? phoneInput.value.trim() : "";

    // Validação de Termos
    if (!checkbox.checked) {
        return alert("⚠️ Você precisa aceitar os Termos de Uso para continuar.");
    }

    if (nome.length < 3) {
        return alert("⚠️ Digite seu nome completo.");
    }
    
    // Verificação de Sessão
    if(!auth.currentUser) {
        return alert("⚠️ Sessão perdida. Por favor, faça login novamente.");
    }

    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nome_real: nome,
            displayName: nome,
            whatsapp: phone,
            termos_aceitos: true,
            perfil_completo: true,
            onboarded_at: serverTimestamp(),
            status: 'ativo'
        });
        
        await updateProfile(auth.currentUser, { displayName: nome });
        
        // O onAuthStateChanged fará o resto
        console.log("Cadastro salvo com sucesso!");
        
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
        btn.innerText = "TENTAR NOVAMENTE";
        btn.disabled = false;
    }
};

// ============================================================================
// 3. LOGIN SMS
// ============================================================================
const setupRecaptcha = () => {
    if(window.recaptchaVerifier) window.recaptchaVerifier.clear();
    const container = document.getElementById('recaptcha-container');
    if(container) container.innerHTML = ''; 

    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => console.log("ReCaptcha OK")
    });
};

window.enviarSMSLogin = async (origem) => {
    let telefoneInput;
    if (origem === 'cadastro') {
        telefoneInput = document.getElementById('inp-onboard-phone');
        const nome = document.getElementById('inp-onboard-name').value;
        if(nome.length < 3) return alert("Digite seu nome antes.");
        localStorage.setItem("temp_user_name", nome);
    } else {
        telefoneInput = document.getElementById('login-phone');
    }

    let rawPhone = telefoneInput.value.replace(/\D/g, ''); 
    if(rawPhone.length < 10) return alert("Digite o número com DDD.");
    const finalPhone = '+55' + rawPhone;
    
    const btnId = origem === 'cadastro' ? 'btn-onboard-submit' : 'btn-login-send';
    const btn = document.getElementById(btnId) || document.getElementById('btn-login-send');
    
    if(btn) { btn.disabled = true; btn.innerText = "ENVIANDO..."; }

    try {
        setupRecaptcha();
        const confirmationResult = await signInWithPhoneNumber(auth, finalPhone, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult; 
        
        document.getElementById('lbl-login-phone').innerText = finalPhone;
        document.getElementById('login-step-phone').classList.add('hidden');
        document.getElementById('login-step-code').classList.remove('hidden');

    } catch (error) {
        console.error("Erro SMS:", error);
        if(btn) { btn.disabled = false; btn.innerText = "RECEBER CÓDIGO"; }
        alert("Erro ao enviar SMS: " + error.message);
    }
};

window.confirmarCodigoLogin = async () => {
    const code = document.getElementById('login-code').value.replace(/\s/g, '');
    if(code.length < 6) return alert("O código tem 6 dígitos.");
    
    if (!window.confirmationResult) {
        alert("Sessão expirada. Recarregue.");
        return;
    }

    const btn = document.getElementById('btn-login-verify');
    if(btn) { btn.disabled = true; btn.innerText = "VALIDANDO..."; }

    try {
        await window.confirmationResult.confirm(code);
    } catch (error) {
        console.error(error);
        if(btn) { btn.disabled = false; btn.innerText = "ENTRAR AGORA 🚀"; }
        alert("Código inválido.");
    }
};

window.logout = () => signOut(auth).then(() => location.reload());

// ============================================================================
// 4. ORQUESTRADOR
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    const ui = {
        landing: document.getElementById('landing-page'),
        auth: document.getElementById('auth-container'),
        app: document.getElementById('app-container'),
        role: document.getElementById('role-selection'),
        splash: document.getElementById('splash-screen'),
        onboard: document.getElementById('modal-onboarding')
    };

    if (user) {
        if(ui.landing) ui.landing.classList.add('hidden');
        if(ui.auth) ui.auth.classList.add('hidden');
        
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            if(!docSnap.exists()) {
                const tempName = localStorage.getItem("temp_user_name") || user.displayName || "Usuário";
                await setDoc(userRef, { 
                    email: user.email || "", 
                    phone: user.phoneNumber, 
                    displayName: tempName, 
                    photoURL: user.photoURL, 
                    role: 'user', 
                    wallet_balance: 0.00, 
                    is_provider: false, 
                    created_at: serverTimestamp(), 
                    status: 'ativo', 
                    termos_aceitos: false 
                });
            } else {
                const data = docSnap.data();
                
                if (!data.termos_aceitos || !data.nome_real) {
                    ui.app.classList.add('hidden');
                    if(ui.onboard) {
                        ui.onboard.classList.remove('hidden');
                        ui.onboard.style.display = 'flex';
                        const inpN = document.getElementById('inp-onboard-name');
                        if(inpN && !inpN.value && data.displayName) inpN.value = data.displayName;
                    }
                    if(window.ocultarSplash) window.ocultarSplash();
                    return;
                }

                if(ui.onboard) ui.onboard.classList.add('hidden');
                userProfile = data; window.userProfile = data;
                
                ui.app.classList.remove('hidden');
                atualizarInterfaceUsuario(data);
                
                if (data.is_provider) {
                    toggleDisplay('servicos-prestador', true);
                    toggleDisplay('servicos-cliente', false);
                } else {
                    toggleDisplay('servicos-prestador', false);
                    toggleDisplay('servicos-cliente', true);
                }

                if(window.ocultarSplash) window.ocultarSplash();
            }
        });

    } else {
        if(ui.landing) ui.landing.classList.remove('hidden');
        if(ui.app) ui.app.classList.add('hidden');
        if(ui.onboard) ui.onboard.classList.add('hidden');
        if(window.ocultarSplash) window.ocultarSplash();
    }
});

function atualizarInterfaceUsuario(dados) {
    const nameEl = document.getElementById('header-user-name');
    if(nameEl) nameEl.innerText = dados.displayName || "Usuário";
    const saldoEl = document.getElementById('user-balance');
    if(saldoEl && dados.wallet_balance !== undefined) {
        saldoEl.innerText = dados.wallet_balance.toFixed(2);
    }
}

function toggleDisplay(id, s) { 
    const el = document.getElementById(id); 
    if(el) s ? el.classList.remove('hidden') : el.classList.add('hidden'); 
}
