import { auth, db, provider } from './app.js';
import { signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const storage = getStorage();
const ADMIN_EMAILS = ["contatogilborges@gmail.com"];
const DEFAULT_TENANT = "atlivio_fsa_01";
export let userProfile = null;

// --- LOGIN / LOGOUT ---
window.loginGoogle = () => signInWithPopup(auth, provider).catch(e => {
    alert("Erro no login: " + e.message);
    console.error(e);
});

window.logout = () => signOut(auth).then(() => location.reload());

// --- GESTÃO DE PERFIL ---
window.definirPerfil = async (tipo) => {
    if(!auth.currentUser) return;
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: tipo === 'prestador', 
            perfil_completo: true 
        });
        location.reload();
    } catch(e) {
        alert("Erro ao salvar perfil: " + e.message);
    }
};

window.alternarPerfil = async () => {
    if(!userProfile) return;
    const btn = document.getElementById('btn-trocar-perfil');
    if(btn) {
        btn.innerText = "🔄 Trocando...";
        btn.disabled = true;
    }
    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { 
            is_provider: !userProfile.is_provider 
        });
        // Força recarregamento para aplicar mudanças limpas
        setTimeout(() => location.reload(), 500);
    } catch (error) {
        alert("Erro: " + error.message);
        if(btn) btn.disabled = false;
    }
};

// --- UPLOAD DE FOTO (COM TRATAMENTO DE ERRO) ---
window.uploadFotoPerfil = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const user = auth.currentUser;
    if (!user) return;

    const overlay = document.getElementById('upload-overlay');
    if(overlay) overlay.classList.remove('hidden');

    try {
        const storageRef = ref(storage, `perfil/${user.uid}/foto_perfil.jpg`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        // Atualiza tudo em paralelo
        const promises = [
            updateProfile(user, { photoURL: downloadURL }),
            updateDoc(doc(db, "usuarios", user.uid), { photoURL: downloadURL })
        ];

        // Tenta atualizar active_providers se existir (sem travar se não existir)
        const activeRef = doc(db, "active_providers", user.uid);
        getDoc(activeRef).then(snap => {
            if(snap.exists()) updateDoc(activeRef, { foto_perfil: downloadURL });
        });

        await Promise.all(promises);

        // Atualiza visual
        document.querySelectorAll('img[id$="-pic"], #header-user-pic, #provider-header-pic').forEach(img => {
            img.src = downloadURL;
        });

        alert("✅ Foto atualizada!");

    } catch (error) {
        console.error("Erro upload:", error);
        alert("Não foi possível atualizar a foto. Verifique se o arquivo é uma imagem válida.");
    } finally {
        if(overlay) overlay.classList.add('hidden');
        input.value = "";
    }
};

// --- NÚCLEO DE AUTENTICAÇÃO (BLINDADO) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuário detectado -> Garante que a tela de login suma
        const authContainer = document.getElementById('auth-container');
        if(authContainer) authContainer.classList.add('hidden');

        const userRef = doc(db, "usuarios", user.uid);
        
        onSnapshot(userRef, async (docSnap) => {
            try {
                if(!docSnap.exists()) {
                    // Criação inicial
                    const roleInicial = ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user';
                    userProfile = { 
                        email: user.email, 
                        displayName: user.displayName, 
                        photoURL: user.photoURL,       
                        tenant_id: DEFAULT_TENANT, 
                        perfil_completo: false, 
                        role: roleInicial, 
                        saldo: 0, 
                        is_provider: false,
                        created_at: new Date()
                    };
                    await setDoc(userRef, userProfile);
                } else {
                    userProfile = docSnap.data();
                    
                    // Sincronia de foto (silenciosa)
                    if ((user.photoURL && user.photoURL !== userProfile.photoURL && !userProfile.photoURL.includes('firebasestorage'))) {
                        updateDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL }).catch(()=>{});
                    }
                    
                    // Lança a interface
                    iniciarAppLogado(user);
                    
                    // Verifica setup do prestador (se necessário)
                    if (userProfile.is_provider && !userProfile.setup_profissional_ok) {
                        const modal = document.getElementById('provider-setup-modal');
                        if(modal) {
                            modal.classList.remove('hidden');
                            const inputNome = document.getElementById('setup-name');
                            if(inputNome && !inputNome.value) inputNome.value = user.displayName || "";
                        }
                    }
                }
            } catch (err) {
                console.error("Erro crítico no perfil:", err);
                // Em caso de erro de dados, tenta carregar a app mesmo assim para não travar no login
                iniciarAppLogado(user); 
            }
        });
    } else {
        // Sem usuário -> Mostra Login
        mostrarLogin();
    }
});

function mostrarLogin() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function iniciarAppLogado(user) {
    // 1. Esconde Login e Seleção
    document.getElementById('auth-container').classList.add('hidden');
    
    // 2. Verifica se perfil está completo
    if(!userProfile || !userProfile.perfil_completo) {
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('role-selection').classList.remove('hidden');
        return;
    }

    document.getElementById('role-selection').classList.add('hidden');
    const appContainer = document.getElementById('app-container');
    appContainer.classList.remove('hidden'); // Garante que o app apareça
    
    // 3. Configurações de UI
    const btnPerfil = document.getElementById('btn-trocar-perfil');
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const tabServicos = document.getElementById('tab-servicos');
    const adminTab = document.getElementById('tab-admin');
    const adminSec = document.getElementById('sec-admin');

    // 4. SEGURANÇA: Controle da Aba Admin
    if(isAdmin) {
        if(adminTab) adminTab.classList.remove('hidden');
    } else {
        if(adminTab) adminTab.classList.add('hidden');
        if(adminSec) adminSec.classList.add('hidden');
    }

    // 5. Configuração Visual Baseada no Perfil
    if (userProfile.is_provider) {
        // PRESTADOR
        if(btnPerfil) btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Prestador)</span> 🔄`
            : `Sou: <span class="text-blue-600">PRESTADOR</span> 🔄`;
        
        if(tabServicos) tabServicos.innerText = "Serviços 🛠️";
        
        mostrarElemento('tab-servicos');
        mostrarElemento('tab-missoes');
        mostrarElemento('tab-oportunidades');
        mostrarElemento('tab-ganhar');
        esconderElemento('tab-loja');
        
        mostrarElemento('status-toggle-container');
        mostrarElemento('servicos-prestador');
        esconderElemento('servicos-cliente');
        
        // Garante aba inicial se nenhuma estiver ativa
        if (!document.querySelector('nav button.border-blue-600') && window.switchTab) {
            window.switchTab('servicos'); 
        }

    } else {
        // CLIENTE
        if(btnPerfil) btnPerfil.innerHTML = isAdmin 
            ? `🛡️ <span class="text-red-600 font-black">ADMIN</span> <span class="text-[8px] text-gray-400">(Visão Cliente)</span> 🔄`
            : `Sou: <span class="text-green-600">CLIENTE</span> 🔄`;
            
        if(tabServicos) tabServicos.innerText = "Contratar Serviço 🛠️";
        
        mostrarElemento('tab-servicos');
        mostrarElemento('tab-oportunidades');
        mostrarElemento('tab-loja');
        esconderElemento('tab-missoes');
        esconderElemento('tab-ganhar');
        
        esconderElemento('status-toggle-container');
        esconderElemento('servicos-prestador');
        mostrarElemento('servicos-cliente');
        
        if (!document.querySelector('nav button.border-blue-600') && window.switchTab) {
            window.switchTab('servicos');
        }
    }
}

// Helpers para evitar erro se elemento não existir
function mostrarElemento(id) {
    const el = document.getElementById(id);
    if(el) el.classList.remove('hidden');
}
function esconderElemento(id) {
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden');
}
