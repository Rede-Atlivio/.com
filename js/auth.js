import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
window.logout = () => signOut(auth).then(() => location.reload());

window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    
    // Define o perfil inicial
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    });

    // Se escolheu prestador, forçamos o reload para cair na verificação de setup
    location.reload();
};

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
                
                // --- NOVO: VERIFICAÇÃO DE PERFIL PROFISSIONAL ---
                // Se for prestador, verifica se já tem o setup feito
                if (userProfile.is_provider) {
                    verificarPendenciaPerfil(user.uid);
                }
            }
        });
    } else {
        mostrarLogin();
    }
});

// NOVA FUNÇÃO: OBRIGA O SETUP
async function verificarPendenciaPerfil(uid) {
    // Verifica na coleção active_providers se o usuário já tem dados salvos
    // (Mesmo estando offline, podemos checar se ele já salvou o setup antes no localStorage ou numa coleção de perfis)
    // Para simplificar no MVP e corrigir seu erro AGORA: 
    // Vamos checar se o usuário tem os dados salvos localmente ou abrir o modal.
    
    // Como os dados do setup (Nome, Categoria) ficam no 'active_providers' (que apaga quando fica offline),
    // precisamos de um lugar persistente.
    // CORREÇÃO IMEDIATA: Vamos salvar o setup no próprio documento do usuário ('usuarios/{uid}') também, 
    // para saber se ele já configurou.
    
    if (!userProfile.setup_profissional_ok) {
        // Se não tem a flag de setup ok, ABRE O MODAL
        const modal = document.getElementById('provider-setup-modal');
        if(modal) {
            modal.classList.remove('hidden');
            // Preenche o campo de nome com o nome do Google se estiver vazio
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

    // SEGURANÇA ADMIN
    if(isAdmin) {
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        const adminTab = document.getElementById('tab-admin');
        const adminSec = document.getElementById('sec-admin');
        if(adminTab) { adminTab.classList.add('hidden'); adminTab.style.display = 'none'; }
        if(adminSec) { adminSec.classList.add('hidden'); }
    }

    if (userProfile.is_provider) {
        // --- PRESTADOR ---
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Prestador)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        }
        
        // RENOMEIA ABA PRINCIPAL
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";

        // EXIBIÇÃO DE ABAS
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.remove('hidden'); 
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-ganhar').classList.remove('hidden');  
        
        document.getElementById('tab-loja').classList.add('hidden');    
        
        document.getElementById('status-toggle-container').classList.remove('hidden');
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');

        // Foco inicial
        if (!document.querySelector('.border-blue-600')) window.switchTab('servicos'); 

    } else {
        // --- CLIENTE ---
        if(isAdmin) {
             btnPerfil.innerHTML = `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Cliente)</span> 🔄`;
        } else {
             btnPerfil.innerHTML = `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
        }

        // RENOMEIA ABA PRINCIPAL
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";

        // EXIBIÇÃO DE ABAS
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
        
        document.getElementById('tab-missoes').classList.add('hidden');    
        document.getElementById('tab-ganhar').classList.add('hidden');       
        
        document.getElementById('status-toggle-container').classList.add('hidden');
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
        
        // Foco inicial
        if (!document.querySelector('.border-blue-600')) window.switchTab('servicos');
    }
}
