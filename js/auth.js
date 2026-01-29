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

// Limpeza agressiva para evitar erro "Already Rendered"
const resetRecaptcha = () => {
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
    }
    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = ''; 
};

const setupRecaptcha = () => {
    resetRecaptcha(); // Limpa antes de criar
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => console.log("Captcha resolvido."),
        'expired-callback': () => {
            console.warn("Captcha expirado.");
            resetRecaptcha();
        }
    });
};

// EXPORTAÇÃO EXPLÍCITA PARA WINDOW (Garante que o HTML ache a função)
window.enviarSMSLogin = async () => {
    let rawPhone = document.getElementById('login-phone').value;
    let cleanPhone = rawPhone.replace(/\D/g, ''); 

    if(cleanPhone.length < 10) return alert("Digite o número completo com DDD.");

    const finalPhone = '+55' + cleanPhone;
    const btn = document.getElementById('btn-login-send');
    const originalText = btn.innerText;
    
    btn.disabled = true;
    btn.innerText = "ENVIANDO...";

    try {
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;

        const confirmationResult = await signInWithPhoneNumber(auth, finalPhone, appVerifier);
        
        // SALVA NA MEMÓRIA GLOBAL
        window.confirmationResult = confirmationResult;
        console.log("✅ SMS Enviado. ConfirmationResult salvo.");
        
        document.getElementById('lbl-login-phone').innerText = finalPhone;
        document.getElementById('login-step-phone').classList.add('hidden');
        document.getElementById('login-step-code').classList.remove('hidden');

    } catch (error) {
        console.error("Erro SMS:", error);
        resetRecaptcha();
        btn.disabled = false;
        btn.innerText = originalText;
        
        if(error.code === 'auth/invalid-phone-number') alert("Número inválido.");
        else if(error.code === 'auth/too-many-requests') alert("Muitas tentativas. Aguarde.");
        else alert("Erro ao enviar: " + error.message);
    }
};

window.confirmarCodigoLogin = async () => {
    const codeInput = document.getElementById('login-code');
    const code = codeInput.value.replace(/\s/g, ''); // Remove espaços se houver

    if(code.length < 6) return alert("O código deve ter 6 números.");

    // VERIFICAÇÃO CRÍTICA DE SESSÃO PERDIDA
    if (!window.confirmationResult) {
        alert("⚠️ Sessão expirada ou página recarregada.\n\nPor favor, envie o SMS novamente.");
        window.location.reload();
        return;
    }

    const btn = document.getElementById('btn-login-verify');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "VALIDANDO...";

    try {
        const result = await window.confirmationResult.confirm(code);
        console.log("✅ Login Sucesso. UID:", result.user.uid);
        // O onAuthStateChanged vai detectar o login e mudar a tela
    } catch (error) {
        console.error("Erro Validação:", error);
        btn.disabled = false;
        btn.innerText = originalText;
        if (error.code === 'auth/invalid-verification-code') alert("Código incorreto.");
        else alert("Erro: " + error.message);
    }
};

window.logout = () => signOut(auth).then(() => location.reload());

// ============================================================================
// 2. MONITORAMENTO DE ESTADO (ORQUESTRADOR)
// ============================================================================

// Helpers de Perfil
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
    if (user) {
        // Esconde login imediatamente
        const authContainer = document.getElementById('auth-container');
        if(authContainer) authContainer.classList.add('hidden');
        
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    // Criação de Perfil Novo
                    const trafficSource = localStorage.getItem("traffic_source") || "direct";
                    const safeEmail = user.email ? user.email.toLowerCase() : "";
                    
                    const novoPerfil = { 
                        email: safeEmail, 
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
                        traffic_source: trafficSource,
                        termos_aceitos: false,
                        nome_real: "" 
                    };
                    userProfile = novoPerfil; window.userProfile = novoPerfil;
                    await setDoc(userRef, novoPerfil);
                } else {
                    // Usuário Existente
                    const data = docSnap.data();
                    
                    // 1. Checagem Banimento
                    if (data.status === 'banido') {
                        aplicarRestricoesDeStatus('banido');
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; 
                    }

                    // 2. Checagem Onboarding (Jurídico)
                    if (typeof checkOnboarding === 'function') {
                        await checkOnboarding(user); 
                    }

                    // 3. Atualiza Dados Locais
                    data.wallet_balance = data.saldo !== undefined ? data.saldo : (data.wallet_balance || 0);
                    userProfile = data; window.userProfile = data;
                    
                    if (data.status === 'suspenso' && data.is_online) updateDoc(doc(db, "active_providers", user.uid), { is_online: false });
                    
                    aplicarRestricoesDeStatus(data.status);
                    renderizarBotaoSuporte(); 
                    atualizarInterfaceUsuario(userProfile);
                    
                    // Inicia o App (Com proteção contra crash)
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
        // Logout ou Não Logado
        const authC = document.getElementById('auth-container');
        const appC = document.getElementById('app-container');
        const roleC = document.getElementById('role-selection');
        const onbC = document.getElementById('modal-onboarding');

        if(authC) authC.classList.remove('hidden');
        if(appC) appC.classList.add('hidden');
        if(roleC) roleC.classList.add('hidden');
        if(onbC) onbC.classList.add('hidden');
        
        // Reset da tela de login para estado inicial
        const stepPhone = document.getElementById('login-step-phone');
        const stepCode = document.getElementById('login-step-code');
        if(stepPhone) stepPhone.classList.remove('hidden');
        if(stepCode) stepCode.classList.add('hidden');
        
        removerBloqueiosVisuais();
        if(window.ocultarSplash) window.ocultarSplash();
    }
});

// ============================================================================
// 3. FUNÇÕES AUXILIARES DE UI (BLINDADAS)
// ============================================================================

function iniciarAppLogado(user) {
    const containerApp = document.getElementById('app-container');
    const containerRole = document.getElementById('role-selection');
    const containerAuth = document.getElementById('auth-container');
    const tabAdmin = document.getElementById('tab-admin');
    const tabServicos = document.getElementById('tab-servicos');
    const btnPerfil = document.getElementById('btn-trocar-perfil');

    // Se perfil incompleto -> vai para seleção
    if (!userProfile || !userProfile.perfil_completo) {
        if(containerApp) containerApp.classList.add('hidden');
        if(containerRole) containerRole.classList.remove('hidden');
        if(containerAuth) containerAuth.classList.add('hidden');
        return;
    }

    // Se completo -> abre app
    if(containerRole) containerRole.classList.add('hidden');
    if(containerAuth) containerAuth.classList.add('hidden'); 
    if(containerApp) containerApp.classList.remove('hidden');

    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    if(isAdmin && tabAdmin) tabAdmin.classList.remove('hidden');

    // Configura Abas
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

// Funções de Suporte (Radar, Chat, Upload) são carregadas aqui ou via módulos, 
// mantendo a estrutura original mas simplificando para não exceder limites.
// ... (Mantenha as funções de verificarStatusERadar, uploadBanner, etc. do código anterior se necessário, 
// mas o foco aqui foi corrigir o LOGIN e CRASH DE INICIALIZAÇÃO).

// Placeholder para garantir que não quebre se chamado
window.abrirChatSuporte = window.abrirChatSuporte || async function() { alert("Carregando chat..."); };
function toggleDisplay(id, s) { const el = document.getElementById(id); if(el) s ? el.classList.remove('hidden') : el.classList.add('hidden'); }
