import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// Login com Google
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));

// Logout seguro
window.logout = () => signOut(auth).then(() => location.reload());

// Definição de Perfil Inicial
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        is_provider: tipo === 'prestador', 
        perfil_completo: true 
    });
    location.reload();
};

// Troca de Contexto
window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    btn.innerText = "🔄 Trocando...";
    btn.disabled = true;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        });
        // O onSnapshot vai pegar a mudança e recarregar, mas forçamos para garantir
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        alert("Erro: " + error.message);
        btn.disabled = false;
    }
};

// --- NOVA FUNÇÃO: UPLOAD DE FOTO DE PERFIL ---
window.uploadFotoPerfil = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const user = auth.currentUser;
    if (!user) return;

    // 1. Mostra Loading
    const overlay = document.getElementById('upload-overlay');
    if(overlay) overlay.classList.remove('hidden');

    try {
        // 2. Cria referência no Storage: perfil/UID/foto.jpg
        const storageRef = ref(storage, `perfil/${user.uid}/foto_perfil.jpg`);
        
        // 3. Faz o Upload
        await uploadBytes(storageRef, file);
        
        // 4. Pega o Link da imagem
        const downloadURL = await getDownloadURL(storageRef);

        // 5. Atualiza no Auth (Sessão atual)
        await updateProfile(user, { photoURL: downloadURL });

        // 6. Atualiza no Firestore (Perfil do Usuário)
        await updateDoc(doc(db, "usuarios", user.uid), { photoURL: downloadURL });

        // 7. Se for prestador, atualiza no Radar também (Active Providers)
        // Isso garante que o cliente veja a foto nova imediatamente na lista
        const activeRef = doc(db, "active_providers", user.uid);
        const activeSnap = await getDoc(activeRef);
        if (activeSnap.exists()) {
            await updateDoc(activeRef, { foto_perfil: downloadURL });
        }

        // 8. Atualiza visualmente agora (sem recarregar)
        document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => {
            img.src = downloadURL;
        });

        alert("✅ Foto de perfil atualizada com sucesso!");

    } catch (error) {
        console.error("Erro no upload:", error);
        alert("Erro ao atualizar foto. Tente novamente.\n(Verifique se é uma imagem leve).");
    } finally {
        if(overlay) overlay.classList.add('hidden');
        input.value = ""; // Limpa o input para permitir enviar a mesma foto se quiser
    }
};

// Monitor de Autenticação
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
                // Sincronia básica de dados do Google se mudarem
                if ((user.photoURL && user.photoURL !== userProfile.photoURL && !userProfile.photoURL.includes('firebasestorage')) || user.displayName !== userProfile.displayName) {
                    await updateDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL });
                }
                atualizarInterface(user);
                if (userProfile.is_provider) { verificarPendenciaPerfil(); }
            }
        });
    } else {
        mostrarLogin();
    }
});

function verificarPendenciaPerfil() {
    if (userProfile && !userProfile.setup_profissional_ok) {
        const modal = document.getElementById('provider-setup-modal');
        if(modal && !modal.classList.contains('hidden')) return; // Já está aberto
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

    // Configuração Admin
    if(isAdmin) {
        document.getElementById('tab-admin').classList.remove('hidden');
    } else {
        const adminTab = document.getElementById('tab-admin');
        const adminSec = document.getElementById('sec-admin');
        if(adminTab) adminTab.classList.add('hidden');
        if(adminSec) adminSec.classList.add('hidden');
    }

    // Configuração Visual Baseada no Perfil (Provider vs Client)
    if (userProfile.is_provider) {
        btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Prestador)</span> 🔄`
            : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        // Exibe abas de prestador
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.remove('hidden'); 
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-ganhar').classList.remove('hidden');  
        document.getElementById('tab-loja').classList.add('hidden');    
        
        document.getElementById('status-toggle-container').classList.remove('hidden');
        document.getElementById('servicos-prestador').classList.remove('hidden');
        document.getElementById('servicos-cliente').classList.add('hidden');
        
        // Se não estiver em nenhuma aba, vai para serviços
        if (!document.querySelector('nav button.border-blue-600')) window.switchTab('servicos'); 

    } else {
        btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Cliente)</span> 🔄`
            : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
            
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";
        
        // Exibe abas de cliente
        document.getElementById('tab-servicos').classList.remove('hidden');
        document.getElementById('tab-oportunidades').classList.remove('hidden');
        document.getElementById('tab-loja').classList.remove('hidden');
        document.getElementById('tab-missoes').classList.add('hidden');    
        document.getElementById('tab-ganhar').classList.add('hidden');       
        
        document.getElementById('status-toggle-container').classList.add('hidden');
        document.getElementById('servicos-prestador').classList.add('hidden');
        document.getElementById('servicos-cliente').classList.remove('hidden');
        
        if (!document.querySelector('nav button.border-blue-600')) window.switchTab('servicos');
    }
}
