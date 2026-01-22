import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÕES
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
    
    // SEGURANÇA DA ABA ADMIN
    if(isAdmin) {
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        // Se não for admin, remove o elemento do DOM para garantir
        const adminTab = document.getElementById('tab-admin');
        if(adminTab) adminTab.classList.add('hidden');
    }

    // APLICA O "CHAPÉU" (Lógica de Visão)
    if (userProfile.is_provider) {
        // --- VISÃO PRESTADOR ---
        
        // Se for admin, mostra o selo vermelho
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

        // Abre na aba certa se nenhuma estiver ativa
        if (!document.querySelector('.border-blue-600')) window.switchTab('servicos'); 

    } else {
        // --- VISÃO CLIENTE ---
        
        // Se for admin, mostra o selo vermelho
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
        
        // Abre na aba certa se nenhuma estiver ativa
        if (!document.querySelector('.border-blue-600')) window.switchTab('oportunidades');
    }
}
