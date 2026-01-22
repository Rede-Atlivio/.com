import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÕES
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// LOGIN
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

// --- NOVA FUNÇÃO: TROCAR DE PERFIL (Botão Mágico) ---
window.alternarPerfil = async () => {
    if(!userProfile) return;
    
    const novoTipo = userProfile.is_provider ? "CLIENTE" : "PRESTADOR";
    const msg = userProfile.is_provider 
        ? "🔄 Mudar para CLIENTE?\n\nVocê verá serviços para contratar e produtos para comprar." 
        : "🔄 Mudar para PRESTADOR?\n\nVocê verá missões, chamados e sua carteira.";

    if(confirm(msg)) {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        });
        location.reload(); // Recarrega para limpar a visão antiga
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

// AQUI ESTÁ A LÓGICA DE SEGURANÇA VISUAL
function iniciarAppLogado(user) {
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const tipoUsuario = userProfile.is_provider ? "Prestador" : "Cliente";
    // Atualiza o texto do botão de troca
    document.getElementById('btn-trocar-perfil').innerText = `Modo: ${tipoUsuario} 🔄`;

    // 1. SEGURANÇA ADMIN (Correção do Vazamento)
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    if(isAdmin) {
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        document.getElementById('tab-admin').classList.add('hidden');
        document.getElementById('sec-admin').classList.add('hidden'); // Garante que fecha
    }

    // 2. LÓGICA DE ABAS POR PERFIL (Limpeza Mental)
    if (userProfile.is_provider) {
        // MODO PRESTADOR (Ganhar Dinheiro)
        document.getElementById('tab-missoes').classList.remove('hidden'); // Vê Missões
        document.getElementById('tab-ganhar').classList.remove('hidden');  // Vê Carteira
        document.getElementById('tab-produtos').classList.add('hidden');   // Não Vê Loja (Foco em trabalho)
        
        // Botão Online: APARECE
        document.getElementById('status-toggle-container').classList.remove('hidden');
        
        // Aba Serviços: Mostra visão de Trabalho
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');

    } else {
        // MODO CLIENTE (Gastar Dinheiro)
        document.getElementById('tab-missoes').classList.add('hidden');    // Não Vê Missões
        document.getElementById('tab-ganhar').classList.add('hidden');     // Não Vê Carteira
        document.getElementById('tab-produtos').classList.remove('hidden');// Vê Loja
        
        // Botão Online: SOME
        document.getElementById('status-toggle-container').classList.add('hidden');

        // Aba Serviços: Mostra visão de Contratação
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
    }
}
