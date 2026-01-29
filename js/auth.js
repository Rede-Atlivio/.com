import { auth, db, provider } from './app.js';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { checkOnboarding } from './modules/onboarding.js';

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";

export let userProfile = null; 
window.userProfile = null;

// ============================================================================
// 1. ORQUESTRADOR DE ESTADO (CORRIGIDO PARA EVITAR LOOP)
// ============================================================================

onAuthStateChanged(auth, async (user) => {
    // Referências de UI
    const ui = {
        landing: document.getElementById('landing-page'),
        auth: document.getElementById('auth-container'),
        app: document.getElementById('app-container'),
        role: document.getElementById('role-selection'),
        splash: document.getElementById('splash-screen')
    };

    if (user) {
        // 1. Esconde Login/Landing imediatamente para evitar flash
        if(ui.landing) ui.landing.classList.add('hidden');
        if(ui.auth) ui.auth.classList.add('hidden');
        
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    // CRIAÇÃO INICIAL DO PERFIL
                    console.log("✨ Criando perfil novo...");
                    const novoPerfil = { 
                        email: user.email ? user.email.toLowerCase() : "", 
                        phone: user.phoneNumber, 
                        displayName: user.displayName || "Usuário", 
                        photoURL: user.photoURL, 
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: 'user', 
                        wallet_balance: 0.00, 
                        saldo: 0.00, 
                        is_provider: false, 
                        created_at: serverTimestamp(), 
                        status: 'ativo',
                        traffic_source: localStorage.getItem("traffic_source") || "direct",
                        termos_aceitos: false, // Inicia falso
                        nome_real: "" 
                    };
                    await setDoc(userRef, novoPerfil);
                } else {
                    // USUÁRIO JÁ EXISTE
                    const data = docSnap.data();
                    
                    // 2. VERIFICAÇÃO DE BANIMENTO
                    if (data.status === 'banido') {
                        aplicarRestricoesDeStatus('banido');
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; 
                    }

                    // 3. GUARDIÃO DE ONBOARDING (A LÓGICA CORRIGIDA)
                    // Verifica se tem termos OU se tem nome real.
                    // Se faltar QUALQUER UM, manda pro cadastro.
                    if (data.termos_aceitos !== true || !data.nome_real || data.nome_real.length < 3) {
                        console.log("🔒 Cadastro incompleto. Redirecionando para Onboarding...");
                        
                        // Garante que o App e Landing sumam
                        if(ui.app) ui.app.classList.add('hidden');
                        if(ui.landing) ui.landing.classList.add('hidden');
                        
                        // Chama o módulo e passa o controle
                        if (typeof checkOnboarding === 'function') {
                            await checkOnboarding(user); 
                        }
                        
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; // PARE AQUI. Não carregue o App.
                    }

                    // 4. SUCESSO: APP LIBERADO
                    console.log("🔓 Acesso liberado.");
                    
                    // Sincroniza variável global
                    data.wallet_balance = data.saldo !== undefined ? data.saldo : (data.wallet_balance || 0);
                    userProfile = data; window.userProfile = data;
                    
                    // Atualiza UI
                    atualizarInterfaceUsuario(userProfile);
                    renderizarBotaoSuporte(); 
                    
                    // INICIA O APP (Agora seguro)
                    iniciarAppLogado(user); 
                    
                    // Lógicas extras
                    if (data.status === 'suspenso' && data.is_online) updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
                    if (userProfile.is_provider) {
                        verificarStatusERadar(user.uid);
                        if (!userProfile.setup_profissional_ok) window.abrirConfiguracaoServicos();
                    }
                    
                    if(window.ocultarSplash) window.ocultarSplash();
                }
            } catch (err) { 
                console.error("Erro Crítico no Auth:", err);
                // Fallback de segurança: Tenta liberar se der erro, pra não travar o usuário
                iniciarAppLogado(user); 
                if(window.ocultarSplash) window.ocultarSplash(); 
            }
        });
    } else {
        // ESTADO: DESLOGADO (RESET TOTAL)
        if(ui.landing) ui.landing.classList.remove('hidden');
        if(ui.app) ui.app.classList.add('hidden');
        if(ui.role) ui.role.classList.add('hidden');
        if(ui.auth) ui.auth.classList.add('hidden');
        
        // Reset inputs de login
        document.getElementById('login-step-phone')?.classList.remove('hidden');
        document.getElementById('login-step-code')?.classList.add('hidden');
        
        removerBloqueiosVisuais();
        if(window.ocultarSplash) window.ocultarSplash();
    }
});

// ============================================================================
// 2. FUNÇÕES DE UI (ATUALIZADAS)
// ============================================================================

function iniciarAppLogado(user) {
    const el = {
        app: document.getElementById('app-container'),
        role: document.getElementById('role-selection'),
        landing: document.getElementById('landing-page'),
        auth: document.getElementById('auth-container')
    };

    // Garante que telas de login sumam
    if(el.landing) el.landing.classList.add('hidden');
    if(el.auth) el.auth.classList.add('hidden');

    // Se perfil não tem "perfil_completo" (escolha prestador/cliente), vai pra seleção
    if (!userProfile || !userProfile.perfil_completo) {
        if(el.app) el.app.classList.add('hidden');
        if(el.role) el.role.classList.remove('hidden');
        return;
    }

    // Se tudo ok, mostra o App
    if(el.role) el.role.classList.add('hidden');
    if(el.app) el.app.classList.remove('hidden');

    // Configura Admin
    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    const tabAdmin = document.getElementById('tab-admin');
    if(isAdmin && tabAdmin) tabAdmin.classList.remove('hidden');

    // Configura Abas Iniciais
    const tabServicos = document.getElementById('tab-servicos');
    const btnPerfil = document.getElementById('btn-trocar-perfil');

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

// ... (Mantenha as funções de SMS Login e Suporte que já estavam funcionando na V16.3) ...
// (Vou reescrever as funções de login aqui para garantir que o arquivo fique completo)

const resetRecaptcha = () => {
    if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch (e) {} window.recaptchaVerifier = null; }
    const container = document.getElementById('recaptcha-container'); if (container) container.innerHTML = ''; 
};

const setupRecaptcha = () => {
    resetRecaptcha();
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => console.log("Captcha resolvido.")
    });
};

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

    let rawPhone = telefoneInput.value.replace(/\D/g, ''); 
    if(rawPhone.length < 10) return alert("Digite o número completo com DDD.");
    const finalPhone = '+55' + rawPhone;
    
    const btnId = origem === 'cadastro' ? 'btn-onboard-sms' : 'btn-login-send';
    const btn = document.getElementById(btnId);
    if(btn) { btn.disabled = true; btn.innerText = "ENVIANDO..."; }

    try {
        setupRecaptcha();
        const confirmationResult = await signInWithPhoneNumber(auth, finalPhone, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult;
        
        if(origem === 'cadastro') {
            alert(`Código enviado para ${finalPhone}.`);
            // Mágica para trocar de tela sem recarregar
            document.getElementById('modal-onboarding')?.classList.add('hidden');
            document.getElementById('landing-page')?.classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
            document.getElementById('auth-container').style.display = 'flex';
        }

        document.getElementById('lbl-login-phone').innerText = finalPhone;
        document.getElementById('login-step-phone')?.classList.add('hidden');
        document.getElementById('login-step-code')?.classList.remove('hidden');

    } catch (error) {
        console.error("Erro SMS:", error);
        resetRecaptcha();
        if(btn) { btn.disabled = false; btn.innerText = "TENTAR NOVAMENTE"; }
        alert("Erro ao enviar: " + error.message);
    }
};

window.confirmarCodigoLogin = async () => {
    const code = document.getElementById('login-code').value.replace(/\s/g, '');
    if(code.length < 6) return alert("O código deve ter 6 números.");
    if (!window.confirmationResult) return alert("Sessão expirada. Recarregue.");

    const btn = document.getElementById('btn-login-verify');
    if(btn) { btn.disabled = true; btn.innerText = "VALIDANDO..."; }

    try {
        await window.confirmationResult.confirm(code);
        // O onAuthStateChanged assume daqui
    } catch (error) {
        if(btn) { btn.disabled = false; btn.innerText = "ENTRAR AGORA 🚀"; }
        alert("Código incorreto.");
    }
};

window.logout = () => signOut(auth).then(() => location.reload());

// Helpers Visuais
function aplicarRestricoesDeStatus(status) {
    document.getElementById("bloqueio-total-overlay")?.remove(); 
    if (status === 'banido') {
        const jailHtml = `<div id="bloqueio-total-overlay" class="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade"><h1 class="text-3xl font-black text-white mb-2">🚫 CONTA BLOQUEADA</h1><p class="text-gray-400 mb-8">Violação dos termos.</p><button onclick="window.logout()" class="text-gray-500 text-xs underline">Sair</button></div>`;
        document.body.insertAdjacentHTML('beforeend', jailHtml);
    }
}
function removerBloqueiosVisuais() { document.getElementById("bloqueio-total-overlay")?.remove(); }
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
    const btn = document.createElement('div'); btn.id = 'btn-floating-support'; btn.className = 'fixed bottom-4 right-4 z-[200] animate-bounce-slow';
    btn.innerHTML = `<button onclick="window.abrirChatSuporte()" class="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl border-2 border-white transition transform hover:scale-110">💬</button>`;
    document.body.appendChild(btn);
}
window.abrirChatSuporte = window.abrirChatSuporte || async function() { alert("Carregando chat..."); };
function toggleDisplay(id, s) { const el = document.getElementById(id); if(el) s ? el.classList.remove('hidden') : el.classList.add('hidden'); }
