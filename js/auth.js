import { auth, db, provider } from './app.js';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// Importação segura do onboarding
import { checkOnboarding } from './modules/onboarding.js';

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";

export let userProfile = null; 
window.userProfile = null;

// ============================================================================
// 1. GESTÃO DE RECAPTCHA & LOGIN SMS
// ============================================================================

const resetRecaptcha = () => {
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = ''; 
};

const setupRecaptcha = () => {
    resetRecaptcha();
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => console.log("Captcha resolvido."),
        'expired-callback': () => {
            console.warn("Captcha expirado.");
            resetRecaptcha();
        }
    });
};

// ATENÇÃO: Esta função pode estar sendo sobrescrita pelo HTML inline. 
// Mantemos aqui para garantir robustez caso o HTML falhe.
window.enviarSMSLogin = async (origem) => {
    let telefoneInput;
    if (origem === 'cadastro') {
        telefoneInput = document.getElementById('inp-onboard-phone');
        const nome = document.getElementById('inp-onboard-name').value;
        if(nome.length < 3) return alert("Por favor, digite seu nome completo.");
        localStorage.setItem("temp_user_name", nome);
    } else {
        telefoneInput = document.getElementById('login-phone');
    }

    if(!telefoneInput) return alert("Erro: Campo de telefone não encontrado.");

    let rawPhone = telefoneInput.value.replace(/\D/g, ''); 
    if(rawPhone.length < 10) return alert("Digite o número completo com DDD.");

    const finalPhone = '+55' + rawPhone;
    
    // Seleciona o botão correto baseado na origem
    const btnId = origem === 'cadastro' ? 'btn-onboard-sms' : 'btn-login-send';
    const btn = document.getElementById(btnId);
    
    if(btn) {
        btn.disabled = true;
        btn.innerText = "ENVIANDO...";
    }

    try {
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, finalPhone, appVerifier);
        
        window.confirmationResult = confirmationResult;
        console.log("✅ SMS Enviado via Auth.js");
        
        if(origem === 'cadastro') {
            alert(`Código enviado para ${finalPhone}.`);
            // Transição visual forçada
            document.getElementById('modal-onboarding')?.classList.add('hidden');
            document.getElementById('landing-page')?.classList.add('hidden');
            const authC = document.getElementById('auth-container');
            if(authC) {
                authC.classList.remove('hidden');
                authC.style.display = 'flex';
            }
        }

        const lblPhone = document.getElementById('lbl-login-phone');
        if(lblPhone) lblPhone.innerText = finalPhone;
        
        document.getElementById('login-step-phone')?.classList.add('hidden');
        document.getElementById('login-step-code')?.classList.remove('hidden');

    } catch (error) {
        console.error("Erro SMS:", error);
        resetRecaptcha();
        if(btn) {
            btn.disabled = false;
            btn.innerText = "TENTAR NOVAMENTE";
        }
        if(error.code === 'auth/invalid-phone-number') alert("Número inválido.");
        else if(error.code === 'auth/too-many-requests') alert("Muitas tentativas. Aguarde.");
        else alert("Erro ao enviar: " + error.message);
    }
};

window.confirmarCodigoLogin = async () => {
    const codeInput = document.getElementById('login-code');
    const code = codeInput.value.replace(/\s/g, '');

    if(code.length < 6) return alert("O código deve ter 6 números.");
    if (!window.confirmationResult) {
        alert("⚠️ Sessão expirada.\nRecarregue a página e tente novamente.");
        return window.location.reload();
    }

    const btn = document.getElementById('btn-login-verify');
    if(btn) {
        btn.disabled = true;
        btn.innerText = "VALIDANDO...";
    }

    try {
        const result = await window.confirmationResult.confirm(code);
        console.log("✅ Login Sucesso. UID:", result.user.uid);
    } catch (error) {
        console.error("Erro Validação:", error);
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ENTRAR AGORA 🚀";
        }
        alert("Código incorreto.");
    }
};

window.logout = () => signOut(auth).then(() => location.reload());

// ============================================================================
// 2. MONITORAMENTO DE ESTADO (ORQUESTRADOR DE TELAS V16.3)
// ============================================================================

window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try { await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: tipo === 'prestador', perfil_completo: true }); location.reload(); } catch(e) { alert("Erro: " + e.message); }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) { btn.innerText = "🔄 ..."; btn.disabled = true; }
    try { await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: !userProfile.is_provider }); setTimeout(() => location.reload(), 500); } catch (e) { alert("Erro: " + e.message); if(btn) btn.disabled = false; }
};

onAuthStateChanged(auth, async (user) => {
    // ELEMENTOS DE UI
    const el = {
        landing: document.getElementById('landing-page'),
        auth: document.getElementById('auth-container'),
        app: document.getElementById('app-container'),
        role: document.getElementById('role-selection'),
        onboard: document.getElementById('modal-onboarding'),
        splash: document.getElementById('splash-screen')
    };

    if (user) {
        // 1. ESCONDER TELAS DE LOGIN/LANDING IMEDIATAMENTE
        if(el.landing) el.landing.classList.add('hidden');
        if(el.auth) {
            el.auth.classList.add('hidden');
            el.auth.style.display = 'none'; // Força display none
        }
        
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    // Novo Usuário
                    const trafficSource = localStorage.getItem("traffic_source") || "direct";
                    const safeEmail = user.email ? user.email.toLowerCase() : "";
                    const tempName = localStorage.getItem("temp_user_name") || user.displayName || "Usuário";
                    
                    const novoPerfil = { 
                        email: safeEmail, 
                        phone: user.phoneNumber, 
                        displayName: tempName, 
                        photoURL: user.photoURL, 
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: 'user', 
                        wallet_balance: 0.00, 
                        saldo: 0.00, 
                        is_provider: false, 
                        created_at: serverTimestamp(), 
                        status: 'ativo',
                        traffic_source: trafficSource,
                        termos_aceitos: false,
                        nome_real: tempName !== "Usuário" ? tempName : "" 
                    };
                    userProfile = novoPerfil; window.userProfile = novoPerfil;
                    await setDoc(userRef, novoPerfil);
                    localStorage.removeItem("temp_user_name");
                } else {
                    const data = docSnap.data();
                    
                    // 2. CHECAGEM DE BANIMENTO
                    if (data.status === 'banido') {
                        aplicarRestricoesDeStatus('banido');
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; 
                    }

                    // 3. GUARDIÃO DE ONBOARDING (PRIORIDADE ABSOLUTA)
                    // Se não aceitou termos, força a tela de modal e esconde o resto
                    if (!data.termos_aceitos || !data.nome_real) {
                        console.log("🔒 Pendência de Cadastro. Redirecionando...");
                        if(el.app) el.app.classList.add('hidden');
                        if(el.landing) el.landing.classList.add('hidden');
                        
                        // Chama o módulo para exibir o modal
                        if (typeof checkOnboarding === 'function') {
                            await checkOnboarding(user); 
                        }
                        
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; // Pára aqui.
                    }

                    // 4. FLUXO DE SUCESSO (APP LIBERADO)
                    data.wallet_balance = data.saldo !== undefined ? data.saldo : (data.wallet_balance || 0);
                    userProfile = data; window.userProfile = data;
                    
                    if (data.status === 'suspenso' && data.is_online) updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
                    
                    aplicarRestricoesDeStatus(data.status);
                    renderizarBotaoSuporte(); 
                    atualizarInterfaceUsuario(userProfile);
                    
                    // Inicia UI Principal
                    iniciarAppLogado(user); 
                    
                    if (userProfile.is_provider) {
                        verificarStatusERadar(user.uid);
                        if (!userProfile.setup_profissional_ok) window.abrirConfiguracaoServicos();
                    }
                    
                    if(window.ocultarSplash) window.ocultarSplash();
                }
            } catch (err) { 
                console.error("Erro Perfil:", err); 
                iniciarAppLogado(user); 
                if(window.ocultarSplash) window.ocultarSplash(); 
            }
        });
    } else {
        // ESTADO: DESLOGADO
        // Garante que Landing Page apareça e App suma
        if(el.landing) el.landing.classList.remove('hidden');
        if(el.auth) {
            el.auth.classList.add('hidden');
            el.auth.style.display = 'none';
        }
        if(el.app) el.app.classList.add('hidden');
        if(el.role) el.role.classList.add('hidden');
        if(el.onboard) el.onboard.classList.add('hidden');
        
        // Reset inputs
        const phoneStep = document.getElementById('login-step-phone');
        const codeStep = document.getElementById('login-step-code');
        if(phoneStep) phoneStep.classList.remove('hidden');
        if(codeStep) codeStep.classList.add('hidden');
        
        removerBloqueiosVisuais();
        if(window.ocultarSplash) window.ocultarSplash();
    }
});

// ============================================================================
// 3. FUNÇÕES AUXILIARES DE UI (BLINDADAS)
// ============================================================================

function iniciarAppLogado(user) {
    console.log("🚀 Renderizando App...");
    const el = {
        app: document.getElementById('app-container'),
        role: document.getElementById('role-selection'),
        landing: document.getElementById('landing-page'),
        auth: document.getElementById('auth-container')
    };

    // Garante limpeza de telas antigas
    if(el.landing) el.landing.classList.add('hidden');
    if(el.auth) el.auth.classList.add('hidden');

    if (!userProfile || !userProfile.perfil_completo) {
        if(el.app) el.app.classList.add('hidden');
        if(el.role) el.role.classList.remove('hidden');
        return;
    }

    if(el.role) el.role.classList.add('hidden');
    if(el.app) el.app.classList.remove('hidden');

    // Configurações visuais do Admin e Header
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const tabAdmin = document.getElementById('tab-admin');
    const tabServicos = document.getElementById('tab-servicos');
    
    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    
    if(isAdmin && tabAdmin) tabAdmin.classList.remove('hidden');

    if (userProfile.is_provider) {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        ['tab-servicos', 'tab-missoes', 'tab-oportunidades', 'tab-ganhar', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, true));
        toggleDisplay('servicos-cliente', false);
        
        setTimeout(() => { if(tabServicos) tabServicos.click(); }, 500);
    } else {
        if(btnPerfil) btnPerfil.innerHTML = isAdmin ? `🛡️ ADMIN` : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        if(tabServicos) tabServicos.innerText = "Contratar 🛠️";
        
        ['tab-servicos', 'tab-oportunidades', 'tab-loja', 'tab-ganhar', 'servicos-cliente'].forEach(id => toggleDisplay(id, true));
        ['tab-missoes', 'status-toggle-container', 'servicos-prestador'].forEach(id => toggleDisplay(id, false));
        
        setTimeout(() => { 
            if(tabServicos) tabServicos.click(); 
            else if(window.carregarServicos) window.carregarServicos();
            if(window.carregarVagas) window.carregarVagas(); 
        }, 500); 
    }
}

function aplicarRestricoesDeStatus(status) {
    const bloqueioID = "bloqueio-total-overlay"; 
    const avisoID = "aviso-suspenso-bar";
    document.getElementById(bloqueioID)?.remove(); 
    document.getElementById(avisoID)?.remove();

    if (status === 'banido') {
        const jailHtml = `<div id="${bloqueioID}" class="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade"><div class="bg-red-500/10 p-6 rounded-full mb-6 border-4 border-red-500 animate-pulse"><span class="text-6xl">🚫</span></div><h1 class="text-3xl font-black text-white mb-2">CONTA BLOQUEADA</h1><p class="text-gray-400 mb-8 max-w-md">Violação dos termos de uso.</p><button onclick="window.abrirChatSuporte()" class="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg">Suporte</button><button onclick="window.logout()" class="text-gray-500 text-xs mt-4 underline">Sair</button></div>`;
        document.body.insertAdjacentHTML('beforeend', jailHtml);
    } else if (status === 'suspenso') {
        const warningHtml = `<div id="${avisoID}" class="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-xs font-bold px-4 py-2 text-center shadow-xl flex justify-between items-center"><span>⚠️ SUSPENSO</span><button onclick="window.abrirChatSuporte()" class="bg-white/20 px-2 py-1 rounded text-[10px]">Suporte</button></div>`;
        document.body.insertAdjacentHTML('beforeend', warningHtml);
        document.getElementById('header-main')?.classList.add('mt-8');
    } else { 
        document.getElementById('header-main')?.classList.remove('mt-8'); 
    }
}

function removerBloqueiosVisuais() { 
    document.getElementById("bloqueio-total-overlay")?.remove(); 
    document.getElementById("aviso-suspenso-bar")?.remove(); 
}

function atualizarInterfaceUsuario(dados) {
    document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => { if(dados.photoURL) img.src = dados.photoURL; });
    const nameEl = document.getElementById('header-user-name'); if(nameEl) nameEl.innerText = dados.displayName || "Usuário";
    const provNameEl = document.getElementById('provider-header-name');
    if(provNameEl) {
        const saldo = dados.wallet_balance || 0; 
        const corSaldo = saldo < 0 ? 'text-red-300' : 'text-emerald-300';
        provNameEl.innerHTML = `${dados.nome_profissional || dados.displayName} <br><span class="text-[10px] font-normal text-gray-300">Saldo: <span class="${corSaldo} font-bold">R$ ${saldo.toFixed(2)}</span></span>`;
    }
}

function renderizarBotaoSuporte() {
    if(document.getElementById('btn-floating-support')) return;
    const btn = document.createElement('div');
    btn.id = 'btn-floating-support';
    btn.className = 'fixed bottom-4 right-4 z-[200] animate-bounce-slow';
    btn.innerHTML = `<button onclick="window.abrirChatSuporte()" class="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl border-2 border-white transition transform hover:scale-110">💬</button>`;
    document.body.appendChild(btn);
}

// Funções placeholder para evitar erros se módulos não carregarem
window.abrirChatSuporte = window.abrirChatSuporte || async function() { alert("Carregando chat..."); };
function toggleDisplay(id, s) { const el = document.getElementById(id); if(el) s ? el.classList.remove('hidden') : el.classList.add('hidden'); }
