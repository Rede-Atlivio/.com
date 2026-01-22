import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO MESTRA DE ADMIN ---
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// LOGIN & LOGOUT
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
window.logout = () => signOut(auth).then(() => location.reload());

// DEFINIR PERFIL INICIAL
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    });
    location.reload();
};

// TROCAR DE PERFIL (Para testar e usar ambos os lados)
window.alternarPerfil = async () => {
    if(!userProfile) return;
    
    const btn = document.getElementById('btn-trocar-perfil');
    const isAtualmentePrestador = userProfile.is_provider;
    
    btn.innerText = "🔄 Trocando...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !isAtualmentePrestador 
        });
        location.reload(); 
    } catch (error) {
        alert("Erro ao trocar perfil: " + error.message);
        btn.innerText = "Erro ❌";
        btn.disabled = false;
    }
};

// OBSERVADOR DE ESTADO
onAuthStateChanged(auth, async (user) => {
    if (user) {
        onSnapshot(doc(db, "usuarios", user.uid), async (docSnap) => {
            if(!docSnap.exists()) {
                const roleInicial = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user';
                userProfile = { 
                    email: user.email, 
                    tenant_id: DEFAULT_TENANT, 
                    perfil_completo: false, 
                    role: roleInicial, 
                    saldo: 0, 
                    is_provider: false 
                };
                await setDoc(doc(db, "usuarios", user.uid), userProfile);
            } else {
                userProfile = docSnap.data();
                atualizarInterface(user);
            }
        });
    } else {
        mostrarLogin();
    }
});

function mostrarLogin() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function atualizarInterface(user) {
    document.getElementById('auth-container').classList.add('hidden');
    
    if(!userProfile.perfil_completo) {
        document.getElementById('role-selection').classList.remove('hidden');
        return;
    }
    
    iniciarAppLogado(user);
}

// --- LÓGICA MESTRA DE INTERFACE E SEGURANÇA VISUAL ---
function iniciarAppLogado(user) {
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    
    // --- TRAVA DE SEGURANÇA CRÍTICA (CORREÇÃO DO VAZAMENTO) ---
    if(isAdmin) {
        // Se for admin, revela a aba
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        // Se NÃO for admin, garante que está escondida e remove do fluxo
        const adminTab = document.getElementById('tab-admin');
        const adminSec = document.getElementById('sec-admin');
        
        if(adminTab) {
            adminTab.classList.add('hidden');
            adminTab.style.display = 'none'; // Segurança extra
        }
        if(adminSec) {
            adminSec.classList.add('hidden');
        }
    }

    // APLICA O "CHAPÉU" (Lógica de Visão)
    if (userProfile.is_provider) {
        // --- VISÃO PRESTADOR ---
        
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Prestador)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        }
        
        // Abas
        document.getElementById('tab-missoes').classList.remove('hidden'); 
        document.getElementById('tab-ganhar').classList.remove('hidden');  
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-loja').classList.add('hidden');    
        document.getElementById('tab-oportunidades').classList.add('hidden');
        
        // Header
        document.getElementById('status-toggle-container').classList.remove('hidden');
        
        // Views
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');

        // Se estiver na aba errada, joga pra certa
        if (!document.querySelector('.border-blue-600') || document.getElementById('sec-admin').classList.contains('hidden') === false) {
             if(!isAdmin) window.switchTab('servicos'); 
        }

    } else {
        // --- VISÃO CLIENTE ---
        
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Cliente)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        }

        // Abas
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.add('hidden');    
        document.getElementById('tab-ganhar').classList.add('hidden');      
        
        // Header
        document.getElementById('status-toggle-container').classList.add('hidden');

        // Views
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
        
        // Se estiver na aba errada, joga pra certa
        if (!document.querySelector('.border-blue-600')) {
             if(!isAdmin) window.switchTab('oportunidades');
        }
    }
}
