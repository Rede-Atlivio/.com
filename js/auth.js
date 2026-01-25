import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// REMOVIDO: import { inicializarModuloServicos } ... (Evita o ciclo)

// --- VARIÁVEL GLOBAL (Para todos acessarem) ---
window.userProfile = null;

// --- FUNÇÕES GLOBAIS ---
window.loginGoogle = loginGoogle;
window.logout = logout;
window.alternarPerfil = alternarPerfil;
window.definirPerfil = definirPerfil;

window.alternarStatusOnline = async () => {
    const toggle = document.getElementById('online-toggle');
    if(!auth.currentUser || !toggle) return;
    try {
        await updateDoc(doc(db, "active_providers", auth.currentUser.uid), {
            is_online: toggle.checked,
            last_seen: serverTimestamp()
        });
        console.log("Status Online:", toggle.checked);
    } catch(e) { 
        console.error("Erro status:", e);
        toggle.checked = !toggle.checked;
    }
};

// --- LOGIN ---
async function loginGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        await verificarEAtualizarUsuario(result.user);
    } catch (error) { alert("Erro login: " + error.message); }
}

async function verificarEAtualizarUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        const novoPerfil = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            created_at: serverTimestamp(),
            saldo: 0.00,
            is_provider: false
        };
        await setDoc(userRef, novoPerfil);
        window.userProfile = novoPerfil;
        mostrarTelaSelecao();
    } else {
        window.userProfile = docSnap.data();
        direcionarUsuario();
    }
}

function mostrarTelaSelecao() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.remove('hidden');
}

async function definirPerfil(tipo) {
    if (!auth.currentUser) return;
    const isProvider = tipo === 'prestador';
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: isProvider });
    window.userProfile.is_provider = isProvider;
    direcionarUsuario();
}

async function alternarPerfil() {
    if (!window.userProfile) return;
    const novoStatus = !window.userProfile.is_provider;
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: novoStatus });
    location.reload();
}

function direcionarUsuario() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const tabAdmin = document.getElementById('tab-admin');
    
    if (window.userProfile.is_provider) {
        btnPerfil.innerText = "🔄 Virar Cliente";
        btnPerfil.classList.replace('text-gray-500', 'text-blue-600');
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('status-toggle-container').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.remove('hidden');
        document.getElementById('tab-ganhar').classList.remove('hidden');
        
        // Verifica status online
        getDoc(doc(db, "active_providers", auth.currentUser.uid)).then(snap => {
            if(snap.exists()) document.getElementById('online-toggle').checked = snap.data().is_online;
        });
    } else {
        btnPerfil.innerText = "🔄 Virar Prestador";
        document.getElementById('servicos-cliente').classList.remove('hidden');
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
    }

    if(window.userProfile.email === "contatogilborges@gmail.com") {
        tabAdmin.classList.remove('hidden');
    }

    // Dispara evento para avisar outros módulos que carregou
    window.dispatchEvent(new CustomEvent('perfilCarregado'));
}

function logout() { signOut(auth).then(() => location.reload()); }

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if(snap.exists()) {
            window.userProfile = snap.data();
            direcionarUsuario();
        }
    } else {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    }
});
