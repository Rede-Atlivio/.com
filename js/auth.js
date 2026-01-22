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

// DEFINIR PERFIL INICIAL (Para usuários novos)
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    });
    location.reload();
};

// --- FUNÇÃO: TROCAR DE PERFIL ---
window.alternarPerfil = async () => {
    if(!userProfile) return;
    
    const btn = document.getElementById('btn-trocar-perfil');
    const isAtualmentePrestador = userProfile.is_provider;
    
    // Feedback visual
    btn.innerText = "🔄 Trocando...";
    btn.disabled = true;

    try {
        // Inverte o status no banco de dados
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !isAtualmentePrestador 
        });
        
        // Recarrega a página para limpar a memória e recarregar a UI correta
        location.reload(); 
    } catch (error) {
        alert("Erro ao trocar perfil: " + error.message);
        btn.innerText = "Erro ❌";
        btn.disabled = false;
    }
};

// OBSERVADOR DE ESTADO (Onde tudo começa)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        onSnapshot(doc(db, "usuarios", user.uid), async (docSnap) => {
            if(!docSnap.exists()) {
                // Cria usuário se não existir
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

// --- LÓGICA MESTRA DE INTERFACE ---
function iniciarAppLogado(user) {
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Configura Botão de Perfil
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    
    // Verifica Admin
    if(ADMIN_EMAILS.includes(user.email)) {
        document.getElementById('tab-admin').classList.remove('hidden');
    }

    // APLICA O "CHAPÉU" (Lógica de Visão)
    if (userProfile.is_provider) {
        // ============================
        // VISÃO: PRESTADOR
        // ============================
        btnPerfil.innerHTML = `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        
        // 1. Abas Visíveis (Trabalho)
        document.getElementById('tab-missoes').classList.remove('hidden'); 
        document.getElementById('tab-ganhar').classList.remove('hidden');  
        document.getElementById('tab-servicos').classList.remove('hidden');
        
        // 2. Abas Ocultas (Consumo)
        document.getElementById('tab-loja').classList.add('hidden');    
        document.getElementById('tab-oportunidades').classList.add('hidden');
        
        // 3. Header: Botão "Trabalhar" visível
        document.getElementById('status-toggle-container').classList.remove('hidden');
        
        // 4. Seção Serviços: Visão de quem recebe chamados
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');

        // Abre na aba de Serviços por padrão
        if (!document.querySelector('.border-blue-600')) {
             window.switchTab('servicos'); 
        }

    } else {
        // ============================
        // VISÃO: CLIENTE
        // ============================
        btnPerfil.innerHTML = `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;

        // 1. Abas Visíveis (Consumo)
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
        
        // 2. Abas Ocultas (Trabalho)
        document.getElementById('tab-missoes').classList.add('hidden');    
        document.getElementById('tab-ganhar').classList.add('hidden');      
        
        // 3. Header: Botão "Trabalhar" oculto
        document.getElementById('status-toggle-container').classList.add('hidden');

        // 4. Seção Serviços: Visão de quem contrata
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
        
        // Abre na aba de Oportunidades por padrão
        if (!document.querySelector('.border-blue-600')) {
            window.switchTab('oportunidades');
        }
    }
}
