import { auth, db, provider } from './app.js';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, updateProfile, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";

export let userProfile = null; 
window.userProfile = null;

// ============================================================================
// 1. LÓGICA DE CADASTRO (SALVA SEM DAR REFRESH)
// ============================================================================

window.finalizarCadastro = async () => {
    const nome = document.getElementById('inp-onboard-name').value.trim();
    const phone = document.getElementById('inp-onboard-phone').value.trim();
    const termos = document.getElementById('chk-terms').checked;
    const btn = document.getElementById('btn-onboard-submit');

    if (!termos) return alert("⚠️ Você precisa aceitar os Termos de Uso.");
    if (nome.length < 3) return alert("⚠️ Digite seu nome completo.");
    
    if(!auth.currentUser) return alert("⚠️ Erro de sessão. Faça login novamente.");

    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        console.log("💾 Salvando dados do usuário...");
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nome_real: nome,
            displayName: nome,
            whatsapp: phone,
            termos_aceitos: true,
            perfil_completo: true,
            onboarded_at: serverTimestamp(),
            status: 'ativo'
        });
        
        // Atualiza perfil visual do Auth também
        await updateProfile(auth.currentUser, { displayName: nome });

        console.log("✅ Cadastro finalizado! Liberando App...");
        // O onAuthStateChanged vai detectar a mudança e abrir o app sozinho
        
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
        btn.innerText = "TENTAR NOVAMENTE";
        btn.disabled = false;
    }
};

// ============================================================================
// 2. LÓGICA DE LOGIN SMS
// ============================================================================

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
    const textoOriginal = btn ? btn.innerText : "ENVIAR";
    
    if(btn) { btn.disabled = true; btn.innerText = "ENVIANDO..."; }

    try {
        setupRecaptcha();
        const confirmationResult = await signInWithPhoneNumber(auth, finalPhone, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult;
        
        if(origem === 'cadastro') {
            alert(`Código enviado para ${finalPhone}.`);
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
        if(btn) { btn.disabled = false; btn.innerText = textoOriginal; }
        alert("Erro ao enviar: " + error.message);
    }
};

window.confirmarCodigoLogin = async () => {
    const code = document.getElementById('login-code').value.replace(/\s/g, '');
    if(code.length < 6) return alert("O código deve ter 6 números.");
    if (!window.confirmationResult) return alert("Sessão expirada. Recarregue.");

    const btn = document.getElementById('btn-login-verify');
    if(btn) { btn.disabled = true; btn.innerText = "VALIDANDO..."; }

    // TIMEOUT DE SEGURANÇA (Para o botão não ficar travado pra sempre)
    const safetyTimeout = setTimeout(() => {
        if(btn && btn.innerText === "VALIDANDO...") {
            btn.disabled = false;
            btn.innerText = "ENTRAR AGORA 🚀";
            alert("O servidor demorou para responder. Verifique sua conexão e tente novamente.");
        }
    }, 15000); // 15 segundos

    try {
        await window.confirmationResult.confirm(code);
        clearTimeout(safetyTimeout);
        // Sucesso! O onAuthStateChanged assume.
    } catch (error) {
        clearTimeout(safetyTimeout);
        if(btn) { btn.disabled = false; btn.innerText = "ENTRAR AGORA 🚀"; }
        alert("Código incorreto ou inválido.");
    }
};

window.logout = () => signOut(auth).then(() => location.reload());

// ============================================================================
// 3. ORQUESTRADOR DE ESTADO
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

window.salvarConfiguracoes = async () => {
    const nome = document.getElementById('set-nome').value;
    const pix = document.getElementById('set-pix').value;
    const btn = document.getElementById('btn-save-settings');
    btn.innerText = "SALVANDO..."; btn.disabled = true;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { displayName: nome, pix_key: pix }, { merge: true });
        alert("✅ Salvo com sucesso!"); location.reload();
    } catch(e) { alert("Erro: " + e.message); btn.innerText = "SALVAR"; btn.disabled = false; }
};

window.abrirConfiguracoes = () => {
    document.getElementById('modal-settings').classList.remove('hidden');
    if(userProfile) {
        document.getElementById('set-nome').value = userProfile.displayName || "";
        document.getElementById('set-pix').value = userProfile.pix_key || "";
        document.getElementById('set-phone').value = userProfile.phone || "";
        document.getElementById('set-uid').innerText = userProfile.uid;
    }
};

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
            try {
                if(!docSnap.exists()) {
                    const tempName = localStorage.getItem("temp_user_name") || user.displayName || "Usuário";
                    await setDoc(userRef, { 
                        email: user.email || "", phone: user.phoneNumber, displayName: tempName, 
                        photoURL: user.photoURL, tenant_id: DEFAULT_TENANT, perfil_completo: false, 
                        role: 'user', wallet_balance: 0.00, saldo: 0.00, is_provider: false, 
                        created_at: serverTimestamp(), status: 'ativo', 
                        termos_aceitos: false, nome_real: tempName !== "Usuário" ? tempName : "" 
                    });
                    localStorage.removeItem("temp_user_name");
                } else {
                    const data = docSnap.data();
                    
                    if (data.status === 'banido') {
                        aplicarRestricoesDeStatus('banido');
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; 
                    }

                    // LÓGICA DE ONBOARDING
                    if (data.termos_aceitos !== true || !data.nome_real || data.nome_real.length < 3) {
                        if(ui.app) ui.app.classList.add('hidden');
                        if(ui.landing) ui.landing.classList.add('hidden');
                        if(ui.onboard) {
                            ui.onboard.classList.remove('hidden');
                            ui.onboard.style.display = 'flex';
                            
                            // Preenche dados se tiver
                            const inpN = document.getElementById('inp-onboard-name');
                            const inpP = document.getElementById('inp-onboard-phone');
                            if(inpN && !inpN.value && data.displayName && data.displayName !== "Usuário") inpN.value = data.displayName;
                            if(inpP && !inpP.value && data.phone) inpP.value = data.phone;
                        }
                        if(window.ocultarSplash) window.ocultarSplash();
                        return; 
                    }

                    // LÓGICA DE SUCESSO
                    if(ui.onboard) ui.onboard.classList.add('hidden'); // Esconde onboarding
                    
                    data.wallet_balance = data.saldo !== undefined ? data.saldo : (data.wallet_balance || 0);
                    userProfile = data; window.userProfile = data;
                    
                    atualizarInterfaceUsuario(userProfile);
                    iniciarAppLogado(user); 
                    
                    if(window.ocultarSplash) window.ocultarSplash();
                }
            } catch (err) { 
                console.error("Erro Auth:", err);
                iniciarAppLogado(user); 
                if(window.ocultarSplash) window.ocultarSplash(); 
            }
        });
    } else {
        if(ui.landing) ui.landing.classList.remove('hidden');
        if(ui.app) ui.app.classList.add('hidden');
        if(ui.role) ui.role.classList.add('hidden');
        if(ui.auth) ui.auth.classList.add('hidden');
        if(ui.onboard) ui.onboard.classList.add('hidden');
        
        document.getElementById('login-step-phone')?.classList.remove('hidden');
        document.getElementById('login-step-code')?.classList.add('hidden');
        
        removerBloqueiosVisuais();
        if(window.ocultarSplash) window.ocultarSplash();
    }
});

// Helpers de UI
function iniciarAppLogado(user) {
    const el = { app: document.getElementById('app-container'), role: document.getElementById('role-selection') };
    
    if (!userProfile || !userProfile.perfil_completo) {
        el.app.classList.add('hidden');
        el.role.classList.remove('hidden');
        return;
    }

    el.role.classList.add('hidden');
    el.app.classList.remove('hidden');

    const userEmail = user.email ? user.email.toLowerCase().trim() : "";
    const isAdmin = userEmail && ADMIN_EMAILS.some(adm => adm.toLowerCase() === userEmail);
    const tabAdmin = document.getElementById('tab-admin');
    if(isAdmin && tabAdmin) tabAdmin.classList.remove('hidden');

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
        setTimeout(() => { if(tabServicos) tabServicos.click(); }, 500); 
    }
}

function aplicarRestricoesDeStatus(status) {
    document.getElementById("bloqueio-total-overlay")?.remove(); 
    if (status === 'banido') {
        const jailHtml = `<div id="bloqueio-total-overlay" class="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade"><h1 class="text-3xl font-black text-white mb-2">🚫 CONTA BLOQUEADA</h1><button onclick="window.logout()" class="text-gray-500 text-xs underline">Sair</button></div>`;
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
