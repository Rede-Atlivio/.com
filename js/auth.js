import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { inicializarModuloServicos } from './modules/services.js';

// --- VARIÁVEL EXPORTADA ---
export let userProfile = null;

// --- FUNÇÕES GLOBAIS ---
window.loginGoogle = loginGoogle;
window.logout = logout;
window.alternarPerfil = alternarPerfil;
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
        console.error("Erro ao mudar status:", e);
        toggle.checked = !toggle.checked;
    }
};

// --- LOGIN ---
async function loginGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        await verificarEAtualizarUsuario(user);
    } catch (error) {
        console.error("Erro login:", error);
        alert("Erro ao entrar: " + error.message);
    }
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
        userProfile = novoPerfil;
        mostrarTelaSelecao();
    } else {
        userProfile = docSnap.data();
        direcionarUsuario();
    }
}

function mostrarTelaSelecao() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.remove('hidden');
}

window.definirPerfil = async (tipo) => {
    if (!auth.currentUser) return;
    const isProvider = tipo === 'prestador';
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: isProvider });
    userProfile.is_provider = isProvider;
    direcionarUsuario();
};

window.alternarPerfil = async () => {
    if (!userProfile) return;
    const novoStatus = !userProfile.is_provider;
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { is_provider: novoStatus });
    userProfile.is_provider = novoStatus;
    location.reload();
};

function direcionarUsuario() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const tabAdmin = document.getElementById('tab-admin');
    
    if (userProfile.is_provider) {
        btnPerfil.innerText = "🔄 Virar Cliente";
        btnPerfil.classList.replace('text-gray-500', 'text-blue-600');
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('status-toggle-container').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.remove('hidden');
        document.getElementById('tab-ganhar').classList.remove('hidden');
        verificarStatusOnline(auth.currentUser.uid);
    } else {
        btnPerfil.innerText = "🔄 Virar Prestador";
        document.getElementById('servicos-cliente').classList.remove('hidden');
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
    }

    // --- ADMIN CHECK (SÓ VOCÊ) ---
    if(userProfile.email === "contatogilborges@gmail.com") {
        tabAdmin.classList.remove('hidden');
    }

    inicializarModuloServicos();
}

async function verificarStatusOnline(uid) {
    try {
        const snap = await getDoc(doc(db, "active_providers", uid));
        if(snap.exists()) {
            document.getElementById('online-toggle').checked = snap.data().is_online;
        }
    } catch(e) { console.log("Erro check online", e); }
}

function logout() {
    signOut(auth).then(() => location.reload());
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if(snap.exists()) {
            userProfile = snap.data();
            direcionarUsuario();
        } else {
            await signOut(auth);
            location.reload();
        }
    } else {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    }
});
