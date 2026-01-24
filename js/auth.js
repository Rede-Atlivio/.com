import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// Login com Google
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));

// Logout seguro
window.logout = () => signOut(auth).then(() => location.reload());

// Definição de Perfil Inicial (Primeiro Acesso)
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    });

    location.reload();
};

// Troca de Contexto (Cliente <-> Prestador) sem Logout
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

// Monitor de Autenticação (O CÉREBRO DA IDENTIDADE)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            if(!docSnap.exists()) {
                const roleInicial = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user';
                userProfile = { 
                    email: user.email, 
                    displayName: user.displayName, 
                    photoURL: user.photoURL,       
                    tenant_id: DEFAULT_TENANT, 
                    perfil_completo: false, 
                    role: roleInicial, 
                    saldo: 0, 
                    is_provider: false 
                };
                await setDoc(userRef, userProfile);
            } else {
                userProfile = docSnap.data();
                if (user.photoURL !== userProfile.photoURL || user.displayName !== userProfile.displayName) {
                    await updateDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL });
                }
                atualizarInterface(user);
                if (userProfile.is_provider) { verificarPendenciaPerfil(user.uid); }
            }
        });
    } else {
        mostrarLogin();
    }
});

async function verificarPendenciaPerfil(uid) {
    if (!userProfile.setup_profissional_ok) {
        const modal = document.getElementById('provider-setup-modal');
        if(modal) {
            modal.classList.remove('hidden');
            const inputNome = document.getElementById('setup-name');
            if(inputNome && !inputNome.value) inputNome.value = auth.currentUser.displayName || "";
        }
    }
}

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

function iniciarAppLogado(user) {
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const tabServicos = document.getElementById('tab-servicos');

    if(isAdmin) {
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        const adminTab = document.getElementById('tab-admin');
        const adminSec = document.getElementById('sec-admin');
        if(adminTab) { adminTab.classList.add('hidden'); adminTab.style.display = 'none'; }
        if(adminSec) { adminSec.classList.add('hidden'); }
    }

    if (userProfile.is_provider) {
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Prestador)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        }
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.remove('hidden'); 
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-ganhar').classList.remove('hidden');  
        document.getElementById('tab-loja').classList.add('hidden');    
        document.getElementById('status-toggle-container').classList.remove('hidden');
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');
        if (!document.querySelector('.border-blue-600')) window.switchTab('servicos'); 

    } else {
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Cliente)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        }
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.add('hidden');    
        document.getElementById('tab-ganhar').classList.add('hidden');       
        document.getElementById('status-toggle-container').classList.add('hidden');
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
        if (!document.querySelector('.border-blue-600')) window.switchTab('servicos');
    }
}
