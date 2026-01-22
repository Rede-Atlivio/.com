import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÕES
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null; // Perfil global

// FUNÇÕES DE LOGIN (Disponíveis no window para o HTML clicar)
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));
window.logout = () => signOut(auth).then(() => location.reload());

window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    await setDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    }, { merge: true });
    location.reload();
};

// OBSERVADOR DE ESTADO (O SEGURANÇA)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Escuta mudanças no perfil do usuário em tempo real
        onSnapshot(doc(db, "usuarios", user.uid), async (docSnap) => {
            if(!docSnap.exists()) {
                // Cria perfil se não existir
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

function iniciarAppLogado(user) {
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    const tipoUsuario = userProfile.is_provider ? "Prestador" : "Cliente";
    document.getElementById('user-role-display').innerText = `${tipoUsuario}`;

    // Lógica de UI baseada no perfil
    if (userProfile.is_provider) {
        document.getElementById('tab-ganhar').classList.remove('hidden');
        if(document.getElementById('servicos-prestador')) document.getElementById('servicos-prestador').classList.remove('hidden');
    } else {
        document.getElementById('tab-ganhar').classList.add('hidden');
        if(document.getElementById('servicos-cliente')) document.getElementById('servicos-cliente').classList.remove('hidden');
    }

    // Admin
    if(ADMIN_EMAILS.includes(user.email)) {
        document.getElementById('tab-admin').classList.remove('hidden');
        document.getElementById('sec-admin').classList.remove('hidden');
    } else {
        document.getElementById('tab-admin').classList.add('hidden');
        document.getElementById('sec-admin').classList.add('hidden');
    }
}
